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

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export function currencySymbol(currency: string | undefined): string {
  if (!currency) return '₹'
  return CURRENCY_SYMBOLS[currency] ?? currency
}
