# EdgeShop — Proper E-commerce UI/UX Plan

## Audit: What's Missing vs a Real Store (Shopify-level)

### Current State Problems
- Hero is full-screen but empty — no rich homepage sections below it
- No category/collection browsing on homepage
- No search bar in the header (only a /search page)
- Mobile nav is a basic dropdown, not a proper full-screen drawer
- No quick view modal on products
- No image zoom on product page
- Product page info doesn't stick on desktop scroll
- No product tabs (Description / Shipping / Returns)
- OrderSuccess page is totally bare (gray-50, no branding)
- No 404 page with branding
- No "recently viewed" products
- No mobile bottom navigation bar
- No trust/feature strip between hero and products
- No testimonials section on homepage
- No featured collection banners (editorial-style)
- Fonts are loaded from inside JS — no preload, causes FOUT
- No skeleton loaders on ProductPage (only on HomePage)
- SearchPage is plain with no filter sidebar

---

## Plan: Sections to Build / Overhaul

### Priority 1 — Homepage (highest visible impact)

**A. Feature/USP Strip**
- 3–4 icon + label pills: "Free Shipping", "Easy Returns", "Secure Payment", "Handcrafted"
- Full-width strip between Hero and Product Grid
- Configurable: `theme.config.uspItems` array in theme file — user can delete or edit entries

**B. Featured Collection Banner**
- A wide editorial-style banner: full-width image left, text right (or centered overlay)
- "Shop the Collection →" CTA
- Configurable via `theme.config.featuredCollection` in theme file
- Data: { title, subtitle, image, href, ctaLabel }

**C. Category Bubbles Row**
- Horizontal scrollable row of category circles (image + label)
- Configurable: `theme.config.categoryBubbles` array in theme file
- Data: [{ label, image, href }]

**D. Testimonials Carousel**
- 3 customer testimonials in a sliding/grid layout
- Star rating + name + quote
- Configurable: `theme.config.testimonials` array in theme file
- User deletes the entire section or empties the array

**E. "New Arrivals" secondary grid**
- Shows products from a specific query (newest 4)
- Already fetches products, just needs a dedicated section with its own heading

---

### Priority 2 — Header Overhaul

**A. Inline search bar on desktop**
- Search icon that expands to an input on click (animated width expansion)
- On mobile: search icon opens full-screen overlay

**B. Mobile menu — full-screen slide-in**
- Replace basic dropdown with a proper full-screen left-side drawer
- Animated slide from left
- Shows nav items with sub-items + account + cart count

**C. Wishlist icon**
- Heart icon in header (shows count from localStorage)

---

### Priority 3 — Product Page

**A. Product tabs**
- Tab bar: "Description" | "Shipping & Returns" | "Care Guide"
- Configurable: `theme.config.productTabs` — array of { label, content }
- Default content provided in theme file as template strings

**B. Sticky product info panel on desktop**
- The right column (info + add-to-cart) becomes `sticky top-24` when scrolled

**C. Share buttons**
- Small row: Copy Link, WhatsApp Share, Twitter Share

**D. Recently viewed**
- Horizontal scroll of last 4 viewed products (localStorage)
- Section at bottom of product page above footer

---

### Priority 4 — Missing / Weak Pages

**A. OrderSuccessPage — full redesign**
- Animated checkmark (CSS keyframe, no library)
- Order number display
- "What happens next" steps: Processing → Shipped → Delivered
- Branded colors (CSS vars)
- CTA: Continue Shopping + View Orders

**B. NotFoundPage — branded 404**
- Large "404" in Playfair Display
- Helpful CTAs: Go Home, Browse Products, Contact Us

**C. SearchPage — add filter sidebar**
- Left panel (desktop) / bottom sheet (mobile): Category filter, Price range
- Active filter pills above results
- Sort dropdown: Price low-high, high-low, Newest

---

### Priority 5 — Mobile Experience

**A. Bottom navigation bar (mobile only)**
- Fixed bottom bar: Home | Search | Cart | Account
- Active state highlight
- Cart badge on cart icon

**B. Swipeable product image gallery on mobile**
- Replace thumbnail row with swipe gesture (CSS scroll snap)

**C. Touch-optimised quantity controls**
- Larger tap targets (min 44px) on all +/− buttons

---

### Priority 6 — Global Polish

**A. Font preloading**
- Add `<link rel="preconnect">` and `<link rel="preload">` for Playfair Display in index.html

**B. CSS custom property expansion**
- Add `--color-surface` (card backgrounds), `--color-border`, `--color-muted`, `--font-display`, `--font-body`
- Reduces hardcoded `border-stone-200`, `text-gray-500` etc.

**C. Page transition polish**
- Consistent fade-in on all pages (already have `.page-enter` class, just need it applied everywhere)

---

## Configurable Template System

Every homepage section lives in `theme.config` inside the theme file.
Each section has:
- A `enabled: boolean` flag — set to `false` to hide
- An array of items — user deletes entries they don't want
- Clear JSDoc comments explaining each field

Example in `jewellery/index.ts`:
```ts
export const config = {
  uspItems: [
    { icon: '✦', label: 'Free Shipping', sub: 'On orders over ₹999' },
    { icon: '↩', label: 'Easy Returns', sub: '7-day hassle-free returns' },
    { icon: '🔒', label: 'Secure Payment', sub: 'Razorpay & COD' },
    { icon: '✦', label: 'Handcrafted', sub: 'Every piece made with care' },
  ],
  featuredCollection: {
    enabled: true,
    title: 'The Gold Edit',
    subtitle: 'Timeless pieces for every occasion',
    image: '', // paste your R2 image URL here
    href: '/search?category=gold',
    ctaLabel: 'Explore the Collection',
  },
  categoryBubbles: [
    { label: 'Rings', image: '', href: '/search?category=rings' },
    { label: 'Necklaces', image: '', href: '/search?category=necklaces' },
    { label: 'Earrings', image: '', href: '/search?category=earrings' },
    { label: 'Bracelets', image: '', href: '/search?category=bracelets' },
    { label: 'Sets', image: '', href: '/search?category=sets' },
  ],
  testimonials: [
    { name: 'Priya S.', rating: 5, text: 'Absolutely beautiful craftsmanship. The necklace I ordered exceeded every expectation.' },
    { name: 'Meera R.', rating: 5, text: 'Fast shipping and the packaging was stunning. Will definitely order again.' },
    { name: 'Ananya K.', rating: 5, text: 'The quality is unreal for the price. My go-to for gifting.' },
  ],
  productTabs: [
    { label: 'Description', key: 'description' }, // uses product.description
    { label: 'Shipping & Returns', key: 'static', content: 'We ship within 2–4 business days. Free shipping on orders above ₹999. Returns accepted within 7 days of delivery — items must be unused and in original packaging.' },
    { label: 'Care Guide', key: 'static', content: 'Store in a cool, dry place. Avoid contact with perfume, water, and chemicals. Clean with a soft dry cloth. For gold-plated pieces, avoid prolonged sun exposure.' },
  ],
}
```

---

## Implementation Order

1. `theme config system` — add `config` export to jewellery theme index
2. `USP strip component` — JewelleryUSPStrip.tsx
3. `Featured Collection Banner` — JewelleryFeaturedBanner.tsx
4. `Category Bubbles` — JewelleryCategoryRow.tsx
5. `Testimonials` — JewelleryTestimonials.tsx
6. `HomePage` — wire all new sections
7. `Header` — search expand + full-screen mobile drawer
8. `Product tabs` + sticky panel — ProductPage.tsx
9. `OrderSuccessPage` — full redesign
10. `NotFoundPage` — branded
11. `Mobile bottom nav` — new MobileBottomNav.tsx component
12. `SearchPage` — filter sidebar + sort
13. `Global CSS vars` — expand in theme defaultCssVars
14. `Font preloading` — index.html
