import type { ProductCardProps } from '../types'

export default function ProductCard({ id: _id, name, price, image_url, currency, onAddToCart }: ProductCardProps) {
  return (
    <div className="group cursor-pointer bg-[#F5F0E8]">
      <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-amber-50 border-2 border-amber-200">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-sm">No image</div>
        )}
      </div>
      <div className="px-1 group-hover:shadow-[0_4px_20px_rgba(196,98,45,0.15)] rounded-lg transition-shadow duration-300">
        <h3 className="text-sm font-bold text-[#2C2416] mb-1">
          {name}
        </h3>
        <p className="text-sm font-bold text-[#C4622D]">
          {currency}{price.toFixed(2)}
        </p>
        <button
          onClick={onAddToCart}
          className="mt-3 w-full py-2 text-xs font-bold tracking-wider uppercase bg-[#C4622D] text-white rounded-full hover:bg-[#a8501f] transition-colors"
        >
          Add to Cart
        </button>
      </div>
    </div>
  )
}
