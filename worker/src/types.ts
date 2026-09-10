export interface Product {
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
  // POD-V2.md §1.1 — merchant-nameable option axis headers ("Size" /
  // "Colour" by default; a bottle merchant might rename these to "Volume"
  // / "Cap colour"). Every admin + storefront label reads these two
  // columns rather than hard-coding axis names.
  axis1_label: string
  axis2_label: string
  // POD-V2.md §5 — minimum order quantity, independent of whether bulk
  // price breaks are configured at all.
  min_order_qty: number
  // POD-UI4.md §4.1 / P2 — newline-separated bullet lines for the
  // storefront's "Key Features" box. Opaque merchant copy, never parsed
  // beyond splitting on newlines client-side; '' (the column default)
  // means the box simply isn't rendered.
  highlights: string
  seo_title: string
  seo_description: string
  created_at: string
  // present on list/detail responses via LEFT JOIN — not a real column
  front_image?: string | null
  // POD-UI4.md §4.1 — same LEFT JOIN shape as front_image, keyed to
  // side='back' instead. Feeds ProductCard's hover swap on the list
  // endpoint only; the detail endpoint already exposes the full `sides`
  // array, which is the richer source of truth there.
  back_image?: string | null
}

export interface ProductSide {
  id: number
  product_id: number
  side: 'front' | 'back'
  // POD-V2.md §8 — display-only override; '' means "use the side name".
  // `side` itself stays the fixed 'front'/'back' identity — see the
  // CHECK constraint's comment in schema.sql for why that never changes.
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

/** POD-V2.md §3.1 — option axis 2 (colour / finish / material). No price
 * column: axis 2 never bears a price delta, which is what keeps it out of
 * lib/pricing.ts's computeLine entirely. `swatch_hex` is nullable because
 * a finish like matte/glossy has no colour — the storefront must degrade
 * to a plain labelled pill rather than assume every option is a swatch. */
export interface ProductVariant {
  id: number
  product_id: number
  label: string
  swatch_hex: string | null
  sort_order: number
}

/** POD-V2.md §5 — a bulk quantity tier. `unit_price` is absolute and
 * all-in (includes printing) — it replaces base_price + print fees for
 * lines in the resolved tier, rather than discounting off them (§9 #1).
 * Wired into pricing in Phase 3; this phase only stores and validates it. */
export interface ProductPriceBreak {
  id: number
  product_id: number
  min_qty: number
  unit_price: number
}

export interface Design {
  id: string
  product_id: number
  customer_id: number | null
  design_json: string
  preview_json: string
  sides_used: string
  order_id: string | null
  created_at: string
}

export interface Order {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  total_amount: number
  payment_method: 'razorpay' | 'cod'
  payment_status: string
  order_status: string
  razorpay_order_id: string
  razorpay_payment_id: string
  items_json: string
  created_at: string
  // structured address fields
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  shipping_country: string
  // POD pricing split
  subtotal: number
  print_total: number
  shipping_amount: number
  tracking_number: string
  customer_notes: string
  internal_notes: string
  customer_id: number | null
}

// NOTE: the old flat `OrderItem` shape (product_id/name/price/quantity/
// image_url/size) is gone — POD.md §7.4's items_json shape is now
// `ResolvedLineItem`, defined in lib/pricing.ts alongside the
// server-side price recomputation that produces it (POD.md §7.3).

// POD-V2.md §6.1 — "browse designs": a named grouping of design_templates
// (e.g. 'Birthday', 'Corporate'). `category` matches a product's own
// `category` string case-insensitively; `''` is the wildcard meaning
// "every category" — see lib/templates.ts's collectionMatchesCategory and
// schema.sql's comment on this table.
export interface TemplateCollection {
  id: number
  name: string
  category: string
  status: 'active' | 'draft'
  sort_order: number
}

// POD-V2.md §6.1/§6.2/§6.3 — one ready-made, single-side design, stored as
// Fabric JSON (`design_json`, one side's StoredSideSnapshot) canonicalized
// to the exact bleed rect (`canvas_w` x `canvas_h`) it was authored
// against. See lib/templates.ts's aspectMatches/filterTemplatesByAspect
// for how that pairs against a shopper's actual print area.
export interface DesignTemplate {
  id: number
  collection_id: number
  name: string
  design_json: string
  canvas_w: number
  canvas_h: number
  preview_url: string
  tags: string
  status: 'active' | 'draft'
  sort_order: number
  created_at: string
}

export interface Customer {
  id: number
  email: string
  password_hash: string
  name: string
  phone: string
  created_at: string
  role: string          // 'customer' | 'staff' | 'super_admin'
  permissions_json: string  // JSON-encoded permissions map (still read by auth.ts)
}
