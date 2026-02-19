import { Hono } from 'hono'
import type { Env } from '../index'
import type { OrderItem } from '../types'

const checkout = new Hono<{ Bindings: Env }>()

checkout.post('/', async (c) => {
  const body = await c.req.json<{
    customer_name: string
    customer_email: string
    customer_phone: string
    shipping_address: string
    payment_method: 'razorpay' | 'cod'
    items: OrderItem[]
    total_amount: number
  }>()

  // Basic validation
  if (!body.customer_name || !body.customer_email || !body.shipping_address) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  if (!['razorpay', 'cod'].includes(body.payment_method)) {
    return c.json({ error: 'Invalid payment_method' }, 400)
  }

  const orderId = `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

  if (body.payment_method === 'cod') {
    await c.env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone,
        shipping_address, total_amount, payment_method, payment_status,
        order_status, items_json)
      VALUES (?, ?, ?, ?, ?, ?, 'cod', 'pending', 'placed', ?)
    `).bind(
      orderId,
      body.customer_name,
      body.customer_email,
      body.customer_phone ?? '',
      body.shipping_address,
      body.total_amount,
      JSON.stringify(body.items)
    ).run()

    return c.json({ order_id: orderId, payment_method: 'cod' }, 201)
  }

  // Razorpay flow
  const settingsRows = await c.env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('razorpay_key_id', 'razorpay_key_secret')"
  ).all<{ key: string; value: string }>()
  const cfg: Record<string, string> = {}
  for (const row of settingsRows.results) cfg[row.key] = row.value

  if (!cfg.razorpay_key_id || !cfg.razorpay_key_secret) {
    return c.json({ error: 'Razorpay not configured' }, 503)
  }

  const authHeader = 'Basic ' + btoa(`${cfg.razorpay_key_id}:${cfg.razorpay_key_secret}`)
  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      amount: Math.round(body.total_amount * 100),
      currency: 'INR',
      receipt: orderId,
    }),
  })
  if (!rzpRes.ok) {
    return c.json({ error: 'Razorpay order creation failed' }, 502)
  }
  const rzpOrder = await rzpRes.json() as { id: string }

  await c.env.DB.prepare(`
    INSERT INTO orders (id, customer_name, customer_email, customer_phone,
      shipping_address, total_amount, payment_method, payment_status,
      order_status, razorpay_order_id, items_json)
    VALUES (?, ?, ?, ?, ?, ?, 'razorpay', 'pending', 'placed', ?, ?)
  `).bind(
    orderId,
    body.customer_name,
    body.customer_email,
    body.customer_phone ?? '',
    body.shipping_address,
    body.total_amount,
    rzpOrder.id,
    JSON.stringify(body.items)
  ).run()

  return c.json({
    order_id: orderId,
    razorpay_order_id: rzpOrder.id,
    razorpay_key_id: cfg.razorpay_key_id,
    payment_method: 'razorpay',
  }, 201)
})

export default checkout
