import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Order } from '../../types'
import { sendEmail } from '../../lib/email'
import { shippingUpdateHtml } from '../../lib/emailTemplates'

const VALID_ORDER_STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'refunded'] as const

const adminOrders = new Hono<{ Bindings: Env }>()

adminOrders.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const rawStatus = (c.req.query('status') ?? '').trim()
  const status = (VALID_ORDER_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : ''
  let sql = 'SELECT * FROM orders WHERE 1=1'
  const params: (string | number)[] = []
  if (q) {
    sql += ' AND (customer_name LIKE ? OR customer_email LIKE ? OR id LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (status) { sql += ' AND order_status = ?'; params.push(status) }
  sql += ' ORDER BY created_at DESC LIMIT 200'
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Order>()
    return c.json({ orders: results })
  } catch (err) {
    console.error('Admin orders list error:', err)
    return c.json({ error: 'Failed to load orders' }, 500)
  }
})

adminOrders.get('/:id', async (c) => {
  const id = c.req.param('id')
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()
  if (!order) return c.json({ error: 'Not found' }, 404)
  let emails: Array<{ id: number; type: string; recipient: string; subject: string; status: string; sent_at: number }> = []
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, type, recipient, subject, status, sent_at FROM order_emails WHERE order_id = ? ORDER BY sent_at ASC'
    ).bind(id).all<{ id: number; type: string; recipient: string; subject: string; status: string; sent_at: number }>()
    emails = results
  } catch {
    // order_emails table may not exist yet (migration pending) — return empty list
  }
  let events: Array<{ id: number; event_type: string; data_json: string; created_at: string }> = []
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, event_type, data_json, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC'
    ).bind(id).all<{ id: number; event_type: string; data_json: string; created_at: string }>()
    events = results
  } catch {
    // order_events table may not exist yet (migration pending) — return empty list
  }
  return c.json({ ...order, emails, events })
})

adminOrders.put('/:id', async (c) => {
  const id = c.req.param('id')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const allowed = [
    'order_status', 'payment_status', 'tracking_number', 'internal_notes',
    'customer_name', 'customer_email', 'customer_phone',
    'shipping_address', 'shipping_city', 'shipping_state', 'shipping_pincode', 'shipping_country',
  ]
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

  // Insert timeline events for relevant field changes (non-fatal)
  const eventStmts: ReturnType<typeof c.env.DB.prepare>[] = []
  for (const [k, v] of entries) {
    if (k === 'order_status') {
      eventStmts.push(
        c.env.DB.prepare("INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'status_change', ?)")
          .bind(id, JSON.stringify({ to: v }))
      )
    } else if (k === 'tracking_number') {
      eventStmts.push(
        c.env.DB.prepare("INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'tracking_set', ?)")
          .bind(id, JSON.stringify({ tracking_number: v }))
      )
    } else if (k === 'payment_status') {
      eventStmts.push(
        c.env.DB.prepare("INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'payment_change', ?)")
          .bind(id, JSON.stringify({ to: v }))
      )
    }
  }
  if (eventStmts.length > 0) {
    await c.env.DB.batch(eventStmts).catch(() => {})
  }

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

      const shipSubject = `Your order ${id} has shipped!`
      let shipStatus: 'sent' | 'failed' = 'sent'
      try {
        await sendEmail(
          {
            to: order.customer_email,
            subject: shipSubject,
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
      } catch { shipStatus = 'failed' }
      await c.env.DB.prepare(
        'INSERT INTO order_emails (order_id, type, recipient, subject, status) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, 'shipping_update', order.customer_email, shipSubject, shipStatus).run().catch(() => {})
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

  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'refund', '{}')"
  ).bind(id).run().catch(() => {})

  return c.json({ ok: true })
})

adminOrders.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  let text: string
  try {
    const body = await c.req.json<{ text: string }>()
    text = (body.text ?? '').trim()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  if (!text) return c.json({ error: 'text is required' }, 400)

  const order = await c.env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first()
  if (!order) return c.json({ error: 'Order not found' }, 404)

  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'note', ?)"
  ).bind(id, JSON.stringify({ text })).run()

  return c.json({ ok: true })
})

export default adminOrders
