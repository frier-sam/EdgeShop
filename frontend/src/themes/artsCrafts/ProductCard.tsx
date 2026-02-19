import { Link } from 'react-router-dom'
import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, image_url, currency, onAddToCart }: ProductCardProps) {
  return (
    <div className="group cursor-pointer">
      {/* Image container */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 bg-amber-50">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-xs tracking-wider uppercase">
            No image
          </div>
        )}
        {/* Warm hover overlay */}
        <div
          className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: 'linear-gradient(to top, rgba(44,36,22,0.6) 0%, transparent 60%)' }}
        >
          <button
            onClick={e => { e.preventDefault(); onAddToCart() }}
            className="px-6 py-2.5 text-xs tracking-[0.2em] uppercase font-bold rounded-full transition-colors"
            style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
          >
            Add to Cart
          </button>
        </div>
      </div>

      {/* Info */}
      <Link to={`/product/${id}`} className="block px-1">
        <h3
          className="text-sm font-bold mb-1 leading-snug group-hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          {name}
        </h3>
        <p className="text-xs font-bold tracking-wider" style={{ color: 'var(--color-accent)' }}>
          {currency}{price.toFixed(2)}
        </p>
      </Link>
    </div>
  )
}
