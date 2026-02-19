import { Hono } from 'hono'
import type { Env } from '../index'

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
  }

  return c.json({ ok: true })
})

export default webhook
