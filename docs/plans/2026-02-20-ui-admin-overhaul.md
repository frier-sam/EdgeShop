# UI & Admin Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the admin panel UI (grouped sidebar, Appearance page, nested navigation, footer editor) and polish both storefront themes to production quality.

**Architecture:** Two parallel subagents with non-overlapping file ownership. Agent 1 owns admin files + theme Header/Footer. Agent 2 owns theme Hero/ProductCard/ProductGrid/CartDrawer + ProductPage. Types changed by Agent 1 are backward-compatible so Agent 2 is unblocked.

**Tech Stack:** React 18 + Vite, Tailwind CSS v4, React Router v6, TanStack Query v5, TypeScript, Cloudflare D1 (settings key-value store)

---

## AGENT 1: Admin Panel Overhaul

### Files owned by Agent 1
- `frontend/src/themes/types.ts` — extend NavItem, add FooterData, update FooterProps
- `frontend/src/themes/ThemeProvider.tsx` — add footerData parsing + context
- `frontend/src/admin/AdminLayout.tsx` — grouped collapsible sidebar + mobile drawer
- `frontend/src/admin/pages/AdminSettings.tsx` — remove theme selector section
- `frontend/src/admin/pages/AdminNavigation.tsx` — nested nav + type dialog
- `frontend/src/admin/pages/AdminAppearance.tsx` — NEW: theme selector + customizer
- `frontend/src/admin/pages/AdminFooter.tsx` — NEW: footer CMS editor
- `frontend/src/App.tsx` — add /admin/appearance and /admin/footer routes
- `frontend/src/themes/jewellery/Header.tsx` — mobile menu + children dropdown
- `frontend/src/themes/jewellery/Footer.tsx` — multi-column + footerData prop
- `frontend/src/themes/artsCrafts/Header.tsx` — mobile menu + children dropdown
- `frontend/src/themes/artsCrafts/Footer.tsx` — multi-column + footerData prop

---

### Task 1: Extend types.ts — NavItem children + FooterData

**File:** `frontend/src/themes/types.ts`

Replace the entire file with:

```typescript
import type { ComponentType } from 'react'

export interface ProductCardProps {
  id: number
  name: string
  price: number
  image_url: string
  currency: string
  onAddToCart: () => void
}

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface FooterData {
  tagline?: string
  columns?: FooterColumn[]
  socials?: {
    instagram?: string
    facebook?: string
    whatsapp?: string
  }
  copyright?: string
}

export interface NavItem {
  label: string
  href: string
  type?: 'link' | 'collection' | 'page'
  children?: NavItem[]
}

export interface HeaderProps {
  storeName: string
  cartCount: number
  onCartOpen: () => void
  navItems: NavItem[]
}

export interface FooterProps {
  storeName: string
  footerData?: FooterData
}

export interface HeroProps {
  storeName: string
  tagline: string
}

export interface ProductGridProps {
  products: Array<{
    id: number
    name: string
    price: number
    image_url: string
    category: string
  }>
  currency: string
  onAddToCart: (productId: number) => void
}

export interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}

export interface CartDrawerProps {
  isOpen: boolean
  items: CartItem[]
  currency: string
  onClose: () => void
  onUpdateQuantity: (productId: number, quantity: number) => void
  onCheckout: () => void
}

export interface ThemeOverrides {
  '--color-primary'?: string
  '--color-accent'?: string
  '--color-bg'?: string
  '--color-text'?: string
  '--font-heading'?: string
  '--font-body'?: string
  '--logo-url'?: string
  '--tagline'?: string
  '--hero-image'?: string
}

export interface Theme {
  id: string
  name: string
  description: string
  defaultCssVars: ThemeOverrides
  components: {
    Header: ComponentType<HeaderProps>
    Footer: ComponentType<FooterProps>
    Hero: ComponentType<HeroProps>
    ProductCard: ComponentType<ProductCardProps>
    ProductGrid: ComponentType<ProductGridProps>
    CartDrawer: ComponentType<CartDrawerProps>
  }
}
```

**Step 1:** Replace `frontend/src/themes/types.ts` with the code above.

**Step 2:** Verify TypeScript compiles — run:
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -40
```
Expected: errors only about Footer components not yet accepting footerData (fix in Task 4/5).

**Step 3:** Commit:
```bash
git add frontend/src/themes/types.ts
git commit -m "feat: extend NavItem with children, add FooterData types"
```

---

### Task 2: Update ThemeProvider — add footerData to context

**File:** `frontend/src/themes/ThemeProvider.tsx`

Replace the entire file:

```typescript
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import AnnouncementBar from '../components/AnnouncementBar'
import { useQuery } from '@tanstack/react-query'
import type { Theme, ThemeOverrides, NavItem, FooterData } from './types'
import { themes } from './index'

interface ThemeContextValue {
  theme: Theme | null
  isLoading: boolean
  activeThemeId: string
  navItems: NavItem[]
  footerData: FooterData
  settings: Record<string, string>
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  isLoading: true,
  activeThemeId: 'jewellery',
  navItems: [],
  footerData: {},
  settings: {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: (): Promise<Record<string, string>> =>
      fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const activeThemeId = settings.active_theme ?? 'jewellery'
  const theme = themes[activeThemeId] ?? null

  const navItems = useMemo<NavItem[]>(() => {
    if (!settings.navigation_json) return []
    try { return JSON.parse(settings.navigation_json) as NavItem[] }
    catch { return [] }
  }, [settings.navigation_json])

  const footerData = useMemo<FooterData>(() => {
    if (!settings.footer_json) return {}
    try { return JSON.parse(settings.footer_json) as FooterData }
    catch { return {} }
  }, [settings.footer_json])

  useEffect(() => {
    if (!theme) return
    let overrides: ThemeOverrides = {}
    if (settings.theme_overrides_json) {
      try {
        const allOverrides = JSON.parse(settings.theme_overrides_json)
        overrides = allOverrides[activeThemeId] ?? {}
      } catch { /* ignore */ }
    }
    const merged = { ...theme.defaultCssVars, ...overrides }
    const root = document.documentElement
    for (const [prop, value] of Object.entries(merged)) {
      if (value) root.style.setProperty(prop, value)
    }
  }, [theme, settings, activeThemeId])

  const announcementEnabled = settings.announcement_bar_enabled === 'true'
  const announcementText = settings.announcement_bar_text ?? ''
  const announcementColor = settings.announcement_bar_color ?? '#1A1A1A'

  return (
    <ThemeContext.Provider value={{ theme, isLoading, activeThemeId, navItems, footerData, settings }}>
      {announcementEnabled && announcementText && (
        <AnnouncementBar text={announcementText} color={announcementColor} />
      )}
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

**Step 1:** Replace `frontend/src/themes/ThemeProvider.tsx` with the code above.

**Step 2:** Check `frontend/src/pages/HomePage.tsx` — find where Footer is rendered and ensure footerData is passed (it comes through ThemeProvider context). Search for Footer usage:
```bash
grep -n "Footer\|footerData" /Users/sam/Documents/per/edgeshop/frontend/src/pages/HomePage.tsx
```

**Step 3:** Commit:
```bash
git add frontend/src/themes/ThemeProvider.tsx
git commit -m "feat: add footerData to ThemeProvider context"
```

---

### Task 3: Update HomePage.tsx — pass footerData to Footer

**File:** `frontend/src/pages/HomePage.tsx`

Read the file first, then find where `theme.components.Footer` is rendered. It currently passes `storeName` only. Add `footerData` from context.

Find the Footer render call and update it to:
```tsx
<theme.components.Footer storeName={settings.store_name ?? ''} footerData={footerData} />
```

Where `footerData` comes from `const { theme, navItems, footerData, settings } = useTheme()`.

**Step 1:** Read the file:
```bash
cat /Users/sam/Documents/per/edgeshop/frontend/src/pages/HomePage.tsx
```

**Step 2:** Add `footerData` to the destructured `useTheme()` call.

**Step 3:** Pass `footerData={footerData}` to the Footer render.

**Step 4:** Commit:
```bash
git add frontend/src/pages/HomePage.tsx
git commit -m "feat: pass footerData to Footer component"
```

---

### Task 4: Update Jewellery Footer — multi-column + footerData

**File:** `frontend/src/themes/jewellery/Footer.tsx`

Replace entirely:

```tsx
import { Link } from 'react-router-dom'
import type { FooterProps } from '../types'

export default function Footer({ storeName, footerData = {} }: FooterProps) {
  const { tagline, columns = [], socials, copyright } = footerData
  const hasColumns = columns.length > 0
  const hasSocials = socials && (socials.instagram || socials.facebook || socials.whatsapp)

  return (
    <footer className="border-t border-stone-200 mt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Top: brand + columns */}
        <div className={`grid gap-10 mb-10 ${hasColumns ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Brand column */}
          <div>
            <p
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-bg)' }}
              className="text-lg tracking-widest uppercase font-semibold mb-2"
            >
              {storeName}
            </p>
            <p className="text-xs tracking-wider" style={{ color: 'var(--color-accent)' }}>
              {tagline || 'Crafted with care'}
            </p>
          </div>
          {/* Link columns */}
          {columns.map((col, i) => (
            <div key={i}>
              <p
                className="text-xs tracking-widest uppercase font-semibold mb-4"
                style={{ color: 'var(--color-bg)', opacity: 0.6 }}
              >
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link, j) => (
                  <li key={j}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-xs tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-px mb-6" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.3 }} />

        {/* Bottom: socials + copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {hasSocials && (
            <div className="flex items-center gap-4">
              {socials?.instagram && (
                <a href={socials.instagram} target="_blank" rel="noopener noreferrer"
                  className="text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  Instagram
                </a>
              )}
              {socials?.facebook && (
                <a href={socials.facebook} target="_blank" rel="noopener noreferrer"
                  className="text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  Facebook
                </a>
              )}
              {socials?.whatsapp && (
                <a href={socials.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="text-xs tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  WhatsApp
                </a>
              )}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--color-bg)', opacity: 0.4 }}>
            {copyright || `© ${new Date().getFullYear()} ${storeName}`}
          </p>
        </div>
      </div>
    </footer>
  )
}
```

**Step 1:** Replace `frontend/src/themes/jewellery/Footer.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/jewellery/Footer.tsx
git commit -m "feat: jewellery footer - multi-column layout with footerData prop"
```

---

### Task 5: Update Arts & Crafts Footer — multi-column + footerData

**File:** `frontend/src/themes/artsCrafts/Footer.tsx`

Replace entirely:

```tsx
import { Link } from 'react-router-dom'
import type { FooterProps } from '../types'

export default function Footer({ storeName, footerData = {} }: FooterProps) {
  const { tagline, columns = [], socials, copyright } = footerData
  const hasColumns = columns.length > 0
  const hasSocials = socials && (socials.instagram || socials.facebook || socials.whatsapp)

  return (
    <footer className="mt-16" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Decorative top bar */}
        <div className="w-16 h-1 mb-10 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />

        {/* Top: brand + columns */}
        <div className={`grid gap-10 mb-10 ${hasColumns ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Brand column */}
          <div>
            <p className="text-lg font-bold tracking-wider uppercase mb-2" style={{ color: 'var(--color-bg)' }}>
              {storeName}
            </p>
            <p className="text-xs font-bold tracking-wider" style={{ color: 'var(--color-accent)' }}>
              {tagline || 'Handmade with love'}
            </p>
          </div>
          {/* Link columns */}
          {columns.map((col, i) => (
            <div key={i}>
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--color-bg)', opacity: 0.6 }}>
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link, j) => (
                  <li key={j}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-xs font-medium tracking-wider transition-opacity hover:opacity-70"
                        style={{ color: 'var(--color-bg)' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="w-full h-0.5 mb-6 rounded-full" style={{ backgroundColor: 'var(--color-accent)', opacity: 0.3 }} />

        {/* Bottom: socials + copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {hasSocials && (
            <div className="flex items-center gap-4">
              {socials?.instagram && (
                <a href={socials.instagram} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-bold tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  Instagram
                </a>
              )}
              {socials?.facebook && (
                <a href={socials.facebook} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-bold tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  Facebook
                </a>
              )}
              {socials?.whatsapp && (
                <a href={socials.whatsapp} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-bold tracking-wider transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-accent)' }}>
                  WhatsApp
                </a>
              )}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--color-bg)', opacity: 0.4 }}>
            {copyright || `© ${new Date().getFullYear()} ${storeName}`}
          </p>
        </div>
      </div>
    </footer>
  )
}
```

**Step 1:** Replace `frontend/src/themes/artsCrafts/Footer.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/artsCrafts/Footer.tsx
git commit -m "feat: artsCrafts footer - multi-column layout with footerData prop"
```

---

### Task 6: Update Jewellery Header — mobile menu + nav children dropdown

**File:** `frontend/src/themes/jewellery/Header.tsx`

Replace entirely:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  return (
    <>
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
                        className="absolute top-full left-0 mt-2 min-w-40 border border-stone-200 shadow-lg z-50"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        {item.children!.map(child => (
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

          {/* Right: cart + hamburger */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={onCartOpen}
              style={{ color: 'var(--color-primary)' }}
              className="text-sm tracking-wider uppercase transition-colors hover:opacity-70"
            >
              Bag
              {cartCount > 0 && (
                <span className="ml-1 font-semibold" style={{ color: 'var(--color-accent)' }}>({cartCount})</span>
              )}
            </button>
            {navItems.length > 0 && (
              <button
                className="sm:hidden flex flex-col gap-1.5 p-1"
                onClick={() => setMobileOpen(v => !v)}
                aria-label="Menu"
              >
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
                <span className="w-5 h-px block" style={{ backgroundColor: 'var(--color-primary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-stone-200" style={{ backgroundColor: 'var(--color-bg)' }}>
            {navItems.map(item => (
              <div key={item.href}>
                <Link
                  to={item.href}
                  className="block px-6 py-3 text-xs tracking-widest uppercase"
                  style={{ color: 'var(--color-primary)' }}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
                {item.children?.map(child => (
                  <Link
                    key={child.href}
                    to={child.href}
                    className="block px-10 py-2.5 text-xs tracking-widest uppercase opacity-70"
                    style={{ color: 'var(--color-primary)' }}
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
```

**Step 1:** Replace `frontend/src/themes/jewellery/Header.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/jewellery/Header.tsx
git commit -m "feat: jewellery header - mobile menu, nav dropdown for children"
```

---

### Task 7: Update Arts & Crafts Header — mobile menu + nav children dropdown

**File:** `frontend/src/themes/artsCrafts/Header.tsx`

Replace entirely:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen, navItems }: HeaderProps) {
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
                    {/* Dropdown */}
                    {hasChildren && openDropdown === item.href && (
                      <div
                        className="absolute top-full left-0 mt-2 min-w-40 rounded-lg border-2 border-amber-200 shadow-lg z-50"
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

          {/* Right: cart + hamburger */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={onCartOpen}
              style={{ color: 'var(--color-primary)' }}
              className="text-sm font-bold tracking-wider uppercase transition-colors hover:opacity-70"
            >
              Cart
              {cartCount > 0 && (
                <span className="ml-1 font-bold" style={{ color: 'var(--color-accent)' }}>({cartCount})</span>
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
```

**Step 1:** Replace `frontend/src/themes/artsCrafts/Header.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/artsCrafts/Header.tsx
git commit -m "feat: artsCrafts header - mobile menu, nav dropdown for children"
```

---

### Task 8: Rewrite AdminLayout.tsx — grouped collapsible sidebar + mobile drawer

**File:** `frontend/src/admin/AdminLayout.tsx`

Replace entirely:

```tsx
import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'

interface NavSection {
  title: string
  items: { to: string; label: string; icon: string }[]
}

const sections: NavSection[] = [
  {
    title: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: '📦' },
      { to: '/admin/collections', label: 'Collections', icon: '🗂️' },
      { to: '/admin/blog', label: 'Blog', icon: '✍️' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: '🛒' },
      { to: '/admin/discounts', label: 'Discounts', icon: '🏷️' },
      { to: '/admin/reviews', label: 'Reviews', icon: '⭐' },
      { to: '/admin/analytics', label: 'Analytics', icon: '📊' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/pages', label: 'Pages', icon: '📄' },
      { to: '/admin/navigation', label: 'Navigation', icon: '🔗' },
      { to: '/admin/footer', label: 'Footer', icon: '🦶' },
    ],
  },
  {
    title: 'Store',
    items: [
      { to: '/admin/appearance', label: 'Appearance', icon: '🎨' },
      { to: '/admin/shipping', label: 'Shipping', icon: '🚚' },
      { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
]

function SidebarSection({ section, defaultOpen = true }: { section: NavSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
      >
        {section.title}
        <span className={`transition-transform duration-200 text-gray-300 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-0.5 mt-0.5">
          {section.items.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-60 bg-white border-r border-gray-200 min-h-screen shrink-0">
        <div className="p-4 border-b border-gray-100">
          <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 block mb-1">← Storefront</Link>
          <p className="font-semibold text-gray-800 text-sm">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors mb-3 ${
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
          >
            <span className="text-base leading-none">🏠</span>
            Dashboard
          </NavLink>
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {sections.map(section => (
              <SidebarSection key={section.title} section={section} />
            ))}
          </div>
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-40">
        <div>
          <Link to="/" className="text-xs text-gray-400">← Storefront</Link>
          <p className="font-semibold text-gray-800 text-sm leading-none mt-0.5">Admin</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col gap-1.5 p-2 rounded hover:bg-gray-100"
          aria-label="Open menu"
        >
          <span className="w-5 h-px bg-gray-700 block" />
          <span className="w-5 h-px bg-gray-700 block" />
          <span className="w-5 h-px bg-gray-700 block" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer panel */}
      <div className={`md:hidden fixed left-0 top-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 flex flex-col shadow-xl ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <Link to="/" className="text-xs text-gray-400">← Storefront</Link>
            <p className="font-semibold text-gray-800 text-sm">Admin Panel</p>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl p-1">×</button>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors mb-3 ${
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`
            }
            onClick={() => setDrawerOpen(false)}
          >
            <span className="text-base leading-none">🏠</span>
            Dashboard
          </NavLink>
          <div className="border-t border-gray-100 pt-3 space-y-1">
            {sections.map(section => (
              <SidebarSection key={section.title} section={section} />
            ))}
          </div>
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  )
}
```

**Step 1:** Replace `frontend/src/admin/AdminLayout.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin sidebar - grouped collapsible sections + mobile drawer"
```

---

### Task 9: Create AdminAppearance.tsx — merged theme selector + customizer

**File:** `frontend/src/admin/pages/AdminAppearance.tsx` (NEW)

Create this file:

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { themes } from '../../themes'

export default function AdminAppearance() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const [activeTheme, setActiveTheme] = useState('jewellery')
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!settings) return
    setActiveTheme(settings.active_theme ?? 'jewellery')
    try {
      const parsed: Record<string, Record<string, string>> = settings.theme_overrides_json
        ? JSON.parse(settings.theme_overrides_json)
        : {}
      setOverrideForm(parsed[settings.active_theme ?? 'jewellery'] ?? {})
    } catch {
      setOverrideForm({})
    }
  }, [settings])

  // When active theme changes in the selector, load that theme's overrides
  function handleThemeChange(themeId: string) {
    setActiveTheme(themeId)
    try {
      const parsed: Record<string, Record<string, string>> = settings?.theme_overrides_json
        ? JSON.parse(settings.theme_overrides_json)
        : {}
      setOverrideForm(parsed[themeId] ?? {})
    } catch {
      setOverrideForm({})
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let existingOverrides: Record<string, Record<string, string>> = {}
      try {
        if (settings?.theme_overrides_json) existingOverrides = JSON.parse(settings.theme_overrides_json)
      } catch { /* ignore */ }
      const mergedOverrides = { ...existingOverrides, [activeTheme]: overrideForm }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_theme: activeTheme,
          theme_overrides_json: JSON.stringify(mergedOverrides),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  const theme = themes[activeTheme]
  const cssFields = [
    { key: '--color-accent', label: 'Accent Color', type: 'color' },
    { key: '--color-bg', label: 'Background Color', type: 'color' },
    { key: '--color-primary', label: 'Primary Color', type: 'color' },
    { key: '--color-text', label: 'Text Color', type: 'color' },
    { key: '--font-heading', label: 'Heading Font', type: 'text' },
    { key: '--font-body', label: 'Body Font', type: 'text' },
    { key: '--tagline', label: 'Tagline', type: 'text' },
    { key: '--logo-url', label: 'Logo URL', type: 'text' },
    { key: '--hero-image', label: 'Hero Image URL', type: 'text' },
  ] as const

  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Appearance</h1>

      {/* Theme selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-4">Storefront Theme</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(themes).map(t => (
            <label
              key={t.id}
              className={`cursor-pointer border-2 rounded-lg p-4 transition-colors ${
                activeTheme === t.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="active_theme"
                value={t.id}
                checked={activeTheme === t.id}
                onChange={() => handleThemeChange(t.id)}
                className="sr-only"
              />
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                {activeTheme === t.id && (
                  <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{t.description}</p>
              <div className="flex gap-1">
                {Object.entries(t.defaultCssVars)
                  .filter(([k]) => k.startsWith('--color'))
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: v ?? '#ccc' }}
                      title={k}
                    />
                  ))}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Customizer */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="font-medium text-gray-800">Customise: {theme?.name}</h2>
          <p className="text-xs text-gray-400 mt-1">Override colours and fonts for this theme. Leave blank to use defaults.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cssFields.map(({ key, label, type }) => {
            const defaultVal = theme?.defaultCssVars[key] ?? ''
            return (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  {type === 'color' && (
                    <input
                      type="color"
                      value={overrideForm[key] || defaultVal || '#000000'}
                      onChange={e => setOverrideForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    value={overrideForm[key] ?? ''}
                    onChange={e => setOverrideForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={defaultVal || label}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500 font-mono"
                  />
                  {overrideForm[key] !== undefined && (
                    <button
                      type="button"
                      onClick={() => setOverrideForm(f => { const n = { ...f }; delete n[key]; return n })}
                      className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                      title="Reset to default"
                    >
                      ↺
                    </button>
                  )}
                </div>
                {defaultVal && <p className="text-xs text-gray-300 mt-0.5 font-mono">default: {defaultVal}</p>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Appearance'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        {saveMutation.isError && <span className="text-sm text-red-500">Failed to save</span>}
      </div>
    </div>
  )
}
```

**Step 1:** Create the file `frontend/src/admin/pages/AdminAppearance.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/admin/pages/AdminAppearance.tsx
git commit -m "feat: AdminAppearance - merged theme selector + CSS variable customizer"
```

---

### Task 10: Create AdminFooter.tsx — footer CMS editor

**File:** `frontend/src/admin/pages/AdminFooter.tsx` (NEW)

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FooterData, FooterColumn } from '../../themes/types'

export default function AdminFooter() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const [form, setForm] = useState<FooterData>({
    tagline: '',
    columns: [],
    socials: { instagram: '', facebook: '', whatsapp: '' },
    copyright: '',
  })

  useEffect(() => {
    if (!settings?.footer_json) return
    try { setForm(JSON.parse(settings.footer_json)) } catch { /* ignore */ }
  }, [settings?.footer_json])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ footer_json: JSON.stringify(form) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function addColumn() {
    if ((form.columns?.length ?? 0) >= 3) return
    setForm(f => ({ ...f, columns: [...(f.columns ?? []), { title: '', links: [] }] }))
  }

  function removeColumn(i: number) {
    setForm(f => ({ ...f, columns: (f.columns ?? []).filter((_, idx) => idx !== i) }))
  }

  function updateColumn(i: number, patch: Partial<FooterColumn>) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      cols[i] = { ...cols[i], ...patch }
      return { ...f, columns: cols }
    })
  }

  function addLink(colIndex: number) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      cols[colIndex] = { ...cols[colIndex], links: [...cols[colIndex].links, { label: '', href: '' }] }
      return { ...f, columns: cols }
    })
  }

  function removeLink(colIndex: number, linkIndex: number) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      cols[colIndex] = { ...cols[colIndex], links: cols[colIndex].links.filter((_, i) => i !== linkIndex) }
      return { ...f, columns: cols }
    })
  }

  function updateLink(colIndex: number, linkIndex: number, patch: { label?: string; href?: string }) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      const links = [...cols[colIndex].links]
      links[linkIndex] = { ...links[linkIndex], ...patch }
      cols[colIndex] = { ...cols[colIndex], links }
      return { ...f, columns: cols }
    })
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Footer</h1>

      {/* Basic info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-medium text-gray-800">Basic Info</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tagline</label>
          <input
            value={form.tagline ?? ''}
            onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
            placeholder="Crafted with care"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Copyright Text</label>
          <input
            value={form.copyright ?? ''}
            onChange={e => setForm(f => ({ ...f, copyright: e.target.value }))}
            placeholder={`© ${new Date().getFullYear()} Your Store`}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>

      {/* Social links */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-medium text-gray-800">Social Links</h2>
        {(['instagram', 'facebook', 'whatsapp'] as const).map(platform => (
          <div key={platform}>
            <label className="block text-xs text-gray-500 mb-1 capitalize">{platform}</label>
            <input
              value={form.socials?.[platform] ?? ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, [platform]: e.target.value } }))}
              placeholder={`https://${platform}.com/yourpage`}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        ))}
      </div>

      {/* Link columns */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-800">Link Columns</h2>
          {(form.columns?.length ?? 0) < 3 && (
            <button
              onClick={addColumn}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              + Add Column
            </button>
          )}
        </div>
        {form.columns?.map((col, ci) => (
          <div key={ci} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <input
                value={col.title}
                onChange={e => updateColumn(ci, { title: e.target.value })}
                placeholder="Column Title (e.g. Shop)"
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm mr-2 focus:outline-none focus:border-gray-500"
              />
              <button onClick={() => removeColumn(ci)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </div>
            <div className="space-y-2 pl-2">
              {col.links.map((link, li) => (
                <div key={li} className="flex items-center gap-2">
                  <input
                    value={link.label}
                    onChange={e => updateLink(ci, li, { label: e.target.value })}
                    placeholder="Label"
                    className="w-28 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                  />
                  <input
                    value={link.href}
                    onChange={e => updateLink(ci, li, { href: e.target.value })}
                    placeholder="/pages/about"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                  />
                  <button onClick={() => removeLink(ci, li)} className="text-red-400 hover:text-red-600 text-xs shrink-0">×</button>
                </div>
              ))}
              <button
                onClick={() => addLink(ci)}
                className="text-xs text-gray-500 hover:text-gray-700 pl-0"
              >
                + Add link
              </button>
            </div>
          </div>
        ))}
        {(form.columns?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-400">No link columns yet. Add up to 3.</p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Footer'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        {saveMutation.isError && <span className="text-sm text-red-500">Failed to save</span>}
      </div>
    </div>
  )
}
```

**Step 1:** Create `frontend/src/admin/pages/AdminFooter.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/admin/pages/AdminFooter.tsx
git commit -m "feat: AdminFooter - footer CMS editor with columns, socials, copyright"
```

---

### Task 11: Update AdminSettings.tsx — remove theme selector

**File:** `frontend/src/admin/pages/AdminSettings.tsx`

Remove the `active_theme` from the form state and remove the entire theme selector `<div>` block (lines ~122–170). Also remove `import { themes }` since it's no longer needed here.

After the edit, the form should only have: Store Info, Razorpay, and Announcement Bar sections. The save button should no longer include `active_theme` in the mutation payload.

**Step 1:** Read the current file to confirm line numbers, then remove the theme selector section (the `<div className="bg-white rounded-lg border border-gray-200 p-5">` block with `<h2>Storefront Theme</h2>`).

**Step 2:** Remove `import { themes } from '../../themes'` from the top of the file.

**Step 3:** Remove `active_theme: 'jewellery'` from the initial form state.

**Step 4:** Remove `active_theme` from the Settings interface.

**Step 5:** Commit:
```bash
git add frontend/src/admin/pages/AdminSettings.tsx
git commit -m "feat: remove theme selector from Settings (moved to Appearance)"
```

---

### Task 12: Update AdminNavigation.tsx — nested items + type dialog

**File:** `frontend/src/admin/pages/AdminNavigation.tsx`

Replace entirely with a version that supports:
- Modal dialog for adding items (Collection / Page / Custom Link)
- Nested children (one level)
- Displays children indented below parent

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { NavItem } from '../../themes/types'

type AddTarget = { parentIndex: number | null }

export default function AdminNavigation() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const { data: collectionsData } = useQuery<{ collections: Array<{ id: number; name: string; slug: string }> }>({
    queryKey: ['collections'],
    queryFn: () => fetch('/api/collections').then(r => r.json()),
  })

  const { data: pagesData } = useQuery<Array<{ id: number; title: string; slug: string }>>({
    queryKey: ['admin-pages'],
    queryFn: () => fetch('/api/admin/pages').then(r => r.json()),
  })

  const [items, setItems] = useState<NavItem[]>([])
  const [modal, setModal] = useState<AddTarget | null>(null)
  const [itemType, setItemType] = useState<'link' | 'collection' | 'page'>('link')
  const [newLabel, setNewLabel] = useState('')
  const [newHref, setNewHref] = useState('')

  useEffect(() => {
    if (!settings?.navigation_json) return
    try { setItems(JSON.parse(settings.navigation_json)) } catch { setItems([]) }
  }, [settings?.navigation_json])

  const saveMutation = useMutation({
    mutationFn: async (newItems: NavItem[]) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigation_json: JSON.stringify(newItems) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  function save(newItems: NavItem[]) {
    setItems(newItems)
    saveMutation.mutate(newItems)
  }

  function openModal(parentIndex: number | null) {
    setModal({ parentIndex })
    setItemType('link')
    setNewLabel('')
    setNewHref('')
  }

  function handleTypeSelect(type: 'link' | 'collection' | 'page') {
    setItemType(type)
    setNewLabel('')
    setNewHref('')
  }

  function handleCollectionSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const col = collectionsData?.collections.find(c => c.slug === e.target.value)
    if (col) { setNewLabel(col.name); setNewHref(`/collections/${col.slug}`) }
  }

  function handlePageSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const page = pagesData?.find(p => p.slug === e.target.value)
    if (page) { setNewLabel(page.title); setNewHref(`/pages/${page.slug}`) }
  }

  function addItem() {
    const label = newLabel.trim()
    const href = newHref.trim()
    if (!label || !href) return
    const newItem: NavItem = { label, href, type: itemType }
    let updated: NavItem[]
    if (modal?.parentIndex !== null && modal?.parentIndex !== undefined) {
      updated = items.map((item, i) =>
        i === modal.parentIndex
          ? { ...item, children: [...(item.children ?? []), newItem] }
          : item
      )
    } else {
      updated = [...items, newItem]
    }
    save(updated)
    setModal(null)
  }

  function removeItem(index: number) {
    save(items.filter((_, i) => i !== index))
  }

  function removeChild(parentIndex: number, childIndex: number) {
    save(items.map((item, i) =>
      i === parentIndex
        ? { ...item, children: item.children?.filter((_, ci) => ci !== childIndex) }
        : item
    ))
  }

  function moveItem(index: number, dir: 'up' | 'down') {
    const updated = [...items]
    const target = dir === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= updated.length) return
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    save(updated)
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Navigation Menu</h1>
        <button
          onClick={() => openModal(null)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          + Add Item
        </button>
      </div>
      <p className="text-sm text-gray-500">Build your storefront navigation. Items can have one level of sub-items.</p>

      {/* Item list */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No nav items yet. Add your first item.</p>
        )}
        {items.map((item, i) => (
          <div key={i}>
            {/* Parent item */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 truncate">{item.href}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openModal(i)} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 border border-gray-200 rounded" title="Add sub-item">+ Sub</button>
                <button onClick={() => moveItem(i, 'up')} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
                <button onClick={() => moveItem(i, 'down')} disabled={i === items.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
                <button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600">×</button>
              </div>
            </div>
            {/* Children */}
            {item.children?.map((child, ci) => (
              <div key={ci} className="flex items-center gap-3 pl-8 pr-4 py-2 bg-gray-50 border-t border-gray-100">
                <div className="w-2 h-px bg-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{child.label}</p>
                  <p className="text-xs text-gray-400 truncate">{child.href}</p>
                </div>
                <button onClick={() => removeChild(i, ci)} className="p-1 text-red-400 hover:text-red-600 shrink-0">×</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {saveMutation.isError && <p className="text-red-600 text-sm">Failed to save. Please try again.</p>}
      {saveMutation.isSuccess && <p className="text-green-600 text-sm">Saved.</p>}

      {/* Add Item Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">
              {modal.parentIndex !== null ? `Add sub-item under "${items[modal.parentIndex]?.label}"` : 'Add Navigation Item'}
            </h2>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['collection', 'page', 'link'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleTypeSelect(t)}
                  className={`py-2 text-xs rounded-lg border-2 font-medium capitalize transition-colors ${
                    itemType === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {t === 'link' ? 'Custom Link' : t}
                </button>
              ))}
            </div>

            {/* Fields */}
            {itemType === 'collection' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Collection</label>
                <select onChange={handleCollectionSelect} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a collection…</option>
                  {collectionsData?.collections.map(c => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {itemType === 'page' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Page</label>
                <select onChange={handlePageSelect} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a page…</option>
                  {pagesData?.map(p => (
                    <option key={p.id} value={p.slug}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="About Us"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input
                value={newHref}
                onChange={e => setNewHref(e.target.value)}
                placeholder="/pages/about-us"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={addItem}
                disabled={!newLabel.trim() || !newHref.trim()}
                className="flex-1 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

Note: The `/api/admin/pages` route needs to be checked — if it doesn't exist or requires auth headers, use `/api/pages` instead. Read the worker routes to confirm.

**Step 1:** Replace `frontend/src/admin/pages/AdminNavigation.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/admin/pages/AdminNavigation.tsx
git commit -m "feat: navigation editor - nested items, type dialog for collection/page/link"
```

---

### Task 13: Update App.tsx — add new routes, redirect old /admin/theme

**File:** `frontend/src/App.tsx`

Add imports and routes:

```tsx
import AdminAppearance from './admin/pages/AdminAppearance'
import AdminFooter from './admin/pages/AdminFooter'
```

Add inside the `/admin` Route block:
```tsx
<Route path="appearance" element={<AdminAppearance />} />
<Route path="footer" element={<AdminFooter />} />
<Route path="theme" element={<Navigate to="/admin/appearance" replace />} />
```

Replace the existing `<Route path="theme" element={<AdminThemeCustomizer />} />` with the redirect. Remove the `AdminThemeCustomizer` import.

**Step 1:** Edit `frontend/src/App.tsx`.

**Step 2:** Verify TypeScript compiles:
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```

**Step 3:** Commit:
```bash
git add frontend/src/App.tsx
git commit -m "feat: add /admin/appearance and /admin/footer routes, redirect /admin/theme"
```

---

## AGENT 2: Theme Polish

### Files owned by Agent 2
- `frontend/src/themes/jewellery/Hero.tsx`
- `frontend/src/themes/jewellery/ProductCard.tsx`
- `frontend/src/themes/jewellery/ProductGrid.tsx`
- `frontend/src/themes/jewellery/CartDrawer.tsx`
- `frontend/src/themes/artsCrafts/Hero.tsx`
- `frontend/src/themes/artsCrafts/ProductCard.tsx`
- `frontend/src/themes/artsCrafts/ProductGrid.tsx`
- `frontend/src/themes/artsCrafts/CartDrawer.tsx`
- `frontend/src/pages/ProductPage.tsx`

**Important:** Agent 2 does NOT touch `types.ts`, `ThemeProvider.tsx`, `AdminLayout.tsx`, `Header.tsx` or `Footer.tsx` — those are owned by Agent 1.

---

### Task 14: Jewellery Hero — full-viewport with CTA

**File:** `frontend/src/themes/jewellery/Hero.tsx`

Replace entirely:

```tsx
import { Link } from 'react-router-dom'
import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  const heroImage = getComputedStyle(document.documentElement).getPropertyValue('--hero-image').trim()

  return (
    <section
      className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Background image */}
      {heroImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
      )}
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: `linear-gradient(135deg, var(--color-accent) 0%, transparent 60%)` }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        <p
          className="text-xs tracking-[0.4em] uppercase mb-6 font-light"
          style={{ color: 'var(--color-accent)' }}
        >
          {storeName}
        </p>
        <h2
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          className="text-4xl sm:text-6xl font-semibold mb-6 leading-tight"
        >
          {tagline}
        </h2>
        <div className="w-12 h-px mx-auto mb-8" style={{ backgroundColor: 'var(--color-accent)' }} />
        <Link
          to="/search"
          className="inline-block px-8 py-3 text-xs tracking-[0.2em] uppercase border transition-all duration-300 hover:opacity-80"
          style={{
            borderColor: 'var(--color-primary)',
            color: 'var(--color-bg)',
            backgroundColor: 'var(--color-primary)',
          }}
        >
          Shop Now
        </Link>
      </div>
    </section>
  )
}
```

**Note:** `getComputedStyle` is safe here because this component only renders client-side. If you see SSR issues, fall back to a CSS variable reference: use `style={{ backgroundImage: 'var(--hero-image, none)' }}` — but since this is a Vite SPA there are no SSR concerns.

**Step 1:** Replace `frontend/src/themes/jewellery/Hero.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/jewellery/Hero.tsx
git commit -m "feat: jewellery hero - full-viewport with gradient overlay + CTA"
```

---

### Task 15: Jewellery ProductCard — hover overlay Add to Bag

**File:** `frontend/src/themes/jewellery/ProductCard.tsx`

Replace entirely:

```tsx
import { Link } from 'react-router-dom'
import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, image_url, currency, onAddToCart }: ProductCardProps) {
  return (
    <div className="group cursor-pointer">
      {/* Image container */}
      <div className="relative aspect-square bg-stone-100 overflow-hidden mb-4">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 text-xs tracking-widest uppercase">
            No image
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={e => { e.preventDefault(); onAddToCart() }}
            className="px-6 py-2.5 text-xs tracking-[0.2em] uppercase transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-bg)',
            }}
          >
            Add to Bag
          </button>
        </div>
      </div>

      {/* Info */}
      <Link to={`/product/${id}`} className="block px-1">
        <h3
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
          className="text-sm mb-1 leading-snug group-hover:opacity-70 transition-opacity"
        >
          {name}
        </h3>
        <p className="text-xs tracking-widest" style={{ color: 'var(--color-accent)' }}>
          {currency}{price.toFixed(2)}
        </p>
      </Link>
    </div>
  )
}
```

**Step 1:** Replace `frontend/src/themes/jewellery/ProductCard.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/jewellery/ProductCard.tsx
git commit -m "feat: jewellery product card - hover overlay, image zoom, linked to product"
```

---

### Task 16: Jewellery ProductGrid — better layout

**File:** `frontend/src/themes/jewellery/ProductGrid.tsx`

Replace entirely:

```tsx
import type { ProductGridProps } from '../types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-24" style={{ color: 'var(--color-accent)' }}>
        <p className="text-xs tracking-[0.3em] uppercase">No products yet</p>
      </div>
    )
  }
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            {...p}
            currency={currency}
            onAddToCart={() => onAddToCart(p.id)}
          />
        ))}
      </div>
    </section>
  )
}
```

**Step 1:** Replace `frontend/src/themes/jewellery/ProductGrid.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/jewellery/ProductGrid.tsx
git commit -m "feat: jewellery product grid - 4-col desktop, generous spacing"
```

---

### Task 17: Jewellery CartDrawer — polished with smooth backdrop

**File:** `frontend/src/themes/jewellery/CartDrawer.tsx`

Replace entirely:

```tsx
import type { CartDrawerProps } from '../types'
import { Link } from 'react-router-dom'

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-200">
          <h2
            style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
            className="text-lg"
          >
            Your Bag
            {items.length > 0 && (
              <span className="ml-2 text-xs tracking-widest" style={{ color: 'var(--color-accent)' }}>
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 transition-opacity hover:opacity-50"
            style={{ color: 'var(--color-primary)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                Your bag is empty
              </p>
              <button onClick={onClose} className="text-xs tracking-widest uppercase underline underline-offset-4" style={{ color: 'var(--color-primary)' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-4">
                  <Link to={`/product/${item.product_id}`} onClick={onClose}>
                    <div className="w-20 h-20 bg-stone-100 shrink-0 overflow-hidden">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} onClick={onClose}>
                      <p
                        className="text-sm mb-1 hover:opacity-70 transition-opacity"
                        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}
                      >
                        {item.name}
                      </p>
                    </Link>
                    <p className="text-xs tracking-wider mb-3" style={{ color: 'var(--color-accent)' }}>
                      {currency}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 border border-stone-200 text-xs flex items-center justify-center transition-colors hover:border-stone-400"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        −
                      </button>
                      <span className="text-xs w-4 text-center" style={{ color: 'var(--color-primary)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 border border-stone-200 text-xs flex items-center justify-center transition-colors hover:border-stone-400"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t border-stone-200">
            <div className="flex justify-between mb-5">
              <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--color-primary)' }}>Subtotal</span>
              <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-primary)' }}>
                {currency}{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3.5 text-xs tracking-[0.2em] uppercase transition-all duration-200 hover:opacity-80 active:scale-[0.99]"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
            >
              Checkout
            </button>
            <p className="text-center text-xs mt-3 tracking-wider" style={{ color: 'var(--color-accent)' }}>
              Free shipping on orders above ₹999
            </p>
          </div>
        )}
      </div>
    </>
  )
}
```

**Step 1:** Replace `frontend/src/themes/jewellery/CartDrawer.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/jewellery/CartDrawer.tsx
git commit -m "feat: jewellery cart drawer - smooth transitions, product links, better layout"
```

---

### Task 18: Arts & Crafts Hero — bold warm design

**File:** `frontend/src/themes/artsCrafts/Hero.tsx`

Replace entirely:

```tsx
import { Link } from 'react-router-dom'
import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  return (
    <section
      className="relative min-h-[65vh] sm:min-h-[75vh] flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      {/* Warm accent block */}
      <div
        className="absolute top-0 right-0 w-1/2 h-full opacity-10"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />
      {/* Decorative circle */}
      <div
        className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full opacity-10"
        style={{ backgroundColor: 'var(--color-accent)' }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        <div className="w-12 h-1 mx-auto mb-6 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
        <p
          className="text-xs tracking-[0.4em] uppercase mb-4 font-bold"
          style={{ color: 'var(--color-accent)' }}
        >
          {storeName}
        </p>
        <h2
          className="text-4xl sm:text-6xl font-bold tracking-wide uppercase mb-6 leading-tight"
          style={{ color: 'var(--color-primary)' }}
        >
          {tagline}
        </h2>
        <div className="w-12 h-1 mx-auto mb-8 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
        <Link
          to="/search"
          className="inline-block px-8 py-3.5 text-xs font-bold tracking-[0.2em] uppercase rounded-full transition-all duration-200 hover:opacity-80 active:scale-95"
          style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
        >
          Shop Now
        </Link>
      </div>
    </section>
  )
}
```

**Step 1:** Replace `frontend/src/themes/artsCrafts/Hero.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/artsCrafts/Hero.tsx
git commit -m "feat: artsCrafts hero - bold warm design with decorative shapes"
```

---

### Task 19: Arts & Crafts ProductCard — warm hover + link

**File:** `frontend/src/themes/artsCrafts/ProductCard.tsx`

Replace entirely:

```tsx
import { Link } from 'react-router-dom'
import type { ProductCardProps } from '../types'

export default function ProductCard({ id, name, price, image_url, currency, onAddToCart }: ProductCardProps) {
  return (
    <div className="group cursor-pointer">
      {/* Image */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-4 border-2 border-amber-100">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-amber-300 text-xs font-bold tracking-widest uppercase bg-amber-50">
            No image
          </div>
        )}
        {/* Warm overlay on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
        {/* Add to cart button overlay */}
        <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={e => { e.preventDefault(); onAddToCart() }}
            className="px-6 py-2.5 text-xs font-bold tracking-wider uppercase rounded-full transition-all active:scale-95"
            style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
          >
            Add to Cart
          </button>
        </div>
      </div>

      {/* Info */}
      <Link to={`/product/${id}`} className="block px-1">
        <h3
          className="text-sm font-bold mb-1 leading-snug group-hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-primary)' }}
        >
          {name}
        </h3>
        <p className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
          {currency}{price.toFixed(2)}
        </p>
      </Link>
    </div>
  )
}
```

**Step 1:** Replace `frontend/src/themes/artsCrafts/ProductCard.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/artsCrafts/ProductCard.tsx
git commit -m "feat: artsCrafts product card - hover overlay, zoom, warm design"
```

---

### Task 20: Arts & Crafts ProductGrid — warm layout

**File:** `frontend/src/themes/artsCrafts/ProductGrid.tsx`

Replace entirely:

```tsx
import type { ProductGridProps } from '../types'
import ProductCard from './ProductCard'

export default function ProductGrid({ products, currency, onAddToCart }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-24">
        <p className="text-xs font-bold tracking-[0.3em] uppercase" style={{ color: 'var(--color-accent)' }}>
          No products yet
        </p>
      </div>
    )
  }
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            {...p}
            currency={currency}
            onAddToCart={() => onAddToCart(p.id)}
          />
        ))}
      </div>
    </section>
  )
}
```

**Step 1:** Replace `frontend/src/themes/artsCrafts/ProductGrid.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/artsCrafts/ProductGrid.tsx
git commit -m "feat: artsCrafts product grid - 4-col desktop, generous spacing"
```

---

### Task 21: Arts & Crafts CartDrawer — warm polished design

**File:** `frontend/src/themes/artsCrafts/CartDrawer.tsx`

Replace entirely:

```tsx
import type { CartDrawerProps } from '../types'
import { Link } from 'react-router-dom'

export default function CartDrawer({ isOpen, items, currency, onClose, onUpdateQuantity, onCheckout }: CartDrawerProps) {
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-out border-l-2 border-amber-100 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b-2 border-amber-100">
          <h2 className="text-lg font-bold tracking-wider uppercase" style={{ color: 'var(--color-primary)' }}>
            Your Cart
            {items.length > 0 && (
              <span className="ml-2 text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                ({items.reduce((s, i) => s + i.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-xl transition-colors hover:opacity-50"
            style={{ color: 'var(--color-accent)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                Your cart is empty
              </p>
              <button onClick={onClose} className="text-xs font-bold tracking-wider uppercase underline underline-offset-4" style={{ color: 'var(--color-primary)' }}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={item.product_id} className="flex gap-4">
                  <Link to={`/product/${item.product_id}`} onClick={onClose}>
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-amber-50 border-2 border-amber-100 shrink-0">
                      {item.image_url && (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${item.product_id}`} onClick={onClose}>
                      <p className="text-sm font-bold mb-1 hover:opacity-70 transition-opacity truncate" style={{ color: 'var(--color-primary)' }}>
                        {item.name}
                      </p>
                    </Link>
                    <p className="text-sm font-bold mb-3" style={{ color: 'var(--color-accent)' }}>
                      {currency}{item.price.toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-full border-2 border-amber-200 text-xs flex items-center justify-center transition-colors hover:border-amber-400 font-bold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        −
                      </button>
                      <span className="text-sm font-bold w-4 text-center" style={{ color: 'var(--color-primary)' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-full border-2 border-amber-200 text-xs flex items-center justify-center transition-colors hover:border-amber-400 font-bold"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 border-t-2 border-amber-100">
            <div className="flex justify-between mb-5">
              <span className="text-sm font-bold tracking-wider uppercase" style={{ color: 'var(--color-primary)' }}>Total</span>
              <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                {currency}{total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-3.5 text-sm font-bold tracking-wider uppercase rounded-full transition-all duration-200 hover:opacity-80 active:scale-[0.99]"
              style={{ backgroundColor: 'var(--color-accent)', color: '#fff' }}
            >
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  )
}
```

**Step 1:** Replace `frontend/src/themes/artsCrafts/CartDrawer.tsx`.

**Step 2:** Commit:
```bash
git add frontend/src/themes/artsCrafts/CartDrawer.tsx
git commit -m "feat: artsCrafts cart drawer - warm design, smooth transitions, product links"
```

---

### Task 22: ProductPage.tsx — two-column layout + sticky CTA

**File:** `frontend/src/pages/ProductPage.tsx`

This is a significant overhaul. The page should use theme CSS variables so it adapts to whichever theme is active.

Key changes:
1. Two-column layout on md+ (image left, details right)
2. Sticky right column on desktop (`sticky top-24`)
3. Image uses aspect-square with theme background
4. Category as pill badge
5. Price styled with theme accent
6. Quantity stepper styled with theme border
7. Add to Cart button uses theme primary color
8. Sticky bottom CTA bar on mobile (appears after scrolling)
9. Reviews section remains below fold

Replace the main return JSX (keep all the logic above, only change the render):

```tsx
// Inside ProductPage, replace the return statement from line 124 onwards:
  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')
  const { activeThemeId } = useTheme()

  // ... keep existing state/effects/queries ...

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p className="text-sm" style={{ color: 'var(--color-accent)' }}>Loading...</p>
    </div>
  )
  if (error || !product) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <p className="text-sm" style={{ color: 'var(--color-primary)' }}>
        Product not found.{' '}
        <Link to="/" className="underline">Go back</Link>
      </p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs" style={{ color: 'var(--color-accent)', opacity: 0.7 }}>
          <Link to="/" style={{ color: 'var(--color-accent)' }} className="hover:opacity-70">Home</Link>
          <span>/</span>
          {product.category && (
            <>
              <span style={{ color: 'var(--color-accent)' }}>{product.category}</span>
              <span>/</span>
            </>
          )}
          <span style={{ color: 'var(--color-primary)' }}>{product.name}</span>
        </nav>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 mb-16">
          {/* Left: image */}
          <div className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
            {product.image_url
              ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-xs tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>No image</div>
            }
          </div>

          {/* Right: details — sticky on desktop */}
          <div className="flex flex-col md:sticky md:top-24 md:self-start">
            {product.category && (
              <span
                className="inline-block self-start text-xs tracking-widest uppercase px-3 py-1 rounded-full mb-4 font-medium"
                style={{ backgroundColor: 'var(--color-accent)', color: '#fff', opacity: 0.85 }}
              >
                {product.category}
              </span>
            )}
            <h1
              className="text-2xl sm:text-3xl font-semibold mb-3 leading-tight"
              style={{ color: 'var(--color-primary)' }}
            >
              {product.name}
            </h1>
            <p className="text-2xl font-medium mb-5" style={{ color: 'var(--color-accent)' }}>
              {currency}{product.price.toFixed(2)}
            </p>
            {product.description && (
              <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--color-primary)', opacity: 0.7 }}>
                {product.description}
              </p>
            )}
            <p className="text-xs tracking-wider mb-6" style={{ color: 'var(--color-accent)' }}>
              {product.stock_count > 0 ? `${product.stock_count} in stock` : 'Out of stock'}
            </p>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="flex items-center border rounded overflow-hidden"
                style={{ borderColor: 'var(--color-primary)', opacity: 0.4 }}
              >
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-4 py-3 text-sm transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}
                >
                  −
                </button>
                <span
                  className="px-4 text-sm font-medium"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {qty}
                </span>
                <button
                  onClick={() => setQty(Math.min(product.stock_count, qty + 1))}
                  className="px-4 py-3 text-sm transition-opacity hover:opacity-70"
                  style={{ color: 'var(--color-primary)' }}
                >
                  +
                </button>
              </div>
              <button
                onClick={() => {
                  addItem({ product_id: product.id, name: product.name, price: product.price, quantity: qty, image_url: product.image_url })
                  setAdded(true)
                  setTimeout(() => setAdded(false), 2000)
                }}
                disabled={product.stock_count === 0}
                className="flex-1 py-3 text-sm tracking-wider uppercase transition-all disabled:opacity-40 hover:opacity-80 active:scale-[0.99]"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
              >
                {added ? '✓ Added' : product.stock_count === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>

        {/* Reviews section */}
        <div className="border-t pt-12" style={{ borderColor: 'var(--color-primary)', opacity: 1 }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-primary)' }}>
            Customer Reviews {reviewsList.length > 0 && `(${reviewsList.length})`}
          </h2>
          {reviewsList.length === 0 ? (
            <p className="text-sm mb-8" style={{ color: 'var(--color-accent)', opacity: 0.7 }}>No reviews yet. Be the first to review!</p>
          ) : (
            <div className="space-y-4 mb-8">
              {reviewsList.map(review => (
                <div
                  key={review.id}
                  className="border rounded-lg p-4"
                  style={{ borderColor: 'var(--color-primary)', opacity: 1 }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{review.customer_name}</span>
                    <span className="text-xs" style={{ color: 'var(--color-accent)', opacity: 0.6 }}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[1,2,3,4,5].map(star => (
                      <span key={star} className={star <= review.rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                    ))}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--color-primary)', opacity: 0.8 }}>{review.body}</p>
                </div>
              ))}
            </div>
          )}

          {reviewSubmitted ? (
            <p className="text-sm text-green-600">Thank you! Your review has been submitted for moderation.</p>
          ) : (
            <form
              onSubmit={e => { e.preventDefault(); submitReviewMutation.mutate(reviewForm) }}
              className="space-y-3 border rounded-lg p-5 max-w-lg"
              style={{ borderColor: 'var(--color-primary)' }}
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Write a Review</h3>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-accent)' }}>Your Name *</label>
                <input
                  required
                  maxLength={100}
                  value={reviewForm.customer_name}
                  onChange={e => setReviewForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-accent)' }}>Rating *</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewForm(f => ({ ...f, rating: star }))}
                      className={`text-2xl ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition-colors`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-accent)' }}>Review *</label>
                <textarea
                  required
                  maxLength={2000}
                  rows={3}
                  value={reviewForm.body}
                  onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))}
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
                />
              </div>
              {submitReviewMutation.isError && (
                <p className="text-xs text-red-500">{(submitReviewMutation.error as Error)?.message ?? 'Failed to submit review'}</p>
              )}
              <button
                type="submit"
                disabled={submitReviewMutation.isPending}
                className="px-5 py-2.5 text-sm tracking-wider uppercase transition-all hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
              >
                {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Mobile sticky Add to Cart bar */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 px-4 py-3 border-t flex items-center gap-3 safe-b"
        style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-primary)' }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>{currency}{product.price.toFixed(2)}</p>
          <p className="text-xs" style={{ color: 'var(--color-accent)' }}>{product.name}</p>
        </div>
        <button
          onClick={() => {
            addItem({ product_id: product.id, name: product.name, price: product.price, quantity: 1, image_url: product.image_url })
            setAdded(true)
            setTimeout(() => setAdded(false), 2000)
          }}
          disabled={product.stock_count === 0}
          className="px-6 py-3 text-xs tracking-wider uppercase font-medium transition-all disabled:opacity-40 hover:opacity-80 rounded"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-bg)' }}
        >
          {added ? '✓ Added' : product.stock_count === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </div>
  )
```

**Important:** Keep ALL the existing logic (useState, useEffect, useQuery, useMutation) — only replace the JSX return statement. Add `const { activeThemeId } = useTheme()` if you need it, but the CSS variables approach means you don't need to branch by theme.

Also add `pb-20 md:pb-0` to the main div to prevent the mobile sticky bar from overlapping content.

**Step 1:** Read the full current ProductPage.tsx carefully.

**Step 2:** Replace only the return statement (from `return (` to the closing `)`). Keep all logic above.

**Step 3:** Verify TypeScript compiles:
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```

**Step 4:** Commit:
```bash
git add frontend/src/pages/ProductPage.tsx
git commit -m "feat: product page - two-column layout, theme-aware styling, mobile sticky CTA"
```

---

## Final Verification (Both Agents)

After all tasks complete:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1
```

Expected: No errors (or only pre-existing unrelated errors).

Check dev server starts:
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npm run dev 2>&1 | head -20
```

---

## Notes & Decisions

- Agent 1 owns Header.tsx + Footer.tsx in both themes to avoid merge conflicts with Agent 2
- `FooterData` is optional (`footerData?` in FooterProps) so existing Footer renders still work before settings are saved
- Mobile admin uses slide-in drawer from left (standard UX pattern) instead of bottom tabs (too many items)
- Navigation nesting is one level only — sufficient for e-commerce without UI complexity
- `/admin/theme` redirects to `/admin/appearance` for backward compatibility
- ProductPage uses CSS variables throughout so it adapts to both themes without conditional logic
- Arts&Crafts CartDrawer uses `border-amber-100` for decorative borders (amber-200 is too strong for the drawer context)
- Hero background image reads from `--hero-image` CSS variable set by ThemeCustomizer — no code change needed when merchant sets it via admin
