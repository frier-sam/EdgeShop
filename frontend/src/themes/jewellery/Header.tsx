import { Link } from 'react-router-dom'
import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  return (
    <header className="border-b border-stone-200 sticky top-0 z-50" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6">
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }} className="text-xl tracking-widest uppercase font-semibold shrink-0">
          {storeName}
        </h1>
        {navItems.length > 0 && (
          <nav className="hidden sm:flex items-center gap-6">
            {navItems.map(item => {
              const isExternal = item.href.startsWith('http://') || item.href.startsWith('https://')
              return isExternal ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-widest uppercase transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-xs tracking-widest uppercase transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        )}
        <button
          onClick={onCartOpen}
          style={{ color: 'var(--color-primary)' }}
          className="text-sm tracking-wider uppercase transition-colors hover:opacity-70 shrink-0"
        >
          Bag
          {cartCount > 0 && (
            <span className="ml-1 font-semibold" style={{ color: 'var(--color-accent)' }}>({cartCount})</span>
          )}
        </button>
      </div>
    </header>
  )
}
