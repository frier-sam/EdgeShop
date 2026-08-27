import { Link } from 'react-router-dom'
import Badge from './ui/Badge'
import IconButton from './ui/IconButton'

interface ProductCardProps {
  id: number
  name: string
  price: number
  compare_price?: number | null
  image_url: string
  /**
   * Optional second-side mockup, swapped in on hover (desktop only — opacity
   * transitions are inert on touch, which is fine since there's no hover to
   * trigger them there). `GET /api/products` (worker/src/routes/products.ts,
   * frozen this round) only returns a single `front_image` per row, so no
   * current caller has a back image to pass — this stays plumbed and ready
   * for whenever that becomes available rather than wiring it in with
   * fabricated data.
   */
  back_image_url?: string | null
  currency: string
  is_customizable?: number | boolean
  onAddToCart: () => void
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

export default function ProductCard({
  id,
  name,
  price,
  compare_price,
  image_url,
  back_image_url,
  currency,
  is_customizable,
  onAddToCart,
}: ProductCardProps) {
  const onSale = compare_price != null && compare_price > price
  const customizable = !!is_customizable

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    onAddToCart()
  }

  return (
    <div className="group">
      <Link
        to={`/product/${id}`}
        className="relative block aspect-square overflow-hidden rounded-card bg-surface-2 ring-1 ring-line transition-shadow duration-base ease-out-soft group-hover:shadow-lift"
      >
        <div className="absolute left-2.5 top-2.5 z-10 flex gap-1.5">
          {customizable && (
            <Badge variant="accent" size="sm" className="uppercase">
              Customizable
            </Badge>
          )}
          {onSale && (
            <Badge className="bg-accent text-on-accent uppercase" size="sm">
              Sale
            </Badge>
          )}
        </div>

        {/* Uniform neutral ground (bg-surface-2 above) behind every card,
            with the mockup contained + padded inside it rather than
            cropped edge-to-edge. This is what makes the grid read as one
            system regardless of whatever background colour is baked into
            a given source photo — previously `object-cover` let each
            image's own white/cream backdrop fill the whole tile, so the
            grid looked accidental (mismatched grounds) rather than
            designed. */}
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="h-full w-full object-contain p-6 transition-transform duration-slow ease-out-soft group-hover:scale-105 sm:p-8"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-soft">No image</div>
        )}

        {/* Optional back-side swap — see back_image_url doc comment above. */}
        {back_image_url && (
          <img
            src={back_image_url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain p-6 opacity-0 transition-opacity duration-base ease-out-soft group-hover:opacity-100 sm:p-8"
          />
        )}

        {/* Quick add — always visible (not hover-only) so it's reachable on
            touch devices, which have no hover state. A real 44px target,
            distinct from the "Customize" flow (which needs a size chosen
            on the product page first, so it isn't offered as a one-tap
            action here). */}
        {!customizable && (
          <span className="absolute bottom-2.5 right-2.5 z-10">
            <IconButton
              variant="secondary"
              size="md"
              aria-label={`Add ${name} to cart`}
              onClick={handleAddToCart}
              className="bg-surface/95 shadow-card backdrop-blur-sm"
            >
              <PlusIcon />
            </IconButton>
          </span>
        )}
      </Link>

      <Link to={`/product/${id}`} className="mt-3 block">
        <h3 className="truncate text-sm text-ink">{name}</h3>
        <div className="mt-1 flex items-baseline gap-1.5">
          {/* "From ₹X" for customizable products — the base price is a
              floor, not the final price, since checkout also adds a
              per-side print fee once a shopper actually designs something
              (worker/src/lib/pricing.ts computeLine). GET /api/products
              (list) doesn't return per-side print_fee data — only
              GET /api/products/:id does — so this can't check "has print
              fees" directly without an extra request per card; every
              customizable product in this catalogue is only reachable
              through the paid customize flow, so `is_customizable` alone
              is a safe proxy. Crucially, `price` here is still exactly
              `base_price`, the same true minimum a shopper could ever pay
              that ProductPage's own JSON-LD Offer already advertises — so
              this never shows a number the customer can't actually pay. */}
          {customizable && <span className="text-xs font-medium text-ink-soft">From</span>}
          <p className="text-sm font-semibold text-ink">
            {currency}
            {price.toFixed(2)}
          </p>
          {onSale && (
            <p className="text-xs text-ink-soft line-through">
              {currency}
              {compare_price!.toFixed(2)}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
