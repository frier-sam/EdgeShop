import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  seo_title: string | null
  seo_description: string | null
}

interface Review {
  id: number
  customer_name: string
  rating: number
  body: string
  created_at: string
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
  const queryClient = useQueryClient()

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

  const [reviewForm, setReviewForm] = useState({ customer_name: '', rating: 5, body: '' })
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: reviewsData } = useQuery<{ reviews: Review[] }>({
    queryKey: ['reviews', id],
    queryFn: () => fetch(`/api/products/${id}/reviews`).then(r => r.json()),
    enabled: !!id,
  })
  const reviewsList = reviewsData?.reviews ?? []

  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')

  useEffect(() => {
    if (!product) return
    document.title = product.seo_title || product.name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', product.seo_description || product.description.slice(0, 160))
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
    }
  }, [product])

  useEffect(() => {
    return () => {
      if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current)
    }
  }, [])

  const submitReviewMutation = useMutation({
    mutationFn: (reviewData: { customer_name: string; rating: number; body: string }) =>
      fetch(`/api/products/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData),
      }).then(async res => {
        if (!res.ok) {
          const err = await res.json() as { error?: string }
          throw new Error(err.error ?? 'Failed to submit review')
        }
      }),
    onSuccess: () => {
      setReviewSubmitted(true)
      setReviewForm({ customer_name: '', rating: 5, body: '' })
      queryClient.invalidateQueries({ queryKey: ['reviews', id] })
      reviewTimerRef.current = setTimeout(() => setReviewSubmitted(false), 5000)
    },
  })

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

        {/* Reviews section */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Customer Reviews {reviewsList.length > 0 && `(${reviewsList.length})`}
          </h2>
          {reviewsList.length === 0 ? (
            <p className="text-sm text-gray-400 mb-8">No reviews yet. Be the first to review!</p>
          ) : (
            <div className="space-y-4 mb-8">
              {reviewsList.map(review => (
                <div key={review.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{review.customer_name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[1,2,3,4,5].map(star => (
                      <span key={star} className={star <= review.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">{review.body}</p>
                </div>
              ))}
            </div>
          )}

          {reviewSubmitted ? (
            <p className="text-sm text-green-600">Thank you! Your review has been submitted for moderation.</p>
          ) : (
            <form onSubmit={e => { e.preventDefault(); submitReviewMutation.mutate(reviewForm) }} className="space-y-3 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-800">Write a Review</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Your Name *</label>
                <input required maxLength={100} value={reviewForm.customer_name} onChange={e => setReviewForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rating *</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button key={star} type="button" onClick={() => setReviewForm(f => ({ ...f, rating: star }))}
                      className={`text-2xl ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}>
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Review *</label>
                <textarea required maxLength={2000} rows={3} value={reviewForm.body} onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              {submitReviewMutation.isError && <p className="text-xs text-red-500">{(submitReviewMutation.error as Error)?.message ?? 'Failed to submit review'}</p>}
              <button type="submit" disabled={submitReviewMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50">
                {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
