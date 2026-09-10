# POD-UI4.md — Reference-Aligned Design Language & Merchandising Features

> **Source of truth for this round.** Derived from a first-pass analysis of the
> three static comps supplied in `referance/` (`Home Page.html`,
> `Product Page.html`, `Admin Panel.html` — a "PrintPro" print-on-demand
> storefront + admin).
>
> **`referance/` is gitignored, so those files are not in the repository.**
> §1 and §2 therefore describe the comps in enough detail to work from without
> them: §2 is the full extracted token system, not a pointer to one. Treat this
> document as the artefact of record — if the comps and this file ever
> disagree, this file wins, because it is what the code was built against.
>
> **Two deliverables:**
> 1. **§2 — the design language.** ESPOD's current look (cool-neutral + one
>    indigo accent, generous 16px radii) is replaced wholesale by the
>    reference's system (Material-3-shaped blue-tinted neutrals, **black
>    primary + teal secondary**, tight 2/4/8/12px radii, three-family type,
>    Material Symbols icons). This is authoritative and non-negotiable for
>    every file touched this round.
> 2. **§3–§4 — the feature gap.** §3 is the **complete** inventory of what the
>    comps do that ESPOD does not. §4 is the **minimal cut we actually build**,
>    chosen so nothing half-built and nothing dishonest ships.
>
> **Frozen this round** (§6): the Fabric customizer's design/preview geometry,
> `lib/pricing.ts`'s `computeLine` money path, the print-file export pipeline.
>
> Predecessors: `POD.md` (live plan), `POD-V2.md` (option axes / bulk pricing /
> templates — this round lands parts of its Phase 2, 3.3 and 5), `POD-UI3.md`
> (editor surface split).

---

## 1. What the comps are, in one paragraph each

**Home Page.** A full-bleed 5-slide auto-advancing hero carousel (category-led,
arrows on hover, pagination dots), a 3-up value-prop band under it, then four
horizontally scroll-snapping product/category rails ("Explore all categories",
"Our Most Popular Products", "Trending", "Your recently viewed items"). Every
tile is a square neutral ground with the mockup `mix-blend-multiply`-composited
onto it and a mint **"BUY 100 @ Rs.450"** price-break pill in the top-left.
Chrome is a two-row sticky header: row 1 = wordmark / 5 hover mega-menus /
account + cart icons, row 2 = a full-width pill search field.

**Product Page.** 7/5 split grid: a sticky left gallery (square main image +
a 96px thumbnail strip, active thumb ringed teal) and a right info column —
breadcrumbs, H1, star rating + review count, a bordered **"Key Features"**
bullet box, price + strikethrough + **"38% OFF"**, then four option blocks
(quantity `<select>` with per-tier savings, size cards showing `+₹50.00`,
circular colour swatches, delivery-speed cards) and a two-button action row.
Below: a 3-up customer-reviews grid, "Frequently bought together" and
"Your recently viewed items" rails.

**Admin Panel.** A 280px sidebar (brand + tagline, pill nav rows with a mint
active state, user block pinned to the bottom), a sticky top app bar (back
arrow, title, a **`DRAFT`** status chip, "Save Draft" + "Publish Changes"
pills), then a **two-pane editor**: a 420px scrolling config column
(icon-prefixed section headers, quantity-tier rows showing total + per-unit +
"3% savings", big **customization option cards** with icon tiles, a segmented
Active/Out-of-Stock control, a dashed upload dropzone) beside a preview
workspace on a dot-grid ground (front/back segmented toggle, a zoom chip,
visibility/grid toggles, and a **live status bar** of readiness chips).

---

## 2. The design language (AUTHORITATIVE)

Everything below is expressed as Tailwind v4 `@theme` tokens in
`frontend/src/index.css`. **Components consume tokens through ordinary utility
classes — never inline hex, never a raw `#rrggbb` in a `.tsx` file.**

### 2.1 Strategy: re-point the existing token names, then add the new ones

ESPOD's semantic token names (`paper`, `surface`, `ink`, `ink-soft`, `line`,
`accent`, …) are used across ~60 files. Renaming them would be a huge
mechanical diff with a real chance of missing call sites. So instead:
**keep every existing token name and change its value**, then **add** the
reference tokens that have no ESPOD equivalent. One file edit re-skins the
entire app; per-page work then opts into the new tokens where the comps call
for them.

### 2.2 Colour

| Token | New value | Was | Role in the comps |
|---|---|---|---|
| `paper` | `#F8F9FF` | `#F7F7F9` | page ground (`surface` / `background`) |
| `surface` | `#FFFFFF` | `#FFFFFF` | cards, inputs, sheets (`surface-container-lowest`) |
| `surface-2` | `#EFF4FF` | `#F1F1F4` | tile grounds, subtle fills (`surface-container-low`) |
| `surface-3` | `#E5EEFF` | — | **new** — `surface-container` |
| `surface-4` | `#DCE9FF` | — | **new** — `surface-container-high`, icon circles |
| `surface-5` | `#D3E4FE` | — | **new** — `surface-container-highest`, footer ground |
| `surface-dim` | `#CBDBF5` | — | **new** — disabled tiles |
| `ink` | `#0B1C30` | `#101014` | body text (`on-surface`) |
| `ink-soft` | `#45464D` | `#6A6A77` | secondary text (`on-surface-variant`) |
| `ink-faint` | `#76777D` | `#9B9BA6` | tertiary text, placeholders (`outline`) |
| `line` | `#C6C6CD` | `#E4E4EA` | borders, dividers (`outline-variant`) |
| `primary` | `#000000` | — | **new** — headings + primary button ground |
| `on-primary` | `#FFFFFF` | — | **new** |
| `primary-container` | `#131B2E` | — | **new** — deep navy: primary-button hover, avatar ground |
| `accent` | `#006A61` | `#4F46E5` | **teal, replaces indigo** — links, focus rings, selected borders (`secondary`) |
| `accent-dark` | `#005049` | `#4338CA` | accent hover/press |
| `accent-soft` | `#86F2E4` | `#EEF2FF` | mint active state: sidebar pill, price badge, chips (`secondary-container`) |
| `on-accent-soft` | `#006F66` | — | **new** — text on `accent-soft` |
| `on-accent` | `#FFFFFF` | `#FFFFFF` | — |
| `inverse-surface` | `#213145` | — | **new** — toasts, tooltips |
| `inverse-on-surface` | `#EAF1FF` | — | **new** |
| `success` | `#15803D` | `#15803D` | unchanged — order-status green |
| `success-soft` | `#D3F4E4` | — | **new** |
| `warning` | `#D95F00` | `#B45309` | `on-tertiary-container` orange |
| `warning-soft` | `#FFDBCA` | — | **new** — `tertiary-fixed` |
| `danger` | `#BA1A1A` | `#DC2626` | `error` |
| `danger-soft` | `#FFDAD6` | — | **new** — `error-container` |
| `on-danger-soft` | `#93000A` | — | **new** — `on-error-container` |
| `star` | `#FFD700` | — | **new** — rating stars only |

**The one accent rule still holds, with the accent changed.** Teal (`accent`)
is the only chromatic colour used for interaction. Black (`primary`) is used
for primary button grounds and headings — it is *neutral*, not a second
accent. `warning` / `danger` / `success` are status-only and never decorative.

### 2.3 Type

Three families, matching the comps exactly:

```
--font-display: 'Hanken Grotesk', 'Segoe UI', system-ui, sans-serif;  /* headlines */
--font-sans:    'Inter', system-ui, -apple-system, sans-serif;        /* body */
--font-label:   'Geist', 'Inter', system-ui, sans-serif;              /* UI labels, buttons */
```

Named scale steps, declared as Tailwind v4 `--text-*` tokens so
`text-headline-lg` carries its own line-height / weight / tracking:

| Utility | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `text-headline-xl` | 48 / 56 | 700 | −0.02em | hero slide headline (desktop) |
| `text-headline-lg` | 32 / 40 | 600 | −0.01em | PDP H1, page H1 |
| `text-headline-md` | 24 / 32 | 600 | — | section headings, admin page title |
| `text-body-lg` | 18 / 28 | 400 | — | hero subcopy |
| `text-body-md` | 16 / 24 | 400 | — | body default |
| `text-body-sm` | 14 / 20 | 400 | — | secondary body, captions |
| `text-label-md` | 14 / 16 | 500 | +0.02em | buttons, nav, form labels |
| `text-label-sm` | 12 / 14 | 600 | — | badges, eyebrows, chips |

Mobile headline downshift: `text-headline-md md:text-headline-xl` for the hero,
`text-headline-md md:text-headline-lg` for H1s. Pair each with its family —
`font-display text-headline-lg`, `font-label text-label-md`.

### 2.4 Radius — much tighter than ESPOD's current scale

The comps use a deliberately flat 2/4/8/12px scale. `--radius-card` drops from
16px to 8px; this is the single largest visual change after the palette.

```
--radius-xs:   0.125rem  /*  2px */  hairline chips
--radius-sm:   0.25rem   /*  4px */  small controls, thumbnails
--radius-btn:  0.5rem    /*  8px */  buttons, inputs, option cards   (was 10px)
--radius-card: 0.5rem    /*  8px */  cards, tiles, gallery           (was 16px)
--radius-lg:   0.75rem   /* 12px */  large surfaces, image tiles
--radius-sheet:0.75rem   /* 12px */  bottom sheets, drawers          (was 24px)
--radius-pill: 9999px    /* true pill */
```

`rounded-pill` is for: admin sidebar nav rows, segmented-control thumbs, filter
and status chips, icon buttons, colour swatches, carousel dots, the header
search field, the cart-count badge.

### 2.5 Elevation, layout, motion

```
--shadow-card:   0 1px 2px rgb(11 28 48 / 0.04), 0 2px 8px  rgb(11 28 48 / 0.05)
--shadow-lift:   0 2px 4px rgb(11 28 48 / 0.06), 0 10px 28px rgb(11 28 48 / 0.10)
--shadow-sheet:  0 -4px 24px rgb(11 28 48 / 0.12)
--shadow-canvas: 0 4px 20px -2px rgb(15 23 42 / 0.08)      /* new — admin preview canvas */
```

Layout: page container is **`max-w-7xl` (1280px)**, up from `max-w-6xl`.
Gutters `px-4 md:px-10` (16px / 40px, matching the comps' margin tokens).
Section rhythm `py-10 md:py-16`.

Motion tokens (`--dur-fast|base|slow`, `--ease-out-soft`, `--ease-spring`), the
`animate-*` keyframes, the `duration-*` / `stagger-delay` `@utility`
declarations and the `prefers-reduced-motion` override in `index.css` are
**unchanged and still mandatory**. Two idioms adopted from the comps:

- **Press feedback:** `active:scale-95` on every button and icon button.
- **Hover-reveal rail arrows:** `opacity-0 group-hover:opacity-100` on a
  `group` wrapper — a pointer-only affordance that never blocks touch scroll.
- **Image zoom on hover:** `group-hover:scale-105 duration-slow ease-out-soft`.

### 2.6 Icons — Material Symbols Outlined

The comps use Google's Material Symbols Outlined variable font throughout
(with the `FILL` axis toggled for emphasis). ESPOD currently hand-rolls inline
SVGs per file, so the icon language is inconsistent and duplicated.

**Decision:** one `<Icon>` component backed by the webfont, loaded
**subsetted** via Google Fonts' `icon_names=` parameter so we ship ~20KB
instead of the ~340KB full set. The subset list lives in exactly one place
(`components/ui/iconNames.ts`) and a test asserts every `<Icon name="…">`
literal in the codebase is in it — so a typo or an unlisted icon fails CI
instead of rendering the literal word "favorite" to a shopper.

```tsx
// components/ui/Icon.tsx
<Icon name="shopping_cart" />                 // 24px, inherits color
<Icon name="star" size={16} fill />           // filled variant
```

Always `aria-hidden="true"` on the glyph (the ligature text would otherwise be
read out, and would pollute `getByText` in tests); the accessible name comes
from the surrounding button's `aria-label`.

Existing hand-rolled SVGs are replaced with `<Icon>` **only in files a
workstream is already rewriting**. No repo-wide sweep this round.

---

## 3. Complete feature gap (everything the comps do that ESPOD does not)

Legend: **BUILD** = in the minimal cut (§4). **DEFER** = documented, not built
this round, with the reason.

### 3.1 Storefront chrome

| # | Feature in comp | ESPOD today | Call |
|---|---|---|---|
| C1 | Two-row header; row 2 is a **persistent full-width pill search field** | search icon → modal overlay | **BUILD** |
| C2 | Free-text product search | none — `GET /api/products` has no `q`; header modal filters 100 rows client-side | **BUILD** (`?q=`) |
| C3 | **Hover mega-menus** — 5 top-level groups, each a 400–800px multi-column panel of subcategories | one flat "Categories" dropdown list | **BUILD** as a multi-column panel over the flat category list (a real subcategory tree needs a `categories` hierarchy — that's schema work) |
| C4 | Cart icon with a bare dot indicator | numeric badge | keep ESPOD's (numeric is strictly better) |
| C5 | Footer: 2–4 link columns + social glyphs + copyright bar | already richer (4 columns + payment badges + socials) | restyle only |
| C6 | Announcement strip | present | restyle only |

### 3.2 Home page

| # | Feature in comp | ESPOD today | Call |
|---|---|---|---|
| H1 | **Hero carousel** — 5 auto-advancing full-bleed slides, arrows, dots | static split hero (copy + product composition) | **BUILD**, category-driven |
| H2 | **Value-prop band** — 3 items, circular icon + title + subtitle, divided | `TrustStrip`, numeric eyebrows, no icons | **BUILD** (restyle to the comp) |
| H3 | **Category rail** — small square tiles, horizontal snap-scroll | 4-up static grid | **BUILD** |
| H4 | **Product rails** — snap-scroll, hidden scrollbar, hover arrow | grids only | **BUILD** (one reusable `ProductRail`) |
| H5 | **"BUY 100 @ Rs.450" price-break pill** on tiles | none | **BUILD** — real data: `min_order_qty` + lowest price break |
| H6 | "Our Most Popular Products" / "Trending" rails | none | **DEFER** — no popularity signal exists. Fabricating one is dishonest; a real one means aggregating `orders.items_json`. Ship **"New arrivals"** instead (`created_at DESC`, already the API default — honest and free) |
| H7 | **"Your recently viewed items"** rail | none | **BUILD** — localStorage, genuinely real |
| H8 | **Wishlist heart** on every tile | none | **DEFER** — a heart with no wishlist page is a dead-end control; needs auth-backed persistence + a `/wishlist` route to be worth anything |
| H9 | `mix-blend-multiply` mockups on a tinted ground | `object-contain` on a neutral ground | keep ESPOD's — multiply only works on pure-white source photos and silently muddies anything else |

### 3.3 Product page

| # | Feature in comp | ESPOD today | Call |
|---|---|---|---|
| P1 | **Thumbnail strip** under the main image, active thumb ringed teal | dot indicators | **BUILD** |
| P2 | **"Key Features" bullet box** — bordered, uppercase teal eyebrow | none | **BUILD** — new `products.highlights` column, admin-edited |
| P3 | **"38% OFF" badge** beside the strikethrough price | strikethrough only | **BUILD** (computed) |
| P4 | **Size cards in a grid showing `+₹50.00`** | flat chips, delta hidden | **BUILD** — `price_delta` already exists |
| P5 | **Colour swatch row** (axis 2) | API returns `variants`; storefront ignores them entirely | **BUILD** — POD-V2 Phase 2.3/2.4/2.5 |
| P6 | Gallery swaps on colour selection | — | **DEFER** — POD-V2 Phase 2.1 (per-variant photos + the aspect-ratio print-registration guard). That guard is the trap; it deserves its own round |
| P7 | **Quantity `<select>` with "(Save 10%)"** + "Show pricing guide" link + a price-break table | none | **DEFER** — POD-V2 Phase 3. Showing "₹320/unit at qty 2" while `computeLine` charges `base_price` is a **false price claim** that would fail the server's own `price_mismatch` guard at checkout. All-or-nothing; the "all" is a security-critical two-pass pricing rewrite |
| P8 | **Minimum order quantity** as the quantity floor | `min_order_qty` column exists, unenforced anywhere | **BUILD** — client floor **and** server enforcement (POD-V2 Phase 3.3, independent of P7) |
| P9 | **Star rating + review count + 3-up reviews grid** | none | **DEFER** — needs a `reviews` table, submission, moderation, and aggregate caching. Inventing reviews for a demo is exactly what this repo already refuses to do elsewhere |
| P10 | **Delivery-speed cards** (Standard / Same Day) + **pincode estimate** | fixed honest "Made to order — ships in 3–5 days" | **DEFER** — no shipping-method or serviceability data model |
| P11 | **"Frequently bought together"** rail | none | **BUILD** as **"You may also like"** — same category, `?exclude=` the current product. Both params already exist; co-purchase data does not |
| P12 | "Your recently viewed items" rail on the PDP | none | **BUILD** (same component as H7) |
| P13 | Chevron breadcrumbs | slash breadcrumbs | restyle only |
| P14 | Upload-photo CTA with an instant preview overlay | full Fabric customizer, far richer | keep ESPOD's |

### 3.4 Admin

| # | Feature in comp | ESPOD today | Call |
|---|---|---|---|
| A1 | **280px sidebar**, pill nav rows, mint active state, brand + tagline block, user block with avatar pinned bottom | 240px, 8px-radius rows, plain name/role/sign-out | **BUILD** (restyle) |
| A2 | **Sticky top app bar** — back arrow, title, status chip, "Save Draft" / "Publish Changes" pills | plain `<h1>`, per-section save buttons | **BUILD** (chrome only — the per-section save model stays; a single global save is a different, larger refactor) |
| A3 | **Two-pane editor** — 420px scrolling config column + preview workspace on a dot-grid ground | one long scrolling column with a small `PreviewCheck` card | **BUILD** — sticky right rail at `xl`, stacked below it |
| A4 | **Live status bar** — readiness chips ("Assets Validated", "Pricing Defined", "Customization Rules (2/4)") | none | **BUILD** — all four chips derivable from real product rows |
| A5 | Preview **front/back segmented toggle**, zoom chip, visibility + grid toggles | none | **BUILD** front/back toggle + print-area grid overlay toggle; **DEFER** zoom (the shopper-facing customizer owns real zoom) |
| A6 | **Customization option cards** — icon tile + title + description + checkbox, selected = 2px border | plain checkbox + label per capability block | **BUILD** (restyle the four existing blocks; invent no new flags) |
| A7 | Comp's specific flags: "Browse designs" / "Upload design" / "Add text" toggles | model is per-*side* `customizable` | **DEFER** — three new columns + editor gating for a capability the editor doesn't currently branch on |
| A8 | **Quantity-tier rows** showing line total + per-unit + "3% savings" | `ProductPriceBreaksEditor`: bare min-qty + unit-price inputs | **BUILD** (restyle; savings computed against the first tier) |
| A9 | **Segmented Active / Out-of-Stock control** | `<select>` | **BUILD** as Active / Draft (the real status values) — `components/ui/SegmentedControl` already exists |
| A10 | **Dashed upload dropzone** + uploaded-file row with delete | `ImageUploader` | **BUILD** (restyle) |
| A11 | Admin footer bar (copyright + support links) | none | **BUILD** (cheap) |
| A12 | Sidebar entries "Gallery", "Promo Headlines", "Running Banners", "Cart" | none | **DEFER** — each is a whole feature (CMS banners, promo copy, admin-side cart) |
| A13 | Context-sensitive FAB | none | **DEFER** — no action it would plausibly perform |

### 3.5 Deferred-work summary (for whoever plans the next round)

Ordered by value/cost: **P7 bulk-pricing storefront + POD-V2 Phase 3**
(highest value, highest care — money path) → **P9 reviews** → **P6 per-variant
photos (POD-V2 Phase 2.1)** → **H8 wishlist** → **A12 admin banners / promo
copy** → **C3 true category hierarchy** → **P10 delivery options** → **A7
per-capability customization flags** → **H6 popularity signals**.

---

## 4. The minimal cut we build, as contracts

### 4.1 API contracts (worker) — build the frontend against these exactly

**`GET /api/products`** gains:

- **`q`** (query, optional, trimmed, max 100 chars). Case-insensitive
  substring match on `name`. Combines with `category` / `exclude` with `AND`.
  Empty/whitespace = ignored. `%` and `_` must be escaped (`ESCAPE '\'`) so a
  shopper typing `%` doesn't match everything.
- Two new fields on every row:
  - `back_image: string | null` — `product_sides.image_url WHERE side='back'`
    (a second `LEFT JOIN`). Feeds `ProductCard`'s already-plumbed-but-unused
    `back_image_url` hover swap.
  - `min_order_qty: number`
  - `lowest_break: { min_qty: number; unit_price: number } | null` — the
    `product_price_breaks` row with the **smallest `min_qty`** for that product,
    or `null` when the product has no tiers. **One grouped subquery, not N+1.**

**`GET /api/products/:id`** gains `highlights: string` (see below). Already
returns `variants` and `price_breaks`.

**New column** `products.highlights TEXT NOT NULL DEFAULT ''` — newline-
separated bullet lines, rendered as the P2 "Key Features" box when non-empty.
Requires: `migrations/schema.sql` (column + `'0017_product_highlights.sql'`
appended to the `_migrations` bookkeeping INSERT), a matching `MIGRATIONS`
entry in `lib/migrate.ts` (`ALTER TABLE products ADD COLUMN …`), a
`generate:schema` run, and the admin product `PUT` accepting it. Cap at 2000
chars server-side; a max of 8 non-empty lines is a client-side courtesy.

**Cart line / checkout gains `variant`:**

- `POST /api/checkout` line inputs accept `variant?: string | null`.
- `computeLine` gains a `variant: PricingVariant | null` arg (`{ label }`) and
  **`ComputeLineArgs.input.variant`**. Validation: if `input.variant` is
  non-empty and no matching `product_variants` row was found → `invalid_variant`
  (exactly mirroring the existing `invalid_size` rule). The resolved item
  carries `variant: string | null`.
- **`variant` MUST NOT touch any price.** Axis 2 bears no delta (POD-V2 §3.1).
  `unit_price` stays `base_price + size_delta + print_fee_total`. A test must
  pin that adding a variant to a line changes no monetary field.
- `items_json` therefore carries the variant label; admin order detail and
  account order history display it.

**`min_order_qty` enforcement (POD-V2 Phase 3.3):** in `computeLine`, after the
product row resolves, `input.quantity < product.min_order_qty` →
`{ ok: false, error: 'below_min_order_qty' }`. `PricingProduct` gains
`min_order_qty`, and checkout's product `SELECT` must fetch it. Needs tests for
the boundary (`qty === min` passes, `min - 1` fails) and for the default
`min_order_qty = 1` leaving every existing case untouched.

### 4.2 Cart store contract (frontend)

`CartLine` gains `variant: string | null`. `cartLineKey` becomes
`${product_id}:${size ?? '-'}:${variant ?? '-'}:${design_id ?? 'plain'}`, and
`ServerQuoteItem` / `reconcilePricing` must key the same way. **Bump the
persisted store `version` 2 → 3** with `migrate: () => ({ lines: [] })` — live
shoppers hold v2 keys in `localStorage` and a silent key change would corrupt
their carts (POD-V2 §11 2.4). `POST /api/checkout` sends `variant` per line.

`/customize/:id` accepts **`?variant=`** alongside `?size=`; `CustomizePage`
reads it and passes `initialVariant` to `CustomizerEditor`, which threads it
into its `addLine` call. That is the *only* editor change this round.

### 4.3 New shared frontend modules

| Path | What |
|---|---|
| `components/ui/Icon.tsx` | Material Symbols glyph — `name`, `size` (default 24), `fill`, `className`; always `aria-hidden` |
| `components/ui/iconNames.ts` | `ICON_NAMES` — the sorted subset list, also the `icon_names=` source of truth for `index.html`; `IconName` type derived from it |
| `components/ui/__tests__/iconNames.test.ts` | every `<Icon name="X">` literal in `src/**` is in `ICON_NAMES` (via `import.meta.glob('?raw')`, same idiom as `noInternalDocRefs.test.ts`) |
| `components/ProductRail.tsx` | horizontal snap-scroll rail: `title`, optional `viewAllHref`, `children`; hidden scrollbar, hover-reveal left/right arrow buttons that `scrollBy` a page, arrows hidden when not scrollable and on touch |
| `lib/recentlyViewed.ts` | `recordView(id)` / `readRecentlyViewed(): number[]` — localStorage, cap 12, most-recent-first, dedup, every access `try/catch`-guarded (private browsing throws) |
| `components/home/HeroCarousel.tsx` | see 4.4 |

### 4.4 Hero carousel behaviour (H1) — non-negotiable details

Slides come from `GET /api/categories` — the first **up to 5** categories that
have an `image`. Fewer than 2 → render a single static slide with no
carousel chrome. Zero → fall back to the existing copy-led hero (never an
empty 600px box).

- Track is a `flex` row translated by `-${i * 100}%`, `duration-slow`.
- Autoplay 5s. **Paused** on pointer-enter, on focus anywhere inside, when
  `document.hidden`, and **entirely disabled** under
  `matchMedia('(prefers-reduced-motion: reduce)')`.
- Prev/next buttons: `opacity-0 group-hover:opacity-100`, `aria-label`led,
  wrapping. Dots: real `<button>`s, `aria-label="Go to slide N"`,
  `aria-current` on the active one.
- Copy per slide: category name as `text-headline-md md:text-headline-xl`
  white with `drop-shadow-lg`, one honest line of subcopy (`"{n} products"` —
  the count is real), and a "Shop {category}" CTA linking to
  `/shop?category=…` on a `bg-primary-container text-on-primary` ground.
- `h-[420px] md:h-[600px]`. Slide images `object-cover` with a `bg-primary/20`
  scrim so white text always clears WCAG AA.
- Clear the autoplay interval on unmount.

### 4.5 Price-break pill (H5) — the honesty rule

Render on a product tile **only** when the API gave a real number:

- `lowest_break` present → **`BUY {min_qty} @ {currency}{unit_price}`**
- else `min_order_qty > 1` → **`MIN {min_order_qty} UNITS`**
- else → **render nothing.** Never a made-up quantity, never a bare
  `base_price` dressed up as a bulk price.

Styling: `absolute left-2.5 top-2.5`, `bg-accent-soft text-on-accent-soft
text-label-sm rounded-pill px-3 py-1 shadow-card`.

### 4.6 Admin readiness chips (A4) — each must be derived, never hardcoded

| Chip | Green when | Otherwise |
|---|---|---|
| Mockups | every side has a non-empty `image_url` | pending — "Add a mockup for each side" |
| Print areas | every **customizable** side has `print_w > 0 && print_h > 0` | pending |
| Pricing | `base_price > 0` | pending |
| Options | count of configured blocks — renders as `Options (n/4)`, green at `n ≥ 1` | neutral at 0 |

Green = `bg-accent-soft/40 border-accent/20 text-ink` with a filled
`check_circle`; pending = `bg-surface-4 border-line text-ink-soft` with
`pending`.

---

## 5. Task plan

Ownership is **by file**, so the five workstreams can run concurrently without
touching each other's lanes. Every workstream ends with `tsc -b` clean and both
suites green.

**Baseline at the start of this round:** frontend `tsc -b` clean, **371**
frontend tests / 30 files passing, **157** worker tests / 11 files passing.

### WS-0 — Design system foundation (must land before A–D)

- [x] **0.1** `frontend/src/index.css`: replace the `@theme` colour block per
      §2.2, the font families and the `--text-*` scale per §2.3, the radius
      scale per §2.4 and the shadows per §2.5. Keep motion tokens, keyframes,
      the `@utility` declarations, `@source not`, the reduced-motion override
      and the base `html`/`body`/`::selection`/`:focus-visible`/scrollbar rules.
      Add `.material-symbols-outlined` base rule + the admin dot-grid helper.
- [x] **0.2** `frontend/index.html`: Hanken Grotesk + Inter + Geist, and
      Material Symbols Outlined subsetted with `icon_names=` matching
      `ICON_NAMES` exactly.
- [x] **0.3** `components/ui/Icon.tsx`, `components/ui/iconNames.ts` and the
      subset-coverage test (§4.3).
- [x] **0.4** `lib/types.ts`: add `highlights`, `back_image`, `min_order_qty`
      and `lowest_break` to the catalog types up front so every frontend
      workstream can compile against the §4.1 shapes before the worker lands.

### WS-A — Storefront chrome
*Owns: `components/Header.tsx`, `AnnouncementBar.tsx`, `Footer.tsx`, `MobileBottomNav.tsx`, `Button.tsx`, `Field.tsx`, `SelectField.tsx`, `ToggleField.tsx`, `Toaster.tsx`, `components/ui/{Badge,IconButton,SegmentedControl,Sheet,Skeleton}.tsx`, `lib/storeConfig.ts`*

- [x] **A.1** `Button` / `IconButton` / `Badge` to §2 (black `primary` ground,
      `rounded-btn`/`rounded-pill`, `font-label`, `active:scale-95`).
- [x] **A.2** Header → two rows on desktop: row 1 wordmark + mega-menu nav +
      account/cart, row 2 the persistent pill search field (C1). Mobile keeps
      one row + the sheet. Condense-on-scroll stays.
- [x] **A.3** Mega-menu panel (C3): a wide multi-column dropdown over the flat
      `GET /api/categories` list, opening on hover **and** on click/Enter,
      keeping the existing Escape / arrow-key / outside-pointerdown handling.
      Never an empty panel.
- [x] **A.4** Header search hits `?q=` (C2/§4.1) with a ~250ms debounce and a
      results dropdown; Enter → `/shop?q=…`. Keep the mobile sheet.
- [x] **A.5** Footer + announcement bar + mobile bottom nav restyled;
      `surface-5` footer ground.

### WS-B — Home page
*Owns: `pages/HomePage.tsx`, `components/home/**`, `components/ProductCard.tsx`, `ProductGrid.tsx`, `ProductRail.tsx`, `Skeleton.tsx`, `lib/recentlyViewed.ts`*

- [x] **B.1** `ProductRail` primitive (§4.3).
- [x] **B.2** `HeroCarousel` (§4.4), replacing `Hero`.
- [x] **B.3** `TrustStrip` → the comp's value-prop band (H2): `<Icon>` in a
      `surface-4` circle, title, subtitle, `md:divide-x`.
- [x] **B.4** `ShopByCategory` → a category rail (H3).
- [x] **B.5** `ProductCard`: price-break pill (H5, §4.5), `% OFF` badge,
      `back_image_url` hover swap now that the API returns it.
- [x] **B.6** "New arrivals" rail (H6's honest substitute) + keep the featured
      grid.
- [x] **B.7** `recentlyViewed` + the "Recently viewed" rail (H7), rendered only
      when ≥ 1 stored id resolves to a real product.

### WS-C — Product page, shop, cart
*Owns: `pages/ProductPage.tsx`, `ShopPage.tsx`, `CustomizePage.tsx`, `CheckoutPage.tsx`, `components/CartDrawer.tsx`, `store/cartStore.ts`, `pages/account/AccountOrdersPage.tsx`, and `initialVariant` only in `editor/CustomizerEditor.tsx`*

- [x] **C.1** Gallery → thumbnail strip (P1), keeping the native scroll-snap
      track and dots on mobile.
- [x] **C.2** "Key Features" box (P2) from `highlights`, split on newlines,
      hidden when empty.
- [x] **C.3** `% OFF` badge (P3); size cards in a grid with `+₹delta` (P4).
- [x] **C.4** Variant picker (P5) with all three degradation states — swatch
      chips when `swatch_hex` is set, plain labelled pills when it isn't, mixed
      handled per-option. Labelled with `axis2_label`. Required to proceed when
      variants exist, exactly like size.
- [x] **C.5** Cart-line `variant` + key + **version bump to 3** (§4.2);
      `variant` sent at checkout; shown in the cart drawer, checkout summary,
      order success and account order history.
- [x] **C.6** `min_order_qty` as the quantity floor (P8) — initial qty, stepper
      lower bound, and a one-line note when `> 1`.
- [x] **C.7** "You may also like" rail (P11) via
      `?category=…&exclude=…&limit=8`; render nothing when empty.
- [x] **C.8** `recordView` on the PDP + the "Recently viewed" rail (P12).
- [x] **C.9** ShopPage restyled; reads `?q=` from the URL and passes it to the
      API; the query is visible and clearable in the filter bar.
- [x] **C.10** `?variant=` → `initialVariant` → the editor's `addLine` (§4.2).

### WS-D — Admin
*Owns: `admin/**`*

- [x] **D.1** `AdminLayout`: 280px sidebar, pill nav with the mint active
      state, brand + tagline, avatar user block, admin footer bar (A1/A11).
- [x] **D.2** A reusable admin page header (A2): back arrow, title, status
      chip, action slot. Applied to product edit, template edit, order detail.
- [x] **D.3** `AdminProductEdit` → two panes (A3): a scrolling config column
      and a sticky preview workspace on the dot-grid ground with the front/back
      segmented toggle and a print-area grid overlay toggle (A5).
- [x] **D.4** Readiness chips (A4, §4.6).
- [x] **D.5** Capability blocks → option cards (A6); status → `SegmentedControl`
      (A9).
- [x] **D.6** `ProductPriceBreaksEditor` rows show line total, per-unit and
      savings vs. the first tier (A8). `ProductSizesEditor` /
      `ProductVariantsEditor` / `CategoryCombobox` / `ImageUploader` (A10)
      restyled.
- [x] **D.7** `highlights` textarea in Basics, with the 8-line / 2000-char
      guidance (P2's data source).
- [x] **D.8** Remaining admin screens (dashboard, products, orders, order
      detail, customers, settings, templates, login) brought onto §2.

### WS-E — Worker
*Owns: `worker/**`*

- [x] **E.1** `?q=` on `GET /api/products` (§4.1) with `ESCAPE`-safe LIKE
      + tests.
- [x] **E.2** `back_image`, `min_order_qty`, `lowest_break` on the list
      endpoint — one grouped subquery, no N+1 + tests.
- [x] **E.3** `products.highlights`: `schema.sql`, the `_migrations`
      bookkeeping name, the `0017` `MIGRATIONS` entry, `generate:schema`,
      `GET /api/products/:id`, admin `PUT`, `types.ts` + tests.
- [x] **E.4** `variant` through checkout + `computeLine` (§4.1) — validated,
      echoed into `items_json`, and **pinned by a test as price-neutral**.
- [x] **E.5** `min_order_qty` enforcement in `computeLine` + boundary tests
      (POD-V2 Phase 3.3).

### WS-F — Verification (after A–E)

- [x] **F.1** `tsc -b` clean in both packages; both suites green; `vite build`
      clean; Fabric still out of the main chunk
      (`adminBundleComposition.test.ts` still passes).
- [~] **F.2** Verified live against `wrangler dev` on the real local D1
      catalogue at the **API and asset layer**, which is where this round's
      risk actually sits (see §7): `0017` applied over a pre-existing
      database, the list endpoint's new fields on products both with and
      without tiers, `?q=` including the `%`/`_` escape (a literal `%`
      returns 0 rows, not the whole catalogue), `invalid_variant`,
      `below_min_order_qty`'s exact 99/100/1 boundary, variant
      price-neutrality proven by identical `unit_price`/`line_total` with
      and without one, and the shipped CSS carrying the §2 tokens with zero
      remaining indigo. **Still outstanding: rendered-pixel review in a real
      browser at desktop and mobile widths** — no screenshots were taken,
      so visual regressions (spacing, the mega-menu's diagonal hover gap,
      the admin two-pane rail at `xl`) remain unverified by eye.
- [x] **F.3** Update `POD.md` §13 and `README.md`'s doc index with a pointer
      row; mark POD-V2 §11 items 2.3/2.4/2.5/3.3 as landed here; record
      decisions in §7 below.

---

## 6. Frozen — do not touch this round

- **`lib/pricing.ts`'s money arithmetic.** `variant` and `min_order_qty` are
  additive *validation*; `unit_price` / `line_total` / `computeShipping` /
  `computeOrderQuote` / `pricesMatch` keep their exact current behaviour. Bulk
  tier pricing is POD-V2 Phase 3 and is **not** in this round.
- **The customizer's geometry.** `editor/geometry.ts`, `EditorStage.tsx`,
  `fabric/**`, `preview.ts`, `shading.ts`, `canvasGutter.ts` — untouched apart
  from `CustomizerEditor`'s `initialVariant` prop.
- **The print-file pipeline.** `admin/print/**`, `renderPrintFile`, print
  normalized-coordinate maths.
- **`product_sides.side`** stays the fixed `'front' | 'back'` identity.
- **Design templates** (POD-V2 Phase 4) — shipped and working; restyle only.
- The `prefers-reduced-motion` override, the 44px minimum touch target, and the
  "no internal plan-doc references in rendered text" rule
  (`noInternalDocRefs.test.ts`) all still apply.

---

## 7. Key Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-09-10 | **Re-point the existing token *names* to the reference palette rather than renaming tokens app-wide** | `ink`/`paper`/`accent`/`line` are referenced in ~60 files. Changing values in one `@theme` block re-skins everything atomically with zero chance of a missed call site, and lets each workstream opt into the genuinely new tokens (`surface-3..5`, `primary`, `accent-soft`, `star`) where the comps need them. A rename would have been a multi-thousand-line mechanical diff competing with five concurrent workstreams. |
| 2026-09-10 | **Accent moves from indigo `#4F46E5` to teal `#006A61`; black `#000000` becomes the primary button/heading ground** | This is the comps' actual system: black for weight, one teal for interaction, mint `#86F2E4` for active states. Black is neutral, so the "exactly one accent" rule from the original design system survives intact. |
| 2026-09-10 | **`--radius-card` 16px → 8px, `--radius-sheet` 24px → 12px** | The comps' 2/4/8/12 scale is the second-most-recognizable thing about them after the palette. Keeping ESPOD's soft 16px cards would have read as a different product wearing borrowed colours. |
| 2026-09-10 | **Material Symbols adopted, but subsetted via `icon_names=` and guarded by a coverage test** | The comps' icon language is a real part of the design. The full variable font is ~340KB — unshippable. Subsetting drops it to ~20KB, and its failure mode (an unlisted icon renders as the literal word "favorite" to a shopper) is silent, so a test asserting every `<Icon name>` literal is in `ICON_NAMES` turns it into a CI failure instead. |
| 2026-09-10 | **Bulk-pricing storefront UI (comp's quantity `<select>` with "(Save 10%)" and the price-break table) deliberately NOT built** | `computeLine` charges `base_price + size_delta + print_fees`. Rendering a tier price the server won't honour is a false price claim that the server's own `price_mismatch` guard would reject at checkout — a broken order, not a cosmetic gap. It is all-or-nothing with POD-V2 Phase 3's security-critical two-pass rewrite. The *pattern* is still adopted where the data is already real: the admin tier editor now shows per-unit price and savings. |
| 2026-09-10 | **`min_order_qty` (Phase 3.3) shipped even though the rest of Phase 3 is deferred** | It is independent of tier pricing, it is ~10 lines plus tests in `computeLine`, and a client-only floor would be a merchant-policy hole. It makes a column that has existed unused since Phase 1 actually mean something. |
| 2026-09-10 | **Axis 2 (variants) shipped to the storefront; per-variant photos (Phase 2.1) deferred** | The picker is pure presentation — axis 2 carries no price by design, so it never enters the pricing engine. Per-variant photos are a different problem: the aspect-ratio guard against the side default is the print-registration trap POD-V2 §3.2 flags, and it deserves a round with its own tests rather than riding along on a visual pass. |
| 2026-09-10 | **"Most Popular" / "Trending" rails replaced with "New arrivals"; reviews and wishlist deferred** | Popularity needs a signal ESPOD doesn't collect, reviews need a table plus moderation, and a wishlist heart with no wishlist page is a control that does nothing. `created_at DESC` is already the list endpoint's default, so "New arrivals" is both free and true. This repo already refuses to fabricate testimonials and review copy elsewhere; the same rule applies to merchandising signals. |
| 2026-09-10 | **Cart persisted-store `version` bumped 2 → 3 with a discarding migration** | `cartLineKey` gains a `variant` segment. A live shopper's `localStorage` holds v2 keys; silently reading them under the new format would mismatch on `reconcilePricing` and corrupt totals. Discarding is the same call Phase 7 made going 1 → 2, and for the same reason. |
| 2026-09-10 | **Admin keeps its per-section save model despite adopting the comp's "Save Draft / Publish Changes" top bar** | The bar is chrome that gives the editor a spine and a visible status; a single global save across five independently-`PUT`-ing editors (basics, sizes, variants, price breaks, sides) is a state-management refactor with real regression risk, and it buys nothing this round. The top-bar action slot holds each screen's existing primary action instead. |
| 2026-09-10 | **WS-E: `lowest_break` computed by a grouped LEFT JOIN inside the existing list query, not a second round trip** | Two nested subqueries (`GROUP BY product_id` for the smallest `min_qty`, joined back to `product_price_breaks` for that tier's `unit_price`) run once for the whole page regardless of product count — zero additional queries beyond the pre-existing count+select pair, and no per-product query at all. The flat `lowest_break_min_qty`/`lowest_break_unit_price` columns D1 returns are assembled into the nested `lowest_break` object in exactly one place (`mapProductListRow`), which is what's actually unit-tested — this repo has no D1/SQLite test harness (see `migrate.test.ts`'s header), so the JOIN's SQL text is reviewed rather than executed in a test, matching the existing `categories.ts`/`templates.ts` split of "SQL fetches, a pure JS function shapes and is tested." |
| 2026-09-10 | **WS-E: `?q=` uses `LIKE ? ESCAPE '\'` with `%`/`_`/`\` all escaped, no `LOWER()`** | SQLite's `LIKE` is already case-insensitive for ASCII, so a `LOWER()` on both sides would be a no-op that only costs a table scan hint. Escaping is the actual security/correctness requirement — an unescaped `%` in a shopper's search term would silently become a wildcard matching the entire catalogue. |
| 2026-09-10 | **WS-E: `variant` validation added to `computeLine` as a third required arg (`PricingVariant \| null`), not an optional one** | Matches the existing `size`/`design` pattern exactly (both are required, non-optional args resolved by the caller before calling in) rather than defaulting inside the function — keeps `checkout.ts` as the only place that decides "no variant requested" vs. "variant requested but not found," which is exactly where the DB lookup already happens for `size`. |
| 2026-09-10 | **WS-E: `min_order_qty` check placed immediately after the product-resolution / status check, before the size and variant checks** | Per POD-UI4.md §4.1's exact instruction ("after the product row resolves and after the existing quantity sanity check"). Ordering relative to `invalid_size`/`invalid_variant` doesn't change behavior for any single-violation input, but keeps the floor check adjacent to the other product-level checks rather than interleaved with the two option-axis checks. |
| 2026-09-10 | **`mockupsReady` given an explicit `sides.length === 0` guard during integration** | §4.6 said "every side has a non-empty `image_url`", which `[].every(...)` satisfies vacuously — so a product with no side rows at all, the least-ready state a product can be in, lit the chip green. `printAreasReady` deliberately keeps its vacuous case, because "no customizable sides" genuinely *is* finished for a plain mug. Pinned by a test naming the regression |
| 2026-09-10 | **The customizer's add-to-cart now starts at `min_order_qty`, not a hardcoded `quantity: 1`** | Found during integration, and it was a dead end rather than a blemish: with the floor now enforced server-side, a shopper could spend minutes designing a customizable product whose merchant set a minimum, then get a cart that checkout refuses — recoverable only by guessing the cart drawer's stepper was the fix. Deliberately NOT clamped against stock: if stock is below the merchant's own required minimum, that is a real conflict in the merchant's data and should surface, not be silently rounded away |
| 2026-09-10 | **`variant` added to `GET /api/orders/:id/previews`' PII allow-list** | That route allow-lists preview-safe fields precisely so PII on the `orders` row can never leak, so adding a field to it is a security-relevant decision, not a display tweak. `variant` qualifies for exactly the reason `size` does: an opaque option label the shopper themselves selected. Without it, a shopper who hard-refreshed the confirmation page watched the line lose its colour/finish while the router-state path from checkout kept it — the same field appearing or vanishing depending on how the page was reached |
| 2026-09-10 | **The design-system demo page's palette row reads CSS custom properties instead of literal hex** | It had silently gone stale across the indigo → teal change: a page whose entire job is showing what the design system *is* was displaying a palette that no longer existed. A stale `EditorStage.tsx` comment quoting the old `bg-paper`/`bg-surface-2` hex values was corrected the same way — by dropping the values rather than restating them |
| 2026-09-10 | **Live verification confirmed the P7 bulk-pricing deferral was the right call, not just the cautious one** | The seeded catalogue has a visiting card with real tiers (100 @ ₹8) and `base_price` ₹100. `POST /api/checkout` for 100 units quotes **₹10,000** — `base_price × qty`, exactly as `computeLine` is written. Had the storefront rendered that product's tier price, the shopper would have been shown ₹800 and then charged ₹10,000, which the server's own `price_mismatch` guard rejects: a broken order, not a cosmetic gap. That product also happens to be the ideal axis-2 test case — renamed axes ("Card size" / "Finish") and `swatch_hex: NULL` on both options, i.e. the plain-labelled-pill degradation POD-V2 §3.1 requires |
