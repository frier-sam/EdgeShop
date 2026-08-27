import { Link } from 'react-router-dom'
import Button from '../Button'
import ProductGrid from '../ProductGrid'
import { SkeletonCards } from '../Skeleton'
import type { ProductSummary } from '../../lib/types'

// Cap at 8 (POD-UI2.md §3/F4) — the staggered fade-up entrance stays snappy
// instead of cascading through a long grid.
export const FEATURED_LIMIT = 8

interface FeaturedProductsProps {
  products: ProductSummary[]
  currency: string
  isLoading: boolean
  onAddToCart: (productId: number) => void
}

export default function FeaturedProducts({ products, currency, isLoading, onAddToCart }: FeaturedProductsProps) {
  const featured = products.slice(0, FEATURED_LIMIT)

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-8 md:py-20">
      <div className="mb-8 flex items-end justify-between">
        <h2 className="font-display text-[1.25rem] font-semibold text-ink md:text-[1.75rem]">Featured products</h2>
        {/* size="md" (44px) rather than "sm" (36px, POD-UI.md's Button.tsx
            comment) so this stays ≥44px on touch — everything in this
            workstream's lane clears the touch-target floor. */}
        <Button as={Link} to="/shop" variant="ghost" size="md">
          View all →
        </Button>
      </div>

      {isLoading ? (
        <SkeletonCards count={FEATURED_LIMIT} />
      ) : (
        <ProductGrid
          products={featured.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.base_price,
            compare_price: p.compare_price,
            image_url: p.front_image ?? '',
            is_customizable: p.is_customizable,
          }))}
          currency={currency}
          onAddToCart={onAddToCart}
          stagger
        />
      )}
    </section>
  )
}
