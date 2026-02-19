import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

interface Product {
  id: number
  name: string
  price: number
  image_url: string
  category: string
  created_at: string
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { theme, isLoading: themeLoading, navItems, settings } = useTheme()
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const [cartOpen, setCartOpen] = useState(false)

  const sort = searchParams.get('sort') ?? 'newest'
  const currency = settings.currency === 'INR' ? '₹' : (settings.currency ?? '₹')
  const storeName = settings.store_name ?? 'EdgeShop'

  const { data, isLoading, isError } = useQuery({
    queryKey: ['collection', slug],
    queryFn: () =>
      fetch(`/api/collections/${slug}`).then((r) => {
        if (!r.ok) throw new Error('Collection not found')
        return r.json()
      }),
    enabled: !!slug,
  })

  useEffect(() => {
    if (!data?.collection) return
    const col = data.collection
    document.title = col.seo_title || col.name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', col.seo_description || col.description?.slice(0, 160) || '')
    setMetaProperty('og:title', col.seo_title || col.name)
    setMetaProperty('og:description', col.seo_description || col.description?.slice(0, 160) || '')
    setMetaProperty('og:image', col.image_url || '')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:image', '')
    }
  }, [data])

  if (themeLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!theme) return null

  if (isError || !data?.collection) {
    return (
      <div className="p-8 text-center text-gray-500">Collection not found.</div>
    )
  }

  const { Header, Footer, ProductGrid, CartDrawer } = theme.components

  // Client-side sort
  const products = [...(data.products ?? [])].sort(
    (a: Product, b: Product) => {
      if (sort === 'price_asc') return a.price - b.price
      if (sort === 'price_desc') return b.price - a.price
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  )

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => setCartOpen(true)}
        navItems={navItems}
      />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl font-bold mb-2">{data.collection.name}</h1>
        {data.collection.description && (
          <p className="text-gray-600 mb-6">{data.collection.description}</p>
        )}
        {/* Sort controls */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'newest', label: 'Newest' },
            { key: 'price_asc', label: 'Price ↑' },
            { key: 'price_desc', label: 'Price ↓' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSearchParams({ sort: key })}
              className={`px-3 py-1 text-sm rounded border ${
                sort === key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'border-gray-300 hover:border-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {products.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No products in this collection yet.
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
