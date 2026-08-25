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
