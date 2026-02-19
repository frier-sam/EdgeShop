import { Hono } from 'hono'
import type { Env } from '../index'

const abandonedCart = new Hono<{ Bindings: Env }>()

abandonedCart.post('/save', async (c) => {
  let body: { email?: unknown; cart_json?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { email, cart_json } = body

  if (!email || typeof email !== 'string' || email.trim() === '') {
    return c.json({ error: 'email is required' }, 400)
  }
  if (!/.+@.+\..+/.test(email)) {
    return c.json({ error: 'email is invalid' }, 400)
  }
  if (!cart_json || typeof cart_json !== 'string' || cart_json.trim() === '') {
    return c.json({ error: 'cart_json is required' }, 400)
  }

  const updated = await c.env.DB.prepare(
    "UPDATE abandoned_carts SET cart_json = ?, created_at = datetime('now') WHERE email = ? AND recovery_sent = 0"
  ).bind(cart_json, email).run()

  if (updated.meta.changes === 0) {
    await c.env.DB.prepare(
      'INSERT INTO abandoned_carts (email, cart_json) VALUES (?, ?)'
    ).bind(email, cart_json).run()
  }

  return c.json({ ok: true })
})

export default abandonedCart
