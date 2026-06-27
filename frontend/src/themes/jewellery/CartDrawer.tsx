import type { CartDrawerProps } from '../types'
import { Link } from 'react-router-dom'

const FREE_SHIPPING_THRESHOLD = 999

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const shippingProgress = Math.min(1, subtotal / FREE_SHIPPING_THRESHOLD)
  const shippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
  const freeShippingUnlocked = subtotal >= FREE_SHIPPING_THRESHOLD

  return (
    <>
      <style>{`
        @keyframes cd-slide-in {
          0%   { opacity: 0; transform: translateX(10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .cd-item-enter {
          animation: cd-slide-in 0.3s ease-out both;
        }
        @keyframes cd-bar-fill {
          from { width: 0%; }
        }
        .cd-bar-fill {
          animation: cd-bar-fill 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/25 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
          <h2
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
            className="text-lg"
          >
            Your Bag
            {items.length > 0 && (
              <span className="ml-2 text-xs tracking-widest" style={{ color: 'var(--color-accent)' }}>
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-stone-100"
            style={{ color: 'var(--color-primary)' }}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        {/* Free shipping progress bar */}
        {items.length > 0 && (
          <div className="px-6 py-3.5 border-b border-stone-100">
            {freeShippingUnlocked ? (
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 3 6 7 2" />
                  </svg>
                </span>
                <p className="text-[11px] tracking-wider font-medium" style={{ color: 'var(--color-accent)' }}>
                  You've unlocked free shipping!
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] tracking-wide mb-2.5" style={{ color: 'var(--color-primary)', opacity: 0.6 }}>
                  Add <strong style={{ color: 'var(--color-accent)' }}>{currency}{shippingRemaining.toFixed(0)}</strong> more for free shipping
                </p>
                <div
                  className="h-[2px] w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' }}
                >
                  <div
                    className="h-full rounded-full cd-bar-fill"
                    style={{
                      width: `${shippingProgress * 100}%`,
                      backgroundColor: 'var(--color-accent)',
                      transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14 opacity-[0.15]" style={{ color: 'var(--color-primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm5.625 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <div className="text-center">
                <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: 'var(--color-accent)' }}>
                  Your bag is empty
                </p>
                <button
                  onClick={onClose}
                  className="text-xs tracking-widest uppercase underline underline-offset-4 transition-opacity hover:opacity-60"
                  style={{ color: 'var(--color-primary)' }}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item, index) => (
                <li
                  key={item.product_id}
                  className="flex gap-4 cd-item-enter"
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <Link to={`/product/${item.product_id}`} onClick={onClose} className="shrink-0">
                    <div className="w-20 h-20 bg-stone-100 overflow-hidden">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="w-2 h-2 rotate-45 block" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.3 }} />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} onClick={onClose}>
                      <p
                        className="text-sm mb-1 hover:opacity-70 transition-opacity leading-snug"
                        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
                      >
                        {item.name}
                      </p>
                    </Link>
                    <p className="text-xs tracking-wider mb-3" style={{ color: 'var(--color-accent)' }}>
                      {currency}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-stone-200 divide-x divide-stone-200">
                        <button
                          onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                          className="w-7 h-7 text-xs flex items-center justify-center transition-colors hover:bg-stone-100"
                          style={{ color: 'var(--color-primary)' }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-7 h-7 text-xs flex items-center justify-center" style={{ color: 'var(--color-primary)' }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                          disabled={item.stock_count !== undefined && item.quantity >= item.stock_count}
                          className="w-7 h-7 text-xs flex items-center justify-center transition-colors hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ color: 'var(--color-primary)' }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs tracking-wider" style={{ color: 'var(--color-primary)', opacity: 0.65 }}>
                        {currency}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-stone-200">
            <div className="flex justify-between items-baseline mb-5">
              <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-primary)', opacity: 0.7 }}>
                Subtotal
              </span>
              <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)', fontSize: '1.05rem' }}>
                {currency}{subtotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3.5 text-xs tracking-[0.22em] uppercase transition-all duration-200 hover:opacity-80 active:scale-[0.99] mb-3"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
            >
              Proceed to Checkout
            </button>
            <div className="flex items-center justify-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3" style={{ color: 'var(--color-primary)', opacity: 0.35 }}>
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
              </svg>
              <span className="text-[9px] tracking-[0.18em] uppercase" style={{ color: 'var(--color-primary)', opacity: 0.38 }}>
                Secure Checkout
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
