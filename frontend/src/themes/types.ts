import type { ComponentType } from 'react'

export interface ProductCardProps {
  id: number
  name: string
  price: number
  compare_price?: number | null
  image_url: string
  images?: string[]
  currency: string
  onAddToCart: () => void
}

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface FooterData {
  tagline?: string
  columns?: FooterColumn[]
  socials?: {
    instagram?: string
    facebook?: string
    whatsapp?: string
  }
  copyright?: string
}

export interface NavItem {
  label: string
  href: string
  type?: 'link' | 'collection' | 'page'
  children?: NavItem[]
}

export interface HeaderProps {
  storeName: string
  cartCount: number
  onCartOpen: () => void
  navItems: NavItem[]
}

export interface FooterProps {
  storeName: string
  footerData?: FooterData
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
    compare_price?: number | null
    image_url: string
    images?: string[]
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
