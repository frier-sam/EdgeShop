// Hardcoded storefront navigation + footer links.
// Replaces the D1-backed navigation_json / footer_json that ThemeProvider
// used to fetch — POD has one fixed layout, no admin-configurable nav.

export interface NavItem {
  label: string
  href: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Shop', href: '/shop' },
]

export const FOOTER_LINKS: NavItem[] = [
  { label: 'Shop', href: '/shop' },
  { label: 'My Orders', href: '/account/orders' },
]

// ── Categories (POD-UI2.md §7.1) ────────────────────────────────────
// The hardcoded `CATEGORIES` array that used to live here is gone —
// categories are backend-driven now (`GET /api/categories`, derived from
// `products` via GROUP BY, see worker/src/routes/categories.ts). Header.tsx
// and home/ShopByCategory.tsx each fetch it directly with TanStack Query;
// there's no local fallback/static list to keep in sync with the catalogue
// any more.

// ── Footer columns (POD-UI2.md §3/E4/E6) ───────────────────────────
// `href: '#'` is a deliberate sentinel, not a dead link left by accident —
// Footer.tsx renders those entries as plain inert text (title="Coming
// soon") instead of an <a>, so nothing that looks clickable silently does
// nothing. Every other href below points at a route that actually exists
// in App.tsx, or a mailto:/tel: link.
export const FOOTER_COLUMNS: { title: string; links: NavItem[] }[] = [
  {
    title: 'Shop',
    links: [
      { label: 'All Products', href: '/shop' },
      { label: 'T-Shirts', href: '/shop?category=T-Shirts' },
      { label: 'Polos', href: '/shop?category=Polos' },
      { label: 'Mugs', href: '/shop?category=Mugs' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'My Orders', href: '/account/orders' },
      { label: 'Shipping & Returns', href: '#' },
      { label: 'Size Guide', href: '#' },
      { label: 'Contact Us', href: 'mailto:hello@espod.store' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Home', href: '/' },
      { label: 'About Us', href: '#' },
      { label: 'Careers', href: '#' },
    ],
  },
  {
    title: 'Contact',
    links: [
      { label: 'hello@espod.store', href: 'mailto:hello@espod.store' },
      { label: '+91 98765 43210', href: 'tel:+919876543210' },
      { label: 'Mon–Sat, 10am–6pm IST', href: '#' },
    ],
  },
]

// ── Trust strip (POD-UI2.md §3/F2, consumed by the homepage workstream)
export const TRUST_ITEMS: { icon: string; title: string; subtitle: string }[] = [
  { icon: 'made-to-order', title: 'Made to order', subtitle: 'Printed just for you, nothing pre-stocked' },
  { icon: 'shipping', title: 'Free shipping', subtitle: 'On orders over ₹999' },
  { icon: 'secure-payment', title: 'Secure payment', subtitle: 'Encrypted checkout, every time' },
  { icon: 'returns', title: 'Easy returns', subtitle: 'Simple exchanges within 7 days' },
]

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export function currencySymbol(currency: string | undefined): string {
  if (!currency) return '₹'
  return CURRENCY_SYMBOLS[currency] ?? currency
}
