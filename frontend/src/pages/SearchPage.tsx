import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  category: string
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme, isLoading: themeLoading, navItems, settings } = useTheme()
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const [cartOpen, setCartOpen] = useState(false)

  const q = searchParams.get('q') ?? ''
  const [inputValue, setInputValue] = useState(q)

  useEffect(() => { setInputValue(q) }, [q])

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

  if (themeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!theme) return null

  const { Header, Footer, ProductGrid, CartDrawer } = theme.components
  const products: Product[] = data?.products ?? []
  const resultCount = data?.total ?? products.length ?? 0

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => setCartOpen(true)}
        navItems={navItems}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <form
          onSubmit={e => { e.preventDefault(); navigate('/search?q=' + encodeURIComponent(inputValue.trim())) }}
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
        <h1 className="text-2xl font-semibold mb-6">
          {q ? `Search results for "${q}"` : 'Search'}
        </h1>
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
          <>
            <p className="text-sm text-gray-500 mb-4">
              {resultCount} result{resultCount !== 1 ? 's' : ''}
            </p>
            {products.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No products found for &ldquo;{q}&rdquo;.
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
                }}
              />
            )}
          </>
        )}
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
