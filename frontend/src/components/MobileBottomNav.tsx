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

function ShopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M4 8l1-4h10l1 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3 8h14v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15V8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 8v1.5a2.5 2.5 0 0 0 5 0V8"
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

  function tabClass(active: boolean): string {
    return active ? 'text-gray-900' : 'text-gray-400'
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
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 md:hidden z-50 h-14 flex items-center bg-white border-t border-gray-200"
        aria-label="Mobile navigation"
      >
        <div className="flex w-full items-center">

          {/* Home */}
          <Link
            to="/"
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1 transition-colors ${tabClass(isActive('/'))}`}
            aria-label="Home"
          >
            <HomeIcon />
            <span className="text-[10px] tracking-wide">Home</span>
          </Link>

          {/* Shop */}
          <Link
            to="/shop"
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1 transition-colors ${tabClass(isActive('/shop'))}`}
            aria-label="Shop"
          >
            <ShopIcon />
            <span className="text-[10px] tracking-wide">Shop</span>
          </Link>

          {/* Cart */}
          <button
            onClick={onCartOpen}
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1 relative transition-colors ${tabClass(false)}`}
            aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
          >
            <span className="relative inline-flex">
              <CartIcon />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-semibold flex items-center justify-center text-white leading-none bg-gray-900"
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
            className={`flex flex-col items-center justify-center flex-1 gap-0.5 pt-2 pb-1 transition-colors ${tabClass(isActive('/account'))}`}
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
