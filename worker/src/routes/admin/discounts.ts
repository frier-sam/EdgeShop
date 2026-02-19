import { Hono } from 'hono'
import type { Env } from '../../index'
import type { DiscountCode } from '../../types'

const adminDiscounts = new Hono<{ Bindings: Env }>()

const VALID_TYPES = ['percent', 'fixed', 'free_shipping'] as const
type DiscountType = typeof VALID_TYPES[number]

// List all discount codes
adminDiscounts.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM discount_codes ORDER BY id DESC'
  ).all<DiscountCode>()
  return c.json({ discounts: results })
})

// Create a discount code
adminDiscounts.post('/', async (c) => {
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { code, type, value, min_order_amount, max_uses, expires_at, is_active } = body

  if (typeof code !== 'string' || code.trim() === '') {
    return c.json({ error: 'code must be a non-empty string' }, 400)
  }

  if (!VALID_TYPES.includes(type as DiscountType)) {
    return c.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, 400)
  }

  if ((type === 'percent' || type === 'fixed') && (typeof value !== 'number' || value <= 0)) {
    return c.json({ error: 'value must be a positive number for percent and fixed discount types' }, 400)
  }

  if (expires_at != null) {
    if (typeof expires_at !== 'string' || isNaN(new Date(expires_at).getTime())) {
      return c.json({ error: 'expires_at must be a valid date string' }, 400)
    }
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO discount_codes (code, type, value, min_order_amount, max_uses, expires_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    (code as string).trim(),
    type,
    (value as number) ?? 0,
    min_order_amount ?? 0,
    max_uses ?? 0,
    expires_at ?? null,
    is_active ?? 1
  ).run()

  return c.json({ id: result.meta.last_row_id }, 201)
})

// Update a discount code
adminDiscounts.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const allowed = ['code', 'type', 'value', 'min_order_amount', 'max_uses', 'expires_at', 'is_active']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)

  // Validate individual fields
  const validated: Record<string, unknown> = {}
  for (const [k, v] of entries) {
    if (k === 'type') {
      if (!VALID_TYPES.includes(v as DiscountType)) {
        return c.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, 400)
      }
      validated[k] = v
    } else if (k === 'value' || k === 'min_order_amount' || k === 'max_uses' || k === 'is_active') {
      const num = Number(v)
      if (isNaN(num)) {
        return c.json({ error: `${k} must be a valid number` }, 400)
      }
      validated[k] = num
    } else {
      validated[k] = v
    }
  }

  const validatedEntries = Object.entries(validated)
  const fields = validatedEntries.map(([k]) => `${k} = ?`).join(', ')
  const result = await c.env.DB.prepare(`UPDATE discount_codes SET ${fields} WHERE id = ?`)
    .bind(...validatedEntries.map(([, v]) => v), id).run()

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
