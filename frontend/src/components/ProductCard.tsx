import { Link } from 'react-router-dom'

interface ProductCardProps {
  id: number
  name: string
  price: number
  compare_price?: number | null
  image_url: string
  images?: string[]
  currency: string
  onAddToCart: () => void
}

export default function ProductCard({ id, name, price, compare_price, image_url, currency, onAddToCart }: ProductCardProps) {
  const onSale = compare_price != null && compare_price > price

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    onAddToCart()
  }

  return (
    <div className="group">
      <Link to={`/product/${id}`} className="block relative aspect-square bg-gray-100 overflow-hidden mb-3 rounded">
        {onSale && (
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-white bg-gray-900 rounded">
            Sale
          </span>
        )}
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            No image
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-center pb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleAddToCart}
            className="px-5 py-2 text-xs tracking-wide uppercase bg-gray-900 text-white rounded"
          >
            Add to Cart
          </button>
        </div>
      </Link>

      <Link to={`/product/${id}`} className="block">
        <h3 className="text-sm text-gray-900 mb-1 leading-snug">{name}</h3>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-medium text-gray-900">
            {currency}{price.toFixed(2)}
          </p>
          {onSale && (
            <p className="text-xs text-gray-400 line-through">
              {currency}{compare_price!.toFixed(2)}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
