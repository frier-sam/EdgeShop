import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
  seo_title: string
  seo_description: string
}

interface Settings {
  store_name?: string
  currency?: string
  [key: string]: string | undefined
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addItem = useCartStore((s) => s.addItem)

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => fetch(`/api/products/${id}`).then((r) => {
      if (!r.ok) throw new Error('Not found')
      return r.json()
    }),
    enabled: !!id,
  })

  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')

  useEffect(() => {
    if (!product) return
    document.title = product.seo_title || product.name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', product.seo_description || product.description.slice(0, 160))
  }, [product])

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>
  if (error || !product) return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-red-400">Product not found. <Link to="/" className="underline">Go back</Link></p></div>

  // Use theme-neutral styling for product detail page (works with any theme)
  return (
    <div className="min-h-screen bg-inherit">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-800 mb-8 flex items-center gap-1">
          ← Back
        </button>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {product.image_url
              ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
            }
          </div>
          <div className="flex flex-col justify-center">
            {product.category && <p className="text-xs text-gray-400 tracking-wider uppercase mb-2">{product.category}</p>}
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-3">{product.name}</h1>
            <p className="text-xl text-gray-700 mb-4">{currency}{product.price.toFixed(2)}</p>
            {product.description && <p className="text-sm text-gray-500 leading-relaxed mb-6">{product.description}</p>}
            <p className="text-xs text-gray-400 mb-4">{product.stock_count} in stock</p>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center border border-gray-300 rounded">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 text-gray-500 hover:text-gray-800">−</button>
                <span className="px-3 text-sm">{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock_count, qty + 1))} className="px-3 py-2 text-gray-500 hover:text-gray-800">+</button>
              </div>
              <button
                onClick={() => {
                  addItem({ product_id: product.id, name: product.name, price: product.price, quantity: qty, image_url: product.image_url })
                  setAdded(true)
                  setTimeout(() => setAdded(false), 2000)
                }}
                disabled={product.stock_count === 0}
                className="flex-1 py-3 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {added ? 'Added!' : product.stock_count === 0 ? 'Out of stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
