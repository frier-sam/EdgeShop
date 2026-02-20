import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HeaderProps } from '../types'
import { useAuthStore } from '../../store/authStore'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const token = useAuthStore((s) => s.token)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b border-stone-200 backdrop-blur-sm"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-bg) 90%, transparent)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/">
            <h1
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
              className="text-xl tracking-widest uppercase font-semibold shrink-0"
            >
              {storeName}
            </h1>
          </Link>

          {/* Desktop nav */}
          {navItems.length > 0 && (
            <nav className="hidden sm:flex items-center gap-6">
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
                        className="text-xs tracking-widest uppercase transition-all hover:opacity-70 border-b border-transparent hover:border-current pb-0.5"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        to={item.href}
                        className="text-xs tracking-widest uppercase transition-all hover:opacity-70 border-b border-transparent hover:border-current pb-0.5"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {item.label}
                        {hasChildren && <span className="ml-1 opacity-50">▾</span>}
                      </Link>
                    )}
                    {/* Dropdown — no mt-2 gap so onMouseLeave isn't triggered mid-air */}
                    {hasChildren && openDropdown === item.href && (
                      <div
                        className="absolute top-full left-0 min-w-40 border border-stone-200 shadow-lg z-50 pt-1"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        {item.children!.map(child => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className="block px-4 py-2.5 text-xs tracking-widest uppercase transition-colors hover:opacity-70"
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

          {/* Right: account + cart + hamburger */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              to={token ? '/account/orders' : '/account/login'}
              style={{ color: 'var(--color-primary)' }}
              className="text-xs tracking-widest uppercase transition-all hover:opacity-70 border-b border-transparent hover:border-current pb-0.5"
            >
              {token ? 'Account' : 'Login'}
            </Link>
            <button
              onClick={onCartOpen}
              style={{ color: 'var(--color-primary)' }}
              className="relative transition-colors hover:opacity-70"
              aria-label={`Open cart, ${cartCount} items`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {cartCount}
                </span>
              )}
            </button>
            {navItems.length > 0 && (
              <button
                className="sm:hidden flex flex-col gap-1.5 p-1"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Menu"
              >
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-stone-200" style={{ backgroundColor: 'var(--color-bg)' }}>
            {navItems.map(item => (
              <div key={item.href}>
                <Link
                  to={item.href}
                  className="block px-6 py-3 text-xs tracking-widest uppercase"
                  style={{ color: 'var(--color-primary)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children?.map(child => (
                  <Link
                    key={child.href}
                    to={child.href}
                    className="block px-10 py-2.5 text-xs tracking-widest uppercase opacity-70"
                    style={{ color: 'var(--color-primary)' }}
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
