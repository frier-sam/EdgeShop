import { Link } from 'react-router-dom'

interface ProductCardProps {
  id: number
  name: string
  price: number
  compare_price?: number | null
  image_url: string
  currency: string
  is_customizable?: number | boolean
  onAddToCart: () => void
}

export default function ProductCard({
  id,
  name,
  price,
  compare_price,
  image_url,
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
      <Link to={`/product/${id}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <div className="absolute left-2.5 top-2.5 z-10 flex gap-1.5">
          {customizable && (
            <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-paper">
              Customizable
            </span>
          )}
          {onSale && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
              Sale
            </span>
          )}
        </div>

        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-ink-soft">No image</div>
        )}

        <div className="absolute inset-x-0 bottom-0 translate-y-2 p-3 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          {customizable ? (
            <span className="block w-full rounded-full bg-paper py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-ink shadow-sm">
              Customize
            </span>
          ) : (
            <button
              onClick={handleAddToCart}
              className="block w-full rounded-full bg-paper py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-ink shadow-sm transition-colors hover:bg-ink hover:text-paper"
            >
              Quick add
            </button>
          )}
        </div>
      </Link>

      <Link to={`/product/${id}`} className="mt-3 block">
        <h3 className="truncate text-sm text-ink">{name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
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
