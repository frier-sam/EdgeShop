// Admin-only types for the Phase 4 product editor (POD.md §4, §6.1).
// Server-row shapes (ProductSide, ProductSize, ProductDetail) already live
// in ../lib/types.ts — this file only holds types local to the admin editor
// UI that have no server-side equivalent.

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
