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

export interface Collection {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
  parent_id: number | null
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
}

export interface CustomerAddress {
  id: number
  customer_id: number
  label: string
  address_line: string
  city: string
  state: string
  pincode: string
  country: string
  is_default: number
}

export interface DiscountCode {
  id: number
  code: string
  type: 'percent' | 'fixed' | 'free_shipping'
  value: number
  min_order_amount: number
  max_uses: number
  uses_count: number
  expires_at: string | null
  is_active: number
  created_at: string
}

export interface Page {
  id: number
  slug: string
  title: string
  content_html: string
  meta_title: string
  meta_description: string
  is_visible: number
  created_at: string
}

export interface ShippingZone {
  id: number
  name: string
  countries_json: string
}

export interface ShippingRate {
  id: number
  zone_id: number
  name: string
  min_weight: number
  max_weight: number
  price: number
  free_above_cart_total: number
}

export interface BlogPost {
  id: number
  slug: string
  title: string
  content_html: string
  cover_image: string
  author: string
  tags: string
  published_at: string | null
  seo_title: string
  seo_description: string
  created_at: string
}

export interface Review {
  id: number
  product_id: number
  customer_name: string
  rating: number
  body: string
  is_approved: number
  created_at: string
}

export interface Settings {
  store_name: string
  active_theme: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
  currency: string
  // v2 additions
  email_provider: string
  email_api_key: string
  email_from_name: string
  email_from_address: string
  merchant_email: string
  navigation_json: string
  announcement_bar_text: string
  announcement_bar_enabled: string
  announcement_bar_color: string
  theme_overrides_json: string
  jwt_secret: string
}
