import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen }: HeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-[#FAFAF8] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 style={{ fontFamily: "'Playfair Display', serif" }} className="text-xl tracking-widest uppercase text-[#1A1A1A] font-semibold">
          {storeName}
        </h1>
        <button
          onClick={onCartOpen}
          className="text-sm tracking-wider uppercase text-[#1A1A1A] hover:text-[#C9A96E] transition-colors"
        >
          Bag
          {cartCount > 0 && (
            <span className="ml-1 text-[#C9A96E] font-semibold">({cartCount})</span>
          )}
        </button>
      </div>
    </header>
  )
}
