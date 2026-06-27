import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  category: string
}

type SortKey = 'newest' | 'price-asc' | 'price-desc' | 'name-asc'

function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', 'noindex, nofollow')
  return () => el!.setAttribute('content', '')
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme, isLoading: themeLoading, navItems, settings } = useTheme()
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantityRaw = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const addToast = useToastStore((s) => s.addToast)

  function updateQuantity(productId: number, qty: number) {
    if (qty <= 0) addToast('Removed from cart', 'info')
    updateQuantityRaw(productId, qty)
  }

  const q = searchParams.get('q') ?? ''
  const activeCategory = searchParams.get('collection') ?? ''
  const [inputValue, setInputValue] = useState(q)
  const [sortKey, setSortKey] = useState<SortKey>('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => { setInputValue(q) }, [q])
  useEffect(() => setNoIndex(), [])

  const currency = settings.currency === 'INR' ? '₹' : (settings.currency ?? '₹')
  const storeName = settings.store_name ?? 'EdgeShop'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', q],
    queryFn: () =>
      fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => {
        if (!r.ok) throw new Error('Search failed')
        return r.json()
      }),
    enabled: q.length > 0,
  })

  const rawProducts: Product[] = data?.products ?? []

  // Build unique collection list from search results only
  const categoryOptions = useMemo(() => {
    const fromResults = rawProducts.map((p) => p.category).filter(Boolean)
    return Array.from(new Set(fromResults)).sort()
  }, [rawProducts])

  // Filter client-side by active category
  const filteredByCategory = useMemo(() => {
    if (!activeCategory) return rawProducts
    return rawProducts.filter(
      (p) => p.category.toLowerCase() === activeCategory.toLowerCase()
    )
  }, [rawProducts, activeCategory])

  // Sort client-side
  const products = useMemo(() => {
    const arr = [...filteredByCategory]
    switch (sortKey) {
      case 'price-asc':  return arr.sort((a, b) => a.price - b.price)
      case 'price-desc': return arr.sort((a, b) => b.price - a.price)
      case 'name-asc':   return arr.sort((a, b) => a.name.localeCompare(b.name))
      case 'newest':
      default:           return arr // API returns newest-first by default
    }
  }, [filteredByCategory, sortKey])

  const resultCount = products.length

  function setCategory(cat: string) {
    const next = new URLSearchParams(searchParams)
    if (cat) {
      next.set('collection', cat)
    } else {
      next.delete('collection')
    }
    setSearchParams(next, { replace: true })
  }

  const activeFilterCount = activeCategory ? 1 : 0

  if (themeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!theme) return null

  const { Header, Footer, ProductGrid, CartDrawer } = theme.components

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => openCart()}
        navItems={navItems}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Search form */}
        <form
          onSubmit={e => {
            e.preventDefault()
            const next = new URLSearchParams()
            next.set('q', inputValue.trim())
            navigate('/search?' + next.toString())
          }}
          className="flex gap-2 mb-6"
        >
          <input
            type="search"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder="Search products…"
            autoFocus
            className="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
          />
          <button
            type="submit"
            className="px-5 py-2.5 text-sm font-medium rounded-lg transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
          >
            Search
          </button>
        </form>

        <h1 className="text-2xl font-semibold mb-4">
          {q ? `Search results for "${q}"` : 'Search'}
        </h1>

        {/* Active filter pills */}
        {activeCategory && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, var(--color-bg))' }}
            >
              Collection: {activeCategory}
              <button
                aria-label="Clear collection filter"
                onClick={() => setCategory('')}
                className="ml-0.5 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--color-accent)' }}
              >
                ×
              </button>
            </span>
          </div>
        )}

        {/* Mobile filters toggle */}
        {q && !isLoading && data && categoryOptions.length > 0 && (
          <div className="md:hidden mb-4">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className="flex items-center gap-2 px-4 py-2 text-xs tracking-wide uppercase border rounded-lg transition-opacity hover:opacity-75"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
            >
              {/* Filter icon */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4" style={{ color: 'var(--color-accent)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)' }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Mobile collapsible filter panel */}
            {filtersOpen && (
              <div
                className="mt-3 p-4 border rounded-lg"
                style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', backgroundColor: 'var(--color-bg)' }}
              >
                <p className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-3" style={{ color: 'var(--color-accent)' }}>
                  Collection
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* All pill */}
                  <button
                    onClick={() => { setCategory(''); setFiltersOpen(false) }}
                    className="px-3 py-1 text-xs rounded-full border transition-colors duration-200"
                    style={
                      !activeCategory
                        ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)', borderColor: 'var(--color-accent)' }
                        : { backgroundColor: 'transparent', color: 'var(--color-primary)', borderColor: 'var(--color-accent)' }
                    }
                  >
                    All
                  </button>
                  {categoryOptions.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setFiltersOpen(false) }}
                      className="px-3 py-1 text-xs rounded-full border transition-colors duration-200"
                      style={
                        activeCategory.toLowerCase() === cat.toLowerCase()
                          ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)', borderColor: 'var(--color-accent)' }
                          : { backgroundColor: 'transparent', color: 'var(--color-primary)', borderColor: 'var(--color-accent)' }
                      }
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!q && (
          <p className="text-gray-500 text-sm">
            Type above to search products.
          </p>
        )}
        {q && isLoading && (
          <p className="text-sm text-gray-400">Searching…</p>
        )}
        {q && isError && (
          <p className="text-sm text-red-500">Search failed. Please try again.</p>
        )}

        {q && !isLoading && data && (
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
            {/* ---- Sidebar (desktop only) ---- */}
            <aside
              className="hidden md:block sticky top-8 p-5 border rounded-sm"
              style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', backgroundColor: 'var(--color-bg)' }}
            >
              <p className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-4" style={{ color: 'var(--color-accent)' }}>
                Collection
              </p>
              <div className="flex flex-col gap-2">
                {/* All */}
                <button
                  onClick={() => setCategory('')}
                  className="text-left px-3 py-1.5 text-xs rounded-full border transition-colors duration-200 w-fit"
                  style={
                    !activeCategory
                      ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)', borderColor: 'var(--color-accent)' }
                      : { backgroundColor: 'transparent', color: 'var(--color-primary)', borderColor: 'var(--color-accent)' }
                  }
                >
                  All
                </button>
                {categoryOptions.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="text-left px-3 py-1.5 text-xs rounded-full border transition-colors duration-200 w-fit"
                    style={
                      activeCategory.toLowerCase() === cat.toLowerCase()
                        ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-bg)', borderColor: 'var(--color-accent)' }
                        : { backgroundColor: 'transparent', color: 'var(--color-primary)', borderColor: 'var(--color-accent)' }
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </aside>

            {/* ---- Results column ---- */}
            <div>
              {/* Sort + count bar */}
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <p className="text-sm text-gray-500">
                  {resultCount} result{resultCount !== 1 ? 's' : ''}
                </p>
                <select
                  value={sortKey}
                  onChange={e => setSortKey(e.target.value as SortKey)}
                  className="text-xs border rounded-md px-3 py-1.5 focus:outline-none"
                  style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
                >
                  <option value="newest">Newest</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A–Z</option>
                </select>
              </div>

              {products.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No products found{activeCategory ? ` in "${activeCategory}"` : ''} for &ldquo;{q}&rdquo;.
                </p>
              ) : (
                <ProductGrid
                  products={products}
                  currency={currency}
                  onAddToCart={(productId: number) => {
                    const product = products.find((p: Product) => p.id === productId)
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
            </div>
          </div>
        )}
      </main>

      <Footer storeName={storeName} />
      <CartDrawer
        isOpen={cartOpen}
        items={items}
        currency={currency}
        onClose={() => closeCart()}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => {
          closeCart()
          navigate('/checkout')
        }}
      />
    </div>
  )
}
