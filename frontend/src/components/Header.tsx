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

function CartIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
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
        <div className="fixed inset-0 z-[55] bg-ink/40 sm:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed left-0 top-0 z-[56] flex h-full w-72 flex-col bg-paper shadow-xl transition-transform duration-300 sm:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="font-display text-lg font-semibold text-ink">{storeName}</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink"
            aria-label="Close menu"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex min-h-11 items-center px-5 py-3 text-sm font-medium text-ink hover:bg-ink/5"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <div className="mx-5 my-2 border-t border-line" />
          <Link
            to={token ? '/account/orders' : '/account/login'}
            className="flex min-h-11 items-center px-5 py-3 text-sm font-medium text-ink hover:bg-ink/5"
            onClick={() => setMobileOpen(false)}
          >
            {token ? 'My Account' : 'Login'}
          </Link>
          <button
            className="flex min-h-11 w-full items-center px-5 py-3 text-left text-sm font-medium text-ink hover:bg-ink/5"
            onClick={() => {
              setMobileOpen(false)
              onCartOpen()
            }}
          >
            Cart {cartCount > 0 && `(${cartCount})`}
          </button>
        </nav>
      </div>

      {/* Main header */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link to="/" className="shrink-0 font-display text-lg font-semibold tracking-tight text-ink">
            {storeName}
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden items-center gap-7 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-1">
            <Link
              to={token ? '/account/orders' : '/account/login'}
              className="hidden h-11 items-center gap-1.5 px-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline-flex"
            >
              <AccountIcon />
              {token ? 'Account' : 'Login'}
            </Link>

            <button
              onClick={onCartOpen}
              className="relative flex h-11 w-11 items-center justify-center text-ink transition-colors hover:text-ink-soft"
              aria-label={`Open cart, ${cartCount} items`}
            >
              <CartIcon />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-0.5 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {navItems.length > 0 && (
              <button
                className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 sm:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <span className="block h-px w-5 bg-ink" />
                <span className="block h-px w-5 bg-ink" />
                <span className="block h-px w-5 bg-ink" />
              </button>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
