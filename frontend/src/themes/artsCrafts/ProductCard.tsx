import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, compare_price, image_url, images, currency, onAddToCart }: ProductCardProps) {
  const onSale = compare_price != null && compare_price > price
  const allImages = [image_url, ...(images ?? [])].filter(Boolean)
  const [hoverIdx, setHoverIdx] = useState(0)
  const timerRef = useRef<number | null>(null)

  const startCycle = () => {
    if (allImages.length <= 1) return
    timerRef.current = window.setInterval(() => {
      setHoverIdx(i => (i + 1) % allImages.length)
    }, 800)
  }

  const stopCycle = () => {
    if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null }
    setHoverIdx(0)
  }

  const displayImage = allImages[hoverIdx] ?? image_url

  return (
    <div className="group cursor-pointer" onMouseEnter={startCycle} onMouseLeave={stopCycle}>
      {/* Image container — clicking navigates to product */}
      <Link to={`/product/${id}`} className="block relative aspect-square rounded-xl overflow-hidden mb-4 bg-amber-50">
        {onSale && (
          <span className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
            Sale
          </span>
        )}
        {displayImage ? (
          <img
            src={displayImage}
            alt={name}
            className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-xs tracking-wider uppercase">
            No image
          </div>
        )}
        {/* Image dots indicator */}
        {allImages.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {allImages.map((_, i) => (
              <span
                key={i}
                className={`w-1 h-1 rounded-full transition-colors duration-300 ${i === hoverIdx ? 'bg-white' : 'bg-white/50'}`}
              />
            ))}
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
      </Link>

      {/* Info */}
      <Link to={`/product/${id}`} className="block px-1">
        <h3
          className="text-sm font-bold mb-1 leading-snug group-hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          {name}
        </h3>
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-bold tracking-wider" style={{ color: 'var(--color-accent)' }}>
            {currency}{price.toFixed(2)}
          </p>
          {onSale && (
            <p className="text-xs tracking-wider line-through opacity-50" style={{ color: 'var(--color-primary)' }}>
              {currency}{compare_price!.toFixed(2)}
            </p>
          )}
        </div>
      </Link>
    </div>
  )
}
