import { Hono } from 'hono'
import type { Env } from '../../index'

const analytics = new Hono<{ Bindings: Env }>()

analytics.get('/revenue', async (c) => {
  const days = Number(c.req.query('days') ?? 30)
  if (isNaN(days) || days < 1 || days > 365) {
    return c.json({ error: 'days must be a number between 1 and 365' }, 400)
  }
  const { results } = await c.env.DB.prepare(`
    SELECT date(created_at) as day, SUM(total_amount) as revenue, COUNT(*) as orders
    FROM orders
    WHERE payment_status = 'paid'
      AND created_at >= datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).bind(`-${days} days`).all()
  return c.json({ data: results })
})

export default analytics
