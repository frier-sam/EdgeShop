import { Link } from 'react-router-dom'
import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, image_url, currency, onAddToCart }: ProductCardProps) {
  return (
    <div className="group cursor-pointer">
      {/* Image container */}
      <div className="relative aspect-square bg-stone-100 overflow-hidden mb-4">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs tracking-widest uppercase">
            No image
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={e => { e.preventDefault(); onAddToCart() }}
            className="px-6 py-2.5 text-xs tracking-[0.2em] uppercase transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
            }}
          >
            Add to Bag
          </button>
        </div>
      </div>

      {/* Info */}
      <Link to={`/product/${id}`} className="block px-1">
        <h3
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          className="text-sm mb-1 leading-snug group-hover:opacity-70 transition-opacity"
        >
          {name}
        </h3>
        <p className="text-xs tracking-widest" style={{ color: 'var(--color-accent)' }}>
          {currency}{price.toFixed(2)}
        </p>
      </Link>
    </div>
  )
}
