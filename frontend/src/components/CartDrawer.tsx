import { Link } from 'react-router-dom'
import type { CartItem } from '../lib/types'

interface CartDrawerProps {
  isOpen: boolean
  items: CartItem[]
  currency: string
  onClose: () => void
  onUpdateQuantity: (productId: number, quantity: number) => void
  onCheckout: () => void
}

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col bg-white transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Cart
            {items.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-14 h-14 text-gray-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm5.625 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm text-gray-400">Your cart is empty</p>
              <button
                onClick={onClose}
                className="text-xs font-medium uppercase tracking-wide text-gray-900 underline underline-offset-4 hover:text-gray-600"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-4">
                  <Link to={`/product/${item.product_id}`} onClick={onClose} className="shrink-0">
                    <div className="w-20 h-20 bg-gray-100 overflow-hidden rounded">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} onClick={onClose}>
                      <p className="text-sm font-medium text-gray-900 mb-1 hover:text-gray-600 transition-colors leading-snug">
                        {item.name}
                      </p>
                    </Link>
                    <p className="text-xs text-gray-500 mb-3">
                      {currency}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-gray-200 divide-x divide-gray-200 rounded">
                        <button
                          onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                          className="w-7 h-7 text-xs flex items-center justify-center text-gray-700 hover:bg-gray-50"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-7 h-7 text-xs flex items-center justify-center text-gray-700">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                          disabled={item.stock_count !== undefined && item.quantity >= item.stock_count}
                          className="w-7 h-7 text-xs flex items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">
                        {currency}{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-gray-200">
            <div className="flex justify-between items-baseline mb-5">
              <span className="text-xs uppercase tracking-wide text-gray-500">Subtotal</span>
              <span className="text-base font-semibold text-gray-900">
                {currency}{subtotal.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3.5 text-sm font-medium tracking-wide uppercase bg-gray-900 text-white transition-opacity hover:opacity-90 active:scale-[0.99] rounded"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
