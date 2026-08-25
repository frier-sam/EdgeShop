import { Hono } from 'hono'
import type { Env } from '../index'

// Bug 3 fix (POD-UI.md §6 / OrderSuccessPage.tsx) — the success page's
// design-preview thumbnails only ever arrived via React Router `state`
// handed over by CheckoutPage.tsx; there was no dedicated "fetch this
// order" endpoint for a guest checkout at Phase 7 time. On a hard refresh
// (or a bookmarked/shared link) that state is gone and the thumbnails
// vanished.
//
// This is deliberately public (no auth — a guest checkout has no session
// to authenticate) and deliberately narrow: `orders.id` is
// `ORD-<timestamp>-<8 random hex chars>` (routes/checkout.ts) — the
// timestamp half is guessable, so an id must be treated as "guessable-ish,
// not secret". The response is built field-by-field from `items_json`
// (POD.md §7.4), which never contains customer_name/email/phone/address —
// those live in separate columns on the same `orders` row and are NEVER
// selected here (the SQL query below asks for `items_json` alone). Every
// field copied out of an item is picked by name and type-checked — this
// can only ever surface product names, sizes, quantities and design
// preview art (the same preview images already served unauthenticated
// from R2 via `/img/*` for anyone holding the URL) — never who bought it
// or where it's shipping.
//
// `buildPreviewLines` is kept pure and dependency-free (no D1, no Hono),
// mirroring lib/pricing.ts, so the PII-safety-critical field selection can
// be unit tested with plain fixtures — see orders.test.ts.
const orders = new Hono<{ Bindings: Env }>()

interface StoredOrderItem {
  name?: unknown
  size?: unknown
  quantity?: unknown
  design_id?: unknown
  image_url?: unknown
  previews?: unknown
}

export interface OrderPreviewLine {
  key: string
  name: string
  size: string | null
  quantity: number
  preview_url: string | null
  design_id: string | null
}

function firstPreviewUrl(item: StoredOrderItem): string | null {
  if (typeof item.image_url === 'string' && item.image_url) return item.image_url
  const previews = item.previews
  if (previews && typeof previews === 'object') {
    const record = previews as Record<string, unknown>
    if (typeof record.front === 'string' && record.front) return record.front
    for (const v of Object.values(record)) {
      if (typeof v === 'string' && v) return v
    }
  }
  return null
}

/** Parses a stored `items_json` string into ONLY the preview-safe fields — never the sibling PII columns on the `orders` row. Malformed/non-array JSON yields `[]` rather than throwing, so a corrupt row degrades to "no previews" instead of a 500. */
export function buildPreviewLines(orderId: string, itemsJson: string): OrderPreviewLine[] {
  let rawItems: StoredOrderItem[] = []
  try {
    const parsed = JSON.parse(itemsJson)
    if (Array.isArray(parsed)) rawItems = parsed
  } catch {
    rawItems = []
  }

  return rawItems.map((item, index) => ({
    key: `${orderId}:${index}`,
    name: typeof item.name === 'string' ? item.name : '',
    size: typeof item.size === 'string' ? item.size : null,
    quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1,
    preview_url: firstPreviewUrl(item),
    design_id: typeof item.design_id === 'string' ? item.design_id : null,
  }))
}

// GET /api/orders/:id/previews — preview art + line labels only, no PII.
orders.get('/:id/previews', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare('SELECT items_json FROM orders WHERE id = ?').bind(id).first<{ items_json: string }>()
  if (!row) return c.json({ error: 'Not found' }, 404)

  return c.json({ lines: buildPreviewLines(id, row.items_json) })
})

export default orders
