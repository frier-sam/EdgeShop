import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Order } from '../../types'
import { sendEmail } from '../../lib/email'
import { shippingUpdateHtml } from '../../lib/emailTemplates'

const VALID_ORDER_STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'refunded'] as const

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

  for (const [k, v] of entries) {
    if (k === 'order_status' && !VALID_ORDER_STATUSES.includes(v as never)) {
      return c.json({ error: 'Invalid order_status' }, 400)
    }
    if (k === 'payment_status' && !VALID_PAYMENT_STATUSES.includes(v as never)) {
      return c.json({ error: 'Invalid payment_status' }, 400)
    }
  }

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)

  const result = await c.env.DB.prepare(
    `UPDATE orders SET ${setClauses} WHERE id = ?`
  ).bind(...values, id).run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)

  return c.json({ ok: true })
})

adminOrders.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    order_status?: string
    payment_status?: string
  }>()

  if (body.order_status && !VALID_ORDER_STATUSES.includes(body.order_status as never)) {
    return c.json({ error: 'Invalid order_status' }, 400)
  }
  if (body.payment_status && !VALID_PAYMENT_STATUSES.includes(body.payment_status as never)) {
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

adminOrders.patch('/:id/tracking', async (c) => {
  const id = c.req.param('id')

  let body: { tracking_number: string }
  try {
    body = await c.req.json<{ tracking_number: string }>()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { tracking_number } = body
  if (typeof tracking_number !== 'string' || !tracking_number.trim()) {
    return c.json({ error: 'tracking_number is required' }, 400)
  }
  const trimmedTracking = tracking_number.trim()

  const result = await c.env.DB.prepare(
    "UPDATE orders SET tracking_number = ?, order_status = 'shipped' WHERE id = ?"
  ).bind(trimmedTracking, id).run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)

  try {
    const order = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ?'
    ).bind(id).first<Order>()

    if (order) {
      const emailRows = await c.env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address')"
      ).all<{ key: string; value: string }>()
      const eCfg: Record<string, string> = {}
      for (const row of emailRows.results) eCfg[row.key] = row.value

      await sendEmail(
        {
          to: order.customer_email,
          subject: `Your order ${id} has shipped!`,
          html: shippingUpdateHtml({
            id: order.id,
            customer_name: order.customer_name,
            tracking_number: trimmedTracking,
          }),
        },
        {
          email_api_key: eCfg.email_api_key ?? '',
          email_from_name: eCfg.email_from_name ?? '',
          email_from_address: eCfg.email_from_address ?? '',
        }
      )
    }
  } catch (err) {
    console.error('Failed to send shipping email:', err)
  }

  return c.json({ ok: true })
})

adminOrders.patch('/:id/refund', async (c) => {
  const id = c.req.param('id')

  let notes: string | undefined
  try {
    const body = await c.req.json<{ notes?: string }>()
    notes = body.notes
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Guard: only paid orders can be refunded
  const existing = await c.env.DB.prepare(
    'SELECT payment_status FROM orders WHERE id = ?'
  ).bind(id).first<{ payment_status: string }>()
  if (!existing) return c.json({ error: 'Not found' }, 404)
  if (existing.payment_status !== 'paid') {
    return c.json({ error: 'Only paid orders can be refunded' }, 400)
  }

  // Preserve existing internal_notes if no new notes provided
  await c.env.DB.prepare(
    `UPDATE orders SET payment_status = 'refunded', internal_notes = COALESCE(NULLIF(?, ''), internal_notes) WHERE id = ?`
  ).bind(notes ?? '', id).run()

  return c.json({ ok: true })
})

export default adminOrders
