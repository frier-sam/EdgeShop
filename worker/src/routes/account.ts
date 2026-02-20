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

// Helper to extract and verify customer from Authorization header
async function requireAuth(authHeader: string, db: D1Database): Promise<number | null> {
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null
  const secret = await getOrCreateJwtSecret(db)
  const payload = await verifyJWT(token, secret)
  if (!payload || typeof payload.sub !== 'number') return null
  return payload.sub
}

// GET /api/account/profile
account.get('/profile', async (c) => {
  const customerId = await requireAuth(c.req.header('Authorization') ?? '', c.env.DB)
  if (!customerId) return c.json({ error: 'Unauthorized' }, 401)

  const customer = await c.env.DB.prepare(
    'SELECT id, name, email, phone FROM customers WHERE id = ?'
  ).bind(customerId).first<{ id: number; name: string; email: string; phone: string }>()

  if (!customer) return c.json({ error: 'Not found' }, 404)
  return c.json(customer)
})

// PUT /api/account/profile — update name and/or phone
account.put('/profile', async (c) => {
  const customerId = await requireAuth(c.req.header('Authorization') ?? '', c.env.DB)
  if (!customerId) return c.json({ error: 'Unauthorized' }, 401)

  let body: { name?: string; phone?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid JSON' }, 400) }

  const updates: string[] = []
  const values: unknown[] = []
  if (typeof body.name === 'string') { updates.push('name = ?'); values.push(body.name.trim()) }
  if (typeof body.phone === 'string') { updates.push('phone = ?'); values.push(body.phone.trim()) }
  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400)

  await c.env.DB.prepare(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values, customerId).run()

  return c.json({ ok: true })
})

// GET /api/account/addresses
account.get('/addresses', async (c) => {
  const customerId = await requireAuth(c.req.header('Authorization') ?? '', c.env.DB)
  if (!customerId) return c.json({ error: 'Unauthorized' }, 401)

  const { results } = await c.env.DB.prepare(
    'SELECT id, label, address_line, city, state, postal_code, country FROM customer_addresses WHERE customer_id = ? ORDER BY id DESC'
  ).bind(customerId).all()

  return c.json({ addresses: results })
})

export default account
