import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Icon from './ui/Icon'

export const MOBILE_NAV_HEIGHT = 56

interface MobileBottomNavProps {
  cartCount: number
  onCartOpen: () => void
}

export default function MobileBottomNav({ cartCount, onCartOpen }: MobileBottomNavProps) {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)

  function isActive(href: string) {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  function tabClass(active: boolean): string {
    return active ? 'text-ink' : 'text-ink-soft/70'
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
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center border-t border-line bg-paper md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex w-full items-center">
          <Link
            to="/"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-2 font-label transition-colors ${tabClass(isActive('/'))}`}
            aria-label="Home"
          >
            <Icon name="home" size={20} />
            <span className="text-[10px] tracking-wide">Home</span>
          </Link>

          <Link
            to="/shop"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-2 font-label transition-colors ${tabClass(isActive('/shop'))}`}
            aria-label="Shop"
          >
            <Icon name="storefront" size={20} />
            <span className="text-[10px] tracking-wide">Shop</span>
          </Link>

          <button
            onClick={onCartOpen}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-2 font-label transition-colors ${tabClass(false)}`}
            aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}
          >
            <span className="relative inline-flex">
              <Icon name="shopping_cart" size={20} />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-pill bg-accent px-0.5 text-[9px] font-semibold leading-none text-on-accent">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </span>
            <span className="text-[10px] tracking-wide">Cart</span>
          </button>

          <Link
            to={accountHref}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-2 font-label transition-colors ${tabClass(isActive('/account'))}`}
            aria-label={token ? 'My Account' : 'Login'}
          >
            <Icon name="person" size={20} />
            <span className="text-[10px] tracking-wide">{token ? 'Account' : 'Login'}</span>
          </Link>
        </div>
      </nav>
    </>
  )
}
