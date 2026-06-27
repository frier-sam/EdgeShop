import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { HeaderProps } from '../types'
import { useAuthStore } from '../../store/authStore'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [wishlistCount, setWishlistCount] = useState(0)

  // Read wishlist count from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('edgeshop_wishlist')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setWishlistCount(parsed.length)
        }
      }
    } catch {
      setWishlistCount(0)
    }
  }, [])

  // Body scroll lock when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  // Close search overlay on Escape key
  useEffect(() => {
    if (!searchOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [searchOpen])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (q) {
      setSearchOpen(false)
      setSearchQuery('')
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <>
      {/* Search overlay */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => {
            setSearchOpen(false)
            setSearchQuery('')
          }}
        >
          <div
            className="w-full"
            style={{
              backgroundColor: 'var(--color-bg)',
              animation: 'search-overlay-in 250ms ease forwards',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={handleSearchSubmit}
              className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-4"
            >
              {/* Magnifier inside the bar */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--color-primary)', opacity: 0.5, flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products…"
                className="flex-1 bg-transparent outline-none text-base"
                style={{ color: 'var(--color-primary)', caretColor: 'var(--color-accent)' }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false)
                  setSearchQuery('')
                }}
                className="text-lg leading-none transition-opacity hover:opacity-60 px-1"
                style={{ color: 'var(--color-primary)' }}
                aria-label="Close search"
              >
                ✕
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[55] sm:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={closeMobile}
        />
      )}

      {/* Mobile full-screen left drawer */}
      <div
        className="fixed top-0 left-0 h-full z-[56] w-72 sm:hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms ease',
          boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.18)' : 'none',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-stone-200"
        >
          <span
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
            className="text-xl tracking-widest uppercase font-semibold"
          >
            {storeName}
          </span>
          <button
            onClick={closeMobile}
            className="text-lg leading-none transition-opacity hover:opacity-60 p-1"
            style={{ color: 'var(--color-primary)' }}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Drawer nav items */}
        <div className="flex-1 overflow-y-auto">
          {navItems.map((item) => (
            <div key={item.href}>
              <Link
                to={item.href}
                className="flex items-center px-6 py-4 text-lg tracking-wide transition-opacity hover:opacity-60"
                style={{ color: 'var(--color-primary)' }}
                onClick={closeMobile}
              >
                {item.label}
              </Link>
              {item.children?.map((child) => (
                <Link
                  key={child.href}
                  to={child.href}
                  className="flex items-center pl-10 pr-6 py-3 text-base tracking-wide transition-opacity hover:opacity-60"
                  style={{ color: 'var(--color-primary)', opacity: 0.7 }}
                  onClick={closeMobile}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="mx-6 my-2 border-t border-stone-200" />

          {/* Account row */}
          <Link
            to={token ? '/account/orders' : '/account/login'}
            className="flex items-center gap-3 px-6 py-4 text-lg tracking-wide transition-opacity hover:opacity-60"
            style={{ color: 'var(--color-primary)' }}
            onClick={closeMobile}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {token ? 'Account' : 'Login'}
          </Link>

          {/* Cart row */}
          <button
            className="flex w-full items-center gap-3 px-6 py-4 text-lg tracking-wide transition-opacity hover:opacity-60"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => { closeMobile(); onCartOpen() }}
          >
            <span className="relative inline-flex">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {cartCount}
                </span>
              )}
            </span>
            Cart
            {cartCount > 0 && (
              <span className="text-sm opacity-60">({cartCount})</span>
            )}
          </button>

          {/* Search row */}
          <button
            className="flex w-full items-center gap-3 px-6 py-4 text-lg tracking-wide transition-opacity hover:opacity-60"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => { closeMobile(); setSearchOpen(true) }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </button>
        </div>
      </div>

      {/* Main header */}
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
              {navItems.map((item) => {
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
                    {/* Dropdown */}
                    {hasChildren && openDropdown === item.href && (
                      <div
                        className="absolute top-full left-0 min-w-40 border border-stone-200 shadow-lg z-50 pt-1"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        {item.children!.map((child) => (
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

          {/* Right: icons (desktop) + hamburger (mobile) */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Search icon — visible on all screen sizes */}
            <button
              onClick={() => setSearchOpen(true)}
              style={{ color: 'var(--color-primary)' }}
              className="relative transition-opacity hover:opacity-70"
              aria-label="Open search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Wishlist icon — visible on desktop only */}
            <button
              onClick={() => navigate('/account/orders')}
              style={{ color: 'var(--color-primary)' }}
              className="hidden sm:inline-flex relative transition-opacity hover:opacity-70"
              aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {wishlistCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {wishlistCount}
                </span>
              )}
            </button>

            {/* Account link — desktop only */}
            <Link
              to={token ? '/account/orders' : '/account/login'}
              style={{ color: 'var(--color-primary)' }}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs tracking-widest uppercase transition-all hover:opacity-70 border-b border-transparent hover:border-current pb-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {token ? 'Account' : 'Login'}
            </Link>

            {/* Cart bag — visible on all screen sizes */}
            <button
              onClick={onCartOpen}
              style={{ color: 'var(--color-primary)' }}
              className="relative transition-colors hover:opacity-70"
              aria-label={`Open cart, ${cartCount} items`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
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

            {/* Hamburger — mobile only */}
            {navItems.length > 0 && (
              <button
                className="sm:hidden flex flex-col gap-1.5 p-1"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Keyframes for search overlay slide-down */}
      <style>{`
        @keyframes search-overlay-in {
          from { opacity: 0; transform: translateY(-20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
