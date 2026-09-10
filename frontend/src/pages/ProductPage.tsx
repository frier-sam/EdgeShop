import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { fetchJson } from '../lib/api'
import { useSettings } from '../lib/useSettings'
import { NAV_ITEMS, FOOTER_LINKS, currencySymbol } from '../lib/storeConfig'
import { useCartStore } from '../store/cartStore'
import { useToastStore } from '../store/toastStore'
import type { ProductDetail, ProductSide, ProductSummary, ProductVariant } from '../lib/types'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CartDrawer from '../components/CartDrawer'
import ProductCard from '../components/ProductCard'
import ProductRail from '../components/ProductRail'
import Button from '../components/Button'
import IconButton from '../components/ui/IconButton'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import Icon from '../components/ui/Icon'
// POD-UI4.md §5 C.8 — created by another lane (WS-B owns lib/recentlyViewed.ts,
// exactly `recordView(id: number)` / `readRecentlyViewed(): number[]`); this
// file only ever imports it, never edits or recreates it. If it isn't on
// disk yet when this lands, `tsc` will report an unresolved module here
// until WS-B's file arrives — see this workstream's report.
import { recordView, readRecentlyViewed } from '../lib/recentlyViewed'
// Not a component render — just consuming the exported height constant so
// this page's own mobile sticky bar can stack cleanly above the app-wide
// bottom tab bar instead of both fighting over `bottom: 0` (App.tsx renders
// `<MobileBottomNav>` globally on every route except /admin and /customize,
// which doesn't exclude /product — see the CSS var below).
import { MOBILE_NAV_HEIGHT } from '../components/MobileBottomNav'

/** A hex value from the database is untrusted input, not a design token —
 * POD-UI4.md §5 C.4 / POD-V2.md §3.1 requires it validated before it ever
 * reaches a `style` prop. Exported so the variant-picker degradation states
 * (swatch vs. plain pill vs. mixed) are unit-testable without mounting the
 * whole page. */
const HEX_RE = /^#[0-9a-fA-F]{6}$/
export function isValidSwatchHex(hex: string | null | undefined): hex is string {
  return !!hex && HEX_RE.test(hex)
}

export interface VariantPickerProps {
  variants: ProductVariant[]
  axisLabel: string
  selected: string | null
  onSelect: (label: string) => void
}

/**
 * POD-UI4.md §5 C.4 / POD-V2.md §3.1, §3.3 decision #9 — axis 2 with all
 * three degradation states a substrate-agnostic catalogue requires:
 *  - a validated `swatch_hex` renders a circular colour chip
 *  - a null `swatch_hex` renders a plain labelled pill ("Matte"/"Glossy"
 *    has no colour to show)
 *  - a product can mix both, decided per-option, never per-product
 *
 * Colour is never the only channel carrying the information: the axis
 * label + selected value are always shown as text next to the group, and
 * repeated in every chip's own `aria-label`.
 *
 * Swatch chips are visually the comp's `w-8 h-8` circle, but that alone is
 * an 32px touch target below the 44px floor this app requires everywhere
 * else — so the circle sits inside an `h-11 w-11` button rather than being
 * the whole hit area itself.
 */
export function VariantPicker({ variants, axisLabel, selected, onSelect }: VariantPickerProps) {
  if (variants.length === 0) return null

  return (
    <div className="mb-6">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink">
        {axisLabel}
        {selected && <span className="ml-1 font-normal normal-case text-ink-soft">: {selected}</span>}
      </p>
      <div className="flex flex-wrap gap-3">
        {variants.map((v) => {
          const isSelected = selected === v.label
          const hex = isValidSwatchHex(v.swatch_hex) ? v.swatch_hex : null
          const optionLabel = `${axisLabel}: ${v.label}`

          if (hex) {
            return (
              <button
                key={v.label}
                type="button"
                onClick={() => onSelect(v.label)}
                aria-label={optionLabel}
                aria-pressed={isSelected}
                title={v.label}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill"
              >
                <span
                  aria-hidden="true"
                  className={`h-8 w-8 rounded-pill border border-line transition-transform duration-fast ease-out-soft hover:scale-110 ${
                    isSelected ? 'outline outline-2 outline-offset-2 outline-accent' : ''
                  }`}
                  style={{ backgroundColor: hex }}
                />
              </button>
            )
          }

          return (
            <button
              key={v.label}
              type="button"
              onClick={() => onSelect(v.label)}
              aria-pressed={isSelected}
              className={`flex min-h-11 items-center justify-center rounded-pill border px-4 text-sm font-medium transition-colors duration-fast ${
                isSelected ? 'border-2 border-accent bg-surface-2 text-ink' : 'border-line text-ink hover:border-accent/50'
              }`}
            >
              {v.label}
            </button>
          )
        })}
      </div>
      {!selected && <p className="mt-2.5 text-xs text-ink-soft">Choose a {axisLabel.toLowerCase()} to continue.</p>}
    </div>
  )
}

/**
 * Swipeable product gallery — a horizontally scroll-snapping track (no JS
 * carousel library, per POD-UI.md §B4). Dot indicators track the active
 * slide from native `scroll` events; the same dots (mobile only, below
 * `sm`) and — at `sm` and up — a 96px thumbnail strip (POD-UI4.md §5 C.1 /
 * P1) drive `scrollTo` to move the track. Genuinely swipeable on touch
 * since it's just native overflow scroll underneath.
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
              on a plain wrapper div sidesteps that clash entirely — the
              same trap the thumbnail strip and mobile-only dots below avoid
              by living on plain `<div>`s with no forced base display class. */}
          <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 md:block">
            <IconButton
              variant="secondary"
              size="sm"
              aria-label="Previous image"
              onClick={() => scrollToIndex(Math.max(0, activeIdx - 1))}
              disabled={activeIdx === 0}
              className="bg-surface/90 opacity-0 shadow-card backdrop-blur-sm transition-opacity duration-fast group-hover/gallery:opacity-100"
            >
              <Icon name="chevron_left" size={18} />
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
              <Icon name="chevron_right" size={18} />
            </IconButton>
          </div>

          {/* Dots — mobile only (below `sm`); the thumbnail strip below
              takes over as the "which image am I on" affordance at `sm`+,
              matching the comp (POD-UI4.md §5 C.1 / P1). */}
          <div className="mt-3 flex items-center justify-center gap-1.5 sm:hidden" role="tablist" aria-label="Product images">
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

          {/* Thumbnail strip — `sm`+ only. The strip itself scroll-snaps
              horizontally with `hide-scrollbar` should it ever hold more
              thumbnails than fit; today it holds at most 2 (front/back). */}
          <div className="mt-3 hidden gap-3 overflow-x-auto hide-scrollbar sm:flex">
            {sides.map((s, i) => {
              const active = i === activeIdx
              return (
                <button
                  key={s.side}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Show ${s.side} image`}
                  aria-current={active}
                  className={`h-24 w-24 shrink-0 overflow-hidden rounded-sm transition-opacity duration-fast ${
                    active ? 'border-2 border-accent' : 'border border-line opacity-70 hover:opacity-100'
                  }`}
                >
                  {s.image_url ? (
                    <img src={s.image_url} alt="" aria-hidden="true" className="h-full w-full object-cover" draggable={false} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-soft">No image</div>
                  )}
                </button>
              )
            })}
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
              <Icon
                name="expand_more"
                size={18}
                className={`shrink-0 text-ink-soft transition-transform duration-fast ease-out-soft ${open ? 'rotate-180' : ''}`}
              />
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

interface ProductsListResponse {
  products: ProductSummary[]
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const [qty, setQty] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null)
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
    setSelectedVariant(null)
    setQty(Math.max(1, product?.min_order_qty ?? 1))
    setActiveSideIdx(0)
  }, [product?.id])

  useEffect(() => {
    if (product) document.title = product.seo_title || product.name
  }, [product])

  // POD-UI4.md §5 C.8 — record exactly once per successful product load,
  // not on every render (the effect's dependency array is what guards
  // that; a bare call in the render body would re-fire constantly).
  useEffect(() => {
    if (product?.id) recordView(product.id)
  }, [product?.id])

  // POD-UI4.md §5 C.8 — "Recently viewed" rail data. `readRecentlyViewed`
  // is a synchronous localStorage read (cheap, try/catch-guarded inside the
  // module itself), so it's fine to call directly in the render body rather
  // than caching it in state; the current product is excluded so the rail
  // never recommends the page you're already on.
  const recentIds = product ? readRecentlyViewed().filter((rid) => rid !== product.id).slice(0, 8) : []
  const recentQueries = useQueries({
    queries: recentIds.map((rid) => ({
      // Same queryKey shape as the main product query above, so a
      // recently-viewed product already in the cache (e.g. you just came
      // from it) costs nothing extra to resolve here.
      queryKey: ['product', String(rid)],
      queryFn: () => fetchJson<ProductDetail>(`/api/products/${rid}`),
      retry: false,
      staleTime: 5 * 60 * 1000,
    })),
  })
  const recentlyViewedProducts = recentQueries.map((q) => q.data).filter((p): p is ProductDetail => !!p)

  // POD-UI4.md §5 C.7 / §3.3 P11 — "You may also like": the honest
  // substitute for the comp's "Frequently bought together" rail. There is
  // no co-purchase data anywhere in this schema to base that claim on, so
  // this is same-category browsing instead — `?category=&exclude=`, both
  // params already on `GET /api/products` (§4.1). Renders nothing when the
  // product has no category (query stays disabled) or the response is empty.
  const { data: relatedData } = useQuery<ProductsListResponse>({
    queryKey: ['related-products', product?.id, product?.category],
    queryFn: () => {
      const params = new URLSearchParams({ category: product!.category, exclude: String(product!.id), limit: '8' })
      return fetchJson<ProductsListResponse>(`/api/products?${params}`)
    },
    enabled: !!product?.category,
  })
  const relatedProducts = relatedData?.products ?? []

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
  const variants = product.variants ?? []
  const activeSide = sides[activeSideIdx] ?? sides[0]
  const selectedSizeRow = sizes.find((s) => s.label === selectedSize) ?? null

  // POD-V2.md §1.1 — "Size"/"Colour" are t-shirt words; a bottle merchant
  // renames axis 1 to "Volume", a card merchant renames axis 2 to "Finish".
  const axis1Label = product.axis1_label?.trim() || 'Size'
  const axis2Label = product.axis2_label?.trim() || 'Colour'

  const customizableSides = sides.filter((s) => !!s.customizable)

  const needsSize = sizes.length > 0
  const sizeChosen = !needsSize || !!selectedSize
  const needsVariant = variants.length > 0
  // Axis 2 never touches stock (POD-V2.md §3.3) — this is a pure
  // "did they pick one" gate, exactly like size's own gate above.
  const variantChosen = !needsVariant || !!selectedVariant
  const displayPrice = product.base_price + (selectedSizeRow?.price_delta ?? 0)
  const displayStock = needsSize ? selectedSizeRow?.stock_count ?? 0 : product.stock_count
  const outOfStock = displayStock <= 0
  // A size AND a variant (when either axis exists) must be chosen before
  // the CTA is enabled; out-of-stock sizes can't be selected in the first
  // place (see the disabled size cards below).
  const ctaDisabled = !sizeChosen || !variantChosen || outOfStock
  const ctaLabel = sizeChosen && outOfStock ? 'Out of stock' : product.is_customizable ? 'Customize' : 'Add to cart'

  // POD-UI4.md §5 C.2 — "Key Features" box from the new `highlights`
  // column: newline-separated merchant copy, never parsed beyond splitting
  // on newlines and trimming. Hidden entirely when empty (every product
  // predating the column).
  const highlightLines = (product.highlights || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // POD-UI4.md §5 C.3 — whole-percent discount, only shown when it rounds
  // to at least 1%, computed off the price actually displayed (which
  // already folds in a selected size delta) rather than base_price alone.
  const discountPercent =
    product.compare_price && product.compare_price > displayPrice
      ? Math.round(((product.compare_price - displayPrice) / product.compare_price) * 100)
      : 0

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
  // Variants never enter this calculation either — axis 2 carries no
  // price by design (POD-V2.md §3.1).
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
      variant: selectedVariant,
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
    // POD-UI4.md §5 C.10 — `?variant=` rides alongside the existing
    // `?size=`; CustomizePage reads both and threads them into the editor
    // (`initialSize` / `initialVariant`) exactly the same way.
    const params = new URLSearchParams()
    if (selectedSize) params.set('size', selectedSize)
    if (selectedVariant) params.set('variant', selectedVariant)
    const query = params.toString() ? `?${params.toString()}` : ''
    navigate(`/customize/${product.id}${query}`)
  }

  function handleCta() {
    if (product?.is_customizable) handleCustomize()
    else handleAddToCart()
  }

  // Shared by both rails below ("You may also like" sends a ProductSummary,
  // "Recently viewed" a full ProductDetail) — only these four fields are
  // ever used, so the parameter is a narrow structural shape rather than
  // forcing a full ProductSummary literal to be built from a ProductDetail.
  function handleQuickAddToCart(p: { id: number; name: string; base_price: number; image_url: string | null }) {
    addLine({
      product_id: p.id,
      name: p.name,
      size: null,
      variant: null,
      design_id: null,
      preview_url: p.image_url,
      base_price: p.base_price,
      size_delta: 0,
      print_fees: [],
      unit_price: p.base_price,
      quantity: 1,
    })
    addToast('Added to cart')
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
            title: `${axis1Label} guide`,
            content: (
              <p>
                Sizes run true to standard unisex fit. If you're between sizes, we recommend sizing up for a more
                relaxed fit. Because each order is made to order, we're not able to exchange a customized item for a
                different {axis1Label.toLowerCase()} once it's printed — please double-check your selection before
                checking out.
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
        {/* Breadcrumbs (POD-UI2.md §3/G3, chevrons per POD-UI4.md §2.6/P13)
            — the category crumb reuses the exact `?category=` param
            ShopPage already filters on. */}
        <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1 text-sm text-ink-soft sm:mb-7">
          <Link to="/" className="transition-colors duration-fast hover:text-ink">
            Home
          </Link>
          <Icon name="chevron_right" size={16} className="text-ink-faint" />
          {product.category && (
            <>
              <Link
                to={`/shop?category=${encodeURIComponent(product.category)}`}
                className="capitalize transition-colors duration-fast hover:text-ink"
              >
                {product.category}
              </Link>
              <Icon name="chevron_right" size={16} className="text-ink-faint" />
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

            <h1 className="mb-4 font-display text-headline-md text-ink md:text-headline-lg">{product.name}</h1>

            {/* "Key Features" box (POD-UI4.md §5 C.2 / P2) — hidden entirely
                when the product has no highlights, which is every product
                predating the column. */}
            {highlightLines.length > 0 && (
              <div className="mb-6 rounded-btn border border-line bg-surface-2 p-4">
                <p className="mb-2 font-label text-label-sm uppercase tracking-widest text-accent">Key Features</p>
                <ul className="list-disc space-y-1.5 pl-4 text-body-sm text-ink-soft">
                  {highlightLines.map((lineText, i) => (
                    <li key={i}>{lineText}</li>
                  ))}
                </ul>
              </div>
            )}

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
                {/* % OFF badge (POD-UI4.md §5 C.3 / P3) — computed, never a
                    static claim, and only shown when it rounds to ≥1%. */}
                {discountPercent >= 1 && <span className="font-label text-label-sm text-accent">{discountPercent}% OFF</span>}
              </div>
            )}

            {/* Delivery estimate (POD-UI2.md §3/G3) — every item here is made to
                order, so this is a fixed, honest lead time rather than a
                per-SKU stock-driven estimate we don't actually have data for. */}
            <div className="mb-6 flex items-center gap-2 text-sm text-ink-soft">
              <Icon name="local_shipping" size={18} className="text-ink-faint" />
              <span>Made to order — ships in 3–5 days</span>
            </div>

            {/* Size cards (POD-UI4.md §5 C.3 / P4) — a grid of cards showing
                the REAL price delta, never a fabricated one; heading reads
                the product's own axis1_label ("Size" default, but a bottle
                merchant renamed it "Volume" — POD-V2.md §1.1). */}
            {needsSize && (
              <div className="mb-6">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink">
                  {axis1Label}
                  {selectedSize && <span className="ml-1 font-normal normal-case text-ink-soft">— {selectedSize}</span>}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {sizes.map((s) => {
                    const selected = selectedSize === s.label
                    const disabled = s.stock_count <= 0
                    return (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => setSelectedSize(s.label)}
                        disabled={disabled}
                        aria-pressed={selected}
                        className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-btn border p-3 transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-60 ${
                          selected ? 'border-2 border-accent bg-surface-2' : 'border-line hover:border-accent/50'
                        }`}
                      >
                        <span className={`font-label text-label-md text-ink ${disabled ? 'text-ink-faint line-through' : ''}`}>{s.label}</span>
                        {/* The real per-option delta, never a placeholder —
                            omitted entirely when it's 0. */}
                        {s.price_delta !== 0 && (
                          <span className="text-label-sm text-ink-soft">
                            +{currency}
                            {s.price_delta.toFixed(2)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {!selectedSize && <p className="mt-2.5 text-xs text-ink-soft">Choose a {axis1Label.toLowerCase()} to continue.</p>}
              </div>
            )}

            {/* Variant picker (POD-UI4.md §5 C.4 / P5, POD-V2.md §3.1/§3.3
                decision #9) — labelled with axis2_label ("Colour" default).
                The gallery deliberately does NOT swap on variant selection:
                per-variant photos are POD-UI4.md §3.3 P6 / POD-V2.md §11
                Phase 2.1, explicitly deferred because of the aspect-ratio
                print-registration guard (POD-V2.md §3.2) — that guard is a
                real trap and deserves its own round of tests rather than a
                half-wired swap riding along with this visual pass. */}
            <VariantPicker variants={variants} axisLabel={axis2Label} selected={selectedVariant} onSelect={setSelectedVariant} />

            {/* Quantity — non-customizable products only; stays visible on
                mobile even though the primary CTA button itself moves into
                the sticky bar below, since this is the only place it can
                live before checkout. POD-UI4.md §5 C.6 / P8 — min_order_qty
                is the floor here, not 1; the server enforces the real
                guarantee (`below_min_order_qty`), this is the affordance. */}
            {!product.is_customizable && (
              <div className="mb-5">
                {product.min_order_qty > 1 && (
                  <p className="mb-2 text-xs text-ink-soft">Minimum order: {product.min_order_qty} units</p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink">Qty</span>
                  <div className="flex h-11 items-center overflow-hidden rounded-btn border border-line">
                    <button
                      onClick={() => setQty(Math.max(product.min_order_qty, qty - 1))}
                      disabled={qty <= product.min_order_qty}
                      className="flex h-11 w-11 items-center justify-center text-ink transition-colors duration-fast hover:bg-ink/5 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:active:scale-100"
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
                <Icon name="verified" size={16} />
                Secure payment
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="autorenew" size={16} />
                Easy returns
              </span>
            </div>

            {/* Description / Size guide / Care — accordion (POD-UI2.md §3/G3) */}
            <ProductAccordion items={accordionItems} defaultOpenId="description" />
          </div>
        </div>
      </div>

      {/* "You may also like" (POD-UI4.md §5 C.7 / §3.3 P11) — the honest
          substitute for the comp's "Frequently bought together": there is
          no co-purchase data anywhere in this schema to base that claim
          on, so this is same-category browsing instead. `ProductRail`
          renders nothing itself when `relatedProducts` is empty (covers
          "no category" too, since the query stays disabled then), and it
          owns its own full-width section container — it isn't nested
          inside this page's `max-w-5xl` column above. */}
      <ProductRail
        title="You may also like"
        viewAllHref={product.category ? `/shop?category=${encodeURIComponent(product.category)}` : undefined}
      >
        {relatedProducts.map((p) => (
          <div key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
            <ProductCard
              id={p.id}
              name={p.name}
              price={p.base_price}
              compare_price={p.compare_price}
              image_url={p.front_image ?? ''}
              back_image_url={p.back_image}
              currency={currency}
              is_customizable={p.is_customizable}
              min_order_qty={p.min_order_qty}
              lowest_break={p.lowest_break}
              onAddToCart={() => handleQuickAddToCart({ id: p.id, name: p.name, base_price: p.base_price, image_url: p.front_image })}
            />
          </div>
        ))}
      </ProductRail>

      {/* "Recently viewed" (POD-UI4.md §5 C.8 / P12) — `ProductRail` again
          renders nothing when there are zero resolved ids. */}
      <ProductRail title="Recently viewed">
        {recentlyViewedProducts.map((p) => {
          const frontImage = p.sides?.find((s) => s.side === 'front')?.image_url ?? null
          // ProductDetail (unlike the list endpoint's ProductSummary) has no
          // precomputed `lowest_break` — it has the full `price_breaks`
          // array instead, already ordered `min_qty ASC` by the worker, so
          // the first entry IS the lowest tier.
          const lowestBreak = p.price_breaks?.[0] ?? null
          return (
            <div key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
              <ProductCard
                id={p.id}
                name={p.name}
                price={p.base_price}
                compare_price={p.compare_price}
                image_url={frontImage ?? ''}
                currency={currency}
                is_customizable={p.is_customizable}
                min_order_qty={p.min_order_qty}
                lowest_break={lowestBreak}
                onAddToCart={() => handleQuickAddToCart({ id: p.id, name: p.name, base_price: p.base_price, image_url: frontImage })}
              />
            </div>
          )
        })}
      </ProductRail>

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
