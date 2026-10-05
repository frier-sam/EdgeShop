import { Hono } from 'hono'
import type { Env } from '../../index'

const adminVendors = new Hono<{ Bindings: Env }>()

interface VendorBody {
  name?: unknown
  contact?: unknown
  email?: unknown
  phone?: unknown
  notes?: unknown
  active?: unknown
}

const TEXT_FIELDS = ['contact', 'email', 'phone', 'notes'] as const

// List vendors with how many orders are currently assigned to each.
adminVendors.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT v.id, v.name, v.contact, v.email, v.phone, v.notes, v.active, v.created_at,
           COUNT(o.id) AS order_count
    FROM vendors v
    LEFT JOIN orders o ON o.vendor_id = v.id
    GROUP BY v.id
    ORDER BY v.active DESC, v.name COLLATE NOCASE ASC
  `).all()
  return c.json({ vendors: results })
})

adminVendors.post('/', async (c) => {
  let body: VendorBody
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return c.json({ error: 'name is required' }, 400)
  const text = (k: (typeof TEXT_FIELDS)[number]) => (typeof body[k] === 'string' ? (body[k] as string).trim() : '')

  const result = await c.env.DB.prepare(
    'INSERT INTO vendors (name, contact, email, phone, notes) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, text('contact'), text('email'), text('phone'), text('notes')).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminVendors.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  let body: VendorBody
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const sets: string[] = []
  const values: unknown[] = []
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return c.json({ error: 'name cannot be empty' }, 400)
    sets.push('name = ?'); values.push(name)
  }
  for (const k of TEXT_FIELDS) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== 'string') return c.json({ error: `${k} must be a string` }, 400)
      sets.push(`${k} = ?`); values.push((body[k] as string).trim())
    }
  }
  if (body.active !== undefined) {
    sets.push('active = ?'); values.push(body.active ? 1 : 0)
  }
  if (!sets.length) return c.json({ error: 'Nothing to update' }, 400)

  const result = await c.env.DB.prepare(`UPDATE vendors SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values, id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// Deleting a vendor that has orders would orphan them, so refuse and let the
// admin deactivate it instead.
adminVendors.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const used = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM orders WHERE vendor_id = ?')
    .bind(id).first<{ n: number }>()
  if ((used?.n ?? 0) > 0) {
    return c.json({ error: 'Vendor has assigned orders — deactivate it instead.' }, 409)
  }
  const result = await c.env.DB.prepare('DELETE FROM vendors WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

export default adminVendors
