export interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  stock_count: number
  category: string
  created_at: string
  // v2 additions
  compare_price: number | null
  status: 'active' | 'draft'
  tags: string
  product_type: 'physical' | 'digital'
  digital_file_key: string
  weight: number
  seo_title: string
  seo_description: string
  images?: string[]
}

export interface ProductVariant {
  id: number
  product_id: number
  name: string
  options_json: string
  price: number
  stock_count: number
  image_url: string
  sku: string
  created_at: string
}

export interface ProductImage {
  id: number
  product_id: number
  url: string
  sort_order: number
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
  // structured address fields (migration 0007)
  shipping_city: string
  shipping_state: string
  shipping_pincode: string
  shipping_country: string
  // v2 additions
  discount_code: string
  discount_amount: number
  shipping_amount: number
  tax_amount: number
  tracking_number: string
  customer_notes: string
  internal_notes: string
  customer_id: number | null
}

export interface OrderItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}

export interface Customer {
  id: number
  email: string
  password_hash: string
  name: string
  phone: string
  created_at: string
  role: string          // 'customer' | 'staff' | 'super_admin'
  permissions_json: string  // JSON-encoded permissions map
}
