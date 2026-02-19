export interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  stock_count: number
  category: string
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
}

export interface OrderItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}

export interface Settings {
  store_name: string
  active_theme: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
  currency: string
}
