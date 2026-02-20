import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword, verifyPassword, createJWT, getOrCreateJwtSecret } from '../lib/auth'

const auth = new Hono<{ Bindings: Env }>()

auth.post('/register', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, password, name, phone } = body as { email?: string; password?: string; name?: string; phone?: string }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Valid email required' }, 400)
  }
  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }
  if (password.length > 1024) {
    return c.json({ error: 'Password must be at most 1024 characters' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email.toLowerCase()).first()
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const password_hash = await hashPassword(password)
  const result = await c.env.DB.prepare(
    'INSERT INTO customers (email, password_hash, name, phone) VALUES (?, ?, ?, ?)'
  ).bind(email.toLowerCase(), password_hash, name ?? '', phone ?? '').run()

  if (!result.meta.last_row_id) {
    return c.json({ error: 'Registration failed' }, 500)
  }

  const secret = await getOrCreateJwtSecret(c.env.DB)
  const token = await createJWT({ sub: result.meta.last_row_id, email: email.toLowerCase() }, secret)

  return c.json({ token, customer_id: result.meta.last_row_id, name: (name as string) ?? '' }, 201)
})

auth.post('/login', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { email, password } = body as { email?: string; password?: string }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return c.json({ error: 'Email and password required' }, 400)
  }

  const customer = await c.env.DB.prepare(
    'SELECT id, email, password_hash, name FROM customers WHERE email = ?'
  ).bind(email.toLowerCase()).first<{ id: number; email: string; password_hash: string; name: string }>()
  if (!customer) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, customer.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const secret = await getOrCreateJwtSecret(c.env.DB)
  const token = await createJWT({ sub: customer.id, email: customer.email }, secret)

  return c.json({ token, customer_id: customer.id, name: customer.name })
})

export default auth
