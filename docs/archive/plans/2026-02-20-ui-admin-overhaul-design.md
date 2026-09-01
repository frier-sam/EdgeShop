# UI & Admin Overhaul Design
Date: 2026-02-20

## Summary

Six improvements to EdgeShop's admin panel and storefront themes, executed via 2 parallel subagents.

---

## Agent 1: Admin Panel Overhaul

### 1A. Sidebar — Collapsible Grouped Sections with Icons

**File:** `frontend/src/admin/AdminLayout.tsx`

Replace the flat 13-item nav list with 4 collapsible sections. Section open/closed state persisted in `localStorage`.

**Grouping:**

| Section | Items |
|---------|-------|
| **CATALOG** | Products, Collections, Blog |
| **SALES** | Orders, Discounts, Reviews, Analytics |
| **CONTENT** | Pages, Navigation, Footer |
| **STORE** | Appearance, Shipping, Settings |

Each section header is clickable to collapse/expand. Icons (emoji or Heroicons via inline SVG) beside each item label. Active item highlighted with dark background.

**Mobile:** Replace broken horizontal bottom tab bar (too many items) with a hamburger menu button in a top header bar. Clicking opens a slide-up/slide-in drawer with the same grouped structure. Drawer overlay closes on outside click.

### 1B. Appearance Page (new `/admin/appearance`)

**New file:** `frontend/src/admin/pages/AdminAppearance.tsx`

Combines:
- Theme selector cards (moved from `AdminSettings.tsx`)
- CSS variable customizer (currently at `/admin/theme`)

Two sections on one page:
1. **Choose Theme** — radio cards showing theme name, description, colour swatches
2. **Customise Theme** — CSS variable inputs (colors, fonts, logo, hero image) for the active theme

Route in `App.tsx`: `/admin/appearance` pointing to `AdminAppearance`.
Remove theme selector block from `AdminSettings.tsx`.
Redirect old `/admin/theme` to `/admin/appearance` or remove route.

### 1C. Navigation Editor — Nested Items + Type Dialog

**File:** `frontend/src/admin/pages/AdminNavigation.tsx`
**File:** `frontend/src/themes/types.ts` (extend `NavItem`)

**NavItem type extension:**
```ts
interface NavItem {
  label: string
  href: string
  type?: 'link' | 'collection' | 'page'  // for editor display only
  children?: NavItem[]  // one level of nesting
}
```

**Add Item flow:** Clicking "Add Item" opens a modal dialog with three choices:
- **Collection** — fetches `/api/collections`, shows searchable dropdown, auto-fills label + href (`/collections/:slug`)
- **Page** — fetches `/api/pages`, shows dropdown, auto-fills label + href (`/pages/:slug`)
- **Custom Link** — free-form label + URL fields

**Nested items:** Each top-level nav item has an "Add sub-item" button that opens the same dialog. Sub-items shown indented below parent. One level deep only. Reorder with up/down arrows.

**Theme Header update:** Both `jewellery/Header.tsx` and `artsCrafts/Header.tsx` updated to render a dropdown/flyout on desktop for items that have `children`. On mobile, sub-items shown in expanded accordion.

### 1D. Footer Editor (new `/admin/footer`)

**New file:** `frontend/src/admin/pages/AdminFooter.tsx`
**Updated:** `frontend/src/themes/types.ts` — add `FooterData` interface and `footerData` prop to `Footer` component signature
**Updated:** Both theme `Footer.tsx` files to accept and render `footerData`
**Updated:** `ThemeProvider.tsx` — fetch `footer_json` from settings, parse, pass as `footerData` to Footer

**FooterData interface:**
```ts
interface FooterData {
  tagline?: string           // "Crafted with care" etc.
  columns?: Array<{
    title: string
    links: Array<{ label: string; href: string }>
  }>                         // Up to 3 link columns
  socials?: {
    instagram?: string
    facebook?: string
    whatsapp?: string
  }
  copyright?: string         // "© 2025 My Store"
}
```

**Admin UI:** Simple form with:
- Tagline text input
- Up to 3 link columns (add/remove columns, add/remove links within each)
- Social links (3 inputs)
- Copyright text
- Save button → `PUT /api/settings { footer_json: JSON.stringify(footerData) }`

**Route:** `/admin/footer` added to `App.tsx` and sidebar under CONTENT section.

---

## Agent 2: Theme Polish — Jewellery & Arts & Crafts

### Scope

Polish the following components in both themes:
1. `Header.tsx` — sticky, backdrop blur, hover effects, mobile menu
2. `Hero.tsx` — full-viewport, layered typography, CTA animations
3. `ProductCard.tsx` — hover overlays, cleaner typography
4. `ProductGrid.tsx` — better grid layout, responsive
5. `Footer.tsx` — multi-column layout using `footerData` prop
6. `CartDrawer.tsx` — smoother, more polished slide-in panel
7. Pages: ensure `ProductPage.tsx` (detail page), `HomePage.tsx` have good mobile layout

### Jewellery Theme

**Design language:** Luxury editorial. Off-white background `#FAFAF8`, charcoal `#1A1A1A`, gold accent `#C9A96E`. Playfair Display serif headings, clean sans body.

- **Header:** Sticky with `backdrop-blur-sm bg-white/80`. Logo centered. Nav with underline-on-hover animation. Cart icon with badge. Mobile: hamburger → slide-down mobile menu.
- **Hero:** Full `100svh`. Large serif headline with gold accent word. Sub-headline. CTA button with border animation on hover. Background image with `object-cover`.
- **ProductCard:** Clean white card. Image fills top half, 1:1 aspect ratio. On hover: image zooms 105%, "Add to Cart" button fades in as overlay at bottom of image. Name in Playfair Display. Price in gold.
- **ProductGrid:** CSS Grid `repeat(auto-fill, minmax(280px, 1fr))`. 24px gap. Generous padding.
- **ProductPage (storefront page):** 2-column grid on desktop (md+). Image gallery left (main image + thumbnails below). Right column: breadcrumb, name, price, variant pickers (pill buttons), quantity stepper, Add to Cart + Buy Now buttons. Sticky right column via `sticky top-24`. Reviews section below fold.
- **Mobile sticky CTA:** On product page mobile, a fixed bottom bar with price + "Add to Cart" that appears after scrolling past the above-fold button.
- **CartDrawer:** Slide from right. Backdrop overlay. Smooth `translate-x` transition. Line items with quantity controls. Subtotal. Checkout button (gold).
- **Footer:** Dark `#1A1A1A` background. 3-column grid on desktop. Link columns in off-white. Social icons. Gold divider top. Copyright centered bottom.

### Arts & Crafts Theme

**Design language:** Warm, handmade, earthy. Linen `#F5F0E8`, warm dark `#2C2416`, terracotta `#C4622D`. Bold sans-serif with organic feel.

- **Header:** Sticky with warm linen background. Nav links with terracotta underline on hover. Mobile: hamburger → drawer.
- **Hero:** Bold overlapping text blocks. Warm semi-transparent overlay on background image. Terracotta CTA.
- **ProductCard:** Warm linen card with rounded corners. On hover: warm overlay + "View" button. Earthy typography.
- **ProductGrid:** Same grid structure as jewellery but with more border-radius.
- **ProductPage:** Same 2-column layout. Terracotta variant pickers. "Handcrafted" badge. Warm button styles. Mobile sticky CTA.
- **CartDrawer:** Slide from right. Linen background. Warm separator lines.
- **Footer:** Warm dark background `#2C2416`. Same 3-column link structure. Terracotta social icons. Decorative rule.

### Mobile-first Rules (both themes)

- All tap targets minimum 44×44px
- Input fields minimum 16px font (prevents iOS zoom)
- Bottom safe-area padding: `pb-safe` or `padding-bottom: env(safe-area-inset-bottom)`
- No horizontal overflow
- Images: `width: 100%; height: auto` or aspect-ratio utilities

---

## Implementation Strategy

**Agent 1 (Admin Panel):** Modifies `AdminLayout.tsx`, `AdminSettings.tsx`, `AdminNavigation.tsx`, `App.tsx`. Creates `AdminAppearance.tsx`, `AdminFooter.tsx`. Updates `types.ts` (NavItem, FooterData), `ThemeProvider.tsx`.

**Agent 2 (Theme Polish):** Modifies all 6 components in `jewellery/` and `artsCrafts/` directories. Minimal changes to page files (`HomePage.tsx`, `ProductPage.tsx`) for sticky CTA. No backend changes required.

**No conflicts:** Agent 1 and Agent 2 touch completely different files.

---

## Decisions

- Mobile bottom nav replaced with hamburger + drawer (13 items can't fit in tab bar)
- Navigation nesting limited to one level (sufficient for e-commerce; deeper nesting adds complexity with little benefit)
- Footer CMS stored as `footer_json` in existing D1 settings table (no schema migration needed)
- Theme selector + customizer merged into single `/admin/appearance` route
- Both themes polished rather than adding a 3rd theme (user preference)
- `FooterData` added to theme type contract so any future theme automatically supports footer CMS
