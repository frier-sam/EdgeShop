import { Hono } from 'hono'
import type { Env } from '../index'
import type { OrderItem } from '../types'
import { sendEmail } from '../lib/email'
import { orderConfirmationHtml, newOrderAlertHtml } from '../lib/emailTemplates'
import { createDownloadToken, verifyJWT, getOrCreateJwtSecret } from '../lib/auth'

async function logOrderEmail(db: D1Database, orderId: string, type: string, recipient: string, subject: string, status: 'sent' | 'failed') {
  await db.prepare(
    'INSERT INTO order_emails (order_id, type, recipient, subject, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(orderId, type, recipient, subject, status).run().catch(() => {/* non-fatal */})
}

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
    discount_code: string
    discount_amount: number
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

  if (body.payment_method === 'cod') {
    await c.env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
        total_amount, payment_method, payment_status,
        order_status, items_json, discount_code, discount_amount, shipping_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'placed', ?, ?, ?, ?)
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
      body.total_amount,
      JSON.stringify(body.items),
      body.discount_code ?? '',
      body.discount_amount ?? 0,
      body.shipping_amount ?? 0
    ).run()

    // Link order to customer if logged in
    const authHeaderCod = c.req.header('Authorization') ?? ''
    const customerIdCod = await getCustomerIdFromHeader(authHeaderCod, c.env.DB)
    if (customerIdCod !== null) {
      await c.env.DB.prepare('UPDATE orders SET customer_id = ? WHERE id = ?')
        .bind(customerIdCod, orderId).run()
      // Save shipping address to customer_addresses
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO customer_addresses (customer_id, label, address_line, city, state, pincode, country) VALUES (?, 'Shipping', ?, ?, ?, ?, ?)"
      ).bind(customerIdCod, body.shipping_address, body.shipping_city ?? '', body.shipping_state ?? '', body.shipping_pincode ?? '', body.shipping_country ?? 'India').run()
    }

    if (body.discount_code) {
      await c.env.DB.prepare(
        'UPDATE discount_codes SET uses_count = uses_count + 1 WHERE code = ? COLLATE NOCASE'
      ).bind(body.discount_code).run()
    }

    // Decrement stock for each ordered item (COD orders are immediately confirmed)
    const stockStmts = body.items.map(item =>
      c.env.DB.prepare(
        'UPDATE products SET stock_count = MAX(0, stock_count - ?) WHERE id = ?'
      ).bind(item.quantity, item.product_id)
    )
    if (stockStmts.length > 0) {
      await c.env.DB.batch(stockStmts)
    }

    // Wrap all email logic so any failure doesn't break the order response
    try {
      // Fetch email settings
      const emailRows = await c.env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','merchant_email')"
      ).all<{ key: string; value: string }>()
      const eCfg: Record<string, string> = {}
      for (const row of emailRows.results) eCfg[row.key] = row.value

      // Send order confirmation to customer
      const confirmSubject = `Order ${orderId} Confirmed`
      let confirmStatus: 'sent' | 'failed' = 'sent'
      try {
        await sendEmail(
          {
            to: body.customer_email,
            subject: confirmSubject,
            html: orderConfirmationHtml({
              id: orderId,
              customer_name: body.customer_name,
              items_json: JSON.stringify(body.items),
              total_amount: body.total_amount,
              payment_method: 'cod',
              shipping_address: body.shipping_address,
            }),
          },
          { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
        )
      } catch { confirmStatus = 'failed' }
      await logOrderEmail(c.env.DB, orderId, 'order_confirmation', body.customer_email, confirmSubject, confirmStatus)

      // Send new order alert to merchant
      if (eCfg.merchant_email) {
        const alertSubject = `New Order: ${orderId}`
        let alertStatus: 'sent' | 'failed' = 'sent'
        try {
          await sendEmail(
            {
              to: eCfg.merchant_email,
              subject: alertSubject,
              html: newOrderAlertHtml({
                id: orderId,
                customer_name: body.customer_name,
                customer_email: body.customer_email,
                total_amount: body.total_amount,
                payment_method: 'cod',
              }),
            },
            { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
          )
        } catch { alertStatus = 'failed' }
        await logOrderEmail(c.env.DB, orderId, 'new_order_alert', eCfg.merchant_email, alertSubject, alertStatus)
      }
    } catch (err) {
      console.error('COD confirmation email failed:', err)
    }

    // Generate download tokens for digital items
    const items = body.items as Array<{ product_id: number; quantity: number }>
    const productIds = items.map(i => i.product_id)
    const downloadTokens: Record<number, string> = {}

    if (productIds.length > 0) {
      const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
      if (!secretRow?.value) {
        console.warn('jwt_secret not configured — digital download tokens not generated')
      } else {
        for (const productId of productIds) {
          const product = await c.env.DB.prepare(
            "SELECT product_type FROM products WHERE id = ? AND product_type = 'digital'"
          ).bind(productId).first<{ product_type: string }>()
          if (product) {
            downloadTokens[productId] = await createDownloadToken(orderId, productId, secretRow.value)
          }
        }
      }
    }

    return c.json({ order_id: orderId, payment_method: 'cod', ...(Object.keys(downloadTokens).length > 0 ? { download_tokens: downloadTokens } : {}) }, 201)
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
      shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
      total_amount, payment_method, payment_status,
      order_status, razorpay_order_id, items_json, discount_code, discount_amount, shipping_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'razorpay', 'pending', 'placed', ?, ?, ?, ?, ?)
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
    body.total_amount,
    rzpOrder.id,
    JSON.stringify(body.items),
    body.discount_code ?? '',
    body.discount_amount ?? 0,
    body.shipping_amount ?? 0
  ).run()

  // Link order to customer if logged in
  const authHeaderRzp = c.req.header('Authorization') ?? ''
  const customerIdRzp = await getCustomerIdFromHeader(authHeaderRzp, c.env.DB)
  if (customerIdRzp !== null) {
    await c.env.DB.prepare('UPDATE orders SET customer_id = ? WHERE id = ?')
      .bind(customerIdRzp, orderId).run()
    // Save shipping address to customer_addresses
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO customer_addresses (customer_id, label, address_line, city, state, pincode, country) VALUES (?, 'Shipping', ?, ?, ?, ?, ?)"
    ).bind(customerIdRzp, body.shipping_address, body.shipping_city ?? '', body.shipping_state ?? '', body.shipping_pincode ?? '', body.shipping_country ?? 'India').run()
  }

  return c.json({
    order_id: orderId,
    razorpay_order_id: rzpOrder.id,
    razorpay_key_id: cfg.razorpay_key_id,
    payment_method: 'razorpay',
  }, 201)
})

export default checkout
