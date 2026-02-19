import { Hono } from 'hono'
import type { Env } from '../../index'
import type { ShippingZone, ShippingRate } from '../../types'

const adminShipping = new Hono<{ Bindings: Env }>()

// ── Zones ────────────────────────────────────────────────────────────────────

adminShipping.get('/zones', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM shipping_zones ORDER BY name ASC'
  ).all<ShippingZone>()
  return c.json({ zones: results })
})

adminShipping.post('/zones', async (c) => {
  let body: { name: string; countries_json: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const { name, countries_json } = body
  if (typeof name !== 'string' || !name.trim()) return c.json({ error: 'name is required' }, 400)
  if (typeof countries_json !== 'string') return c.json({ error: 'countries_json is required' }, 400)
  // validate JSON
  try { JSON.parse(countries_json) } catch { return c.json({ error: 'countries_json must be valid JSON' }, 400) }

  const result = await c.env.DB.prepare(
    'INSERT INTO shipping_zones (name, countries_json) VALUES (?, ?)'
  ).bind(name.trim(), countries_json).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminShipping.put('/zones/:id', async (c) => {
  const id = Number(c.req.param('id'))
  let body: { name?: string; countries_json?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const updates: string[] = []
  const values: unknown[] = []
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return c.json({ error: 'name must be a non-empty string' }, 400)
    updates.push('name = ?'); values.push(body.name.trim())
  }
  if (body.countries_json !== undefined) {
    if (typeof body.countries_json !== 'string') return c.json({ error: 'countries_json must be a string' }, 400)
    try { JSON.parse(body.countries_json) } catch { return c.json({ error: 'countries_json must be valid JSON' }, 400) }
    updates.push('countries_json = ?'); values.push(body.countries_json)
  }
  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400)

  const result = await c.env.DB.prepare(
    `UPDATE shipping_zones SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values, id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

adminShipping.delete('/zones/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const result = await c.env.DB.prepare('DELETE FROM shipping_zones WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// ── Rates ─────────────────────────────────────────────────────────────────────

adminShipping.get('/zones/:id/rates', async (c) => {
  const id = Number(c.req.param('id'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM shipping_rates WHERE zone_id = ? ORDER BY price ASC'
  ).bind(id).all<ShippingRate>()
  return c.json({ rates: results })
})

adminShipping.post('/zones/:id/rates', async (c) => {
  const zone_id = Number(c.req.param('id'))
  let body: { name: string; min_weight: number; max_weight: number; price: number; free_above_cart_total?: number }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const { name, min_weight, max_weight, price, free_above_cart_total = 0 } = body
  if (typeof name !== 'string' || !name.trim()) return c.json({ error: 'name is required' }, 400)
  if (typeof min_weight !== 'number' || min_weight < 0) return c.json({ error: 'min_weight must be a non-negative number' }, 400)
  if (typeof max_weight !== 'number' || max_weight < min_weight) return c.json({ error: 'max_weight must be >= min_weight' }, 400)
  if (typeof price !== 'number' || price < 0) return c.json({ error: 'price must be a non-negative number' }, 400)

  const result = await c.env.DB.prepare(
    'INSERT INTO shipping_rates (zone_id, name, min_weight, max_weight, price, free_above_cart_total) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(zone_id, name.trim(), min_weight, max_weight, price, free_above_cart_total).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminShipping.put('/rates/:id', async (c) => {
  const id = Number(c.req.param('id'))
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const allowed = ['name', 'min_weight', 'max_weight', 'price', 'free_above_cart_total']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)

  for (const [k, v] of entries) {
    if (k === 'name' && (typeof v !== 'string' || !(v as string).trim())) return c.json({ error: 'name must be a non-empty string' }, 400)
    if (['min_weight', 'max_weight', 'price', 'free_above_cart_total'].includes(k) && (typeof v !== 'number' || (v as number) < 0)) {
      return c.json({ error: `${k} must be a non-negative number` }, 400)
    }
  }

  const result = await c.env.DB.prepare(
    `UPDATE shipping_rates SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`
  ).bind(...entries.map(([, v]) => v), id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

adminShipping.delete('/rates/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const result = await c.env.DB.prepare('DELETE FROM shipping_rates WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

export default adminShipping
