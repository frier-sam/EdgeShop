import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '../../lib/api'
import Icon from '../ui/Icon'
import Hero from './Hero'
import type { StorefrontCategory } from './ShopByCategory'
import type { ProductSummary } from '../../lib/types'

interface CategoriesResponse {
  categories: StorefrontCategory[]
}

// POD-UI4.md §4.4 — up to 5 slides, one per category, and 5s between advances.
const MAX_SLIDES = 5
const AUTOPLAY_MS = 5000

// Narrows `image` to `string` — slides are always filtered to categories
// that have one (see `slides` below) — so callers never need a `cat.image!`
// non-null assertion or an `?? undefined` src fallback.
type SlideCategory = StorefrontCategory & { image: string }

interface HeroCarouselProps {
  products: ProductSummary[]
  currency: string
  isLoading: boolean
}

/** One slide's photo + scrim + copy. Shared between the multi-slide track and the single-slide fallback below. */
function SlideContent({ cat }: { cat: SlideCategory }) {
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative; the slide's own heading names the category. */}
      <img src={cat.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      {/* Scrim over every photo, regardless of how light/dark it is, so the
          white copy on top always clears WCAG AA (POD-UI4.md §4.4). */}
      <div className="absolute inset-0 bg-primary/20" aria-hidden="true" />
      <div className="relative flex h-full flex-col items-center justify-center px-4 text-center md:px-10">
        <h2 className="max-w-2xl text-headline-md text-white drop-shadow-lg md:text-headline-xl">{cat.name}</h2>
        {/* Honest count — this is the real GET /api/categories row count for
            the category, never a placeholder. */}
        <p className="mt-3 text-body-md text-white/90 drop-shadow-md md:text-body-lg">
          {cat.count} {cat.count === 1 ? 'product' : 'products'}
        </p>
        <Link
          to={`/shop?category=${encodeURIComponent(cat.name)}`}
          className="mt-7 inline-flex h-11 items-center justify-center rounded-btn bg-primary-container px-6 font-label text-label-md text-on-primary transition-transform duration-fast active:scale-95"
        >
          Shop {cat.name}
        </Link>
      </div>
    </>
  )
}

/**
 * H1 (POD-UI4.md §3.2/§4.4) — the category-led hero carousel, replacing
 * the static copy-led `Hero` on the homepage.
 *
 * Slide source: the first ≤5 `GET /api/categories` rows that carry an
 * `image` (categories with no representative product photo can't make a
 * legible slide). Same query key as ShopByCategory's own fetch, so
 * TanStack Query serves both from one cached request rather than issuing
 * it twice per page load.
 */
export default function HeroCarousel({ products, currency, isLoading }: HeroCarouselProps) {
  const { data } = useQuery<CategoriesResponse>({
    queryKey: ['categories'],
    queryFn: () => fetchJson<CategoriesResponse>('/api/categories'),
    staleTime: 5 * 60 * 1000,
  })

  const slides = useMemo(
    () => (data?.categories ?? []).filter((c): c is SlideCategory => !!c.image).slice(0, MAX_SLIDES),
    [data],
  )

  const [index, setIndex] = useState(0)
  // Clamp if a refetch ever shrinks the slide count out from under the
  // current index (e.g. a category loses its last product mid-session).
  useEffect(() => {
    if (index >= slides.length) setIndex(0)
  }, [slides.length, index])

  // Reduced motion disables autoplay entirely, regardless of any other
  // pause condition (POD-UI4.md §4.4) — it is not merely "one more pause
  // reason", so it is tracked separately and short-circuits the effect
  // below rather than folding into `pausedByX` state. Live-updated (same
  // pattern as Header.tsx's viewport matchMedia) in case the preference
  // changes while the page is open.
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [docHidden, setDocHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const handler = () => setDocHidden(document.hidden)
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  const [pausedByPointer, setPausedByPointer] = useState(false)
  const [pausedByFocus, setPausedByFocus] = useState(false)

  const autoplayActive = slides.length >= 2 && !reducedMotion && !docHidden && !pausedByPointer && !pausedByFocus

  useEffect(() => {
    if (!autoplayActive) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [autoplayActive, slides.length])

  // Zero categories with an image: never an empty box. Reuse the original
  // copy-led hero wholesale (headline, subcopy, both CTAs) instead of
  // duplicating that JSX here — Hero.tsx stays a real, exported component
  // specifically so this fallback path can render it, and ProductComposition
  // (which Hero renders) stays alive through this one remaining call site.
  if (slides.length === 0) {
    return <Hero products={products} currency={currency} isLoading={isLoading} />
  }

  // Exactly one image-bearing category: a static slide, no carousel chrome
  // at all (no arrows, no dots, no autoplay — there is nowhere to advance to).
  if (slides.length === 1) {
    return (
      <section className="relative h-[420px] overflow-hidden bg-surface-2 md:h-[600px]">
        <SlideContent cat={slides[0]} />
      </section>
    )
  }

  return (
    <section
      className="group relative h-[420px] overflow-hidden bg-surface-2 md:h-[600px]"
      onPointerEnter={() => setPausedByPointer(true)}
      onPointerLeave={() => setPausedByPointer(false)}
      onFocus={() => setPausedByFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausedByFocus(false)
      }}
    >
      <div
        className="flex h-full transition-transform duration-slow ease-out-soft"
        style={{ transform: `translateX(-${index * 100}%)`, width: `${slides.length * 100}%` }}
      >
        {slides.map((cat) => (
          <div key={cat.name} className="relative h-full shrink-0" style={{ width: `${100 / slides.length}%` }}>
            <SlideContent cat={cat} />
          </div>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
        className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-pill bg-white/20 p-2.5 text-white opacity-0 backdrop-blur-md transition-opacity duration-fast active:scale-95 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/30 md:flex"
      >
        <Icon name="chevron_left" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => setIndex((i) => (i + 1) % slides.length)}
        className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-pill bg-white/20 p-2.5 text-white opacity-0 backdrop-blur-md transition-opacity duration-fast active:scale-95 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/30 md:flex"
      >
        <Icon name="chevron_right" />
      </button>

      {/* Each dot is a full 44px touch target with a small 10px visible
          pill centred inside it (matching editor/components/ColorSwatchRow.tsx's
          pattern) — the comp's dots are much smaller than that, but nothing
          interactive on this storefront may fall under the touch-target floor. */}
      <div className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1">
        {slides.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            className="flex h-11 w-11 items-center justify-center"
          >
            <span
              className={`h-2.5 w-2.5 rounded-pill transition-colors duration-fast ${
                i === index ? 'bg-white' : 'bg-white/50'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
