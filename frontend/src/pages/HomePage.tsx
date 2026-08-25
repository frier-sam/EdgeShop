import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import { SkeletonCards } from '../components/Skeleton'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProductGrid from '../components/ProductGrid'
import CartDrawer from '../components/CartDrawer'

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
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const [page, setPage] = useState(1)
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantityRaw = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const addToast = useToastStore((s) => s.addToast)

  function addItemWithToast(item: Parameters<typeof addItem>[0]) {
    addItem(item)
    addToast('Added to cart')
  }

  function updateQuantity(productId: number, qty: number) {
    if (qty <= 0) addToast('Removed from cart', 'info')
    updateQuantityRaw(productId, qty)
  }

  const { data: productsData, isLoading: productsLoading } = useQuery<ProductsData>({
    queryKey: ['products', page],
    queryFn: () => fetch(`/api/products?page=${page}&limit=12`).then((r) => r.json()),
    staleTime: 60 * 1000,
  })

  const currency = currencySymbol(storeCurrency)
  const products = productsData?.products ?? []

  useEffect(() => {
    const name = storeName
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
  }, [storeName])

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />
      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-4">
            {storeName}
          </h1>
          <p className="text-sm sm:text-base text-gray-500 max-w-xl mx-auto mb-8">
            Discover our collection — thoughtfully made, delivered to your door.
          </p>
          <button
            onClick={() => navigate('/shop')}
            className="inline-block px-8 py-3 text-sm font-medium tracking-wide uppercase bg-gray-900 text-white rounded hover:opacity-90 transition-opacity"
          >
            Shop Now
          </button>
        </section>

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
              addItemWithToast({ product_id: product.id, name: product.name, price: product.price, quantity: 1, image_url: product.image_url })
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
      <Footer storeName={storeName} links={FOOTER_LINKS} />
      <CartDrawer isOpen={cartOpen} items={items} currency={currency} onClose={closeCart} onUpdateQuantity={updateQuantity} onCheckout={() => { closeCart(); navigate('/checkout') }} />
    </div>
  )
}
