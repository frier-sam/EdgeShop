import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'

interface ProductVariant {
  id: number
  product_id: number
  name: string
  options_json: string  // JSON string e.g. '{"Size":"M","Color":"Red"}'
  price: number
  stock_count: number
  image_url: string
  sku: string
}

interface Product {
  id: number
  name: string
  description: string
  price: number
  compare_price: number | null
  image_url: string
  stock_count: number
  category: string
  product_type: 'physical' | 'digital'
  digital_file_key: string
  seo_title: string | null
  seo_description: string | null
  variants?: ProductVariant[]
  images?: Array<{ id: number; url: string; sort_order: number }>
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

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

// Parse options_json from a variant into a key-value map
function parseOptions(optionsJson: string): Record<string, string> {
  try { return JSON.parse(optionsJson) as Record<string, string> }
  catch { return {} }
}

// Group variants by option key to build picker UI
function buildOptionGroups(variants: ProductVariant[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const v of variants) {
    const opts = parseOptions(v.options_json)
    for (const [key, val] of Object.entries(opts)) {
      if (!groups.has(key)) groups.set(key, [])
      const existing = groups.get(key)!
      if (!existing.includes(val)) existing.push(val)
    }
  }
  return groups
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { theme, isLoading: themeLoading, navItems, footerData } = useTheme()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [manualImage, setManualImage] = useState<string | null>(null)
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const updateQuantityRaw = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const addItem = useCartStore((s) => s.addItem)
  const addToast = useToastStore((s) => s.addToast)

  function updateQuantity(productId: number, qty: number) {
    if (qty <= 0) addToast('Removed from cart', 'info')
    updateQuantityRaw(productId, qty)
  }
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

  const { data: recommendedData } = useQuery<{ products: Array<{ id: number; name: string; price: number; image_url: string; images: string[]; stock_count: number }> }>({
    queryKey: ['recommended', product?.category, id],
    queryFn: () =>
      fetch(`/api/products?category=${encodeURIComponent(product!.category)}&exclude=${id}&limit=4`)
        .then(r => r.json()),
    enabled: !!product?.category && !!id,
    staleTime: 60 * 1000,
  })
  const recommendedProducts = recommendedData?.products ?? []

  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')

  // Initialize default selected options when product loads
  useEffect(() => {
    if (!product?.variants?.length) return
    const groups = buildOptionGroups(product.variants)
    const defaults: Record<string, string> = {}
    for (const [key, vals] of groups.entries()) {
      defaults[key] = vals[0]
    }
    setSelectedOptions(defaults)
  }, [product])

  // Reset manual image override when variant selection changes
  useEffect(() => {
    setManualImage(null)
  }, [selectedOptions])

  // Find the matching variant for current selections
  const variants = product?.variants ?? []
  const optionGroups = variants.length > 0 ? buildOptionGroups(variants) : new Map<string, string[]>()

  const selectedVariant = variants.length > 0
    ? variants.find(v => {
        const opts = parseOptions(v.options_json)
        return Object.entries(selectedOptions).every(([k, val]) => opts[k] === val)
      }) ?? null
    : null

  const displayPrice = selectedVariant ? selectedVariant.price : (product?.price ?? 0)
  const displayStock = selectedVariant ? selectedVariant.stock_count : (product?.stock_count ?? 0)
  const displayImage = manualImage ?? (selectedVariant?.image_url || product?.image_url) ?? ''

  const isDigital = product?.product_type === 'digital'

  useEffect(() => {
    if (!product) return
    document.title = product.seo_title || product.name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', product.seo_description || product.description.slice(0, 160))
    setMetaProperty('og:title', product.seo_title || product.name)
    setMetaProperty('og:description', product.seo_description || product.description.slice(0, 160))
    setMetaProperty('og:image', product.image_url)
    setMetaProperty('og:url', window.location.href)
    setMetaProperty('og:type', 'product')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:image', '')
      setMetaProperty('og:url', '')
      setMetaProperty('og:type', 'website')
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

  function handleAddToCart() {
    if (!product) return
    addItem({
      product_id: product.id,
      name: product.name,
      price: displayPrice,
      quantity: qty,
      image_url: displayImage,
      stock_count: displayStock,
    })
    addToast('Added to cart')
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p className="text-sm" style={{ color: 'var(--color-accent)' }}>Loading...</p>
    </div>
  )
  if (error || !product) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p className="text-sm" style={{ color: 'var(--color-accent)' }}>
        Product not found. <Link to="/" className="underline">Go back</Link>
      </p>
    </div>
  )

  if (themeLoading || !theme) return <div className="min-h-screen flex items-center justify-center"><p className="text-sm text-gray-400">Loading...</p></div>

  const { Header, Footer, CartDrawer, ProductCard } = theme.components

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Header
        storeName={settings?.store_name ?? 'EdgeShop'}
        cartCount={totalItems()}
        onCartOpen={openCart}
        navItems={navItems}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="text-sm mb-8 flex items-center gap-1 transition-opacity hover:opacity-60"
          style={{ color: 'var(--color-accent)' }}
        >
          ← Back
        </button>

        {/* Two-column product layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16">
          {/* Image */}
          <div>
            <div className="aspect-square rounded-xl overflow-hidden bg-stone-100">
              {displayImage
                ? <img src={displayImage} alt={product.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: 'var(--color-accent)' }}>No image</div>
              }
            </div>

            {/* Gallery thumbnails */}
            {(product.images ?? []).length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {/* Primary image thumbnail */}
                <button
                  onClick={() => setManualImage(null)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    manualImage === null ? 'border-[var(--color-primary)]' : 'border-transparent'
                  }`}
                >
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                </button>
                {(product.images ?? []).map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setManualImage(img.url)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      manualImage === img.url ? 'border-[var(--color-primary)]' : 'border-transparent'
                    }`}
                  >
                    <img src={img.url} alt={`${product.name} ${img.id}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info column */}
          <div className="flex flex-col">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-3">
              {product.category && (
                <span className="text-xs tracking-wider uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: 0.8 }}>
                  {product.category}
                </span>
              )}
              {isDigital && (
                <span className="text-xs tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Digital Product
                </span>
              )}
            </div>

            {/* Name */}
            <h1
              className="text-2xl sm:text-3xl font-semibold mb-3 leading-tight"
              style={{ color: 'var(--color-primary)' }}
            >
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
                {currency}{displayPrice.toFixed(2)}
              </span>
              {product.compare_price && product.compare_price > displayPrice && (
                <span className="text-sm line-through opacity-50" style={{ color: 'var(--color-primary)' }}>
                  {currency}{product.compare_price.toFixed(2)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm leading-relaxed mb-6 opacity-70" style={{ color: 'var(--color-primary)' }}>
                {product.description}
              </p>
            )}

            {/* Variant pickers */}
            {optionGroups.size > 0 && Array.from(optionGroups.entries()).map(([key, values]) => (
              <div key={key} className="mb-5">
                <p className="text-xs tracking-wider uppercase mb-2 font-semibold" style={{ color: 'var(--color-primary)' }}>
                  {key}
                  {selectedOptions[key] && <span className="ml-2 normal-case font-normal opacity-60">— {selectedOptions[key]}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {values.map(val => {
                    const isSelected = selectedOptions[key] === val
                    // Check if this option combo has stock
                    const hasStock = variants.some(v => {
                      const opts = parseOptions(v.options_json)
                      return opts[key] === val && v.stock_count > 0
                    })
                    return (
                      <button
                        key={val}
                        onClick={() => setSelectedOptions(prev => ({ ...prev, [key]: val }))}
                        disabled={!hasStock}
                        className="px-4 py-2 text-xs border rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={isSelected ? {
                          backgroundColor: 'var(--color-primary)',
                          borderColor: 'var(--color-primary)',
                          color: 'var(--color-bg)',
                        } : {
                          backgroundColor: 'transparent',
                          borderColor: 'var(--color-accent)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {val}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Digital product note */}
            {isDigital && (
              <div className="mb-5 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs text-blue-700">
                  📥 <strong>Digital Download</strong> — After purchase, you'll receive a secure download link via email.
                </p>
              </div>
            )}

            {/* Stock */}
            <p className="text-xs mb-4 opacity-50" style={{ color: 'var(--color-primary)' }}>
              {displayStock > 0 ? `${displayStock} in stock` : 'Out of stock'}
            </p>

            {/* Quantity + Add to Cart (desktop — hidden on mobile via pb-24) */}
            {!isDigital && (
              <div className="flex items-center gap-3 mb-4 pb-24 md:pb-0">
                <div className="flex items-center border rounded-full overflow-hidden" style={{ borderColor: 'var(--color-accent)' }}>
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="px-4 py-2 text-sm transition-opacity hover:opacity-60"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    −
                  </button>
                  <span className="px-3 text-sm min-w-[2rem] text-center" style={{ color: 'var(--color-primary)' }}>{qty}</span>
                  <button
                    onClick={() => setQty(Math.min(displayStock, qty + 1))}
                    className="px-4 py-2 text-sm transition-opacity hover:opacity-60"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={displayStock === 0}
                  className="flex-1 py-3 text-sm font-semibold tracking-wider uppercase rounded-full transition-all duration-200 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
                >
                  {added ? 'Added!' : displayStock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>
            )}

            {/* Digital: Buy to Download */}
            {isDigital && (
              <div className="flex gap-3 pb-24 md:pb-0">
                <button
                  onClick={handleAddToCart}
                  disabled={displayStock === 0}
                  className="flex-1 py-3 text-sm font-semibold tracking-wider uppercase rounded-full transition-all duration-200 hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
                >
                  {added ? 'Added!' : displayStock === 0 ? 'Out of Stock' : 'Buy to Download'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile sticky CTA bar */}
        {!isDigital && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 border-t" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-accent)', borderTopWidth: '1px' }}>
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                {currency}{displayPrice.toFixed(2)}
              </div>
              <button
                onClick={handleAddToCart}
                disabled={displayStock === 0}
                className="flex-1 py-3 text-sm font-semibold tracking-wider uppercase rounded-full transition-all duration-200 disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
              >
                {added ? 'Added!' : displayStock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        )}
        {isDigital && (
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 border-t" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-accent)', borderTopWidth: '1px' }}>
            <div className="flex items-center gap-3">
              <div className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                {currency}{displayPrice.toFixed(2)}
              </div>
              <button
                onClick={handleAddToCart}
                disabled={displayStock === 0}
                className="flex-1 py-3 text-sm font-semibold tracking-wider uppercase rounded-full transition-all duration-200 disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
              >
                {added ? 'Added!' : displayStock === 0 ? 'Out of Stock' : 'Buy Now'}
              </button>
            </div>
          </div>
        )}

        {/* Reviews section */}
        {settings?.reviews_visibility !== 'none' && (
          <div className="mt-16">
            <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-primary)' }}>
              Customer Reviews {reviewsList.length > 0 && `(${reviewsList.length})`}
            </h2>
            {reviewsList.length === 0 ? (
              <p className="text-sm mb-8 opacity-50" style={{ color: 'var(--color-primary)' }}>No reviews yet. Be the first to review!</p>
            ) : (
              <div className="space-y-4 mb-8">
                {reviewsList.map(review => (
                  <div key={review.id} className="border rounded-xl p-4" style={{ borderColor: 'var(--color-accent)', opacity: 0.9 }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{review.customer_name}</span>
                      <span className="text-xs opacity-50" style={{ color: 'var(--color-primary)' }}>
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className={star <= review.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                      ))}
                    </div>
                    <p className="text-sm opacity-70" style={{ color: 'var(--color-primary)' }}>{review.body}</p>
                  </div>
                ))}
              </div>
            )}

            {settings?.reviews_visibility === 'logged_in' ? (
              <p className="text-sm opacity-60 border rounded-xl p-4" style={{ color: 'var(--color-primary)', borderColor: 'var(--color-accent)' }}>
                Log in to write a review
              </p>
            ) : reviewSubmitted ? (
              <p className="text-sm text-green-600">Thank you! Your review has been submitted for moderation.</p>
            ) : (
              <form onSubmit={e => { e.preventDefault(); submitReviewMutation.mutate(reviewForm) }} className="space-y-3 border rounded-xl p-4" style={{ borderColor: 'var(--color-accent)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Write a Review</h3>
                <div>
                  <label className="block text-xs mb-1 opacity-60" style={{ color: 'var(--color-primary)' }}>Your Name *</label>
                  <input required maxLength={100} value={reviewForm.customer_name} onChange={e => setReviewForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'transparent' }} />
                </div>
                <div>
                  <label className="block text-xs mb-1 opacity-60" style={{ color: 'var(--color-primary)' }}>Rating *</label>
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
                  <label className="block text-xs mb-1 opacity-60" style={{ color: 'var(--color-primary)' }}>Review *</label>
                  <textarea required maxLength={2000} rows={3} value={reviewForm.body} onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'transparent' }} />
                </div>
                {submitReviewMutation.isError && <p className="text-xs text-red-500">{(submitReviewMutation.error as Error)?.message ?? 'Failed to submit review'}</p>}
                <button type="submit" disabled={submitReviewMutation.isPending}
                  className="px-5 py-2 text-sm font-semibold rounded-full transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}>
                  {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Recommended Products */}
        {recommendedProducts.length > 0 && (
          <div className="mt-16 mb-8">
            <h2
              className="text-lg font-semibold mb-6"
              style={{ color: 'var(--color-primary)' }}
            >
              You May Also Like
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {recommendedProducts.map(p => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  image_url={p.image_url}
                  images={p.images}
                  currency={currency}
                  onAddToCart={() => {
                    addItem({
                      product_id: p.id,
                      name: p.name,
                      price: p.price,
                      quantity: 1,
                      image_url: p.image_url,
                      stock_count: p.stock_count,
                    })
                    addToast('Added to cart')
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer storeName={settings?.store_name ?? 'EdgeShop'} footerData={footerData} />
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
