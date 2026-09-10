import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { fetchJson } from '../lib/api'
import { useSettings } from '../lib/useSettings'
import { currencySymbol } from '../lib/storeConfig'
import type { ProductSummary } from '../lib/types'
import type { StorefrontCategory } from './home/ShopByCategory'
import Icon from './ui/Icon'
import IconButton from './ui/IconButton'
import Badge from './ui/Badge'
import Sheet from './ui/Sheet'
import Skeleton from './ui/Skeleton'
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

interface CategoriesResponse {
  categories: StorefrontCategory[]
}

const SEARCH_DEBOUNCE_MS = 250
const SEARCH_RESULT_LIMIT = 6

/** Delays reflecting a fast-changing value by `delayMs` — used to turn every
 * keystroke in the search field into one `?q=` request every 250ms instead
 * of one per keystroke (POD-UI4.md §4/A.4). */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
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
        <Icon name="shopping_cart" size={22} />
      </IconButton>
      <CartCountBadge count={cartCount} />
    </div>
  )
}

/**
 * Search results — shared by the desktop row-2 dropdown and the mobile
 * Sheet (POD-UI4.md §4/A.4). Four explicit states, never a bare spinner:
 * an untouched field shows a quiet prompt (no request has even been made,
 * since the query below is `enabled` only once there's text), a query
 * mid-debounce or in flight shows shimmer rows, a settled query with no
 * hits says so by name, and a hit list reuses the same thumb/name/price
 * row POD-UI2's client-side filter used. "See all results" only appears
 * once we know there's something to see — for the true empty case it
 * would just relink to the same "nothing matched" outcome on /shop.
 */
function SearchResultsList({
  trimmedQuery,
  pending,
  results,
  currency,
  onNavigate,
}: {
  trimmedQuery: string
  pending: boolean
  results: ProductSummary[]
  currency: string
  onNavigate: () => void
}) {
  if (!trimmedQuery) {
    return <p className="px-1 py-6 text-center text-sm text-ink-soft">Start typing to search the catalog.</p>
  }

  if (pending) {
    return (
      <ul className="flex flex-col gap-1 p-1">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 p-2">
            <Skeleton shape="rect" width={48} height={48} className="rounded-btn" />
            <span className="flex-1">
              <Skeleton shape="text" width="70%" />
              <Skeleton shape="text" width="35%" className="mt-1.5" />
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (results.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-ink-soft">No products match &ldquo;{trimmedQuery}&rdquo;.</p>
  }

  return (
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
      <li>
        <Link
          to={`/shop?q=${encodeURIComponent(trimmedQuery)}`}
          onClick={onNavigate}
          className="block rounded-btn px-2 py-2.5 text-center font-label text-label-md text-accent transition-colors duration-fast hover:bg-surface-2"
        >
          See all results for &ldquo;{trimmedQuery}&rdquo;
        </Link>
      </li>
    </ul>
  )
}

const CATEGORY_GRID_COLS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
}

/** 2-4 columns depending on how many categories there are to lay out — more categories, more columns, capped at 4 (the comp's widest menu). */
function categoryColumnCount(count: number): 2 | 3 | 4 {
  if (count <= 6) return 2
  if (count <= 12) return 3
  return 4
}

/**
 * Desktop mega-menu (POD-UI4.md §3.1 C3 / §5 A.3) — replaces the old
 * 256px single-column "Categories" dropdown with a wide multi-column
 * panel carrying each category's thumbnail and product count, matching
 * the comp's hover mega-menus.
 *
 * IMPORTANT: `GET /api/categories` returns a FLAT list — one row per
 * distinct `products.category` value, no parent/child relationship. The
 * grid below is purely a *layout* device that chunks that flat list into
 * 2-4 columns by count (`categoryColumnCount`); it is NOT rendering a
 * category tree, and the columns don't correspond to groups of anything.
 * A real subcategory hierarchy is schema work, deferred per §3.1/§3.5.
 *
 * Opens on hover (matching the comp's `group-hover`) *and* on click/Enter
 * for keyboard and touch, where hover events don't fire. The close-on-
 * mouseleave is delayed slightly rather than immediate: the panel sits
 * `mt-2` below the trigger, so a mouse travelling diagonally into the
 * panel crosses a sliver of unrelated page between the two for a few
 * milliseconds — closing on that instant would make the menu unusable by
 * mouse. Re-entering the trigger or the panel within the delay cancels
 * the pending close.
 *
 * Autofocusing the first item on open is gated on the trigger already
 * being focused — otherwise a hover-open (which never touches focus)
 * would yank keyboard focus into the menu the instant a mouse passed
 * over the trigger, which is not what hovering does anywhere else.
 *
 * Every other accessibility behaviour carries over unchanged:
 * `aria-haspopup`/`aria-expanded` on the trigger, `role="menu"`/
 * `"menuitem"` on the panel/items, Escape closes and restores focus to
 * the trigger, Up/Down arrows move between items with wraparound, and an
 * outside `pointerdown` closes it. Renders nothing at all — never an
 * empty panel shell — when there are no categories.
 */
function CategoriesMenu({ categories }: { categories: StorefrontCategory[] }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const closeTimeoutRef = useRef<number | undefined>(undefined)

  const clearPendingClose = () => {
    if (closeTimeoutRef.current !== undefined) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = undefined
    }
  }

  useEffect(() => () => clearPendingClose(), [])

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const items = itemRefs.current.filter((el): el is HTMLAnchorElement => el !== null)
      if (items.length === 0) return
      const activeIndex = items.findIndex((el) => el === document.activeElement)
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const nextIndex = activeIndex === -1 ? 0 : (activeIndex + delta + items.length) % items.length
      items[nextIndex]?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open && document.activeElement === triggerRef.current) {
      requestAnimationFrame(() => itemRefs.current[0]?.focus())
    }
  }, [open])

  if (categories.length === 0) return null

  const columns = categoryColumnCount(categories.length)
  const rows = Math.ceil(categories.length / columns)

  function handleMouseEnter() {
    clearPendingClose()
    setOpen(true)
  }
  function handleMouseLeave() {
    clearPendingClose()
    closeTimeoutRef.current = window.setTimeout(() => setOpen(false), 150)
  }

  return (
    <div ref={containerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-1 whitespace-nowrap font-label text-label-md text-ink-soft transition-colors duration-fast hover:text-ink"
      >
        Categories
        <Icon name="expand_more" size={18} className={`transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Categories"
          className="animate-fade-in absolute left-1/2 top-full z-50 mt-2 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-card border border-line bg-surface p-6 shadow-lift"
        >
          <div
            className={`grid gap-x-8 gap-y-1 ${CATEGORY_GRID_COLS[columns]}`}
            style={{ gridAutoFlow: 'column', gridTemplateRows: `repeat(${rows}, minmax(0, auto))` }}
          >
            {categories.map((cat, i) => (
              <Link
                key={cat.name}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                role="menuitem"
                to={`/shop?category=${encodeURIComponent(cat.name)}`}
                onClick={() => setOpen(false)}
                className="flex min-h-11 w-48 items-center gap-3 rounded-btn px-3 py-2 text-ink transition-colors duration-fast hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-btn bg-surface-2 ring-1 ring-line">
                  {cat.image ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- decorative, name is the adjacent text
                    <img src={cat.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="image" size={20} className="text-ink-faint" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-label text-label-md">{cat.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {cat.count} {cat.count === 1 ? 'item' : 'items'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const { currency: storeCurrency } = useSettings()
  const currency = currencySymbol(storeCurrency)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Shared by the desktop row-2 field and the mobile Sheet's field — only
  // one of the two is ever visible/reachable at a given viewport (the
  // other is `sm:hidden`/`hidden sm:flex`), so one query and one piece of
  // state avoids firing the request twice and keeps a query typed on one
  // surface visible if the viewport changes mid-search.
  const [searchQuery, setSearchQuery] = useState('')
  const trimmedQuery = searchQuery.trim()
  const debouncedQuery = useDebouncedValue(trimmedQuery, SEARCH_DEBOUNCE_MS)

  // POD-UI2.md §3/E3 documented the old client-side-filter-100-rows
  // stopgap; `?q=` is the real endpoint now (POD-UI4.md §3.1 C2 / §4.1).
  // `enabled` gates the request on the *debounced* value, and it's also
  // the query key, so a request never fires per keystroke and React
  // Query naturally dedupes/caches per distinct search term.
  const { data: searchData, isFetching: searchFetching } = useQuery<ProductsResponse>({
    queryKey: ['products', 'header-search', debouncedQuery],
    queryFn: () =>
      fetchJson<ProductsResponse>(`/api/products?page=1&limit=${SEARCH_RESULT_LIMIT}&q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length > 0,
    staleTime: 30 * 1000,
  })
  const searchResults = searchData?.products ?? []
  // "Pending" covers both legs of the wait: still inside the 250ms debounce
  // window (trimmedQuery hasn't caught up to debouncedQuery yet) and the
  // request itself in flight — so the shimmer never has a gap where it's
  // neither loading nor showing a result.
  const searchPending = trimmedQuery.length > 0 && (trimmedQuery !== debouncedQuery || searchFetching)

  const [desktopResultsOpen, setDesktopResultsOpen] = useState(false)
  const desktopSearchContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!desktopResultsOpen) return
    function onPointerDown(e: PointerEvent) {
      if (desktopSearchContainerRef.current && !desktopSearchContainerRef.current.contains(e.target as Node)) {
        setDesktopResultsOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDesktopResultsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [desktopResultsOpen])

  function navigateToFullResults(q: string) {
    const query = q.trim()
    if (!query) return
    navigate(`/shop?q=${encodeURIComponent(query)}`)
  }

  function handleDesktopSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    setDesktopResultsOpen(false)
    navigateToFullResults(searchQuery)
  }

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  function openMobileSearch() {
    setMobileSearchOpen(true)
  }
  function closeMobileSearch() {
    setMobileSearchOpen(false)
    setSearchQuery('')
  }
  function handleMobileSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const query = searchQuery.trim()
    closeMobileSearch()
    if (query) navigateToFullResults(query)
  }

  // POD-UI2.md §7.1 — one "Categories" menu, backend-driven, instead of a
  // hand-maintained per-category nav link list. 5-minute staleTime matches
  // useSettings — categories change about as rarely as store settings do.
  const { data: categoriesData } = useQuery<CategoriesResponse>({
    queryKey: ['categories'],
    queryFn: () => fetchJson<CategoriesResponse>('/api/categories'),
    staleTime: 5 * 60 * 1000,
  })
  const categories = categoriesData?.categories ?? []

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
        {/* Mobile — single row, unchanged from before the two-row split
            (POD-UI4.md §5 A.2): hamburger + wordmark left, search icon +
            cart right. True 3-zone centering doesn't apply here; this is a
            simple 2-group flex row. */}
        <div
          className={`mx-auto flex items-center justify-between gap-2 px-4 transition-[height] duration-base ease-out-soft sm:hidden ${
            condensed ? 'h-14' : 'h-16'
          }`}
        >
          <div className="flex min-w-0 items-center gap-0.5">
            {(navItems.length > 0 || categories.length > 0) && (
              <IconButton variant="ghost" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
                <Icon name="menu" size={22} />
              </IconButton>
            )}
            <Wordmark storeName={storeName} className="text-base" />
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton variant="ghost" aria-label="Search products" onClick={openMobileSearch}>
              <Icon name="search" size={22} />
            </IconButton>
            <CartButton cartCount={cartCount} onCartOpen={onCartOpen} />
          </div>
        </div>

        {/* Desktop — two rows (POD-UI4.md §3.1 C1 / §5 A.2): row 1 is
            wordmark / mega-menu nav / account+cart, matching the comp's
            three-zone flex layout exactly (brand fixed-width left, nav
            centred in the remaining space, actions fixed-width right —
            no CSS-grid centering trick needed since, unlike the old
            single-row layout, the wordmark no longer has to be optically
            centred on the whole bar). Row 2 is the "persistent" pill
            search field the comp names it — persistent means it does NOT
            collapse away on scroll, so condensing only tightens the
            vertical padding on both rows instead of hiding row 2 the way
            the old single-row header shrank its one fixed height. */}
        <div className="mx-auto hidden max-w-7xl flex-col px-4 sm:flex md:px-10">
          <div
            className={`flex items-center gap-6 transition-[padding] duration-base ease-out-soft ${
              condensed ? 'py-2' : 'py-3'
            }`}
          >
            <Wordmark storeName={storeName} className="shrink-0 text-lg" />

            <nav className="flex min-w-0 flex-1 items-center justify-center gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="flex min-h-11 items-center whitespace-nowrap font-label text-label-md text-ink-soft transition-colors duration-fast hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
              <CategoriesMenu categories={categories} />
            </nav>

            <div className="flex shrink-0 items-center justify-end gap-1">
              <IconButton
                variant="ghost"
                aria-label={token ? 'My account' : 'Log in'}
                onClick={() => navigate(token ? '/account/orders' : '/account/login')}
              >
                <Icon name="person" size={22} />
              </IconButton>
              <CartButton cartCount={cartCount} onCartOpen={onCartOpen} />
            </div>
          </div>

          <div
            ref={desktopSearchContainerRef}
            className={`relative transition-[padding] duration-base ease-out-soft ${condensed ? 'pb-2' : 'pb-3'}`}
          >
            <Icon
              name="search"
              size={20}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              type="search"
              aria-label="Search products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setDesktopResultsOpen(true)}
              onKeyDown={handleDesktopSearchKeyDown}
              placeholder="Search products…"
              className="h-11 w-full rounded-pill border border-line bg-surface-2 pl-11 pr-4 text-sm text-ink placeholder:text-ink-faint transition-colors duration-fast focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {desktopResultsOpen && (
              <div className="animate-fade-in absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-card border border-line bg-surface p-2 shadow-lift">
                <SearchResultsList
                  trimmedQuery={trimmedQuery}
                  pending={searchPending}
                  results={searchResults}
                  currency={currency}
                  onNavigate={() => setDesktopResultsOpen(false)}
                />
              </div>
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
            <Wordmark storeName={storeName} className="text-base" />
            <IconButton variant="ghost" size="sm" aria-label="Close menu" onClick={() => setMobileOpen(false)}>
              <Icon name="close" size={18} />
            </IconButton>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            <p className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Shop</p>
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="flex min-h-11 items-center px-5 py-3 font-label text-label-md text-ink transition-colors duration-fast hover:bg-surface-2"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            {categories.length > 0 && (
              <>
                <p className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Categories</p>
                {categories.map((cat) => (
                  <Link
                    key={cat.name}
                    to={`/shop?category=${encodeURIComponent(cat.name)}`}
                    className="flex min-h-11 items-center justify-between px-5 py-3 font-label text-label-md text-ink transition-colors duration-fast hover:bg-surface-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span>{cat.name}</span>
                    <span className="text-xs text-ink-faint">{cat.count}</span>
                  </Link>
                ))}
              </>
            )}
            <div className="mx-5 my-2 border-t border-line" />
            <Link
              to={token ? '/account/orders' : '/account/login'}
              className="flex min-h-11 items-center px-5 py-3 font-label text-label-md text-ink transition-colors duration-fast hover:bg-surface-2"
              onClick={() => setMobileOpen(false)}
            >
              {token ? 'My Account' : 'Login'}
            </Link>
            <button
              className="flex min-h-11 w-full items-center px-5 py-3 text-left font-label text-label-md text-ink transition-colors duration-fast hover:bg-surface-2"
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

      {/* Mobile search — bottom Sheet (POD-UI4.md §5 A.2/A.4), the desktop
          row-2 field's counterpart on small viewports. Same debounced
          `?q=` query and result list as the desktop dropdown, just a
          different chrome around it. */}
      <Sheet open={mobileSearchOpen} onClose={closeMobileSearch} title="Search" initialSnap="full" fullHeight="90vh">
        <div className="flex items-center gap-2 rounded-btn border border-line bg-surface-2 px-3.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <Icon name="search" size={20} className="text-ink-faint" />
          <input
            type="search"
            aria-label="Search products"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleMobileSearchKeyDown}
            placeholder="Search products…"
            className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <div className="mt-3 max-h-[60vh] overflow-y-auto sm:max-h-80">
          <SearchResultsList
            trimmedQuery={trimmedQuery}
            pending={searchPending}
            results={searchResults}
            currency={currency}
            onNavigate={closeMobileSearch}
          />
        </div>
      </Sheet>
    </>
  )
}
