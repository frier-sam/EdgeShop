import { Hono } from 'hono'
import type { Env } from '../../index'
import type { DiscountCode } from '../../types'

const adminDiscounts = new Hono<{ Bindings: Env }>()

// List all discount codes
adminDiscounts.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM discount_codes ORDER BY id DESC'
  ).all<DiscountCode>()
  return c.json({ discounts: results })
})

// Create a discount code
adminDiscounts.post('/', async (c) => {
  const body = await c.req.json<{
    code: string
    type: 'percent' | 'fixed' | 'free_shipping'
    value: number
    min_order_amount?: number
    max_uses?: number
    expires_at?: string | null
    is_active?: number
  }>()

  if (!body.code || !body.type) {
    return c.json({ error: 'code and type are required' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO discount_codes (code, type, value, min_order_amount, max_uses, expires_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.code,
    body.type,
    body.value ?? 0,
    body.min_order_amount ?? 0,
    body.max_uses ?? 0,
    body.expires_at ?? null,
    body.is_active ?? 1
  ).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

// Update a discount code
adminDiscounts.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['code', 'type', 'value', 'min_order_amount', 'max_uses', 'expires_at', 'is_active']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)

  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const result = await c.env.DB.prepare(`UPDATE discount_codes SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id).run()

  if (result.meta.changes === 0) return c.json({ error: 'Discount code not found' }, 404)
  return c.json({ ok: true })
})

// Delete a discount code
adminDiscounts.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const result = await c.env.DB.prepare('DELETE FROM discount_codes WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Discount code not found' }, 404)
  return c.json({ ok: true })
})

export default adminDiscounts
