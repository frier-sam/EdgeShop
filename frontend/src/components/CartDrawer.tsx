import { Link } from 'react-router-dom'
import type { CartLine } from '../store/cartStore'
import Button from './Button'

interface CartDrawerProps {
  isOpen: boolean
  lines: CartLine[]
  currency: string
  onClose: () => void
  onUpdateQuantity: (key: string, quantity: number) => void
  onRemove: (key: string) => void
  onCheckout: () => void
}

export default function CartDrawer({ isOpen, lines, currency, onClose, onUpdateQuantity, onRemove, onCheckout }: CartDrawerProps) {
  const subtotal = lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-paper transition-transform duration-300 ease-in-out sm:w-96 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-display text-lg font-semibold text-ink">
            Your Cart
            {lines.length > 0 && (
              <span className="ml-2 text-sm font-normal text-ink-soft">
                ({lines.reduce((s, l) => s + l.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="h-14 w-14 text-line">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm5.625 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm text-ink-soft">Your cart is empty</p>
              <button onClick={onClose} className="text-xs font-medium uppercase tracking-wide text-ink underline underline-offset-4 hover:text-accent">
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {lines.map((line) => (
                <li key={line.key} className="flex gap-4">
                  <Link to={`/product/${line.product_id}`} onClick={onClose} className="shrink-0">
                    <div className="h-20 w-20 overflow-hidden rounded-lg bg-surface ring-1 ring-line">
                      {line.preview_url ? (
                        <img src={line.preview_url} alt={line.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-soft">No image</div>
                      )}
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${line.product_id}`} onClick={onClose}>
                      <p className="mb-1 truncate text-sm font-medium leading-snug text-ink transition-colors hover:text-accent">
                        {line.name}
                      </p>
                    </Link>
                    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                      {line.size && <span>Size {line.size}</span>}
                      {line.design_id && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-dark">
                          Custom design
                        </span>
                      )}
                    </div>
                    {line.print_fees.length > 0 && (
                      <p className="mb-1 text-[11px] text-ink-soft">
                        {line.print_fees
                          .map((f) => `${f.side === 'front' ? 'Front' : 'Back'} print +${currency}${f.fee.toFixed(2)}`)
                          .join(' · ')}
                      </p>
                    )}
                    {line.design_id && (
                      <Link
                        to={`/customize/${line.product_id}?design=${line.design_id}${line.size ? `&size=${encodeURIComponent(line.size)}` : ''}`}
                        onClick={onClose}
                        className="mb-2 inline-block text-[11px] font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
                      >
                        Edit design
                      </Link>
                    )}
                    <p className="mb-3 text-xs text-ink-soft">
                      {currency}
                      {line.unit_price.toFixed(2)}
                    </p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center divide-x divide-line rounded-full border border-line">
                        <button
                          onClick={() => onUpdateQuantity(line.key, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center text-sm text-ink hover:bg-ink/5"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="flex h-8 w-8 items-center justify-center text-xs text-ink">{line.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(line.key, line.quantity + 1)}
                          disabled={line.quantity >= line.max_qty}
                          className="flex h-8 w-8 items-center justify-center text-sm text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-ink">
                          {currency}
                          {(line.unit_price * line.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => onRemove(line.key)}
                          className="text-xs text-ink-soft underline underline-offset-2 hover:text-danger"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-line px-6 py-5">
            <div className="mb-5 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wide text-ink-soft">Subtotal</span>
              <span className="text-base font-semibold text-ink">
                {currency}
                {subtotal.toFixed(2)}
              </span>
            </div>
            <Button variant="accent" size="lg" fullWidth onClick={onCheckout} className="uppercase">
              Proceed to Checkout
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
