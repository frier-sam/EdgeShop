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
  seo_title: string
  seo_description: string
  created_at: string
  // present on list/detail responses via LEFT JOIN — not a real column
  front_image?: string | null
}

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
