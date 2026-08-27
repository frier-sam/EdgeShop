import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchJson } from '../lib/api'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProductGrid from '../components/ProductGrid'
import CartDrawer from '../components/CartDrawer'
import Button from '../components/Button'
import Skeleton from '../components/ui/Skeleton'
import type { ProductSummary } from '../lib/types'
// Value-only import (no component render) — see the matching comment in
// ProductPage.tsx: App.tsx renders `<MobileBottomNav>` globally on /shop
// too, so this page's own bottom padding needs to clear its real height
// (plus safe area) rather than the flat guess this page shipped with
// before that global nav existed.
import { MOBILE_NAV_HEIGHT } from '../components/MobileBottomNav'

interface ProductsData {
  products: ProductSummary[]
  total: number
  page: number
  limit: number
  pages: number
}

type SortOption = 'newest' | 'price-asc' | 'price-desc'

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest',
  'price-asc': 'Price: Low to High',
  'price-desc': 'Price: High to Low',
}

function SortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function EmptyBoxIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  )
}

/** Skeleton placeholder matching the real card layout (uniform square ground + two text lines) — POD-UI2.md §3/G2. */
function ShopSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <Skeleton shape="rect" height="auto" className="aspect-square w-full" />
          <Skeleton shape="text" width="70%" className="mt-3" />
          <Skeleton shape="text" width="35%" className="mt-2" />
        </div>
      ))}
    </div>
  )
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
  // The category filter is the one piece of ShopPage state that needs to be
  // a URL param, not just component state — the homepage's category tiles
  // link straight to `/shop?category=<slug>` (POD-UI2.md §3/F3), so a
  // fresh page load has to be able to land already filtered.
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategory = searchParams.get('category') ?? ''
  const [sort, setSort] = useState<SortOption>('newest')

  const currency = currencySymbol(storeCurrency)

  // Broad, unfiltered fetch just to derive the category chip list.
  const { data: allProductsData } = useQuery<ProductsData>({
    queryKey: ['products-all-categories'],
    queryFn: () => fetchJson<ProductsData>('/api/products?limit=48'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: productsData, isLoading } = useQuery<ProductsData>({
    queryKey: ['shop-products', page, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '24' })
      if (selectedCategory) params.set('category', selectedCategory)
      return fetchJson<ProductsData>(`/api/products?${params}`)
    },
    staleTime: 60 * 1000,
  })

  const categories = useMemo<string[]>(() => {
    const all = allProductsData?.products ?? []
    return Array.from(new Set(all.map((p) => p.category).filter(Boolean))).sort()
  }, [allProductsData])

  const products = productsData?.products ?? []

  // ── Sort — client-side over the already-fetched page only ─────────────
  // GET /api/products (worker/src/routes/products.ts, frozen this round)
  // has no `?sort=` param and no search endpoint exists at all. Its default
  // order is already `created_at DESC`, so "Newest" is a genuine pass-
  // through; "Price: Low/High" only re-order the ≤24 rows already on
  // screen, they do NOT re-rank the whole catalogue across pages. That's an
  // intentional, documented scope limit rather than a control that quietly
  // does nothing — see POD-UI2.md §3/G2.
  const sortedProducts = useMemo(() => {
    if (sort === 'newest') return products
    const copy = [...products]
    copy.sort((a, b) => (sort === 'price-asc' ? a.base_price - b.base_price : b.base_price - a.base_price))
    return copy
  }, [products, sort])

  function handleCategoryClick(cat: string) {
    setPage(1)
    setSearchParams(cat ? { category: cat } : {}, { replace: true })
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
    // `--mobile-nav-h` feeds the arbitrary-value calc() below — a real CSS
    // var, not a Tailwind-interpolated class (arbitrary-value utilities are
    // resolved by static analysis at build time and can't see a JS
    // constant). Reserves space for the app-wide bottom tab bar plus the
    // home-indicator safe area so the footer/pagination controls never end
    // up rendered underneath it.
    <div
      className="min-h-screen pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:pb-0"
      style={{ '--mobile-nav-h': `${MOBILE_NAV_HEIGHT}px` } as React.CSSProperties}
    >
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <h1 className="font-display text-[1.75rem] font-bold capitalize tracking-[-0.02em] text-ink md:text-[2.5rem]">
          {selectedCategory || 'All Products'}
        </h1>

        {categories.length > 0 && (
          <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <button
              onClick={() => handleCategoryClick('')}
              className={`flex min-h-11 shrink-0 snap-start items-center rounded-full border px-3.5 text-xs font-medium transition-colors duration-fast ${
                selectedCategory === '' ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`flex min-h-11 shrink-0 snap-start items-center rounded-full border px-3.5 text-xs font-medium capitalize transition-colors duration-fast ${
                  selectedCategory === cat ? 'border-ink bg-ink text-paper' : 'border-line text-ink-soft hover:border-ink hover:text-ink'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Result count + sort — sort is intentionally scoped, see comment above `sortedProducts`. */}
        <div className="mt-6 flex items-center justify-between gap-4 border-b border-line pb-4">
          <p className="text-sm text-ink-soft">
            {isLoading ? 'Loading…' : `${productsData?.total ?? 0} product${(productsData?.total ?? 0) === 1 ? '' : 's'}`}
          </p>
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              aria-label="Sort products"
              className="h-11 min-w-11 appearance-none rounded-btn border border-line bg-surface py-2 pl-3.5 pr-9 text-sm font-medium text-ink transition-colors duration-fast hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <option key={opt} value={opt}>
                  {SORT_LABELS[opt]}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft">
              <SortIcon />
            </span>
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <ShopSkeletonGrid count={8} />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface py-20 text-center">
              <span className="text-ink-faint">
                <EmptyBoxIcon />
              </span>
              <p className="text-sm font-semibold text-ink">No products found</p>
              <p className="max-w-xs text-sm text-ink-soft">
                {selectedCategory
                  ? `We couldn't find anything in "${selectedCategory}" right now.`
                  : 'Check back soon — new products are on the way.'}
              </p>
              {selectedCategory && (
                <Button variant="secondary" size="sm" onClick={() => handleCategoryClick('')} className="mt-1">
                  View all products
                </Button>
              )}
            </div>
          ) : (
            <ProductGrid
              products={sortedProducts.map((p) => ({
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
              className="min-h-11 rounded-full border border-line px-4 py-2 text-sm text-ink transition-colors duration-fast hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-ink-soft">
              Page {page} of {productsData.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(productsData.pages, p + 1))}
              disabled={page === productsData.pages}
              className="min-h-11 rounded-full border border-line px-4 py-2 text-sm text-ink transition-colors duration-fast hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
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
