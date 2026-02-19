import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, image_url, currency, onAddToCart }: ProductCardProps) {
  return (
    <div className="group cursor-pointer">
      <div className="aspect-square bg-stone-100 overflow-hidden mb-4">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-sm">No image</div>
        )}
      </div>
      <div className="px-1">
        <h3 style={{ fontFamily: "'Playfair Display', serif" }} className="text-sm text-[#1A1A1A] mb-1">
          {name}
        </h3>
        <p className="text-xs text-stone-500 tracking-wider">
          {currency}{price.toFixed(2)}
        </p>
        <button
          onClick={onAddToCart}
          className="mt-3 w-full py-2 text-xs tracking-widest uppercase border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#FAFAF8] transition-colors"
        >
          Add to Bag
        </button>
      </div>
    </div>
  )
}
