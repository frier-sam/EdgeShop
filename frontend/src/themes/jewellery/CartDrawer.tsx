import type { CartDrawerProps } from '../types'
import { Link } from 'react-router-dom'

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
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
            className="p-1 transition-opacity hover:opacity-50"
            style={{ color: 'var(--color-primary)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                Your bag is empty
              </p>
              <button onClick={onClose} className="text-xs tracking-widest uppercase underline underline-offset-4" style={{ color: 'var(--color-primary)' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-4">
                  <Link to={`/product/${item.product_id}`} onClick={onClose}>
                    <div className="w-20 h-20 bg-stone-100 shrink-0 overflow-hidden">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} onClick={onClose}>
                      <p
                        className="text-sm mb-1 hover:opacity-70 transition-opacity"
                        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
                      >
                        {item.name}
                      </p>
                    </Link>
                    <p className="text-xs tracking-wider mb-3" style={{ color: 'var(--color-accent)' }}>
                      {currency}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 border border-stone-200 text-xs flex items-center justify-center transition-colors hover:border-stone-400"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        −
                      </button>
                      <span className="text-xs w-4 text-center" style={{ color: 'var(--color-primary)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 border border-stone-200 text-xs flex items-center justify-center transition-colors hover:border-stone-400"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        +
                      </button>
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
            <div className="flex justify-between mb-5">
              <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-primary)' }}>Subtotal</span>
              <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}>
                {currency}{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3.5 text-xs tracking-[0.2em] uppercase transition-all duration-200 hover:opacity-80 active:scale-[0.99]"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
            >
              Checkout
            </button>
            <p className="text-center text-xs mt-3 tracking-wider" style={{ color: 'var(--color-accent)' }}>
              Free shipping on orders above ₹999
            </p>
          </div>
        )}
      </div>
    </>
  )
}
