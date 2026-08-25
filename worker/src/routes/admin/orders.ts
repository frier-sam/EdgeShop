import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Order, Design, ProductSide } from '../../types'
import type { ResolvedLineItem } from '../../lib/pricing'
import { sendEmail } from '../../lib/email'
import { shippingUpdateHtml } from '../../lib/emailTemplates'

const VALID_ORDER_STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'refunded'] as const

const adminOrders = new Hono<{ Bindings: Env }>()

// ── POD.md §8.1 / §4.2 — per-line design + print geometry ──────────────────
//
// The admin order detail page's PrintFileRenderer (frontend/src/admin/print/)
// needs, per customized line item, the exact same `design_json` the
// customer's editor produced plus the product side's geometry
// (print_width_in drives the export DPI maths — POD.md §5.1/§5.7). This is
// a pure join/enrichment on top of the already-stored §7.4 items_json —
// nothing here re-derives pricing or touches design_json's contents.

export interface AdminOrderSideGeometry {
  side: string
  image_url: string
  image_w: number
  image_h: number
  print_x: number
  print_y: number
  print_w: number
  print_h: number
  print_width_in: number
}

export interface AdminOrderItem extends ResolvedLineItem {
  design: {
    id: string
    design_json: Record<string, unknown>
    preview_json: Record<string, string>
    sides_used: string[]
  } | null
  /** Only the sides this design actually used — matches `design.sides_used`. Empty for a plain (no-design) line. */
  sides: AdminOrderSideGeometry[]
}

type DesignRow = Pick<Design, 'id' | 'design_json' | 'preview_json' | 'sides_used'>

async function enrichOrderItems(db: D1Database, itemsJson: string): Promise<AdminOrderItem[]> {
  let rawItems: ResolvedLineItem[]
  try {
    const parsed = JSON.parse(itemsJson)
    if (!Array.isArray(parsed)) return []
    rawItems = parsed
  } catch {
    return []
  }

  const designIds = Array.from(new Set(rawItems.map((i) => i.design_id).filter((id): id is string => !!id)))
  const productIds = Array.from(new Set(rawItems.map((i) => i.product_id).filter((id): id is number => Number.isFinite(id))))

  const designsById = new Map<string, DesignRow>()
  if (designIds.length > 0) {
    const placeholders = designIds.map(() => '?').join(',')
    const { results } = await db
      .prepare(`SELECT id, design_json, preview_json, sides_used FROM designs WHERE id IN (${placeholders})`)
      .bind(...designIds)
      .all<DesignRow>()
    for (const row of results) designsById.set(row.id, row)
  }

  const sidesByProduct = new Map<number, AdminOrderSideGeometry[]>()
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(',')
    const { results } = await db
      .prepare(
        `SELECT product_id, side, image_url, image_w, image_h, print_x, print_y, print_w, print_h, print_width_in
         FROM product_sides WHERE product_id IN (${placeholders})`
      )
      .bind(...productIds)
      .all<ProductSide>()
    for (const row of results) {
      const list = sidesByProduct.get(row.product_id) ?? []
      list.push({
        side: row.side,
        image_url: row.image_url,
        image_w: row.image_w,
        image_h: row.image_h,
        print_x: row.print_x,
        print_y: row.print_y,
        print_w: row.print_w,
        print_h: row.print_h,
        print_width_in: row.print_width_in,
      })
      sidesByProduct.set(row.product_id, list)
    }
  }

  return rawItems.map((item) => {
    const designRow = item.design_id ? designsById.get(item.design_id) : undefined
    if (!designRow) return { ...item, design: null, sides: [] }

    let designJson: Record<string, unknown> = {}
    let previewJson: Record<string, string> = {}
    try { designJson = JSON.parse(designRow.design_json) } catch { /* corrupt row — surface as empty, don't 500 the admin */ }
    try { previewJson = JSON.parse(designRow.preview_json) } catch { /* same */ }
    const sidesUsed = designRow.sides_used.split(',').map((s) => s.trim()).filter(Boolean)
    const allSides = sidesByProduct.get(item.product_id) ?? []
    const sides = allSides.filter((s) => sidesUsed.includes(s.side))

    return {
      ...item,
      design: { id: designRow.id, design_json: designJson, preview_json: previewJson, sides_used: sidesUsed },
      sides,
    }
  })
}

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
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>()
  if (!order) return c.json({ error: 'Not found' }, 404)
  let events: Array<{ id: number; event_type: string; data_json: string; created_at: string }> = []
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, event_type, data_json, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC'
    ).bind(id).all<{ id: number; event_type: string; data_json: string; created_at: string }>()
    events = results
  } catch {
    // order_events table may not exist yet (migration pending) — return empty list
  }

  const items = await enrichOrderItems(c.env.DB, order.items_json)

  return c.json({ ...order, events, items })
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

      try {
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
      } catch { /* non-fatal — tracking number is already saved */ }
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
