import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen }: HeaderProps) {
  return (
    <header className="border-b-2 border-amber-200 sticky top-0 z-50" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-wider uppercase" style={{ color: 'var(--color-primary)' }}>
          {storeName}
        </h1>
        <button
          onClick={onCartOpen}
          style={{ color: 'var(--color-primary)' }}
          className="text-sm font-bold tracking-wider uppercase transition-colors hover:opacity-70"
        >
          Cart
          {cartCount > 0 && (
            <span className="ml-1 font-bold" style={{ color: 'var(--color-accent)' }}>({cartCount})</span>
          )}
        </button>
      </div>
    </header>
  )
}
