import { Children, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './ui/Icon'

interface ProductRailProps {
  title: string
  subtitle?: string
  /** Right-aligned "View all" link next to the heading. Omit to leave the heading unpaired. */
  viewAllHref?: string
  children: ReactNode
}

/**
 * POD-UI4.md §4.3 / §4/H4 — the one reusable horizontal snap-scroll rail
 * every product/category collection on the homepage renders through
 * (category tiles, new arrivals, recently viewed, and any future rail).
 * Native `overflow-x-auto` + `snap-x snap-mandatory` does the scrolling —
 * deliberately no carousel library and no JS scroll-animation loop, only a
 * native smooth `scrollBy` nudge from the optional arrow buttons.
 *
 * "Render nothing at all when children is empty" is load-bearing, not a
 * style choice: every caller (ShopByCategory with zero categories,
 * RecentlyViewedRail with zero resolved ids) relies on this component to
 * be the single place that turns "nothing to show" into an actual empty
 * render, rather than each caller re-implementing its own empty guard.
 */
export default function ProductRail({ title, subtitle, viewAllHref, children }: ProductRailProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const itemCount = Children.count(children)

  useEffect(() => {
    const track = trackRef.current
    if (!track || itemCount === 0) return

    function updateArrows() {
      const el = track!
      // 1px slack absorbs sub-pixel rounding so an exactly-full track
      // doesn't flicker an arrow that has nowhere left to scroll to.
      setCanScrollLeft(el.scrollLeft > 1)
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
    }

    updateArrows()
    track.addEventListener('scroll', updateArrows, { passive: true })

    // Track width changes (viewport resize, a card image finishing load)
    // can flip whether the row overflows at all — re-derive the arrows
    // whenever that happens, not only on scroll. jsdom (this repo's test
    // environment) has no ResizeObserver, so this degrades to "arrows only
    // recompute on scroll" there rather than throwing.
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateArrows)
      observer.observe(track)
    }

    return () => {
      track.removeEventListener('scroll', updateArrows)
      observer?.disconnect()
    }
  }, [itemCount])

  if (itemCount === 0) return null

  function scrollByPage(direction: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:px-10 md:py-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-headline-md text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-body-sm text-ink-soft">{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link
            to={viewAllHref}
            className="shrink-0 font-label text-label-md text-accent transition-colors duration-fast hover:text-accent-dark"
          >
            View all
          </Link>
        )}
      </div>

      <div className="group relative">
        <div
          ref={trackRef}
          data-testid="product-rail-track"
          className="hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-6"
        >
          {children}
        </div>

        {/* Hover-reveal, pointer-only (POD-UI4.md §2.5) — hidden on touch,
            where they'd fight the same gesture as the scroll itself. Also
            hidden/absent outright when the track can't actually scroll
            further in that direction, rather than rendered disabled. */}
        {canScrollLeft && (
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollByPage(-1)}
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-surface p-2.5 text-ink opacity-0 shadow-card transition-opacity duration-fast active:scale-95 group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
          >
            <Icon name="chevron_left" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollByPage(1)}
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-pill border border-line bg-surface p-2.5 text-ink opacity-0 shadow-card transition-opacity duration-fast active:scale-95 group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
          >
            <Icon name="chevron_right" />
          </button>
        )}
      </div>
    </section>
  )
}
