import { Link } from 'react-router-dom'
import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  return (
    <header className="border-b-2 border-amber-200 sticky top-0 z-50" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6">
        <h1 className="text-xl font-bold tracking-wider uppercase shrink-0" style={{ color: 'var(--color-primary)' }}>
          {storeName}
        </h1>
        {navItems.length > 0 && (
          <nav className="hidden sm:flex items-center gap-5">
            {navItems.map(item => {
              const isExternal = item.href.startsWith('http://') || item.href.startsWith('https://')
              return isExternal ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold tracking-wider uppercase transition-colors hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-xs font-bold tracking-wider uppercase transition-colors hover:opacity-70"
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
          className="text-sm font-bold tracking-wider uppercase transition-colors hover:opacity-70 shrink-0"
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
