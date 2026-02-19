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

adminOrders.get('/:id', async (c) => {
  const id = c.req.param('id')
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()
  if (!order) return c.json({ error: 'Not found' }, 404)
  return c.json(order)
})

adminOrders.put('/:id', async (c) => {
  const id = c.req.param('id')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const allowed = ['order_status', 'payment_status', 'tracking_number', 'internal_notes']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)

  const validOrderStatuses = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']
  const validPaymentStatuses = ['pending', 'paid', 'refunded']

  for (const [k, v] of entries) {
    if (k === 'order_status' && !validOrderStatuses.includes(v as string)) {
      return c.json({ error: 'Invalid order_status' }, 400)
    }
    if (k === 'payment_status' && !validPaymentStatuses.includes(v as string)) {
      return c.json({ error: 'Invalid payment_status' }, 400)
    }
  }

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)

  await c.env.DB.prepare(
    `UPDATE orders SET ${setClauses} WHERE id = ?`
  ).bind(...values, id).run()

  return c.json({ ok: true })
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
