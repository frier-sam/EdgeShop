import ProductRail from '../ProductRail'
import ProductCard from '../ProductCard'
import { Skeleton } from '../Skeleton'
import type { ProductSummary } from '../../lib/types'

// Mirrors FeaturedProducts.FEATURED_LIMIT — keeps the rail from scrolling
// through the whole fetched page.
export const NEW_ARRIVALS_LIMIT = 8

interface NewArrivalsProps {
  products: ProductSummary[]
  currency: string
  isLoading: boolean
  onAddToCart: (productId: number) => void
}

/**
 * H6 (POD-UI4.md §3.2) — the honest substitute for the comp's "Our Most
 * Popular Products" / "Trending" rails. Neither popularity nor a trending
 * signal exists in this schema — a real one needs aggregating
 * `orders.items_json`, which is a whole feature, not a styling pass — and
 * fabricating one is exactly the kind of dishonest merchandising this repo
 * already refuses elsewhere (see homeContent.ts's testimonial rules).
 * `GET /api/products` already orders by `created_at DESC` by default, so
 * the `products` HomePage fetches are already newest-first: this rail is
 * free, and every word of "new arrivals" is literally true.
 *
 * Do not "fix" this later by inventing a popularity score — build the real
 * one (order-line aggregation) instead, or leave this exactly as it is.
 */
export default function NewArrivals({ products, currency, isLoading, onAddToCart }: NewArrivalsProps) {
  const items = products.slice(0, NEW_ARRIVALS_LIMIT)

  return (
    <ProductRail title="New arrivals" subtitle="Fresh off the press">
      {isLoading
        ? Array.from({ length: NEW_ARRIVALS_LIMIT }).map((_, i) => (
            <div key={i} className="w-40 shrink-0 snap-start sm:w-48">
              <Skeleton className="aspect-square w-full rounded-card" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-1.5 h-3 w-1/2" />
            </div>
          ))
        : items.map((p) => (
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
                onAddToCart={() => onAddToCart(p.id)}
              />
            </div>
          ))}
    </ProductRail>
  )
}
