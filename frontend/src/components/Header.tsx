import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import IconButton from './ui/IconButton'
import Badge from './ui/Badge'

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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

/**
 * Small pill that plays `animate-badge-pop` whenever the count changes —
 * remounting on `count` (via `key`) replays the keyframe every time an
 * item is added (or removed), which is the simplest reliable way to
 * trigger a CSS keyframe on a value change without extra state.
 */
function CartCountBadge({ count, size = 'md' }: { count: number; size?: 'sm' | 'md' }) {
  if (count <= 0) return null
  return (
    <Badge
      key={count}
      pop
      variant="accent"
      size={size}
      className={`absolute -right-1.5 -top-1.5 border-2 border-paper bg-accent text-on-accent ${
        size === 'sm' ? 'h-[18px] min-w-[18px] px-1' : ''
      }`}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  )
}

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const token = useAuthStore((s) => s.token)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm transition-[height] duration-base ease-out-soft ${
          condensed ? 'h-14' : 'h-16'
        }`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-8">
          <Link to="/" className="shrink-0 font-display text-lg font-semibold tracking-tight text-ink">
            {storeName}
          </Link>

          {navItems.length > 0 && (
            <nav className="hidden items-center gap-7 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-1">
            <Link
              to={token ? '/account/orders' : '/account/login'}
              className="hidden h-11 items-center gap-1.5 px-2 text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink sm:inline-flex"
            >
              <AccountIcon />
              {token ? 'Account' : 'Login'}
            </Link>

            <div className="relative">
              <IconButton variant="ghost" aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`} onClick={onCartOpen}>
                <CartIcon />
              </IconButton>
              <CartCountBadge count={cartCount} />
            </div>

            {navItems.length > 0 && (
              <IconButton variant="ghost" className="sm:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
          </div>
        </div>
      </header>

      {/* Mobile nav — left-edge slide-in sheet, built on the shared Sheet
          primitive but pinned to the left/full-height rather than the
          bottom, so it reads as a nav drawer instead of a bottom sheet. */}
      <div className={`fixed inset-0 z-[60] sm:hidden ${mobileOpen ? '' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-ink/40 transition-opacity duration-base ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className={`absolute left-0 top-0 flex h-full w-[82%] max-w-72 flex-col bg-surface shadow-lift transition-transform duration-base ease-out-soft ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-display text-lg font-semibold text-ink">{storeName}</span>
            <IconButton variant="ghost" size="sm" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="1" y1="1" x2="11" y2="11" />
                <line x1="11" y1="1" x2="1" y2="11" />
              </svg>
            </IconButton>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="flex min-h-11 items-center px-5 py-3 text-sm font-medium text-ink transition-colors duration-fast hover:bg-surface-2"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mx-5 my-2 border-t border-line" />
            <Link
              to={token ? '/account/orders' : '/account/login'}
              className="flex min-h-11 items-center px-5 py-3 text-sm font-medium text-ink transition-colors duration-fast hover:bg-surface-2"
              onClick={() => setMobileOpen(false)}
            >
              {token ? 'My Account' : 'Login'}
            </Link>
            <button
              className="flex min-h-11 w-full items-center px-5 py-3 text-left text-sm font-medium text-ink transition-colors duration-fast hover:bg-surface-2"
              onClick={() => {
                setMobileOpen(false)
                onCartOpen()
              }}
            >
              Cart {cartCount > 0 && `(${cartCount})`}
            </button>
          </nav>
        </div>
      </div>
    </>
  )
}
