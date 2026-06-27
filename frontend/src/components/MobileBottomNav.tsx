import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export const MOBILE_NAV_HEIGHT = 56

interface MobileBottomNavProps {
  cartCount: number
  onCartOpen: () => void
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 18v-5h5v5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle
        cx="9"
        cy="9"
        r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M13 13l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M5 2L3 5v11a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 16V5l-2-3H5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line x1="3" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13 8.5a3 3 0 0 1-6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle
        cx="10"
        cy="7"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function MobileBottomNav({ cartCount, onCartOpen }: MobileBottomNavProps) {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)

  function isActive(href: string) {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      color: active
        ? 'var(--color-accent)'
        : 'color-mix(in srgb, var(--color-primary) 50%, transparent)',
      transition: 'color 0.15s ease',
    }
  }

  const accountHref = token ? '/account/orders' : '/account/login'

  return (
    <>
      <style>{`
        .mobile-bottom-nav {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      `}</style>
      <nav
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 md:hidden z-50 h-14 flex items-center"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderTop: '1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)',
        }}
        aria-label="Mobile navigation"
      >
        <div className="flex w-full items-center">

          {/* Home */}
          <Link
            to="/"
            className="flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1"
            style={tabStyle(isActive('/'))}
            aria-label="Home"
          >
            <HomeIcon />
            <span className="text-[10px] tracking-wide">Home</span>
          </Link>

          {/* Search */}
          <Link
            to="/search"
            className="flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1"
            style={tabStyle(isActive('/search'))}
            aria-label="Search"
          >
            <SearchIcon />
            <span className="text-[10px] tracking-wide">Search</span>
          </Link>

          {/* Cart */}
          <button
            onClick={onCartOpen}
            className="flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1 relative"
            style={tabStyle(false)}
            aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
          >
            <span className="relative inline-flex">
              <CartIcon />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-semibold flex items-center justify-center text-white leading-none"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span className="text-[10px] tracking-wide">Cart</span>
          </button>

          {/* Account */}
          <Link
            to={accountHref}
            className="flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1"
            style={tabStyle(isActive('/account'))}
            aria-label={token ? 'My Account' : 'Login'}
          >
            <AccountIcon />
            <span className="text-[10px] tracking-wide">{token ? 'Account' : 'Login'}</span>
          </Link>

        </div>
      </nav>
    </>
  )
}
