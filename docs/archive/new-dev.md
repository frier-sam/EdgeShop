# EdgeShop — UI/UX Implementation Tracker

## Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done

---

## Phase 1 — Theme Config System
| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | Create jewellery theme config (USP items, featured banner, category bubbles, testimonials, product tabs) | `themes/jewellery/config.ts` | `[x]` |
| 1.2 | Expand CSS vars (--color-surface, --color-border, --color-muted) in theme index | `themes/jewellery/index.ts` | `[x]` |

## Phase 2 — Homepage Sections
| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | USP / feature strip (4 icons: Free Shipping, Easy Returns, Secure Payment, Handcrafted) | `themes/jewellery/USPStrip.tsx` | `[x]` |
| 2.2 | Featured Collection editorial banner (image + text + CTA, configurable) | `themes/jewellery/FeaturedBanner.tsx` | `[x]` |
| 2.3 | Category bubbles horizontal scroll row | `themes/jewellery/CategoryRow.tsx` | `[x]` |
| 2.4 | Testimonials carousel / grid section | `themes/jewellery/Testimonials.tsx` | `[x]` |
| 2.5 | Wire all new sections into HomePage between Hero and ProductGrid | `pages/HomePage.tsx` | `[x]` |

## Phase 3 — Header Overhaul
| # | Task | File | Status |
|---|------|------|--------|
| 3.1 | Search icon → expands inline on desktop, full-screen overlay on mobile | `themes/jewellery/Header.tsx` | `[x]` |
| 3.2 | Mobile menu → full-screen slide-in drawer (replace basic dropdown) | `themes/jewellery/Header.tsx` | `[x]` |
| 3.3 | Wishlist icon in header with localStorage count | `themes/jewellery/Header.tsx` | `[x]` |

## Phase 4 — Product Page Improvements
| # | Task | File | Status |
|---|------|------|--------|
| 4.1 | Product tabs: Description / Shipping & Returns / Care Guide (configurable content) | `pages/ProductPage.tsx` | `[x]` |
| 4.2 | Sticky product info panel on desktop scroll | `pages/ProductPage.tsx` | `[x]` |
| 4.3 | Share buttons: Copy Link / WhatsApp / Twitter | `pages/ProductPage.tsx` | `[x]` |
| 4.4 | Recently Viewed products section (localStorage, last 4) | `pages/ProductPage.tsx` | `[x]` |

## Phase 5 — Missing / Weak Pages
| # | Task | File | Status |
|---|------|------|--------|
| 5.1 | OrderSuccessPage full redesign (animated checkmark, steps, branded) | `pages/OrderSuccessPage.tsx` | `[x]` |
| 5.2 | NotFoundPage branded 404 (Playfair Display, CTAs) | `pages/NotFoundPage.tsx` | `[x]` |
| 5.3 | SearchPage: category filter + price sort + active filter pills | `pages/SearchPage.tsx` | `[x]` |

## Phase 6 — Mobile Experience
| # | Task | File | Status |
|---|------|------|--------|
| 6.1 | Mobile bottom navigation bar (Home / Search / Cart / Account) | `components/MobileBottomNav.tsx` | `[x]` |
| 6.2 | Wire MobileBottomNav into App.tsx | `App.tsx` | `[x]` |
| 6.3 | Touch-optimised tap targets on ProductPage quantity controls | `pages/ProductPage.tsx` | `[x]` |

## Phase 7 — Global Polish
| # | Task | File | Status |
|---|------|------|--------|
| 7.1 | Font preloading (Playfair Display preconnect + preload) | `index.html` | `[x]` |
| 7.2 | Global base styles (smooth scroll, font-body on body, focus-visible ring) | `src/index.css` | `[x]` |

---

## Decisions Log
- Theme sections are config-driven via `themes/jewellery/config.ts` — user edits/deletes entries, sets `enabled: false` to hide sections
- No new npm packages — all animations via CSS keyframes inline in components
- Mobile bottom nav hidden on desktop via `md:hidden`, shows on `< md` breakpoint; hidden on /admin/* routes
- Recently viewed uses `localStorage` key `edgeshop_recently_viewed`
- Wishlist uses `localStorage` key `edgeshop_wishlist`
- Product tabs content for Shipping & Returns and Care Guide is hardcoded in config.ts as editable template strings
- New CSS vars added: `--color-surface` (#F3F0EB), `--color-border` (#E8E2D9), `--color-muted` (#7A7167)
- GlobalMobileNav wrapper in App.tsx reads cart store and skips render on /admin/* paths
