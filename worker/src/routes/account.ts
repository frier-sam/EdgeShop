import { Hono } from 'hono'
import type { Env } from '../index'
import { verifyJWT } from '../lib/auth'

const account = new Hono<{ Bindings: Env }>()

account.get('/orders', async (c) => {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  if (!secretRow?.value) return c.json({ error: 'Auth service not configured' }, 500)

  const payload = await verifyJWT(token, secretRow.value)
  if (!payload) return c.json({ error: 'Unauthorized' }, 401)

  const customerId = payload.sub as number
  const { results } = await c.env.DB.prepare(
    'SELECT id, total_amount, order_status, payment_status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC'
  ).bind(customerId).all<{ id: string; total_amount: number; order_status: string; payment_status: string; created_at: string }>()

  return c.json({ orders: results })
})

export default account
