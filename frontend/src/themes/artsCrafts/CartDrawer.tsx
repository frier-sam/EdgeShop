import type { CartDrawerProps } from '../types'
import { Link } from 'react-router-dom'

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b-2 border-amber-200">
          <h2 className="text-lg font-bold tracking-wider uppercase" style={{ color: 'var(--color-primary)' }}>
            Your Cart
            {items.length > 0 && (
              <span className="ml-2 text-xs" style={{ color: 'var(--color-accent)' }}>
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 transition-opacity hover:opacity-50 text-xl font-bold"
            style={{ color: 'var(--color-primary)' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-xs tracking-widest uppercase font-bold" style={{ color: 'var(--color-accent)' }}>
                Your cart is empty
              </p>
              <button onClick={onClose} className="text-xs tracking-widest uppercase underline underline-offset-4" style={{ color: 'var(--color-primary)' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-3">
                  <Link to={`/product/${item.product_id}`} onClick={onClose}>
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-amber-50 border-2 border-amber-100 flex-shrink-0">
                      {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} onClick={onClose}>
                      <p className="text-sm font-bold truncate hover:opacity-70 transition-opacity" style={{ color: 'var(--color-primary)' }}>
                        {item.name}
                      </p>
                    </Link>
                    <p className="text-xs font-bold mt-0.5 mb-2" style={{ color: 'var(--color-accent)' }}>
                      {currency}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-full border-2 border-amber-200 text-xs flex items-center justify-center transition-colors hover:border-amber-400 font-bold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        −
                      </button>
                      <span className="text-xs font-bold w-4 text-center" style={{ color: 'var(--color-primary)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-full border-2 border-amber-200 text-xs flex items-center justify-center transition-colors hover:border-amber-400 font-bold"
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
          <div className="px-6 py-5 border-t-2 border-amber-200">
            <div className="flex justify-between mb-4">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-primary)' }}>Subtotal</span>
              <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                {currency}{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3 text-xs font-bold tracking-[0.2em] uppercase rounded-full transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'var(--color-accent)', color: '#FFFFFF' }}
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
