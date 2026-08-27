# POD-UI2.md — Ecommerce Depth, Brand Rename (ESPOD)

> **Goal:** The app works and is now consistent (POD-UI.md), but the storefront still reads as a SaaS landing page rather than a shop. This round adds real ecommerce structure, upgrades the visual quality, and renames the brand to **ESPOD**.
>
> **Frozen, unchanged from POD-UI.md §6:** editor geometry, `editor/fabric/**`, `preview.ts`, `designSchema.ts`, `designApi.ts`, `admin/print/**`, and all pricing/auth logic in `worker/**` except the explicit rename touchpoints listed in §2.

---

## 1. Critique — from actual rendered screenshots, not assumption

Captured at 1280×900 and 390×844 against a running local build.

| # | Problem | Detail |
|---|---|---|
| 1 | **Hero is text-only** | Badge → wordmark → one line → button, then a full viewport of empty space. No product imagery anywhere above the fold. This is the single biggest reason it doesn't read as a store. |
| 2 | **No ecommerce furniture** | No category navigation, no search, no trust/USP strip, no social proof, no promotional band, no newsletter, no real footer. Header contains exactly one link ("Shop"). |
| 3 | **Inconsistent product imagery** | Cards render on mismatched grounds — white, cream, cream, white — so the grid looks unintentional. |
| 4 | **Placeholder mockups are poor** | The Classic Tee reads as a black blob with an arrow spike (bad sleeve polygons in the generation script). Mug and polo are flat and lifeless. |
| 5 | **"How it works" is present but weak** | Flat grey band, small numbered dots, no icons or imagery. On mobile it becomes a very tall stack with large dead gaps. |
| 6 | **Product cards lack commerce cues** | No hover state, no secondary image, no "from ₹", no rating, no quick-add affordance on desktop. |
| 7 | **Shop page is bare** | No sort control, no result count, no filters beyond category chips. |
| 8 | **Footer is thin** | A tagline and two links. |

---

## 2. Brand rename: EdgeShop → ESPOD

Every user-visible occurrence. Known touchpoints (grep for `EdgeShop` before assuming this list is complete):

| File | Change |
|---|---|
| `frontend/index.html` | `<title>`, `og:site_name`, meta description |
| `frontend/src/lib/useSettings.ts` | default `store_name` fallback |
| `frontend/src/pages/CheckoutPage.tsx` | `store_name` fallback |
| `worker/migrations/schema.sql` | seeded `store_name`, `email_from_name` |
| `worker/src/lib/migrate.ts` | new migration updating existing rows still holding `'EdgeShop'` |
| `README.md`, `project.md`, `DEPLOY.md`, `cloudflare-deploy.md` | prose |
| `frontend/src/index.css` | header comment |

**Do not** rename: the D1 database (`edgeshop-db`), the R2 bucket (`edgeshop-images`), the worker name in `wrangler.toml`, npm package names, or git history. Those are infrastructure identifiers; renaming them breaks deploys for zero user benefit. Note this explicitly in the docs so it doesn't look like an oversight.

Also update the running local DB: `UPDATE settings SET value='ESPOD' WHERE key IN ('store_name','email_from_name')`.

**Wordmark:** set as `ESPOD` in `font-display`, tight tracking. It's an acronym, so all-caps is correct — do not title-case it.

---

## 3. Workstreams

### E — Brand, chrome, and assets
Owns: `frontend/index.html`, `frontend/src/lib/storeConfig.ts`, `frontend/src/lib/useSettings.ts`, `frontend/src/components/Header.tsx`, `Footer.tsx`, new `components/AnnouncementBar.tsx`, `worker/migrations/schema.sql`, `worker/src/lib/migrate.ts`, docs, and `scripts/generate-mockups.py`.

1. **Rename** per §2, repo-wide.
2. **Announcement bar** — slim, dismissible (persisted), above the header. Copy: free shipping over ₹999.
3. **Header** — three zones: left nav with category links, centred wordmark on desktop, right actions (search, account, cart). Search opens an overlay/sheet that queries the products list client-side (there is no search endpoint and adding one is out of scope — filter the already-fetched catalogue and say so in a comment). Mobile: hamburger → slide-in menu with categories. Sticky, condenses on scroll (already implemented — preserve).
4. **Footer** — four columns (Shop / Help / Company / Contact), payment-method row, social icons, newsletter field. Static content is fine; the newsletter input may be non-functional but must not *look* broken — no dead POST.
5. **Regenerate product mockups.** `scripts/generate-mockups.py` currently produces a malformed tee. Rewrite it to output clean, consistent mockups on **one uniform light-neutral ground** for: tee (front/back), hoodie, mug, tote, cap, polo. Use smooth silhouettes with subtle shading — no arrow artifacts. Every image the same dimensions per product type, subject centred, consistent margin. Then re-upload to local R2 at the keys the seed references and confirm they serve.
6. **Extend `storeConfig`** with `CATEGORIES` (label, slug, image) and richer `FOOTER_COLUMNS`.

### F — Homepage as a real store
Owns: `frontend/src/pages/HomePage.tsx` and new `frontend/src/components/home/**`.

Sections, in order:
1. **Hero — must contain product imagery.** Split layout on desktop: copy and CTA left, a product composition right (2–3 mockups, layered/offset, subtle float animation). Stacked on mobile with the image above the fold. Keep the headline short and benefit-led; the store name belongs in the header, not as the hero headline.
2. **Trust strip** — 4 items with icons: made to order, free shipping over ₹999, secure payment, easy returns.
3. **Shop by category** — image tiles linking to `/shop?category=`.
4. **Featured products** — the existing grid, upgraded cards (Workstream G owns `ProductCard`; consume it).
5. **"How it works" — redesign.** Three steps with real icons and a connecting line on desktop; a compact horizontal or tighter vertical rhythm on mobile (the current version wastes enormous vertical space). Consider showing a miniature of the editor UI for step 2.
6. **Social proof** — 3 short testimonials with names and star ratings. Clearly fictional placeholder content is fine, but do NOT fabricate real-seeming customer names attached to specific claims about a real business — keep them obviously illustrative.
7. **Closing CTA band** — accent background, single strong call to action.

### G — Shop and product pages
Owns: `frontend/src/pages/ShopPage.tsx`, `ProductPage.tsx`, `frontend/src/components/ProductCard.tsx`, `ProductGrid.tsx`.

1. **`ProductCard`** — uniform neutral image ground so the grid reads as one system, hover image-zoom (desktop), always-visible 44px quick-add (touch), "Customizable" badge, price, and a "from ₹X" treatment where print fees apply.
2. **`ShopPage`** — result count, sort control (newest / price asc / price desc — client-side over the fetched page, documented as such), category chips, responsive 2/3/4 grid, empty state.
3. **`ProductPage`** — breadcrumbs, delivery-estimate line, trust badges near the CTA, and an accordion for description / size guide / care. Keep the existing gallery, size picker, price breakdown, JSON-LD and sticky mobile bar intact.

---

## 4. Ownership & sequencing

| Agent | Workstream | Owns |
|---|---|---|
| 1 | E | `index.html`, `lib/storeConfig.ts`, `lib/useSettings.ts`, `components/{Header,Footer,AnnouncementBar}.tsx`, `worker/migrations/schema.sql`, `worker/src/lib/migrate.ts`, `scripts/generate-mockups.py`, docs |
| 2 | F | `pages/HomePage.tsx`, `components/home/**` |
| 3 | G | `pages/ShopPage.tsx`, `pages/ProductPage.tsx`, `components/ProductCard.tsx`, `components/ProductGrid.tsx` |

All three run in parallel — the lanes are disjoint. Agents 2 and 3 consume `storeConfig`'s new exports; the shape is specified in §3/E6 so they can code against it before Agent 1 lands.

**Do not touch** `frontend/src/index.css` (tokens are final), `editor/**`, `admin/**`, `components/ui/**`, `components/Button.tsx`, `components/Field.tsx`.

---

## 5. Acceptance

1. `worker tsc`, `frontend tsc -b`, `vite build` clean; all 159 tests pass (69 worker + 90 frontend).
2. Fabric and fflate stay out of the main chunk. Main chunk growth ≤ 25KB gz for this round.
3. No horizontal scroll at 360, 390, 768, 1280px.
4. Touch targets ≥ 44px.
5. `prefers-reduced-motion` disables all new motion, including the hero float.
6. **Zero user-visible "EdgeShop" strings remain** — verified by grep across `frontend/src`, `frontend/index.html` and seeded settings.
7. Product mockups render on a consistent ground with no artifacts.
8. Screenshots at 390px and 1280px of home, shop and product accompany each agent's report.

## 6. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-27 | Critique driven by rendered screenshots, not code reading | The previous round's biggest miss (a dead code branch) came from reasoning about source instead of observing output |
| 2026-08-27 | Hero must carry product imagery | A text-only hero is why the site reads as SaaS rather than retail; it is the highest-leverage single change |
| 2026-08-27 | Infrastructure identifiers keep the `edgeshop` name | Renaming the D1 database, R2 bucket or worker breaks deploys and existing data for no user-visible gain |
| 2026-08-27 | Search and sort are client-side over the fetched page | No search endpoint exists; adding one is out of scope for a visual round, and a fake control that silently does nothing is worse than a documented local filter |
| 2026-08-27 | Mockup generator rewritten rather than patched | The current tee output is malformed at the silhouette level; consistent grounds across all products matter more than fixing one polygon |
| 2026-08-27 | Testimonials stay obviously illustrative | Inventing plausible named customers making specific claims about a real business would be fabricated social proof |

---

## 7. Round 2 — Real imagery, backend-driven categories

Two corrections requested after review.

### 7.1 Categories must come from the backend
Today `Header.tsx:272` maps a **hardcoded** `CATEGORIES` array from `storeConfig.ts` into the top bar, printing each category name as its own nav link. Two problems: the top bar is the wrong place for an unbounded list, and the list is a fiction — it is maintained by hand and can drift from what the catalogue actually contains.

- Add `GET /api/categories` returning the distinct `category` values across **active** products, each with a product count and a representative image. No new table — derive it from `products` with a `GROUP BY`.
- The header carries a single **Categories** entry that opens a menu populated from that endpoint. Not one nav link per category.
- Delete the hardcoded `CATEGORIES` export. The database is the only source of truth.
- A category with zero active products must not appear.

### 7.2 Real images, not icons
Decorative inline SVG icons read as a dev placeholder on a store that sells printed products. Replace them with real imagery:

- **How it works** — three real process images instead of icon circles: a blank product, the same product carrying a design, and a packed order.
- **Shop by category** — the representative image from the new endpoint, so the tiles show real catalogue product photos.
- **Trust strip** — remove the decorative icons. A photo for "Secure payment" would be contrived, so this becomes a clean typographic band instead. This is the one place where "use real images" is satisfied by using *no* image rather than a forced one.

**Functional icons stay.** Search, cart, hamburger, close, social links and form affordances are interface controls, not illustration — a magnifier means "search" in a way no photograph does. Only decorative/illustrative icons are being replaced.

### 7.3 Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-27 | Categories derived from `products` via GROUP BY, no new table | The catalogue already holds the truth; a second store would drift from it exactly the way the hardcoded array did |
| 2026-08-27 | One "Categories" menu, not one nav link per category | The list is unbounded and grows with the catalogue; a top bar cannot absorb that |
| 2026-08-27 | Trust strip loses its icons and gains no photos | A stock image for "Secure payment" is contrived; typography carries it better than a forced picture |
| 2026-08-27 | Functional icons retained | Search/cart/menu glyphs are controls, not decoration; replacing them with photography would harm usability |
