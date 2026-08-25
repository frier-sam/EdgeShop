import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import type { ProductDetail } from '../lib/types'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CartDrawer from '../components/CartDrawer'
import Button from '../components/Button'

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const [qty, setQty] = useState(1)
  const [activeSideIdx, setActiveSideIdx] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)

  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const addLine = useCartStore((s) => s.addLine)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const lines = useCartStore((s) => s.lines)
  const totalItems = useCartStore((s) => s.totalItems)
  const addToast = useToastStore((s) => s.addToast)

  const { data: product, isLoading, error } = useQuery<ProductDetail>({
    queryKey: ['product', id],
    queryFn: () =>
      fetch(`/api/products/${id}`).then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
    enabled: !!id,
  })

  const currency = currencySymbol(storeCurrency)

  useEffect(() => {
    setActiveSideIdx(0)
    setSelectedSize(null)
    setQty(1)
  }, [product?.id])

  useEffect(() => {
    if (product) document.title = product.seo_title || product.name
  }, [product])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink-soft">Loading…</p>
      </div>
    )
  }
  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-ink-soft">
          Product not found.{' '}
          <Link to="/shop" className="text-accent underline underline-offset-2">
            Go back
          </Link>
        </p>
      </div>
    )
  }

  const sides = product.sides ?? []
  const sizes = product.sizes ?? []
  const activeSide = sides[activeSideIdx] ?? sides[0]
  const selectedSizeRow = sizes.find((s) => s.label === selectedSize) ?? null
  const customizableSides = sides.filter((s) => !!s.customizable)

  const needsSize = sizes.length > 0
  const sizeChosen = !needsSize || !!selectedSize
  const displayPrice = product.base_price + (selectedSizeRow?.price_delta ?? 0)
  const displayStock = needsSize ? selectedSizeRow?.stock_count ?? 0 : product.stock_count
  const outOfStock = displayStock <= 0
  // A size must be chosen before the CTA is enabled; out-of-stock sizes
  // can't be selected in the first place (see the disabled size buttons).
  const ctaDisabled = !sizeChosen || outOfStock

  function handleAddToCart() {
    if (!product) return
    addLine({
      product_id: product.id,
      name: product.name,
      size: selectedSize,
      design_id: null,
      preview_url: activeSide?.image_url ?? null,
      base_price: product.base_price,
      size_delta: selectedSizeRow?.price_delta ?? 0,
      print_fees: [],
      unit_price: displayPrice,
      quantity: qty,
      max_qty: needsSize ? displayStock : product.stock_count,
    })
    addToast('Added to cart')
  }

  function handleCustomize() {
    if (!product) return
    const query = selectedSize ? `?size=${encodeURIComponent(selectedSize)}` : ''
    navigate(`/customize/${product.id}${query}`)
  }

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link to="/shop" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink">
          ← Back to shop
        </Link>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <div className="aspect-square overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
              {activeSide?.image_url ? (
                <img src={activeSide.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-ink-soft">No image</div>
              )}
            </div>
            {sides.length > 1 && (
              <div className="mt-3 flex gap-2">
                {sides.map((s, i) => (
                  <button
                    key={s.side}
                    onClick={() => setActiveSideIdx(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 transition-colors ${
                      i === activeSideIdx ? 'ring-ink' : 'ring-transparent'
                    }`}
                  >
                    <img src={s.image_url} alt={`${product.name} ${s.side}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col md:sticky md:top-24 md:self-start">
            <div className="mb-3 flex items-center gap-2">
              {product.category && (
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium capitalize text-ink-soft">{product.category}</span>
              )}
              {!!product.is_customizable && (
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent-dark">
                  Customizable
                </span>
              )}
            </div>

            <h1 className="mb-5 font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">{product.name}</h1>

            {/* Price breakdown — POD.md §3.2 */}
            {product.is_customizable && customizableSides.length > 0 ? (
              <div className="mb-6 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink">{product.name}</span>
                  <span className="font-semibold text-ink">
                    {currency}
                    {displayPrice.toFixed(2)}
                  </span>
                </div>
                {customizableSides.map((s) => (
                  <div key={s.side} className="mt-2 flex items-baseline justify-between text-sm text-ink-soft">
                    <span className="capitalize">
                      + {s.side} print{s.side === 'back' ? ' (optional)' : ''}
                    </span>
                    <span>
                      {currency}
                      {s.print_fee.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mb-6 flex items-baseline gap-3">
                <span className="text-2xl font-semibold text-ink">
                  {currency}
                  {displayPrice.toFixed(2)}
                </span>
                {product.compare_price && product.compare_price > displayPrice && (
                  <span className="text-sm text-ink-soft line-through">
                    {currency}
                    {product.compare_price.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {product.description && <p className="mb-6 text-sm leading-relaxed text-ink-soft">{product.description}</p>}

            {/* Size picker */}
            {needsSize && (
              <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                  Size {selectedSize && <span className="ml-1 font-normal normal-case text-ink-soft">— {selectedSize}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const selected = selectedSize === s.label
                    return (
                      <button
                        key={s.label}
                        onClick={() => setSelectedSize(s.label)}
                        disabled={s.stock_count <= 0}
                        className={`min-w-11 rounded-full border px-4 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          selected ? 'border-ink bg-ink text-paper' : 'border-line text-ink hover:border-ink'
                        }`}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* CTA */}
            {product.is_customizable ? (
              <Button variant="accent" size="lg" fullWidth disabled={ctaDisabled} onClick={handleCustomize} className="mb-3">
                {sizeChosen && outOfStock ? 'Out of stock' : 'Customize'}
              </Button>
            ) : (
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 items-center overflow-hidden rounded-full border border-line">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="flex h-11 w-10 items-center justify-center text-ink hover:bg-ink/5">
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm text-ink">{qty}</span>
                  <button
                    onClick={() => setQty(Math.min(Math.max(displayStock, 1), qty + 1))}
                    className="flex h-11 w-10 items-center justify-center text-ink hover:bg-ink/5"
                  >
                    +
                  </button>
                </div>
                <Button variant="accent" size="lg" fullWidth disabled={ctaDisabled} onClick={handleAddToCart}>
                  {sizeChosen && outOfStock ? 'Out of stock' : 'Add to cart'}
                </Button>
              </div>
            )}

            {needsSize && !selectedSize && <p className="text-xs text-ink-soft">Choose a size to continue.</p>}
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper px-4 py-3 md:hidden">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink">
            {currency}
            {displayPrice.toFixed(2)}
          </span>
          {product.is_customizable ? (
            <Button variant="accent" size="lg" fullWidth disabled={ctaDisabled} onClick={handleCustomize}>
              {sizeChosen && outOfStock ? 'Out of stock' : 'Customize'}
            </Button>
          ) : (
            <Button variant="accent" size="lg" fullWidth disabled={ctaDisabled} onClick={handleAddToCart}>
              {sizeChosen && outOfStock ? 'Out of stock' : 'Add to cart'}
            </Button>
          )}
        </div>
      </div>

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
