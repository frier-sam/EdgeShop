import type { CartDrawerProps } from '../types'

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      )}
      <div className={`fixed right-0 top-0 h-full w-full sm:w-96 bg-[#FAFAF8] z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
          <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-lg text-[#1A1A1A]">Your Bag</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-stone-400 text-center mt-10">Your bag is empty</p>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-3">
                  <div className="w-16 h-16 bg-stone-100 flex-shrink-0">
                    {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1A1A1A] truncate">{item.name}</p>
                    <p className="text-xs text-stone-500">{currency}{item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)} className="text-stone-400 hover:text-[#1A1A1A] text-xs w-5 h-5 border border-stone-200 flex items-center justify-center">−</button>
                      <span className="text-xs w-4 text-center">{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)} className="text-stone-400 hover:text-[#1A1A1A] text-xs w-5 h-5 border border-stone-200 flex items-center justify-center">+</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-stone-200">
            <div className="flex justify-between text-sm text-[#1A1A1A] mb-4">
              <span className="tracking-wider uppercase text-xs">Total</span>
              <span style={{ fontFamily: "'Playfair Display', serif" }}>{currency}{total.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3 bg-[#1A1A1A] text-[#FAFAF8] text-xs tracking-widest uppercase hover:bg-[#C9A96E] transition-colors"
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
