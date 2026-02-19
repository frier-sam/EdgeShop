import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Order } from '../../types'

const adminOrders = new Hono<{ Bindings: Env }>()

adminOrders.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM orders ORDER BY created_at DESC'
  ).all<Order>()
  return c.json({ orders: results })
})

adminOrders.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    order_status?: string
    payment_status?: string
  }>()

  const validOrderStatuses = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']
  const validPaymentStatuses = ['pending', 'paid', 'refunded']

  if (body.order_status && !validOrderStatuses.includes(body.order_status)) {
    return c.json({ error: 'Invalid order_status' }, 400)
  }
  if (body.payment_status && !validPaymentStatuses.includes(body.payment_status)) {
    return c.json({ error: 'Invalid payment_status' }, 400)
  }

  const updates: string[] = []
  const values: unknown[] = []
  if (body.order_status) { updates.push('order_status = ?'); values.push(body.order_status) }
  if (body.payment_status) { updates.push('payment_status = ?'); values.push(body.payment_status) }
  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400)

  await c.env.DB.prepare(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values, id).run()

  return c.json({ ok: true })
})

export default adminOrders
