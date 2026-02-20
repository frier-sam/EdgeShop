import { Hono } from 'hono'
import type { Env } from '../index'
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'

const account = new Hono<{ Bindings: Env }>()

account.get('/orders', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const secret = await getOrCreateJwtSecret(c.env.DB)
  const payload = await verifyJWT(token, secret)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const customerId = payload.sub
  if (typeof customerId !== 'number') return c.json({ error: 'Unauthorized' }, 401)
  const { results } = await c.env.DB.prepare(
    'SELECT id, total_amount, order_status, payment_status, created_at, items_json, tracking_number FROM orders WHERE customer_id = ? ORDER BY created_at DESC'
  ).bind(customerId).all<{ id: string; total_amount: number; order_status: string; payment_status: string; created_at: string; items_json: string; tracking_number: string | null }>()

  return c.json({ orders: results })
})

export default account
