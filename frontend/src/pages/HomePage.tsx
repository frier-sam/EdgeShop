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

interface ProductsData {
  products: Product[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function HomePage() {
  const { theme, isLoading: themeLoading, navItems } = useTheme()
  const [cartOpen, setCartOpen] = useState(false)
  const [page, setPage] = useState(1)
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

  const { data: productsData } = useQuery<ProductsData>({
    queryKey: ['products', page],
    queryFn: () => fetch(`/api/products?page=${page}&limit=12`).then((r) => r.json()),
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
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={() => setCartOpen(true)} navItems={navItems} />
      <main>
        <Hero storeName={storeName} tagline="Discover our collection" />
        <ProductGrid
          products={products}
          currency={currency}
          onAddToCart={(productId) => {
            const product = products.find((p) => p.id === productId)
            if (!product) return
            addItem({ product_id: product.id, name: product.name, price: product.price, quantity: 1, image_url: product.image_url })
          }}
        />
        {productsData && productsData.pages > 1 && (
          <div className="flex items-center justify-center gap-4 py-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">Page {page} of {productsData.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(productsData.pages, p + 1))}
              disabled={page === productsData.pages}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </main>
      <Footer storeName={storeName} />
      <CartDrawer isOpen={cartOpen} items={items} currency={currency} onClose={() => setCartOpen(false)} onUpdateQuantity={updateQuantity} onCheckout={() => { setCartOpen(false); navigate('/checkout') }} />
    </div>
  )
}
