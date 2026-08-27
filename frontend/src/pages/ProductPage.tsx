import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '../lib/api'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import type { ProductDetail, ProductSide } from '../lib/types'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CartDrawer from '../components/CartDrawer'
import Button from '../components/Button'
import IconButton from '../components/ui/IconButton'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
// Not a component render — just consuming the exported height constant so
// this page's own mobile sticky bar can stack cleanly above the app-wide
// bottom tab bar instead of both fighting over `bottom: 0` (App.tsx renders
// `<MobileBottomNav>` globally on every route except /admin and /customize,
// which doesn't exclude /product — see the CSS var below).
import { MOBILE_NAV_HEIGHT } from '../components/MobileBottomNav'

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points={direction === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
    </svg>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-fast ease-out-soft ${open ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="6" width="14" height="11" rx="1.5" />
      <path d="M15 10h3.5L22 13.5V17h-7" />
      <circle cx="6" cy="19" r="1.75" />
      <circle cx="17.5" cy="19" r="1.75" />
    </svg>
  )
}

function ShieldCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.7 7.5 9 4.3-1.3 7.5-4.5 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15.4-6.4L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15.4 6.4L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}

/**
 * Swipeable product gallery — a horizontally scroll-snapping track (no JS
 * carousel library, per POD-UI.md §B4). Dot indicators track the active
 * slide from native `scroll` events; the same dots (and, on hover-capable
 * pointers, arrow buttons) drive `scrollTo` to move the track. Genuinely
 * swipeable on touch since it's just native overflow scroll underneath.
 */
function ProductGallery({
  sides,
  productName,
  onActiveChange,
}: {
  sides: ProductSide[]
  productName: string
  onActiveChange?: (index: number) => void
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const setActive = useCallback(
    (idx: number) => {
      setActiveIdx((prev) => (prev === idx ? prev : idx))
      onActiveChange?.(idx)
    },
    [onActiveChange],
  )

  useEffect(() => {
    setActive(0)
    trackRef.current?.scrollTo({ left: 0 })
    // Only reset when the set of sides actually changes (e.g. a different
    // product loads) — `setActive` is stable-ish but not worth chasing here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sides])

  const handleScroll = useCallback(() => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const idx = Math.round(track.scrollLeft / track.clientWidth)
    setActive(idx)
  }, [setActive])

  const scrollToIndex = (i: number) => {
    const track = trackRef.current
    if (!track) return
    setActive(i)
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' })
  }

  if (sides.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-card bg-surface text-sm text-ink-soft ring-1 ring-line">
        No image
      </div>
    )
  }

  return (
    <div className="group/gallery relative">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-card bg-surface ring-1 ring-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {sides.map((s) => (
          <div key={s.side} className="h-full w-full shrink-0 snap-center snap-always">
            {s.image_url ? (
              <img src={s.image_url} alt={`${productName} — ${s.side}`} className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-ink-soft">No image</div>
            )}
          </div>
        ))}
      </div>

      {sides.length > 1 && (
        <>
          {/* Arrow buttons — pointer-only affordance layered over the same
              swipeable track; opacity is gated on hover so it never fights
              touch scrolling. The visibility toggle lives on this wrapper,
              not on IconButton's own className: IconButton's BASE always
              includes a bare `inline-flex`, and Tailwind emits utility
              classes in alphabetical order — `.inline-flex` compiles after
              `.hidden` in the stylesheet, so at equal specificity it always
              wins the cascade and silently defeats a `hidden md:inline-flex`
              override no matter the viewport. Toggling `hidden`/`md:block`
              on a plain wrapper div sidesteps that clash entirely. */}
          <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 md:block">
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Previous image"
              onClick={() => scrollToIndex(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              className="bg-surface/90 opacity-0 shadow-card backdrop-blur-sm transition-opacity duration-fast group-hover/gallery:opacity-100"
            >
              <ChevronIcon direction="left" />
            </IconButton>
          </div>
          <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 md:block">
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Next image"
              onClick={() => scrollToIndex(Math.min(sides.length - 1, activeIdx + 1))}
              disabled={activeIdx === sides.length - 1}
              className="bg-surface/90 opacity-0 shadow-card backdrop-blur-sm transition-opacity duration-fast group-hover/gallery:opacity-100"
            >
              <ChevronIcon direction="right" />
            </IconButton>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist" aria-label="Product images">
            {sides.map((s, i) => (
              <button
                key={s.side}
                role="tab"
                aria-selected={i === activeIdx}
                aria-label={`Show ${s.side} image`}
                onClick={() => scrollToIndex(i)}
                className={`h-2 rounded-full transition-all duration-fast ${i === activeIdx ? 'w-6 bg-ink' : 'w-2 bg-ink/20 hover:bg-ink/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface AccordionItemData {
  id: string
  title: string
  content: React.ReactNode
}

/**
 * Description / Size guide / Care instructions accordion (POD-UI2.md §3/G3).
 * Single-open — the same "one focus at a time" pattern as the size picker
 * and gallery dots elsewhere on this page. Description defaults open since
 * that's the one panel with real per-product content; the other two are
 * static, deliberately generic copy (see callers below).
 */
function ProductAccordion({ items, defaultOpenId }: { items: AccordionItemData[]; defaultOpenId?: string }) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null)

  return (
    <div className="mt-8 border-t border-line">
      {items.map((item) => {
        const open = openId === item.id
        const panelId = `product-accordion-panel-${item.id}`
        return (
          <div key={item.id} className="border-b border-line">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              aria-expanded={open}
              aria-controls={panelId}
              className="flex min-h-11 w-full items-center justify-between gap-4 py-3.5 text-left text-sm font-semibold text-ink"
            >
              {item.title}
              <ChevronDownIcon open={open} />
            </button>
            {open && (
              <div id={panelId} className="animate-fade-in pb-4 text-sm leading-relaxed text-ink-soft">
                {item.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProductPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <Skeleton shape="text" width={180} height={14} className="mb-6" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
        <Skeleton shape="rect" height="auto" className="aspect-square w-full" />
        <div>
          <Skeleton shape="text" width={100} height={22} className="mb-4" />
          <Skeleton shape="text" width="70%" height={32} className="mb-5" />
          <Skeleton shape="rect" height={96} className="mb-6" />
          <Skeleton shape="text" width="100%" height={14} className="mb-2" />
          <Skeleton shape="text" width="85%" height={14} className="mb-6" />
          <Skeleton shape="rect" height={44} className="mb-6 w-full" />
          <Skeleton shape="rect" height={52} className="w-full" />
        </div>
      </div>
    </div>
  )
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const [qty, setQty] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [activeSideIdx, setActiveSideIdx] = useState(0)

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
    queryFn: () => fetchJson<ProductDetail>(`/api/products/${id}`),
    enabled: !!id,
  })

  const currency = currencySymbol(storeCurrency)

  useEffect(() => {
    setSelectedSize(null)
    setQty(1)
    setActiveSideIdx(0)
  }, [product?.id])

  useEffect(() => {
    if (product) document.title = product.seo_title || product.name
  }, [product])

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />
        <ProductPageSkeleton />
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
  const ctaLabel = sizeChosen && outOfStock ? 'Out of stock' : product.is_customizable ? 'Customize' : 'Add to cart'

  // ── Product JSON-LD (POD.md §9.2) ─────────────────────────────────────
  // `offers.price` is deliberately `base_price` alone, NOT `displayPrice`
  // (which already folds in a selected size delta) and never a price that
  // includes a customization fee: for an `is_customizable` product the
  // real checkout total also depends on which side(s) the shopper designs
  // (§7.1's per-side print_fee), which isn't knowable until they've used
  // the editor. Advertising base_price + assumed print fees as THE price
  // would be a structured-data claim search engines can flag as
  // misleading once a real checkout doesn't match it. base_price is the
  // floor — the true minimum a shopper could ever pay for this product —
  // which is what schema.org's Offer.price is meant to represent absent
  // a priceSpecification range; customization cost is surfaced honestly
  // to the shopper in the on-page price breakdown above, and recomputed
  // authoritatively server-side at checkout (routes/checkout.ts, §7.3).
  const anyInStock = needsSize ? sizes.some((s) => s.stock_count > 0) : product.stock_count > 0
  const absoluteImageUrls = sides
    .map((s) => s.image_url)
    .filter((url): url is string => !!url)
    .map((url) => new URL(url, window.location.origin).toString())
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(absoluteImageUrls.length > 0 ? { image: absoluteImageUrls } : {}),
    offers: {
      '@type': 'Offer',
      price: product.base_price.toFixed(2),
      priceCurrency: storeCurrency,
      availability: anyInStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: window.location.href,
    },
  }

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

  function handleCta() {
    if (product?.is_customizable) handleCustomize()
    else handleAddToCart()
  }

  // Static, deliberately generic accordion copy (POD-UI2.md §3/G3: "keep it
  // honest and generic — do not invent specific fabric compositions or
  // certifications for a demo product"). Only `product.description` is
  // real per-product data; size guide and care copy apply the same way to
  // any item in this catalogue instead of guessing at materials we don't
  // actually have on file.
  const accordionItems: AccordionItemData[] = [
    {
      id: 'description',
      title: 'Description',
      content: <p>{product.description || 'No additional description has been added for this product yet.'}</p>,
    },
    ...(needsSize
      ? [
          {
            id: 'size-guide',
            title: 'Size guide',
            content: (
              <p>
                Sizes run true to standard unisex fit. If you're between sizes, we recommend sizing up for a more
                relaxed fit. Because each order is made to order, we're not able to exchange a customized item for a
                different size once it's printed — please double-check your size before checking out.
              </p>
            ),
          },
        ]
      : []),
    {
      id: 'care',
      title: 'Care instructions',
      content: (
        <p>
          Follow the standard care approach for this type of product, and take a little extra care around the
          printed area to help your design stay vibrant for longer — avoid scrubbing or ironing directly over it.
        </p>
      ),
    },
  ]

  return (
    // `--mobile-nav-h` feeds the page's bottom padding below (a CSS var,
    // not a Tailwind-interpolated class, since arbitrary-value utilities
    // are resolved by static analysis at build time and can't see a JS
    // constant) — see the MOBILE_NAV_HEIGHT import comment above for why
    // this page needs to reserve space for the app-wide bottom tab bar on
    // top of its own sticky action bar.
    <div
      className="min-h-screen pb-[calc(6.5rem+var(--mobile-nav-h)+env(safe-area-inset-bottom))] md:pb-0"
      style={{ '--mobile-nav-h': `${MOBILE_NAV_HEIGHT}px` } as React.CSSProperties}
    >
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify output only, '<' escaped below so a description containing "</script>" can't break out of the tag */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd).replace(/</g, '\\u003c') }}
      />
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={openCart} navItems={NAV_ITEMS} />

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        {/* Breadcrumbs (POD-UI2.md §3/G3) — replaces the old bare "← Back to
            shop" link with the standard Home / Category / Product trail;
            the category crumb reuses the exact `?category=` param ShopPage
            already filters on. */}
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-ink-soft sm:mb-7">
          <Link to="/" className="transition-colors duration-fast hover:text-ink">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          {product.category && (
            <>
              <Link
                to={`/shop?category=${encodeURIComponent(product.category)}`}
                className="capitalize transition-colors duration-fast hover:text-ink"
              >
                {product.category}
              </Link>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span className="truncate text-ink" aria-current="page">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <ProductGallery sides={sides} productName={product.name} onActiveChange={setActiveSideIdx} />
          </div>

          {/* Info */}
          <div className="flex flex-col md:sticky md:top-24 md:self-start">
            <div className="mb-3 flex items-center gap-2">
              {product.category && (
                <Badge variant="neutral" className="capitalize">
                  {product.category}
                </Badge>
              )}
              {!!product.is_customizable && (
                <Badge variant="accent" className="uppercase">
                  Customizable
                </Badge>
              )}
            </div>

            <h1 className="mb-6 font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[2rem]">
              {product.name}
            </h1>

            {/* Price breakdown — POD.md §3.2, larger price treatment for hierarchy (POD-UI2.md §3/G3) */}
            {product.is_customizable && customizableSides.length > 0 ? (
              <div className="mb-6 rounded-card border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink">{product.name}</span>
                  <span className="font-display text-2xl font-bold tracking-tight text-ink">
                    {currency}
                    {displayPrice.toFixed(2)}
                  </span>
                </div>
                {customizableSides.map((s) => (
                  <div key={s.side} className="mt-2 flex items-baseline justify-between border-t border-line/70 pt-2 text-sm text-ink-soft">
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
                <span className="font-display text-3xl font-bold tracking-tight text-ink sm:text-[2.5rem]">
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

            {/* Delivery estimate (POD-UI2.md §3/G3) — every item here is made to
                order, so this is a fixed, honest lead time rather than a
                per-SKU stock-driven estimate we don't actually have data for. */}
            <div className="mb-6 flex items-center gap-2 text-sm text-ink-soft">
              <span className="text-ink-faint">
                <TruckIcon />
              </span>
              <span>Made to order — ships in 3–5 days</span>
            </div>

            {/* Size picker — 44px chips (POD-UI.md §B4) */}
            {needsSize && (
              <div className="mb-6">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink">
                  Size {selectedSize && <span className="ml-1 font-normal normal-case text-ink-soft">— {selectedSize}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => {
                    const selected = selectedSize === s.label
                    const disabled = s.stock_count <= 0
                    return (
                      <button
                        key={s.label}
                        onClick={() => setSelectedSize(s.label)}
                        disabled={disabled}
                        aria-pressed={selected}
                        className={`flex h-11 min-w-11 items-center justify-center rounded-btn border px-4 text-sm font-semibold transition-colors duration-fast disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint disabled:opacity-60 disabled:line-through ${
                          selected
                            ? 'border-ink bg-ink text-paper'
                            : 'border-line text-ink hover:border-ink/60 hover:bg-ink/[0.03]'
                        }`}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
                {!selectedSize && <p className="mt-2.5 text-xs text-ink-soft">Choose a size to continue.</p>}
              </div>
            )}

            {/* Quantity — non-customizable products only; stays visible on
                mobile even though the primary CTA button itself moves into
                the sticky bar below, since this is the only place it can
                live before checkout. */}
            {!product.is_customizable && (
              <div className="mb-5 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink">Qty</span>
                <div className="flex h-11 items-center overflow-hidden rounded-btn border border-line">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="flex h-11 w-11 items-center justify-center text-ink transition-colors duration-fast hover:bg-ink/5 active:scale-90"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] text-center text-sm tabular-nums text-ink">{qty}</span>
                  <button
                    onClick={() => setQty(Math.min(Math.max(displayStock, 1), qty + 1))}
                    className="flex h-11 w-11 items-center justify-center text-ink transition-colors duration-fast hover:bg-ink/5 active:scale-90"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* CTA — hidden on mobile; the sticky bottom bar below owns the
                primary action there so there's exactly one Add to
                cart / Customize control on screen at a time. The
                hidden/md:block toggle lives on this wrapper rather than on
                Button's own className — see the gallery-arrow comment above
                for why `hidden` can't win against Button's BASE, which
                always includes a bare `inline-flex`. */}
            <div className="hidden md:block">
              <Button variant="primary" size="lg" fullWidth disabled={ctaDisabled} onClick={handleCta}>
                {ctaLabel}
              </Button>
            </div>

            {/* Trust badges near the CTA (POD-UI2.md §3/G3) — same two cues as
                the homepage trust strip (POD-UI2.md §3/F2), kept honest and
                generic rather than making product-specific claims. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheckIcon />
                Secure payment
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RefreshIcon />
                Easy returns
              </span>
            </div>

            {/* Description / Size guide / Care — accordion (POD-UI2.md §3/G3) */}
            <ProductAccordion items={accordionItems} defaultOpenId="description" />
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar — mobile only. Price + single primary CTA.
          Stacked *above* the app-wide bottom tab bar (App.tsx's
          `<MobileBottomNav>`, MOBILE_NAV_HEIGHT px tall) rather than at
          `bottom-0`: that global nav renders on every route except /admin
          and /customize, /product included, so both would otherwise pin to
          the same edge and this bar's price + CTA would render underneath
          it — invisible and untappable. The tab bar's own safe-area padding
          already covers the home-indicator inset once it's the bottommost
          element, so this bar just needs a flat `pb-3`. */}
      <div
        className="fixed inset-x-0 z-30 border-t border-line bg-surface/95 px-4 pb-3 pt-3 shadow-sheet backdrop-blur-sm md:hidden"
        style={{ bottom: MOBILE_NAV_HEIGHT }}
      >
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-ink-soft">Price</p>
            <p className="text-base font-semibold text-ink">
              {currency}
              {displayPrice.toFixed(2)}
            </p>
          </div>
          <Button variant="primary" size="lg" fullWidth disabled={ctaDisabled} onClick={handleCta}>
            {ctaLabel}
          </Button>
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
