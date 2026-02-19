import { Hono } from 'hono'
import type { Env } from '../index'

const shippingRates = new Hono<{ Bindings: Env }>()

shippingRates.post('/calculate', async (c) => {
  let body: { cart_total: number; weight?: number; country?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { cart_total, weight, country } = body
  if (typeof cart_total !== 'number' || cart_total < 0) {
    return c.json({ error: 'cart_total must be a non-negative number' }, 400)
  }

  const safeCountry = (country ?? 'India').replace(/%/g, '\\%').replace(/_/g, '\\_')
  const zone = await c.env.DB.prepare(
    "SELECT sz.id FROM shipping_zones sz WHERE sz.countries_json LIKE ? ESCAPE '\\'"
  ).bind(`%"${safeCountry}"%`).first<{ id: number }>()

  if (!zone) return c.json({ shipping_amount: 0, rate_name: 'Free Shipping' })

  const rate = await c.env.DB.prepare(`
    SELECT name, price, free_above_cart_total FROM shipping_rates
    WHERE zone_id = ?
      AND min_weight <= ?
      AND max_weight >= ?
    ORDER BY price ASC LIMIT 1
  `).bind(zone.id, weight ?? 0, weight ?? 0).first<{
    name: string; price: number; free_above_cart_total: number
  }>()

  if (!rate) return c.json({ shipping_amount: 0, rate_name: 'Free Shipping' })

  const shipping_amount = rate.free_above_cart_total > 0 && cart_total >= rate.free_above_cart_total
    ? 0 : rate.price

  return c.json({ shipping_amount, rate_name: rate.name })
})

export default shippingRates
