import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b-2 border-amber-200"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/">
            <h1 className="text-xl font-bold tracking-wider uppercase shrink-0" style={{ color: 'var(--color-primary)' }}>
              {storeName}
            </h1>
          </Link>

          {/* Desktop nav */}
          {navItems.length > 0 && (
            <nav className="hidden sm:flex items-center gap-5">
              {navItems.map(item => {
                const hasChildren = item.children && item.children.length > 0
                const isExternal = item.href.startsWith('http')
                return (
                  <div
                    key={item.href}
                    className="relative"
                    onMouseEnter={() => hasChildren && setOpenDropdown(item.href)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {isExternal ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold tracking-wider uppercase transition-colors"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        className="text-xs font-bold tracking-wider uppercase transition-colors relative group"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {item.label}
                        {hasChildren && <span className="ml-1 opacity-50">▾</span>}
                        <span
                          className="absolute -bottom-1 left-0 w-0 h-0.5 group-hover:w-full transition-all duration-300 rounded-full"
                          style={{ backgroundColor: 'var(--color-accent)' }}
                        />
                      </Link>
                    )}
                    {/* Dropdown */}
                    {hasChildren && openDropdown === item.href && (
                      <div
                        className="absolute top-full left-0 mt-2 min-w-40 rounded-lg border-2 border-amber-200 shadow-lg z-50"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        {item.children!.map(child => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className="block px-4 py-2.5 text-xs font-bold tracking-wider uppercase transition-colors hover:opacity-70"
                            style={{ color: 'var(--color-primary)' }}
                            onClick={() => setOpenDropdown(null)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
          )}

          {/* Right: cart + hamburger */}
          <div className="flex items-center gap-4 shrink-0">
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
            {navItems.length > 0 && (
              <button
                className="sm:hidden flex flex-col gap-1.5 p-1"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Menu"
              >
                <span className="w-5 h-0.5 block rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-0.5 block rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-0.5 block rounded-full" style={{ backgroundColor: 'var(--color-primary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="sm:hidden border-t-2 border-amber-200" style={{ backgroundColor: 'var(--color-bg)' }}>
            {navItems.map(item => (
              <div key={item.href}>
                <Link
                  to={item.href}
                  className="block px-6 py-3 text-xs font-bold tracking-wider uppercase"
                  style={{ color: 'var(--color-primary)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children?.map(child => (
                  <Link
                    key={child.href}
                    to={child.href}
                    className="block px-10 py-2.5 text-xs font-bold tracking-wider uppercase opacity-70"
                    style={{ color: 'var(--color-accent)' }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </header>
    </>
  )
}
