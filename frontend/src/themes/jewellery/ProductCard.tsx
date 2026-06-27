import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, compare_price, image_url, images, currency, onAddToCart }: ProductCardProps) {
  const onSale = compare_price != null && compare_price > price
  const allImages = [image_url, ...(images ?? [])].filter(Boolean)
  const [hoverIdx, setHoverIdx] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistBounce, setWishlistBounce] = useState(false)
  const [addedToBag, setAddedToBag] = useState(false)
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

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsWishlisted(w => !w)
    setWishlistBounce(true)
    setTimeout(() => setWishlistBounce(false), 400)
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    if (addedToBag) return
    onAddToCart()
    setAddedToBag(true)
    setTimeout(() => setAddedToBag(false), 1500)
  }

  const displayImage = allImages[hoverIdx] ?? image_url

  return (
    <>
      <style>{`
        @keyframes pc-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pc-wishlist-bounce {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.35); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes pc-checkmark-in {
          0%   { opacity: 0; transform: scale(0.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        .pc-shimmer-bg {
          background: linear-gradient(90deg, #e7e3df 25%, #f5f2ef 50%, #e7e3df 75%);
          background-size: 200% 100%;
          animation: pc-shimmer 1.6s infinite;
        }
        .pc-wishlist-bounce {
          animation: pc-wishlist-bounce 0.4s ease-out;
        }
        .pc-checkmark-in {
          animation: pc-checkmark-in 0.25s ease-out;
        }
        .pc-name-underline {
          background-image: linear-gradient(currentColor, currentColor);
          background-size: 0% 1px;
          background-repeat: no-repeat;
          background-position: 0 100%;
          transition: background-size 0.35s ease;
        }
        .group:hover .pc-name-underline {
          background-size: 100% 1px;
        }
      `}</style>

      <div className="group cursor-pointer" onMouseEnter={startCycle} onMouseLeave={stopCycle}>
        <Link to={`/product/${id}`} className="block relative aspect-square bg-stone-100 overflow-hidden mb-4">
          {onSale && (
            <span className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[10px] font-semibold tracking-widest uppercase text-white" style={{ backgroundColor: 'var(--color-accent)' }}>
              Sale
            </span>
          )}

          {/* Wishlist heart button */}
          <button
            onClick={handleWishlist}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className={`absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white ${wishlistBounce ? 'pc-wishlist-bounce' : ''}`}
          >
            {isWishlisted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" style={{ color: 'var(--color-accent)' }}>
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            )}
          </button>

          {displayImage ? (
            <img
              src={displayImage}
              alt={name}
              className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="pc-shimmer-bg w-full h-full flex items-center justify-center">
              <span className="text-stone-400 text-xs tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                No image
              </span>
            </div>
          )}

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

          <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={handleAddToCart}
              className="px-6 py-2.5 text-xs tracking-[0.2em] uppercase min-w-[130px] text-center"
              style={{
                backgroundColor: addedToBag ? 'var(--color-accent)' : 'var(--color-primary)',
                color: 'var(--color-bg)',
                transition: 'background-color 0.3s ease',
              }}
            >
              {addedToBag ? (
                <span key="added" className="pc-checkmark-in inline-block">✓ Added</span>
              ) : (
                <span key="add">Add to Bag</span>
              )}
            </button>
          </div>
        </Link>

        <Link to={`/product/${id}`} className="block px-1">
          <h3
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
            className="text-sm mb-1 leading-snug pc-name-underline inline-block"
          >
            {name}
          </h3>
          <div className="flex items-baseline gap-2">
            <p className="text-xs tracking-widest" style={{ color: 'var(--color-accent)' }}>
              {currency}{price.toFixed(2)}
            </p>
            {onSale && (
              <p className="text-xs tracking-widest line-through opacity-50" style={{ color: 'var(--color-primary)' }}>
                {currency}{compare_price!.toFixed(2)}
              </p>
            )}
          </div>
        </Link>
      </div>
    </>
  )
}
