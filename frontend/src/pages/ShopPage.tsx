import { useState, useMemo, useEffect, useRef } from 'react'
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
import IconButton from '../components/ui/IconButton'
import Skeleton from '../components/ui/Skeleton'
import Icon from '../components/ui/Icon'
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
  // fresh page load has to be able to land already filtered. `?q=` (POD-
  // UI4.md §5 C.9 / §4.1) works the same way: the header search (another
  // lane) navigates here with `/shop?q=…`.
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedCategory = searchParams.get('category') ?? ''
  const activeQuery = (searchParams.get('q') ?? '').trim()
  const [sort, setSort] = useState<SortOption>('newest')

  // Local, immediately-responsive input state, debounced into the URL —
  // typing shouldn't fire a network request (or a browser-history entry)
  // on every keystroke, but the field still has to reflect `?q=` when it
  // arrives from elsewhere (the header search navigating straight here).
  const [searchInput, setSearchInput] = useState(activeQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchInput(activeQuery)
    // Only re-sync when the URL's own query changes (e.g. a fresh
    // navigation), not on every render — `activeQuery` is derived fresh
    // each render but only actually changes value when the URL does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function commitQuery(value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value.trim()) next.set('q', value.trim())
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }

  function handleSearchInputChange(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => commitQuery(value), 300)
  }

  function handleClearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchInput('')
    commitQuery('')
  }

  // Reset pagination whenever either filter changes — covers both this
  // page's own category chips/search box AND a fresh `/shop?q=…` or
  // `/shop?category=…` navigation landing here from elsewhere.
  useEffect(() => {
    setPage(1)
  }, [selectedCategory, activeQuery])

  const currency = currencySymbol(storeCurrency)

  // Broad, unfiltered fetch just to derive the category chip list. Not
  // scoped to the current search — the chip list is "what categories
  // exist", independent of what's currently typed in the search box.
  const { data: allProductsData } = useQuery<ProductsData>({
    queryKey: ['products-all-categories'],
    queryFn: () => fetchJson<ProductsData>('/api/products?limit=48'),
    staleTime: 5 * 60 * 1000,
  })

  const { data: productsData, isLoading } = useQuery<ProductsData>({
    queryKey: ['shop-products', page, selectedCategory, activeQuery],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '24' })
      if (selectedCategory) params.set('category', selectedCategory)
      if (activeQuery) params.set('q', activeQuery)
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
  // GET /api/products (worker/src/routes/products.ts) has no `?sort=` param.
  // Its default order is already `created_at DESC`, so "Newest" is a
  // genuine pass-through; "Price: Low/High" only re-order the ≤24 rows
  // already on screen, they do NOT re-rank the whole catalogue across
  // pages. That's an intentional, documented scope limit rather than a
  // control that quietly does nothing — see POD-UI2.md §3/G2.
  const sortedProducts = useMemo(() => {
    if (sort === 'newest') return products
    const copy = [...products]
    copy.sort((a, b) => (sort === 'price-asc' ? a.base_price - b.base_price : b.base_price - a.base_price))
    return copy
  }, [products, sort])

  function handleCategoryClick(cat: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (cat) next.set('category', cat)
        else next.delete('category')
        return next
      },
      { replace: true },
    )
  }

  function handleAddToCart(productId: number) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    addLine({
      product_id: product.id,
      name: product.name,
      size: null,
      variant: null,
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

  // POD-UI4.md §5 C.9 — "no results for this query" reads differently from
  // "no products at all": the former is fixable (clear the search/filter),
  // the latter isn't something the shopper can do anything about.
  const hasActiveFilter = !!selectedCategory || !!activeQuery
  const noResultsHeading = activeQuery ? `No results for “${activeQuery}”` : 'No products found'

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

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-10 md:py-16">
        <h1 className="font-display text-headline-md capitalize text-ink md:text-headline-lg">
          {selectedCategory || 'All Products'}
        </h1>

        {/* Filter bar — category chips + the search box, both URL-backed and
            combinable (POD-UI4.md §5 C.9). */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {categories.length > 0 && (
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 hide-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              <button
                onClick={() => handleCategoryClick('')}
                className={`flex min-h-11 shrink-0 snap-start items-center rounded-pill border px-3.5 text-xs font-medium transition-colors duration-fast ${
                  selectedCategory === '' ? 'border-accent bg-accent-soft text-on-accent-soft' : 'border-line text-ink-soft hover:border-ink/30 hover:text-ink'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`flex min-h-11 shrink-0 snap-start items-center rounded-pill border px-3.5 text-xs font-medium capitalize transition-colors duration-fast ${
                    selectedCategory === cat ? 'border-accent bg-accent-soft text-on-accent-soft' : 'border-line text-ink-soft hover:border-ink/30 hover:text-ink'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Search — a compact, `sm:` right-aligned field rather than
              Field/SelectField (another lane's, and both force a visible
              label above the control, which doesn't fit this toolbar). */}
          <div className="relative w-full sm:w-64">
            <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              inputMode="search"
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="h-11 w-full rounded-btn border border-line bg-surface pl-10 pr-9 text-sm text-ink placeholder:text-ink-faint transition-colors duration-fast focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {searchInput && (
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <IconButton variant="ghost" size="sm" aria-label="Clear search" onClick={handleClearSearch}>
                  <Icon name="close" size={16} />
                </IconButton>
              </span>
            )}
          </div>
        </div>

        {/* Result count + sort — sort is intentionally scoped, see comment above `sortedProducts`. */}
        <div className="mt-6 flex items-center justify-between gap-4 border-b border-line pb-4">
          <p className="text-sm text-ink-soft">
            {isLoading ? 'Loading…' : `${productsData?.total ?? 0} product${(productsData?.total ?? 0) === 1 ? '' : 's'}`}
            {activeQuery && !isLoading && (
              <>
                {' '}
                for <span className="font-medium text-ink">“{activeQuery}”</span>
              </>
            )}
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
            <Icon name="expand_more" size={18} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
          </div>
        </div>

        <div className="mt-8">
          {isLoading ? (
            <ShopSkeletonGrid count={8} />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface py-20 text-center">
              <Icon name="inventory_2" size={40} className="text-ink-faint" />
              <p className="text-sm font-semibold text-ink">{noResultsHeading}</p>
              <p className="max-w-xs text-sm text-ink-soft">
                {activeQuery
                  ? `We couldn't find anything matching "${activeQuery}"${selectedCategory ? ` in "${selectedCategory}"` : ''}. Try a different search.`
                  : selectedCategory
                    ? `We couldn't find anything in "${selectedCategory}" right now.`
                    : 'Check back soon — new products are on the way.'}
              </p>
              {hasActiveFilter && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    handleClearSearch()
                    handleCategoryClick('')
                  }}
                  className="mt-1"
                >
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
                back_image_url: p.back_image,
                is_customizable: p.is_customizable,
                min_order_qty: p.min_order_qty,
                lowest_break: p.lowest_break,
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
              className="min-h-11 rounded-pill border border-line px-4 py-2 text-sm text-ink transition-colors duration-fast hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-ink-soft">
              Page {page} of {productsData.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(productsData.pages, p + 1))}
              disabled={page === productsData.pages}
              className="min-h-11 rounded-pill border border-line px-4 py-2 text-sm text-ink transition-colors duration-fast hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
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
