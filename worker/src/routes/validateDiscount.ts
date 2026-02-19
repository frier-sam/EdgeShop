import { Hono } from 'hono'
import type { Env } from '../index'
import type { DiscountCode } from '../types'

const validateDiscount = new Hono<{ Bindings: Env }>()

validateDiscount.post('/', async (c) => {
  let body: { code: unknown; cart_total: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { code, cart_total } = body

  if (typeof code !== 'string' || code.trim() === '') {
    return c.json({ error: 'code must be a non-empty string' }, 400)
  }
  if (typeof cart_total !== 'number' || cart_total < 0) {
    return c.json({ error: 'cart_total must be a non-negative number' }, 400)
  }

  const discount = await c.env.DB.prepare(`
    SELECT * FROM discount_codes
    WHERE code = ? COLLATE NOCASE AND is_active = 1
  `).bind(code).first<DiscountCode>()

  if (!discount) return c.json({ error: 'Invalid discount code' }, 404)

  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    return c.json({ error: 'Discount code has expired' }, 400)
  }

  if (discount.max_uses > 0 && discount.uses_count >= discount.max_uses) {
    return c.json({ error: 'Discount code usage limit reached' }, 400)
  }

  if (cart_total < discount.min_order_amount) {
    return c.json({ error: `Minimum order amount is ₹${discount.min_order_amount}` }, 400)
  }

  let discount_amount = 0
  if (discount.type === 'percent') {
    discount_amount = Math.min(
      Math.round((cart_total * discount.value / 100) * 100) / 100,
      cart_total
    )
  } else if (discount.type === 'fixed') {
    discount_amount = Math.min(discount.value, cart_total)
  }
  // free_shipping: discount_amount = 0 (shipping waived at checkout)

  return c.json({
    valid: true,
    discount_amount,
    type: discount.type,
    code: discount.code,
  })
})

export default validateDiscount
