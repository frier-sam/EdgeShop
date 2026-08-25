import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProductGrid from '../components/ProductGrid'
import CartDrawer from '../components/CartDrawer'
import type { ProductSummary } from '../lib/types'

interface ProductsData {
  products: ProductSummary[]
  total: number
  page: number
  limit: number
  pages: number
}

export default function ShopPage() {
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const addLine = useCartStore((s) => s.addLine)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const lines = useCartStore((s) => s.lines)
  const totalItems = useCartStore((s) => s.totalItems)
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const currency = currencySymbol(storeCurrency)

  // Broad, unfiltered fetch just to derive the category chip list.
  const { data: allProductsData } = useQuery<ProductsData>({
    queryKey: ['products-all-categories'],
    queryFn: () => fetch('/api/products?limit=48').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: productsData, isLoading } = useQuery<ProductsData>({
    queryKey: ['shop-products', page, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '24' })
      if (selectedCategory) params.set('category', selectedCategory)
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
    staleTime: 60 * 1000,
  })

  const categories = useMemo<string[]>(() => {
    const all = allProductsData?.products ?? []
    return Array.from(new Set(all.map((p) => p.category).filter(Boolean))).sort()
  }, [allProductsData])

  const products = productsData?.products ?? []

  function handleCategoryClick(cat: string) {
    setSelectedCategory(cat)
    setPage(1)
  }

  function handleAddToCart(productId: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    addLine({
      product_id: product.id,
      name: product.name,
      size: null,
      design_id: null,
      preview_url: product.front_image,
      base_price: product.base_price,
      size_delta: 0,
      print_fees: [],
      unit_price: product.base_price,
      quantity: 1,
    })
    addToast('Added to cart')
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          All Products
          {productsData && <span className="ml-3 text-sm font-normal text-ink-soft">({productsData.total})</span>}
        </h1>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryClick('')}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === '' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  selectedCategory === cat ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="mt-8">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-ink-soft">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-soft">No products found.</p>
          ) : (
            <ProductGrid
              products={products.map((p) => ({
                id: p.id,
                name: p.name,
                price: p.base_price,
                compare_price: p.compare_price,
                image_url: p.front_image ?? '',
                is_customizable: p.is_customizable,
              }))}
              currency={currency}
              onAddToCart={handleAddToCart}
            />
          )}
        </div>

        {productsData && productsData.pages > 1 && (
          <div className="flex items-center justify-center gap-4 py-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-ink-soft">
              Page {page} of {productsData.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(productsData.pages, p + 1))}
              disabled={page === productsData.pages}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <Footer storeName={storeName} links={FOOTER_LINKS} />
      <CartDrawer
        isOpen={cartOpen}
        lines={lines}
        currency={currency}
        onClose={closeCart}
        onUpdateQuantity={updateQuantity}
        onRemove={removeItem}
        onCheckout={() => {
          closeCart()
          navigate('/checkout')
        }}
      />
    </div>
  )
}
