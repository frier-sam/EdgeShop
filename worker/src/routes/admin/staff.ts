import { Hono } from 'hono'
import type { Env } from '../../index'
import { PERMISSION_KEYS, allPermissions } from '../../lib/permissions'
import { requireSuperAdmin } from '../../middleware/requireAdmin'

const staff = new Hono<{ Bindings: Env }>()

// List all staff and super_admin accounts
staff.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, phone, role, permissions_json, created_at FROM customers WHERE role IN ('staff','super_admin') ORDER BY role DESC, created_at ASC"
  ).all<{ id: number; name: string; email: string; phone: string; role: string; permissions_json: string; created_at: string }>()

  const members = results.map(({ permissions_json, ...r }) => ({
    ...r,
    permissions: (() => {
      if (r.role === 'super_admin') return allPermissions()
      try { return JSON.parse(permissions_json || '{}') } catch { return {} }
    })(),
  }))

  return c.json({ staff: members })
})

// Search customers (for adding new staff)
staff.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (!q) return c.json({ customers: [] })
  const like = `%${q}%`
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, role FROM customers WHERE (name LIKE ? OR email LIKE ?) AND role = 'customer' LIMIT 10"
  ).bind(like, like).all<{ id: number; name: string; email: string; role: string }>()
  return c.json({ customers: results })
})

// Update a customer's role and permissions (super_admin only)
staff.put('/:id', requireSuperAdmin, async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  // Prevent modifying super_admin accounts
  const target = await c.env.DB.prepare('SELECT role FROM customers WHERE id = ?').bind(id).first<{ role: string }>()
  if (!target) return c.json({ error: 'Not found' }, 404)
  if (target.role === 'super_admin') return c.json({ error: 'Cannot modify super_admin' }, 403)

  let body: { role: 'staff' | 'customer'; permissions?: Record<string, boolean> }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const { role, permissions } = body
  if (!['staff', 'customer'].includes(role)) return c.json({ error: 'Invalid role' }, 400)

  const permissionsJson = role === 'staff'
    ? JSON.stringify(Object.fromEntries(PERMISSION_KEYS.map(k => [k, !!(permissions?.[k])])))
    : '{}'

  await c.env.DB.prepare(
    'UPDATE customers SET role = ?, permissions_json = ? WHERE id = ?'
  ).bind(role, permissionsJson, id).run()

  return c.json({ ok: true })
})

export default staff
