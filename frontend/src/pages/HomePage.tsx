import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  stock_count: number
  category: string
}

interface Settings {
  store_name?: string
  active_theme?: string
  currency?: string
  [key: string]: string | undefined
}

export default function HomePage() {
  const { theme, isLoading: themeLoading, navItems } = useTheme()
  const [cartOpen, setCartOpen] = useState(false)
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()),
  })

  const storeName = settings?.store_name ?? 'EdgeShop'
  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')
  const products = productsData?.products ?? []

  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const { Header, Footer, Hero, ProductGrid, CartDrawer } = theme.components

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => setCartOpen(true)}
        navItems={navItems}
      />
      <main>
        <Hero storeName={storeName} tagline="Discover our collection" />
        <ProductGrid
          products={products}
          currency={currency}
          onAddToCart={(productId) => {
            const product = products.find((p) => p.id === productId)
            if (!product) return
            addItem({
              product_id: product.id,
              name: product.name,
              price: product.price,
              quantity: 1,
              image_url: product.image_url,
            })
          }}
        />
      </main>
      <Footer storeName={storeName} />
      <CartDrawer
        isOpen={cartOpen}
        items={items}
        currency={currency}
        onClose={() => setCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          setCartOpen(false)
          navigate('/checkout')
        }}
      />
    </div>
  )
}
