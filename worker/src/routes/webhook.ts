import { Hono } from 'hono'
import type { Env } from '../index'
import { sendEmail } from '../lib/email'
import { orderConfirmationHtml, newOrderAlertHtml } from '../lib/emailTemplates'

const webhook = new Hono<{ Bindings: Env }>()

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0)
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const sigBytes = hexToBytes(signature)
    if (sigBytes.length === 0) return false
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
  } catch {
    return false
  }
}

webhook.post('/razorpay', async (c) => {
  const signature = c.req.header('x-razorpay-signature') ?? ''
  const rawBody = await c.req.text()
  const secret = c.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret) {
    return c.json({ error: 'Webhook secret not configured' }, 503)
  }

  const valid = await verifyRazorpaySignature(rawBody, signature, secret)
  if (!valid) return c.json({ error: 'Invalid signature' }, 401)

  const event = JSON.parse(rawBody) as {
    event: string
    payload: { payment: { entity: { order_id: string; id: string } } }
  }

  if (event.event === 'payment.captured') {
    const { order_id, id: payment_id } = event.payload.payment.entity
    await c.env.DB.prepare(`
      UPDATE orders
      SET payment_status = 'paid', razorpay_payment_id = ?
      WHERE razorpay_order_id = ?
    `).bind(payment_id, order_id).run()

    // Fetch order for email and discount processing
    const order = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE razorpay_order_id = ?'
    ).bind(order_id).first<{
      id: string; customer_name: string; customer_email: string;
      items_json: string; total_amount: number; shipping_address: string; payment_method: string;
      discount_code: string
    }>()

    if (order) {
      // Increment discount code usage if applicable
      if (order.discount_code) {
        await c.env.DB.prepare(
          'UPDATE discount_codes SET uses_count = uses_count + 1 WHERE code = ? COLLATE NOCASE'
        ).bind(order.discount_code).run()
      }

      // Decrement stock now that payment is confirmed (not at order creation, to avoid
      // reducing stock for abandoned Razorpay sessions)
      try {
        const items = JSON.parse(order.items_json) as Array<{ product_id: number; quantity: number }>
        const stockStmts = items.map(item =>
          c.env.DB.prepare(
            'UPDATE products SET stock_count = MAX(0, stock_count - ?) WHERE id = ?'
          ).bind(item.quantity, item.product_id)
        )
        if (stockStmts.length > 0) {
          await c.env.DB.batch(stockStmts)
        }
      } catch (err) {
        console.error('Stock decrement failed for order:', order.id, err)
      }

      try {
        const emailRows = await c.env.DB.prepare(
          "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','merchant_email')"
        ).all<{ key: string; value: string }>()
        const eCfg: Record<string, string> = {}
        for (const row of emailRows.results) eCfg[row.key] = row.value

        // Confirmation to customer
        await sendEmail(
          {
            to: order.customer_email,
            subject: `Order ${order.id} Confirmed`,
            html: orderConfirmationHtml({
              id: order.id,
              customer_name: order.customer_name,
              items_json: order.items_json,
              total_amount: order.total_amount,
              payment_method: order.payment_method,
              shipping_address: order.shipping_address,
            }),
          },
          { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
        )

        // Alert to merchant
        if (eCfg.merchant_email) {
          await sendEmail(
            {
              to: eCfg.merchant_email,
              subject: `New Order: ${order.id}`,
              html: newOrderAlertHtml({
                id: order.id,
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                total_amount: order.total_amount,
                payment_method: order.payment_method,
              }),
            },
            { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
          )
        }
      } catch (err) {
        console.error('Webhook confirmation email failed:', err)
      }
    }
  }

  return c.json({ ok: true })
})

export default webhook
