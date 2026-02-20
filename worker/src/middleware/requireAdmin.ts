import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'

export async function requireAdmin(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = await getOrCreateJwtSecret(c.env.DB)
    const payload = await verifyJWT(token, secret)
    if (!payload || (payload.role !== 'staff' && payload.role !== 'super_admin')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export async function requireSuperAdmin(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = await getOrCreateJwtSecret(c.env.DB)
    const payload = await verifyJWT(token, secret)
    if (!payload || payload.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
