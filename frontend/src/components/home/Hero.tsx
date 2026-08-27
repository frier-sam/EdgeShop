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
 * F1 — the hero. Split layout on desktop (copy left, product composition
 * right); stacked on mobile with the composition still above the fold.
 * The headline is deliberately benefit-led rather than the store name —
 * the wordmark lives in the header (POD-UI2.md §1 problem #1 / §3/F1).
 */
export default function Hero({ products, currency, isLoading }: HeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-surface px-4 py-12 sm:px-8 md:py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-12">
        <div className="animate-fade-up text-center md:text-left">
          <span className="mb-5 inline-block rounded-full bg-accent-soft px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-dark">
            Print on demand
          </span>
          <h1 className="font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.03em] text-ink md:text-[4.5rem]">
            Wear your own design
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[0.9375rem] text-ink-soft md:mx-0 md:text-base">
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
