import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword, verifyPassword, createJWT, getOrCreateJwtSecret } from '../lib/auth'
import { passwordResetHtml } from '../lib/emailTemplates'
import { sendEmail } from '../lib/email'
import { allPermissions } from '../lib/permissions'

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

  // Check if this was the first customer → auto super_admin
  const countBefore = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM customers WHERE id != ?')
    .bind(result.meta.last_row_id).first<{ cnt: number }>()
  const isFirst = (countBefore?.cnt ?? 0) === 0
  const role = isFirst ? 'super_admin' : 'customer'
  const permissions = isFirst ? allPermissions() : {}

  if (isFirst) {
    await c.env.DB.prepare("UPDATE customers SET role = 'super_admin' WHERE id = ?")
      .bind(result.meta.last_row_id).run()
  }

  const secret = await getOrCreateJwtSecret(c.env.DB)
  const token = await createJWT({
    sub: result.meta.last_row_id,
    email: email.toLowerCase(),
    role,
    permissions,
  }, secret)

  return c.json({ token, customer_id: result.meta.last_row_id, name: (name as string) ?? '', role, permissions }, 201)
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
    'SELECT id, email, password_hash, name, role, permissions_json FROM customers WHERE email = ?'
  ).bind(email.toLowerCase()).first<{ id: number; email: string; password_hash: string; name: string; role: string; permissions_json: string }>()
  if (!customer) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, customer.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  let permissions: Record<string, boolean> = {}
  try { permissions = JSON.parse(customer.permissions_json || '{}') } catch {}
  // super_admin always has all permissions
  if (customer.role === 'super_admin') permissions = allPermissions()

  const secret = await getOrCreateJwtSecret(c.env.DB)
  const token = await createJWT({
    sub: customer.id,
    email: customer.email,
    role: customer.role,
    permissions,
  }, secret)

  return c.json({ token, customer_id: customer.id, name: customer.name, role: customer.role, permissions })
})

auth.post('/forgot-password', async (c) => {
  let body: { email?: string }
  try { body = await c.req.json() } catch { return c.json({ ok: true }) }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  if (!email) return c.json({ ok: true }) // always 200 — don't leak whether email exists

  const customer = await c.env.DB.prepare(
    'SELECT id, name FROM customers WHERE email = ?'
  ).bind(email).first<{ id: number; name: string }>()

  if (!customer) return c.json({ ok: true }) // silent — don't leak existence

  const token = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour

  await c.env.DB.prepare(
    'UPDATE customers SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?'
  ).bind(token, expiresAt, customer.id).run()

  // Fire-and-forget email — silently skips if email not configured
  try {
    const emailRows = await c.env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address')"
    ).all<{ key: string; value: string }>()
    const eCfg: Record<string, string> = {}
    for (const row of emailRows.results) eCfg[row.key] = row.value

    const frontendUrl = new URL(c.req.url).origin
    const resetUrl = `${frontendUrl}/account/reset-password?token=${token}`

    await sendEmail(
      {
        to: email,
        subject: 'Reset your password',
        html: passwordResetHtml({ customer_name: customer.name || 'there', reset_url: resetUrl }),
      },
      { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
    )
  } catch {
    // Email not configured or failed — token is still saved, user can still reset
  }

  return c.json({ ok: true })
})

auth.post('/reset-password', async (c) => {
  let body: { token?: string; password?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid request' }, 400) }

  const { token, password } = body

  if (typeof token !== 'string' || !token) return c.json({ error: 'Invalid token' }, 400)
  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)
  const customer = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE reset_token = ? AND reset_token_expires_at > ?'
  ).bind(token, now).first<{ id: number }>()

  if (!customer) return c.json({ error: 'Token invalid or expired' }, 400)

  const password_hash = await hashPassword(password)
  await c.env.DB.prepare(
    'UPDATE customers SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?'
  ).bind(password_hash, customer.id).run()

  return c.json({ ok: true })
})

export default auth
