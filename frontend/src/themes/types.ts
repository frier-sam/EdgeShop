import type { ComponentType } from 'react'

export interface ProductCardProps {
  id: number
  name: string
  price: number
  image_url: string
  currency: string
  onAddToCart: () => void
}

export interface HeaderProps {
  storeName: string
  cartCount: number
  onCartOpen: () => void
}

export interface FooterProps {
  storeName: string
}

export interface HeroProps {
  storeName: string
  tagline: string
}

export interface ProductGridProps {
  products: Array<{
    id: number
    name: string
    price: number
    image_url: string
    category: string
  }>
  currency: string
  onAddToCart: (productId: number) => void
}

export interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}

export interface CartDrawerProps {
  isOpen: boolean
  items: CartItem[]
  currency: string
  onClose: () => void
  onUpdateQuantity: (productId: number, quantity: number) => void
  onCheckout: () => void
}

export interface ThemeOverrides {
  '--color-primary'?: string
  '--color-accent'?: string
  '--color-bg'?: string
  '--color-text'?: string
  '--font-heading'?: string
  '--font-body'?: string
  '--logo-url'?: string
  '--tagline'?: string
  '--hero-image'?: string
}

export interface Theme {
  id: string
  name: string
  description: string
  defaultCssVars: ThemeOverrides
  components: {
    Header: ComponentType<HeaderProps>
    Footer: ComponentType<FooterProps>
    Hero: ComponentType<HeroProps>
    ProductCard: ComponentType<ProductCardProps>
    ProductGrid: ComponentType<ProductGridProps>
    CartDrawer: ComponentType<CartDrawerProps>
  }
}
