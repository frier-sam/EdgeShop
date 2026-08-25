// Shared types that used to live under src/themes/types.ts.
// Phase 5 (cart rewrite) will change the CartItem shape for composite
// product:size:design line keys — kept as-is for Phase 1.

export interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
  stock_count?: number
}

// ── Catalog (POD.md §6.1 / §8) ─────────────────────────────────────
// Matches the columns the worker actually returns — see
// worker/src/routes/products.ts and worker/src/types.ts.

export interface ProductSide {
  id: number
  product_id: number
  side: 'front' | 'back'
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
}
