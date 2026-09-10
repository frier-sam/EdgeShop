import ProductRail from '../ProductRail'
import ProductCard from '../ProductCard'
import { readRecentlyViewed } from '../../lib/recentlyViewed'
import type { ProductSummary } from '../../lib/types'

interface RecentlyViewedRailProps {
  products: ProductSummary[]
  currency: string
  onAddToCart: (productId: number) => void
}

/**
 * H7 (POD-UI4.md §3.2/§4.3) — resolves the shopper's locally-stored
 * recently-viewed ids against the product data HomePage already fetched,
 * rather than issuing a dedicated request: `GET /api/products` has no
 * `ids=` batch filter this round, so an id outside that already-fetched
 * window simply doesn't resolve. That is an honest degradation, not a bug
 * — recording happens on the PDP (pages/ProductPage.tsx, another lane), so
 * a shopper who viewed something outside HomePage's own catalogue window
 * just won't see it here rather than this component issuing a second
 * request purely to chase completeness.
 *
 * Renders nothing — never an empty or skeleton-only rail — unless at least
 * one stored id actually resolves to a product HomePage has in hand.
 */
export default function RecentlyViewedRail({ products, currency, onAddToCart }: RecentlyViewedRailProps) {
  const ids = readRecentlyViewed()
  const byId = new Map(products.map((p) => [p.id, p]))
  const resolved = ids.map((id) => byId.get(id)).filter((p): p is ProductSummary => !!p)

  if (resolved.length === 0) return null

  return (
    <ProductRail title="Recently viewed">
      {resolved.map((p) => (
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
