// Shared types that used to live under src/themes/types.ts.
// The cart line shape lives in store/cartStore.ts (POD.md §7.2) — see
// the `CartLine` interface there.

// ── Catalog (POD.md §6.1 / §8) ─────────────────────────────────────
// Matches the columns the worker actually returns — see
// worker/src/routes/products.ts and worker/src/types.ts.

export interface ProductSide {
  id: number
  product_id: number
  side: 'front' | 'back'
  // POD-V2.md §8 — the internal `front`/`back` keys stay exactly as-is
  // (design_json, sides_used, pricing and print-file naming all key off
  // them), but a substrate-agnostic merchant needs a display name: a
  // bottle's "front" is really its "Wrap", a mug's is its "Outer". Purely
  // cosmetic — never parsed, never fed back into pricing/print logic.
  label: string
  image_url: string
  image_w: number
  image_h: number
  customizable: number
  print_x: number
  print_y: number
  print_w: number
  print_h: number
  print_width_in: number
  print_fee: number
  sort_order: number
}

export interface ProductSize {
  id: number
  product_id: number
  label: string
  price_delta: number
  stock_count: number
  sort_order: number
}

// POD-V2.md §3.1 — axis 2 ("Colour" by default, but the admin can rename
// it to anything: "Finish", "Cap colour", …). Deliberately carries no
// price_delta and no stock_count — see §3.1 / §3.3: axis 2 never touches
// `lib/pricing.ts`, so it stays a pure presentation/fulfilment attribute.
export interface ProductVariant {
  id: number
  label: string
  // Nullable, and that nullability is load-bearing (§3.1): "Matte" /
  // "Glossy" has no colour, so the admin/storefront must degrade to a
  // plain labelled pill rather than assume every option is a swatch.
  swatch_hex: string | null
  sort_order: number
}

// POD-V2.md §5 — an opaque quantity tier. `unit_price` is the ABSOLUTE,
// all-in price per unit at this tier (§9 decision 7) — it already
// includes printing, it does not add on top of base_price + print fees.
export interface ProductPriceBreak {
  id: number
  min_qty: number
  unit_price: number
}

// POD-UI4.md §4.1 / §4.5 — the cheapest honest bulk-pricing signal a
// *listing* can carry. The lowest-`min_qty` tier for the product, or null
// when it has none. Used for the "BUY 100 @ ₹4.50" pill on a product tile;
// when it is null the tile falls back to `min_order_qty > 1` and otherwise
// shows no pill at all, never a fabricated quantity.
export interface LowestPriceBreak {
  min_qty: number
  unit_price: number
}

// Shape returned by GET /api/products (list)
export interface ProductSummary {
  id: number
  name: string
  slug: string | null
  base_price: number
  compare_price: number | null
  category: string
  is_customizable: number
  front_image: string | null
  // POD-UI4.md §4.1 — added to the list endpoint this round.
  // `back_image` finally gives ProductCard's long-plumbed hover swap real
  // data; `min_order_qty` + `lowest_break` drive the price-break pill.
  back_image: string | null
  min_order_qty: number
  lowest_break: LowestPriceBreak | null
}

// Shape returned by GET /api/products/:id (detail)
export interface ProductDetail {
  id: number
  name: string
  slug: string | null
  description: string
  base_price: number
  compare_price: number | null
  category: string
  status: 'active' | 'draft'
  is_customizable: number
  stock_count: number
  seo_title: string
  seo_description: string
  sides: ProductSide[]
  sizes: ProductSize[]
  // POD-V2.md §1.1 — axis names are editable per product because "Size"
  // and "Colour" are t-shirt words; a visiting card varies by "Paper
  // size" / "Finish". Every opaque option label in product_sizes and
  // product_variants stays exactly that (never parsed) — only these two
  // TEXT columns tell the form (and, from Phase 2, the storefront) what
  // to call each axis. Default "Size" / "Colour" when a product predates
  // this column or the merchant never renamed it.
  axis1_label: string
  axis2_label: string
  // POD-V2.md §5 — minimum purchase quantity. Meaningful with or without
  // bulk tiers (a merchant can require "12 minimum" even with a flat
  // price), but pairs naturally with price_breaks: the product page's
  // quantity chips derive from the tiers, and this is the floor.
  min_order_qty: number
  variants: ProductVariant[]
  price_breaks: ProductPriceBreak[]
  // POD-UI4.md §4.1 / P2 — newline-separated bullet lines, rendered as the
  // product page's "Key Features" box. Opaque merchant copy: never parsed
  // beyond splitting on newlines, and the box is simply not rendered when
  // this is empty (which it is for every product predating the column).
  highlights: string
}
