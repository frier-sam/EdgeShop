// frontend/src/pages/ShopPage.tsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'

interface Product {
  id: number
  name: string
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

type SortKey = 'newest' | 'price_asc' | 'price_desc'

export default function ShopPage() {
  const { theme, isLoading: themeLoading, navItems, footerData, settings } = useTheme()
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantityRaw = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  function updateQuantity(productId: number, qty: number) {
    if (qty <= 0) addToast('Removed from cart', 'info')
    updateQuantityRaw(productId, qty)
  }

  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sort, setSort] = useState<SortKey>('newest')

  const storeName = settings.store_name ?? 'EdgeShop'
  const currency = settings.currency === 'INR' ? '₹' : (settings.currency ?? '₹')

  // Fetch all products for category chips (limit=48, page=1, no category filter)
  const { data: allProductsData } = useQuery<ProductsData>({
    queryKey: ['products-all-categories'],
    queryFn: () => fetch('/api/products?limit=48').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  // Fetch filtered + paginated products
  const { data: productsData, isLoading: productsLoading } = useQuery<ProductsData>({
    queryKey: ['shop-products', page, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '48' })
      if (selectedCategory) params.set('category', selectedCategory)
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
    staleTime: 60 * 1000,
  })

  // Derive unique category list from the first page fetch
  const categories = useMemo<string[]>(() => {
    const all = allProductsData?.products ?? []
    const unique = Array.from(new Set(all.map((p) => p.category).filter(Boolean)))
    return unique.sort()
  }, [allProductsData])

  // Client-side sort of current page
  const products = useMemo<Product[]>(() => {
    const list = [...(productsData?.products ?? [])]
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') list.sort((a, b) => b.price - a.price)
    // 'newest' is the default API order (created_at DESC) — no sort needed
    return list
  }, [productsData, sort])

  function handleCategoryClick(cat: string) {
    setSelectedCategory(cat)
    setPage(1)
  }

  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const { Header, Footer, ProductGrid, CartDrawer } = theme.components

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={openCart}
        navItems={navItems}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page title */}
        <h1
          className="text-2xl font-semibold mb-6"
          style={{ color: 'var(--color-primary)' }}
        >
          All Products
          {productsData && (
            <span className="ml-3 text-sm font-normal opacity-50">
              ({productsData.total})
            </span>
          )}
        </h1>

        {/* Filter + sort bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 flex-1">
              <button
                onClick={() => handleCategoryClick('')}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedCategory === ''
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-bg)]'
                    : 'border-[var(--color-accent)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedCategory === cat
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-bg)]'
                      : 'border-[var(--color-accent)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs border rounded px-2 py-1.5 focus:outline-none shrink-0"
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
          </select>
        </div>

        {/* Product grid */}
        {productsLoading ? (
          <p className="text-sm opacity-50 py-16 text-center" style={{ color: 'var(--color-primary)' }}>
            Loading products…
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm opacity-50 py-16 text-center" style={{ color: 'var(--color-primary)' }}>
            No products found.
          </p>
        ) : (
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
              addToast('Added to cart')
            }}
          />
        )}

        {/* Pagination */}
        {productsData && productsData.pages > 1 && (
          <div className="flex items-center justify-center gap-4 py-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
            >
              ← Prev
            </button>
            <span className="text-sm opacity-50" style={{ color: 'var(--color-primary)' }}>
              Page {page} of {productsData.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(productsData.pages, p + 1))}
              disabled={page === productsData.pages}
              className="px-4 py-2 text-sm border rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <Footer storeName={storeName} footerData={footerData} />
      <CartDrawer
        isOpen={cartOpen}
        items={items}
        currency={currency}
        onClose={closeCart}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => { closeCart(); navigate('/checkout') }}
      />
    </div>
  )
}
