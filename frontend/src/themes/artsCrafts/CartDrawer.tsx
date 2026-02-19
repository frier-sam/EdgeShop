import type { CartDrawerProps } from '../types'

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      )}
      <div className={`fixed right-0 top-0 h-full w-full sm:w-96 bg-[#F5F0E8] z-50 transform transition-transform duration-300 flex flex-col border-l-2 border-amber-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b-2 border-amber-200">
          <h2 className="text-lg font-bold tracking-wider uppercase text-[#2C2416]">Your Cart</h2>
          <button onClick={onClose} className="text-amber-400 hover:text-[#C4622D] text-2xl leading-none transition-colors">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="text-sm text-amber-400 text-center mt-10 font-bold tracking-wider">Your cart is empty</p>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-amber-50 border-2 border-amber-200 flex-shrink-0">
                    {item.image_url && <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#2C2416] truncate">{item.name}</p>
                    <p className="text-sm text-[#C4622D] font-bold">{currency}{item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                        className="text-[#2C2416] hover:text-[#C4622D] text-xs w-6 h-6 rounded-full border-2 border-amber-200 flex items-center justify-center transition-colors font-bold"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold w-4 text-center text-[#2C2416]">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                        className="text-[#2C2416] hover:text-[#C4622D] text-xs w-6 h-6 rounded-full border-2 border-amber-200 flex items-center justify-center transition-colors font-bold"
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
        {items.length > 0 && (
          <div className="px-6 py-5 border-t-2 border-amber-200">
            <div className="flex justify-between text-[#2C2416] mb-4">
              <span className="font-bold tracking-wider uppercase text-sm">Total</span>
              <span className="font-bold text-[#C4622D] text-sm">{currency}{total.toFixed(2)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3 bg-[#C4622D] text-white text-sm font-bold tracking-wider uppercase rounded-full hover:bg-[#a8501f] transition-colors"
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
