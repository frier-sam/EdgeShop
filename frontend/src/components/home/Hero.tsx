import { Link } from 'react-router-dom'
import Button from '../Button'
import ProductComposition from './ProductComposition'
import type { ProductSummary } from '../../lib/types'
import './home.css'

interface HeroProps {
  products: ProductSummary[]
  currency: string
  isLoading: boolean
}

/**
 * F1 — the copy-led hero. Split layout on desktop (copy left, product
 * composition right); stacked on mobile with the composition still above
 * the fold. The headline is deliberately benefit-led rather than the store
 * name — the wordmark lives in the header (POD-UI2.md §1 problem #1 / §3/F1).
 *
 * POD-UI4.md §4.4 — no longer HomePage's hero directly. `HeroCarousel` now
 * owns that slot; this component is its zero-categories-with-an-image
 * fallback (rendered wholesale rather than duplicated, so there is exactly
 * one "copy-led hero" to maintain) and stays otherwise unchanged.
 */
export default function Hero({ products, currency, isLoading }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface px-4 py-12 md:px-10 md:py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
        <div className="animate-fade-up text-center md:text-left">
          <span className="mb-5 inline-block rounded-pill bg-accent-soft px-3.5 py-1.5 text-label-sm uppercase tracking-wide text-accent-dark">
            Print on demand
          </span>
          {/* §2.3's hero headline step exactly: text-headline-md -> text-headline-xl at md. */}
          <h1 className="font-display text-headline-md text-ink md:text-headline-xl">Wear your own design</h1>
          <p className="mx-auto mt-5 max-w-md text-body-sm text-ink-soft md:mx-0 md:text-body-md">
            Upload art or type a message, place it on a tee, hoodie or mug, and we print and ship it — made one at a time, no minimums.
          </p>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
            <Button as={Link} to="/shop" variant="primary" size="lg" fullWidth className="sm:w-auto">
              Start designing
            </Button>
            <Button href="#how-it-works" variant="ghost" size="lg" fullWidth className="sm:w-auto">
              How it works
            </Button>
          </div>
        </div>

        <ProductComposition products={products} currency={currency} isLoading={isLoading} />
      </div>
    </section>
  )
}
