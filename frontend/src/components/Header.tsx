import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { fetchJson } from '../lib/api'
import { useSettings } from '../lib/useSettings'
import { CATEGORIES, currencySymbol } from '../lib/storeConfig'
import type { ProductSummary } from '../lib/types'
import IconButton from './ui/IconButton'
import Badge from './ui/Badge'
import Sheet from './ui/Sheet'
import AnnouncementBar from './AnnouncementBar'

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

interface ProductsResponse {
  products: ProductSummary[]
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="1" y1="1" x2="11" y2="11" />
      <line x1="11" y1="1" x2="1" y2="11" />
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

/** ESPOD is an acronym — always rendered upper-case with tight tracking, regardless of what an admin types into `store_name`. Never title-cased. */
function Wordmark({ storeName, className = '' }: { storeName: string; className?: string }) {
  return (
    <Link
      to="/"
      className={`shrink-0 truncate font-display font-bold uppercase tracking-tight text-ink ${className}`}
    >
      {storeName}
    </Link>
  )
}

function CartButton({
  cartCount,
  onCartOpen,
}: {
  cartCount: number
  onCartOpen: () => void
}) {
  return (
    <div className="relative">
      <IconButton variant="ghost" aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`} onClick={onCartOpen}>
        <CartIcon />
      </IconButton>
      <CartCountBadge count={cartCount} />
    </div>
  )
}

/**
 * Live-filtered product search, shared by the desktop overlay and the
 * mobile Sheet. There is no search API endpoint — `worker/src/routes/
 * products.ts` only supports pagination + an exact category match, no
 * free-text query — so this fetches the product list once (lazily, only
 * once the panel is opened) and filters it client-side in memory. That's
 * a documented limitation for a visual round, not a stand-in for a real
 * feature: see POD-UI2.md §3/E3.
 */
function SearchPanel({
  query,
  onQueryChange,
  products,
  isLoading,
  currency,
  onNavigate,
  inputRef,
}: {
  query: string
  onQueryChange: (v: string) => void
  products: ProductSummary[]
  isLoading: boolean
  currency: string
  onNavigate: () => void
  inputRef: React.RefObject<HTMLInputElement>
}) {
  const trimmed = query.trim().toLowerCase()
  const results = trimmed ? products.filter((p) => p.name.toLowerCase().includes(trimmed)) : []

  return (
    <div>
      <div className="flex items-center gap-2 rounded-btn border border-line bg-paper px-3.5">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search products…"
          className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto sm:max-h-80">
        {!trimmed && <p className="px-1 py-6 text-center text-sm text-ink-soft">Start typing to search the catalog.</p>}
        {trimmed && isLoading && <p className="px-1 py-6 text-center text-sm text-ink-soft">Loading products…</p>}
        {trimmed && !isLoading && results.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-ink-soft">No products match &ldquo;{query}&rdquo;.</p>
        )}
        {results.length > 0 && (
          <ul className="flex flex-col gap-1">
            {results.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/product/${p.id}`}
                  onClick={onNavigate}
                  className="flex items-center gap-3 rounded-btn p-2 transition-colors duration-fast hover:bg-surface-2"
                >
                  <span className="h-12 w-12 shrink-0 overflow-hidden rounded-btn bg-surface-2 ring-1 ring-line">
                    {p.front_image && (
                      // eslint-disable-next-line jsx-a11y/alt-text -- decorative, name is the adjacent text
                      <img src={p.front_image} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                    <span className="block text-xs text-ink-soft">
                      {currency}
                      {p.base_price}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const token = useAuthStore((s) => s.token)
  const { currency: storeCurrency } = useSettings()
  const currency = currencySymbol(storeCurrency)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [condensed, setCondensed] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Tracks the `sm` breakpoint (640px, matching Tailwind) so the search UI
  // renders as exactly one dialog at a time — the desktop overlay OR the
  // mobile Sheet, never both mounted-and-open together (which would fight
  // over Escape/focus-trap and register as two modals to a screen reader).
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const handler = () => setIsDesktopViewport(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Lazy — only fetched once the search UI is actually opened, and cached
  // under its own key so it doesn't collide with other pages' `/api/products`
  // queries (different limit/pagination).
  const { data: searchData, isLoading: searchLoading } = useQuery<ProductsResponse>({
    queryKey: ['products', 'header-search'],
    queryFn: () => fetchJson<ProductsResponse>('/api/products?page=1&limit=100'),
    enabled: searchOpen,
    staleTime: 5 * 60 * 1000,
  })
  const searchProducts = searchData?.products ?? []

  function openSearch() {
    setSearchOpen(true)
    // Autofocus once the panel/sheet has mounted.
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }
  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
  }

  useEffect(() => {
    if (!searchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])

  const categoryLinks: NavItem[] = CATEGORIES.map((c) => ({
    label: c.label,
    href: `/shop?category=${encodeURIComponent(c.slug)}`,
  }))
  const combinedNav = [...navItems, ...categoryLinks]

  return (
    <>
      <AnnouncementBar />

      <header
        className={`sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm transition-[height] duration-base ease-out-soft ${
          condensed ? 'h-14' : 'h-16'
        }`}
      >
        {/* Mobile row — hamburger + wordmark left, search + cart right.
            True 3-zone centering (desktop) doesn't apply here; this is a
            simple 2-group flex row instead. */}
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-4 sm:hidden">
          <div className="flex min-w-0 items-center gap-0.5">
            {combinedNav.length > 0 && (
              <IconButton variant="ghost" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Wordmark storeName={storeName} className="text-base" />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton variant="ghost" aria-label="Search products" onClick={openSearch}>
              <SearchIcon />
            </IconButton>
            <CartButton cartCount={cartCount} onCartOpen={onCartOpen} />
          </div>
        </div>

        {/* Desktop row — left category nav / centred wordmark / right actions,
            via a 3-column grid so the wordmark is centred on the header
            itself rather than merely between two unequal-width groups. */}
        <div className="mx-auto hidden h-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-8 sm:grid">
          <nav className="flex min-w-0 items-center gap-6 justify-self-start">
            {combinedNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="whitespace-nowrap text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Wordmark storeName={storeName} className="justify-self-center text-lg" />

          <div className="flex items-center justify-end gap-1 justify-self-end">
            <IconButton variant="ghost" aria-label="Search products" onClick={openSearch}>
              <SearchIcon />
            </IconButton>
            <Link
              to={token ? '/account/orders' : '/account/login'}
              className="inline-flex h-11 items-center gap-1.5 px-2 text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink"
            >
              <AccountIcon />
              {token ? 'Account' : 'Login'}
            </Link>
            <CartButton cartCount={cartCount} onCartOpen={onCartOpen} />
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
            <Wordmark storeName={storeName} className="text-base" />
            <IconButton variant="ghost" size="sm" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
              <CloseIcon />
            </IconButton>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            <p className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Shop</p>
            {combinedNav.map((item) => (
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

      {/* Search — desktop overlay (command-palette style, centred near the
          top so it doesn't need exact header-height math for condensed vs
          full state) OR mobile Sheet — exactly one mounted-and-open at a
          time, gated on the tracked viewport rather than CSS visibility. */}
      {searchOpen && isDesktopViewport && (
        <div className="fixed inset-0 z-[70]">
          <div onClick={closeSearch} className="absolute inset-0 animate-fade-in bg-ink/40" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="absolute inset-x-0 top-24 mx-auto w-full max-w-xl animate-scale-in rounded-card bg-surface p-5 shadow-lift"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Search</h2>
              <IconButton variant="ghost" size="sm" aria-label="Close search" onClick={closeSearch}>
                <CloseIcon />
              </IconButton>
            </div>
            <SearchPanel
              query={searchQuery}
              onQueryChange={setSearchQuery}
              products={searchProducts}
              isLoading={searchLoading}
              currency={currency}
              onNavigate={closeSearch}
              inputRef={searchInputRef}
            />
          </div>
        </div>
      )}

      <Sheet open={searchOpen && !isDesktopViewport} onClose={closeSearch} title="Search" initialSnap="full" fullHeight="90vh">
        <SearchPanel
          query={searchQuery}
          onQueryChange={setSearchQuery}
          products={searchProducts}
          isLoading={searchLoading}
          currency={currency}
          onNavigate={closeSearch}
          inputRef={searchInputRef}
        />
      </Sheet>
    </>
  )
}
