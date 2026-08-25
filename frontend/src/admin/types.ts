// Admin-only types for the Phase 4 product editor (POD.md §4, §6.1) and the
// Phase 8 order fulfilment view (POD.md §4.2, §8.1). Server-row shapes
// (ProductSide, ProductSize, ProductDetail) already live in ../lib/types.ts
// — this file only holds types local to admin UI that have no plain
// server-side equivalent.
import type { DesignJson } from '../editor/designSchema'

/** One `product_sides` row's geometry, as returned by `GET
 *  /api/admin/orders/:id` (worker/src/routes/admin/orders.ts) — enough for
 *  PrintFileRenderer to size/scale the export without a second product
 *  fetch. Narrower than the full `ProductSide` in ../lib/types.ts (no id,
 *  no fee, no customizable flag — an order's line item already froze
 *  those at purchase time). */
export interface AdminOrderSideGeometry {
  side: 'front' | 'back'
  image_url: string
  image_w: number
  image_h: number
  print_x: number
  print_y: number
  print_w: number
  print_h: number
  print_width_in: number
}

/** POD.md §7.4's `items_json` entry, as re-shaped by the admin `GET
 *  /:id` route: the canonical (non-alias) fields plus the `design` +
 *  `sides` join Phase 8 adds. `design` is null for a plain (no artwork)
 *  line; `sides` only lists the sides the design actually used. */
export interface AdminOrderLineItem {
  product_id: number
  name: string
  size: string | null
  quantity: number
  base_price: number
  size_delta: number
  print_fees: { side: 'front' | 'back'; fee: number }[]
  unit_price: number
  line_total: number
  design_id: string | null
  previews: Record<string, string>
  design: {
    id: string
    design_json: DesignJson
    preview_json: Record<string, string>
    sides_used: string[]
  } | null
  sides: AdminOrderSideGeometry[]
}

/** The four normalized (0..1) fields that describe a print area, shared by
 *  PrintAreaSelector and ProductSideCard. Subset of ProductSide. */
export interface PrintRect {
  print_x: number
  print_y: number
  print_w: number
  print_h: number
}

/** One row in the sizes editor. `key` is a stable client-side id used only
 *  for React list rendering — new (unsaved) rows don't have a server id yet.
 *  Never sent to the API; the PUT payload is stripped down to
 *  { label, price_delta, stock_count }. */
export interface SizeDraftRow {
  key: string
  label: string
  price_delta: number
  stock_count: number
}
