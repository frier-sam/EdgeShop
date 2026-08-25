import { Hono } from 'hono'
import type { Env } from '../index'
import type { OrderItem } from '../types'
import { sendEmail } from '../lib/email'
import { orderConfirmationHtml, newOrderAlertHtml } from '../lib/emailTemplates'
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'

const checkout = new Hono<{ Bindings: Env }>()

async function getCustomerIdFromHeader(authHeader: string, db: D1Database): Promise<number | null> {
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null
  try {
    const secret = await getOrCreateJwtSecret(db)
    const payload = await verifyJWT(token, secret)
    if (!payload || typeof payload.sub !== 'number') return null
    return payload.sub
  } catch {
    return null
  }
}

// NOTE: pricing here is still fully client-trusted, carried forward from v1.
// Phase 7 (POD.md §7.3) replaces this with full server-side recomputation
// from products/product_sides/product_sizes/designs and rejects mismatches.
// This function is scoped to Phase 3: make checkout compile and behave
// sanely against the new schema, not fix that flaw.
async function validateStock(
  db: D1Database,
  items: OrderItem[]
): Promise<Array<{ id: number; name: string; available: number }> | null> {
  if (!items.length) return null
  const insufficient: Array<{ id: number; name: string; available: number }> = []

  for (const item of items) {
    if (item.size) {
      // Sized product — stock lives on product_sizes for that label.
      const sizeRow = await db.prepare(
        'SELECT stock_count FROM product_sizes WHERE product_id = ? AND label = ?'
      ).bind(item.product_id, item.size).first<{ stock_count: number }>()
      if (!sizeRow) {
        insufficient.push({ id: item.product_id, name: item.name, available: 0 })
      } else if (item.quantity > sizeRow.stock_count) {
        insufficient.push({ id: item.product_id, name: item.name, available: sizeRow.stock_count })
      }
    } else {
      // Sizeless product — stock lives on products.stock_count.
      const product = await db.prepare(
        'SELECT id, name, stock_count FROM products WHERE id = ?'
      ).bind(item.product_id).first<{ id: number; name: string; stock_count: number }>()
      if (!product) {
        insufficient.push({ id: item.product_id, name: item.name, available: 0 })
      } else if (item.quantity > product.stock_count) {
        insufficient.push({ id: product.id, name: product.name, available: product.stock_count })
      }
    }
  }
  return insufficient.length > 0 ? insufficient : null
}

export async function decrementStock(db: D1Database, items: OrderItem[]): Promise<void> {
  const stmts = items.map((item) =>
    item.size
      ? db.prepare(
          'UPDATE product_sizes SET stock_count = MAX(0, stock_count - ?) WHERE product_id = ? AND label = ?'
        ).bind(item.quantity, item.product_id, item.size)
      : db.prepare(
          'UPDATE products SET stock_count = MAX(0, stock_count - ?) WHERE id = ?'
        ).bind(item.quantity, item.product_id)
  )
  if (stmts.length > 0) await db.batch(stmts)
}

checkout.post('/', async (c) => {
  const body = await c.req.json<{
    customer_name: string
    customer_email: string
    customer_phone: string
    shipping_address: string
    shipping_city?: string
    shipping_state?: string
    shipping_pincode?: string
    shipping_country?: string
    payment_method: 'razorpay' | 'cod'
    items: OrderItem[]
    total_amount: number
    shipping_amount: number
  }>()

  // Basic validation
  if (!body.customer_name || !body.customer_email || !body.shipping_address) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  if (!['razorpay', 'cod'].includes(body.payment_method)) {
    return c.json({ error: 'Invalid payment_method' }, 400)
  }

  const orderId = `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const shippingAmount = body.shipping_amount ?? 0
  const totalAmount = body.total_amount ?? 0
  // Legacy client payload carries no side/print-fee breakdown — the whole
  // pre-shipping amount is treated as subtotal until Phase 7 recomputes
  // this server-side from products/sides/sizes/designs.
  const subtotal = Math.max(0, totalAmount - shippingAmount)
  const printTotal = 0

  if (body.payment_method === 'cod') {
    // Stock check — must happen before INSERT
    const stockIssues = await validateStock(c.env.DB, body.items)
    if (stockIssues) {
      return c.json({ error: 'stock_error', items: stockIssues }, 400)
    }

    await c.env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
        items_json, subtotal, print_total, shipping_amount, total_amount,
        payment_method, payment_status, order_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'placed')
    `).bind(
      orderId,
      body.customer_name,
      body.customer_email,
      body.customer_phone ?? '',
      body.shipping_address,
      body.shipping_city ?? '',
      body.shipping_state ?? '',
      body.shipping_pincode ?? '',
      body.shipping_country ?? 'India',
      JSON.stringify(body.items),
      subtotal,
      printTotal,
      shippingAmount,
      totalAmount
    ).run()

    // Link order to customer if logged in
    const authHeaderCod = c.req.header('Authorization') ?? ''
    const customerIdCod = await getCustomerIdFromHeader(authHeaderCod, c.env.DB)
    if (customerIdCod !== null) {
      await c.env.DB.prepare('UPDATE orders SET customer_id = ? WHERE id = ?')
        .bind(customerIdCod, orderId).run()
    }

    // Decrement stock for each ordered item (COD orders are immediately confirmed)
    await decrementStock(c.env.DB, body.items)

    // Wrap all email logic so any failure doesn't break the order response
    try {
      // Fetch email settings
      const emailRows = await c.env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','merchant_email')"
      ).all<{ key: string; value: string }>()
      const eCfg: Record<string, string> = {}
      for (const row of emailRows.results) eCfg[row.key] = row.value

      // Send order confirmation to customer
      try {
        await sendEmail(
          {
            to: body.customer_email,
            subject: `Order ${orderId} Confirmed`,
            html: orderConfirmationHtml({
              id: orderId,
              customer_name: body.customer_name,
              items_json: JSON.stringify(body.items),
              total_amount: totalAmount,
              payment_method: 'cod',
              shipping_address: body.shipping_address,
            }),
          },
          { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
        )
      } catch { /* non-fatal — order already placed */ }

      // Send new order alert to merchant
      if (eCfg.merchant_email) {
        try {
          await sendEmail(
            {
              to: eCfg.merchant_email,
              subject: `New Order: ${orderId}`,
              html: newOrderAlertHtml({
                id: orderId,
                customer_name: body.customer_name,
                customer_email: body.customer_email,
                total_amount: totalAmount,
                payment_method: 'cod',
              }),
            },
            { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
          )
        } catch { /* non-fatal — order already placed */ }
      }
    } catch (err) {
      console.error('COD confirmation email failed:', err)
    }

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

  // Stock check before creating Razorpay order
  const rzpStockIssues = await validateStock(c.env.DB, body.items)
  if (rzpStockIssues) {
    return c.json({ error: 'stock_error', items: rzpStockIssues }, 400)
  }

  const authHeader = 'Basic ' + btoa(`${cfg.razorpay_key_id}:${cfg.razorpay_key_secret}`)
  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      amount: Math.round(totalAmount * 100),
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
      shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
      items_json, subtotal, print_total, shipping_amount, total_amount,
      payment_method, payment_status, order_status, razorpay_order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'razorpay', 'pending', 'placed', ?)
  `).bind(
    orderId,
    body.customer_name,
    body.customer_email,
    body.customer_phone ?? '',
    body.shipping_address,
    body.shipping_city ?? '',
    body.shipping_state ?? '',
    body.shipping_pincode ?? '',
    body.shipping_country ?? 'India',
    JSON.stringify(body.items),
    subtotal,
    printTotal,
    shippingAmount,
    totalAmount,
    rzpOrder.id
  ).run()

  // Link order to customer if logged in
  const authHeaderRzp = c.req.header('Authorization') ?? ''
  const customerIdRzp = await getCustomerIdFromHeader(authHeaderRzp, c.env.DB)
  if (customerIdRzp !== null) {
    await c.env.DB.prepare('UPDATE orders SET customer_id = ? WHERE id = ?')
      .bind(customerIdRzp, orderId).run()
  }

  return c.json({
    order_id: orderId,
    razorpay_order_id: rzpOrder.id,
    razorpay_key_id: cfg.razorpay_key_id,
    payment_method: 'razorpay',
  }, 201)
})

export default checkout
