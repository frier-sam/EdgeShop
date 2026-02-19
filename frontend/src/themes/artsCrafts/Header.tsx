import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen }: HeaderProps) {
  return (
    <header className="border-b-2 border-amber-200 bg-[#F5F0E8] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wider uppercase text-[#2C2416]">
          {storeName}
        </h1>
        <button
          onClick={onCartOpen}
          className="text-sm font-bold tracking-wider uppercase text-[#2C2416] hover:text-[#C4622D] transition-colors"
        >
          Cart
          {cartCount > 0 && (
            <span className="ml-1 text-[#C4622D] font-bold">({cartCount})</span>
          )}
        </button>
      </div>
    </header>
  )
}
