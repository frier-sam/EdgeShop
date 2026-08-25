import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export interface NavItem {
  label: string
  href: string
}

interface HeaderProps {
  storeName: string
  cartCount: number
  onCartOpen: () => void
  navItems: NavItem[]
}

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const token = useAuthStore((s) => s.token)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <>
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 sm:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-[56] w-72 bg-white sm:hidden flex flex-col shadow-xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="text-lg font-semibold text-gray-900">{storeName}</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-xl p-1"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="block px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mx-5 my-2 border-t border-gray-100" />
          <Link
            to={token ? '/account/orders' : '/account/login'}
            className="block px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => setMobileOpen(false)}
          >
            {token ? 'My Account' : 'Login'}
          </Link>
          <button
            className="block w-full text-left px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={() => { setMobileOpen(false); onCartOpen() }}
          >
            Cart {cartCount > 0 && `(${cartCount})`}
          </button>
        </nav>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link to="/" className="text-lg font-semibold text-gray-900 shrink-0">
            {storeName}
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden sm:flex items-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-4 shrink-0">
            <Link
              to={token ? '/account/orders' : '/account/login'}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {token ? 'Account' : 'Login'}
            </Link>

            <button
              onClick={onCartOpen}
              className="relative text-gray-700 hover:text-gray-900 transition-colors"
              aria-label={`Open cart, ${cartCount} items`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-gray-900 text-white text-[10px] font-semibold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            {navItems.length > 0 && (
              <button
                className="sm:hidden flex flex-col gap-1.5 p-1"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <span className="w-5 h-px bg-gray-700 block" />
                <span className="w-5 h-px bg-gray-700 block" />
                <span className="w-5 h-px bg-gray-700 block" />
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
