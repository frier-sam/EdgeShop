import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'
import { SkeletonCards } from '../components/Skeleton'

interface Product {
  id: number
  name: string
  description: string
  price: number
  compare_price?: number | null
  image_url: string
  images?: string[]
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

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

export default function HomePage() {
  const { theme, isLoading: themeLoading, navItems, footerData } = useTheme()
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
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

  const { data: productsData, isLoading: productsLoading } = useQuery<ProductsData>({
    queryKey: ['products', page],
    queryFn: () => fetch(`/api/products?page=${page}&limit=12`).then((r) => r.json()),
    staleTime: 60 * 1000,
  })

  const storeName = settings?.store_name ?? 'EdgeShop'
  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')
  const products = productsData?.products ?? []

  useEffect(() => {
    const name = settings?.store_name ?? 'EdgeShop'
    const desc = `Shop ${name} — discover our handpicked collection.`
    document.title = name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', desc)
    setMetaProperty('og:title', name)
    setMetaProperty('og:description', desc)
    setMetaProperty('og:url', window.location.origin + '/')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:url', '')
    }
  }, [settings?.store_name])

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
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={navItems} />
      <main>
        <Hero storeName={storeName} tagline="Discover our collection" />
        {productsLoading ? (
          <div className="max-w-6xl mx-auto px-4 py-8">
            <SkeletonCards count={8} />
          </div>
        ) : (
          <ProductGrid
            products={products}
            currency={currency}
            onAddToCart={(productId) => {
              const product = products.find((p) => p.id === productId)
              if (!product) return
              addItem({ product_id: product.id, name: product.name, price: product.price, quantity: 1, image_url: product.image_url })
            }}
          />
        )}
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
      <Footer storeName={storeName} footerData={footerData} />
      <CartDrawer isOpen={cartOpen} items={items} currency={currency} onClose={closeCart} onUpdateQuantity={updateQuantity} onCheckout={() => { closeCart(); navigate('/checkout') }} />
    </div>
  )
}
