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
                    {/* Dropdown — no mt-2 gap so onMouseLeave isn't triggered mid-air */}
                    {hasChildren && openDropdown === item.href && (
                      <div
                        className="absolute top-full left-0 min-w-40 rounded-b-lg border-2 border-t-0 border-amber-200 shadow-lg z-50 pt-1"
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

          {/* Right: account + cart + hamburger */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              to={token ? '/account/orders' : '/account/login'}
              style={{ color: 'var(--color-primary)' }}
              className="text-xs font-bold tracking-wider uppercase transition-colors hover:opacity-70"
            >
              {token ? 'Account' : 'Login'}
            </Link>
            <button
              onClick={onCartOpen}
              style={{ color: 'var(--color-primary)' }}
              className="relative transition-colors hover:opacity-70"
              aria-label={`Open cart, ${cartCount} items`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
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
