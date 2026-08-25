# POD.md — Print-on-Demand Conversion Plan

> **Goal:** Convert EdgeShop from a general-purpose, multi-theme e-commerce engine into a **lean, single-purpose Print-on-Demand storefront**: browse → customize on the product → preview → add to cart → buy.
>
> **Non-goal:** Themes, CMS, blog, reviews, collections, discounts, shipping zones, search, digital products, integrations. All of it goes.
>
> This plan supersedes `plan.md` for the `POD` branch. `plan.md` stays as the historical record of the v1/v2 build.

---

## 0. Decisions taken up front

Confirmed with the product owner before planning:

| # | Question | Decision |
|---|----------|----------|
| 1 | Variants | **Size only.** One mockup per side, a simple size list per product (`S/M/L/XL`) with optional price delta. Print area is defined once per side and reused across all sizes. No colour variants. |
| 2 | Customer accounts | **Keep.** Register / login / reset / order history stay. Unlocks "My Designs" (re-order, re-edit) as a natural POD feature. |
| 3 | Build approach | **Strip in place on the `POD` branch.** Delete bloat, flatten one theme into plain components, replace the schema. The app stays runnable and verifiable at every phase. |
| 4 | Print fee | **Per customized side.** Front-only = 1× fee, front+back = 2×. Fee is stored per side, so back can be priced differently from front. |

---

## 1. Today vs. target

| | Today | After POD conversion |
|---|---|---|
| Worker routes | 41 files, ~3,940 LOC | ~16 files, ~1,500 LOC |
| Frontend files | 90 files, ~17,000 LOC | ~40 files, ~7,000 LOC (incl. new editor) |
| D1 tables | 18 + FTS + 3 triggers | 8 |
| Themes | 2 pluggable themes + ThemeProvider + customizer + appearance admin | 1 hard-coded design, Tailwind only |
| Admin pages | 24 | 7 |
| Storefront pages | 17 | 8 |
| Core new capability | — | **Canvas design editor with per-side print areas** |

The editor is the only genuinely new engineering. Everything else is subtraction plus a schema swap.

---

## 2. Target architecture

Unchanged foundations — they are already right for this:

- **Worker (Hono)** on Cloudflare Workers, serving `/api/*` and falling back to static assets. Single worker, single deploy.
- **D1** for products, sides, sizes, designs, orders, customers, settings.
- **R2** for mockup images, customer-uploaded art, and flattened design previews.
- **Browser does the pixel work.** This project's founding constraint ("Zero-CPU image logic") maps perfectly onto POD: the customer's browser composites the preview, the merchant's browser renders the 300 DPI print file. The Worker never touches image bytes beyond streaming them into and out of R2.

One architectural change:

- **All R2 objects are served same-origin through the Worker** at `GET /img/<key>`, replacing the cross-origin `R2_PUBLIC_URL`. This is not cosmetic — see §5.8. Without it, `canvas.toDataURL()` throws on a tainted canvas and the whole editor is dead in the water.

---

## 3. Customer flow

### 3.1 Shop (`/`, `/shop`)

Product grid. Customizable products carry a "Customizable" badge. No collections, no search, no filters beyond an optional category chip row.

### 3.2 Product page (`/product/:id`)

- Mockup gallery: front, and back if the product has one.
- Size picker (if the product has sizes).
- Price block:
  ```
  Classic Tee                ₹499
  + Front print              ₹ 99
  + Back print (optional)    ₹ 99
  ```
- Primary CTA depends on `is_customizable`:
  - customizable → **Customize** → `/customize/:productId`
  - plain → **Add to cart**

### 3.3 Customizer (`/customize/:productId`)

Full-screen, mobile-first. Layout: canvas stage centre, tool rail left (desktop) / bottom sheet (mobile), properties panel right / drawer.

- **Stage** shows the product mockup at full bleed with the print area outlined:
  - dimmed scrim outside the editable region,
  - solid outline at the **bleed boundary** (the hard clip — art past this is trimmed),
  - dashed inner outline at the **safe area** (keep text inside this).
- **Side tabs** (Front / Back) appear only if the product has a customizable back. Each side holds its own independent design.
- **Tools:** Text, Upload image, Shapes (rect / circle / triangle / star / line).
- **Per-object properties:** for text — font (curated list), size, colour, weight, alignment, letter-spacing; for images — opacity, flip, remove background is *out of scope*; for shapes — fill, stroke, corner radius.
- **Object actions:** drag, resize, rotate, layer up/down, duplicate, delete, undo/redo (Cmd+Z), "center" and "fit to print area" helpers.
- **Live price** in the footer, updating as sides gain art: `₹499 + ₹99 front = ₹598`.
- **Quality warning:** if an uploaded image would print below ~150 DPI at its current on-canvas size, show an inline "This image may look blurry when printed" badge on the object.
- **Done** → preview.

### 3.4 Preview (same route, preview state)

- All guides, scrim, handles and selection hidden. Just the product with the artwork on it, exactly as printed.
- Front/back toggle if both are designed.
- Size picker (last chance to change).
- **Back to editing** / **Add to cart**.

### 3.5 Add to cart

On confirm, the browser:

1. Uploads any not-yet-uploaded art assets to R2 (`POST /api/uploads/art`) — normally already done at drop time.
2. Renders a flattened **preview** per designed side (~1000 px WebP, mockup + art composited).
3. `POST /api/designs` with `{ product_id, design_json, sides_used }` → `{ design_id }`.
4. `PUT /api/designs/:id/preview?side=front` streams each preview WebP into R2.
5. Pushes a cart line keyed by `product_id : size : design_id`.

**No high-resolution print file is generated here** — see §5.7 for why, and where it is generated instead.

### 3.6 Cart → checkout → order

- Cart drawer shows the design preview as the line thumbnail, with size, per-side print fees and an **Edit design** link (reloads the editor from `design_json`).
- Checkout: name / email / phone / address, COD or Razorpay. Flat shipping from settings, free over a threshold.
- The Worker **recomputes every price server-side** and rejects mismatches (see §7.3).
- Order confirmation shows the previews; the confirmation email embeds them.

### 3.7 Account (kept)

`/account/orders` gains a **My Designs** tab: every design the customer has saved, with "Re-order" and "Edit a copy".

---

## 4. Admin flow

Seven pages total: Dashboard, Products, Product editor, Orders, Order detail, Customers, Settings.

### 4.1 Product editor (`/admin/products/:id`)

One page, sectioned:

1. **Basics** — name, slug, description, category, status, base price, compare price.
2. **Sizes** — repeatable rows: label, price delta, stock. Empty list = single-SKU product using `products.stock_count`.
3. **Sides** — a Front card and an optional Back card. Each card:
   - **Upload mockup** (existing browser-side WebP resize pipeline, reused as-is).
   - **"This side is customizable"** toggle. Turning it on reveals:
   - **Print area selector** — the mockup rendered at fit-to-width with a draggable / resizable rectangle over it. Live readout in normalized coords and inches. Buttons: *Reset*, *Center*, *Copy from front*.
   - **Physical print width (inches)** — needed to compute print DPI. Height is derived from the rectangle's aspect ratio and shown read-only.
   - **Print fee for this side** (₹), pre-filled from the `default_print_fee` setting.
4. **Preview check** — drops a sample design into the print area so the merchant can sanity-check placement before publishing.

Adding a back side is a single "Add back side" button; removing it deletes the row.

### 4.2 Order detail (`/admin/orders/:id`)

- Customer, address, payment, status transitions, tracking number, order event timeline.
- Per line item: size, quantity, and a **design panel**:
  - the flattened preview,
  - **Download print file** — renders the artwork at 300 DPI from `design_json` in the merchant's own browser and downloads a transparent PNG,
  - **Download all print files** for the order (zip).

---

## 5. The customization editor — technical design

This is the heart of the build. Getting these seven decisions right up front avoids a rewrite.

### 5.1 Coordinate system

Print areas are stored as **normalized fractions of the mockup's natural dimensions**:

```
print_x, print_y, print_w, print_h  ∈ [0, 1]
```

Rendering at any size is then `px = print_x * renderedWidth`. This makes the print area independent of the mockup's resolution, the editor's responsive canvas size, and the print export resolution — one number, three consumers. Never store pixels.

Alongside them, `print_width_in` (physical inches) is stored per side. Everything DPI-related derives from it:

```
printPx      = print_width_in * PRINT_DPI            // e.g. 12in × 300 = 3600px
canvasScale  = printPx / editorCanvasCssWidth        // export multiplier
assetDpi     = assetNaturalWidth / (objectWidthOnCanvas / canvasCssWidth * print_width_in)
```

### 5.2 Two-layer stage (recommended over canvas clip paths)

```
<div class="stage" style="position:relative">           ← sized to fit viewport
  <img src="/img/mockups/tee-front.webp">               ← plain DOM image, object-fit: contain
  <div class="scrim">…</div>                            ← dimmed area outside the bleed rect
  <canvas id="art">                                     ← absolutely positioned, its box IS the bleed rect
  <div class="safe-guide"></div>                        ← dashed inner outline, pure CSS
</div>
```

The design canvas element is positioned and sized to **exactly the bleed rectangle**. This gives three things for free:

- **Clipping is native.** A canvas cannot paint outside its own element, so art dragged past the print area is trimmed with zero clip-path maths.
- **Export is trivially correct.** `canvas.toDataURL({ multiplier })` produces exactly the bleed rect on a transparent background — that *is* the print file. No cropping, no offset arithmetic, no chance of a half-pixel drift between preview and print.
- **Guides never leak into the output.** They are DOM elements, not canvas objects, so there is no "remember to hide the guides before exporting" bug class.

*Known trade-off:* selection handles on an object touching the print-area edge are clipped by the canvas bounds. Acceptable — it reinforces the boundary. If it proves annoying in testing, the fallback is to grow the canvas by a fixed gutter `G` and export with `toDataURL({ left: G, top: G, width, height, multiplier })`; the cost is that art can then be dragged into the gutter and appear un-clipped while editing.

### 5.3 Bleed and safe area

```
bleedRect = printRect grown by  print_bleed_percent  (default 4% of the shorter side)
safeRect  = printRect shrunk by print_safe_percent   (default 4%)
```

- `bleedRect` = the canvas element = the hard clip = what gets exported. This is the "margin" in the requirement: the user can push art past the print edge, and it is trimmed at print time.
- `printRect` = the true product print area, drawn as a solid line.
- `safeRect` = dashed line; text or logos outside it risk being cut by garment tolerance.

Both percentages are global settings, not per-product, to keep the admin lean.

### 5.4 Library choice: Fabric.js v6

| Option | Verdict |
|---|---|
| **Fabric.js v6** ✅ | ESM, tree-shakeable, in-canvas text editing, transform controls, serialization (`toJSON`/`loadFromJSON`) and `toDataURL({ multiplier })` all built in. `design_json` is just Fabric's own format. ~90 KB gzipped, **lazy-loaded only on `/customize`**. |
| Konva / react-konva | Nicer React ergonomics, but text editing needs a hand-built DOM overlay and the Transformer must be wired manually. More code for the same result. |
| Hand-rolled | Handles, rotation, snapping, undo, hit-testing, text editing — weeks of work to reach parity. Not worth it. |

`design_json` shape:

```json
{
  "version": 1,
  "front": { "objects": [ … ], "background": null },
  "back":  { "objects": [ … ] }
}
```

Fabric JSON is the storage format directly, so re-editing and print rendering are the same `loadFromJSON` call.

### 5.5 Fonts

A curated set of ~10 fonts, **self-hosted** in `frontend/public/fonts/` with a `@font-face` block — not Google Fonts CDN. Reasons: the print render must be byte-identical to what the customer approved, and a CDN font that fails to load silently changes the artwork. Before any export:

```ts
await document.fonts.ready
await Promise.all(usedFonts.map(f => document.fonts.load(`16px "${f}"`)))
```

### 5.6 Preview render (customer's browser, on add-to-cart)

Offscreen canvas at ~1000 px wide:

1. `drawImage(mockup, 0, 0, 1000, h)`
2. `drawImage(artCanvas, bleedRect.x*s, bleedRect.y*s, bleedRect.w*s, bleedRect.h*s)`
3. `toBlob('image/webp', 0.85)` → ~100–200 KB → `PUT /api/designs/:id/preview?side=front`

Reuses the exact pattern already in `frontend/src/utils/imageProcessor.ts`.

### 5.7 Print file render (merchant's browser, on demand)

**Decision: print files are rendered on demand in the admin, not stored at add-to-cart.**

Rationale:

- **R2 stays small.** A 3600 px transparent PNG is 2–8 MB. Storing one per abandoned cart line would burn the 10 GB free tier in weeks. Only ~150 KB of preview per design is stored.
- **No mobile OOM.** Rendering a 3600×4800 canvas on a mid-range phone at the moment of purchase is the single most likely place for the checkout to crash.
- **Always correct.** `design_json` + the R2 asset URLs are immutable, so the file rendered at fulfilment time is bit-for-bit what the customer approved.
- **Same code path.** The admin's renderer is the customer's renderer with a different `multiplier`.

Admin flow: click **Download print file** → the page lazy-loads Fabric → `loadFromJSON(design_json)` into an offscreen canvas sized to `bleedRect` at CSS scale → `toDataURL({ format: 'png', multiplier: printPx / bleedCssWidth })` → download.

*Alternative if a merchant ever wants files pushed to a fulfiller automatically:* add a "freeze print files" action that renders and uploads them to R2 at order-paid time. Deliberately deferred — not needed for v1.

### 5.8 CORS: the same-origin image proxy

Today R2 objects are served from `R2_PUBLIC_URL` — a different origin. Drawing a cross-origin image into a canvas **taints** it, and every subsequent `toDataURL()` throws `SecurityError`. That kills the preview render, the print render, and the editor's thumbnailing.

`crossOrigin="anonymous"` + an R2 CORS policy would work, but it is a silent-failure trap: one misconfigured bucket and the editor breaks in production only.

**Fix:** a Worker route that streams R2 objects on the site's own origin.

```ts
app.get('/img/*', async (c) => {
  const key = c.req.path.slice(5)
  const cached = await caches.default.match(c.req.raw)
  if (cached) return cached
  const obj = await c.env.BUCKET.get(key)
  if (!obj) return c.notFound()
  const res = new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': obj.httpEtag,
    },
  })
  c.executionCtx.waitUntil(caches.default.put(c.req.raw, res.clone()))
  return res
})
```

Keys are content-addressed UUIDs and immutable, so the edge cache absorbs essentially all traffic after the first hit. `R2_PUBLIC_URL` is then deleted entirely and all stored URLs become root-relative `/img/...` paths — which also makes the database portable between environments.

### 5.9 Customer art uploads

- Accepted: PNG, JPG, WebP, SVG. Max 15 MB (setting).
- Uploaded **at drop time**, not at add-to-cart, so the editor holds a stable same-origin URL and `design_json` never carries base64.
- Stored at original resolution under `uploads/<uuid>.<ext>` — the print render needs every pixel.
- SVG is accepted but **sanitized client-side** (strip `<script>`, `on*` handlers, external refs) before it ever reaches R2, because `/img/*` serves it same-origin.
- Rate-limited per IP in the Worker to keep the bucket from being used as free storage.

---

## 6. Data model

### 6.1 Tables after conversion (8)

```sql
-- ── Catalog ────────────────────────────────────────────────
CREATE TABLE products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  slug            TEXT    UNIQUE,
  description     TEXT    DEFAULT '',
  base_price      REAL    NOT NULL,
  compare_price   REAL    DEFAULT NULL,
  category        TEXT    DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'active',   -- active | draft
  is_customizable INTEGER NOT NULL DEFAULT 0,
  stock_count     INTEGER NOT NULL DEFAULT 0,          -- used only when no sizes exist
  seo_title       TEXT    DEFAULT '',
  seo_description TEXT    DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_sides (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  side           TEXT    NOT NULL CHECK (side IN ('front','back')),
  image_url      TEXT    NOT NULL,                     -- '/img/mockups/<uuid>.webp'
  image_w        INTEGER NOT NULL,                     -- natural px
  image_h        INTEGER NOT NULL,
  customizable   INTEGER NOT NULL DEFAULT 1,
  print_x        REAL    NOT NULL DEFAULT 0,           -- normalized 0..1
  print_y        REAL    NOT NULL DEFAULT 0,
  print_w        REAL    NOT NULL DEFAULT 0,
  print_h        REAL    NOT NULL DEFAULT 0,
  print_width_in REAL    NOT NULL DEFAULT 12,          -- physical width, drives DPI
  print_fee      REAL    NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, side)
);

CREATE TABLE product_sizes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,                        -- 'S', 'M', 'XL'
  price_delta REAL    NOT NULL DEFAULT 0,
  stock_count INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

-- ── Designs ────────────────────────────────────────────────
CREATE TABLE designs (
  id           TEXT PRIMARY KEY,                       -- 'dsn_<uuid>'
  product_id   INTEGER NOT NULL REFERENCES products(id),
  customer_id  INTEGER REFERENCES customers(id),       -- NULL for guests
  design_json  TEXT NOT NULL,                          -- { version, front:{…}, back:{…} }
  preview_json TEXT NOT NULL DEFAULT '{}',             -- { front:'/img/designs/…', … }
  sides_used   TEXT NOT NULL,                          -- 'front' | 'front,back'
  order_id     TEXT REFERENCES orders(id),             -- NULL = not yet purchased
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_designs_orphan ON designs(created_at) WHERE order_id IS NULL;
CREATE INDEX idx_designs_customer ON designs(customer_id);

-- ── Sales ──────────────────────────────────────────────────
CREATE TABLE orders (
  id                  TEXT PRIMARY KEY,
  customer_id         INTEGER REFERENCES customers(id),
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,
  customer_phone      TEXT DEFAULT '',
  shipping_address    TEXT NOT NULL,
  shipping_city       TEXT DEFAULT '',
  shipping_state      TEXT DEFAULT '',
  shipping_pincode    TEXT DEFAULT '',
  shipping_country    TEXT DEFAULT 'India',
  items_json          TEXT NOT NULL,
  subtotal            REAL NOT NULL,
  print_total         REAL NOT NULL DEFAULT 0,
  shipping_amount     REAL NOT NULL DEFAULT 0,
  total_amount        REAL NOT NULL,
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('razorpay','cod')),
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  order_status        TEXT NOT NULL DEFAULT 'placed',
  razorpay_order_id   TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  tracking_number     TEXT DEFAULT '',
  customer_notes      TEXT DEFAULT '',
  internal_notes      TEXT DEFAULT '',
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_events (…unchanged…);   -- status timeline, genuinely useful in admin

-- ── Identity & config (unchanged) ──────────────────────────
CREATE TABLE customers (…unchanged…);      -- role column still drives admin auth
CREATE TABLE settings  (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

Note `orders` drops `discount_code`, `discount_amount`, `tax_amount` and gains `subtotal` / `print_total` so the admin can show the split without re-parsing `items_json`.

### 6.2 Dropped tables (11 + FTS)

`collections`, `product_collections`, `product_variants`, `product_images`, `discount_codes`, `shipping_zones`, `shipping_rates`, `abandoned_carts`, `order_emails`, `pages`, `blog_posts`, `reviews`, `customer_addresses`, plus `products_fts` and its three triggers.

`customer_addresses` goes because with one flat shipping rate and a short form, the last-used address can live in `localStorage`.

### 6.3 Settings keys

**Keep:** `store_name`, `currency`, `cod_enabled`, `razorpay_key_id`, `razorpay_key_secret`, `email_provider`, `email_api_key`, `email_from_name`, `email_from_address`, `merchant_email`, `default_country_code`, `jwt_secret`.

**Add:**

| Key | Default | Purpose |
|---|---|---|
| `flat_shipping_amount` | `49` | Single flat shipping rate |
| `free_shipping_over` | `999` | Order subtotal above which shipping is free (`0` = never) |
| `default_print_fee` | `99` | Pre-fills the per-side fee in the admin |
| `print_dpi` | `300` | Print export resolution |
| `print_bleed_percent` | `4` | Bleed grown outside the print area |
| `print_safe_percent` | `4` | Safe area inset inside the print area |
| `max_art_upload_mb` | `15` | Customer art upload cap |

**Delete:** `active_theme`, `theme_overrides_json`, `navigation_json`, `footer_json`, `homepage_json`, `announcement_bar_*`, `reviews_visibility`, `shiprocket_*`, `admin_email_notifications`.

### 6.4 R2 key layout

```
mockups/<uuid>.webp             product side mockups (admin upload, ≤1600px)
uploads/<uuid>.<ext>            customer art, original resolution
designs/<design_id>/front.webp  flattened preview ~1000px
designs/<design_id>/back.webp
```

All served as `/img/<key>`. Nothing else is ever written to the bucket.

---

## 7. Pricing, cart and order model

### 7.1 Line price

```
unit_price = base_price
           + size.price_delta
           + Σ side.print_fee  for each side whose design has ≥1 object
line_total = unit_price × quantity
```

### 7.2 Cart line identity

The current `cartStore` dedupes on `product_id`, which is wrong the moment two shirts carry different artwork. Line key becomes:

```
`${product_id}:${size ?? '-'}:${design_id ?? 'plain'}`
```

Cart line shape:

```ts
interface CartLine {
  key: string
  product_id: number
  name: string
  size: string | null
  design_id: string | null
  preview_url: string | null      // '/img/designs/dsn_x/front.webp'
  base_price: number
  size_delta: number
  print_fees: { side: 'front' | 'back'; fee: number }[]
  unit_price: number
  quantity: number
  max_qty: number
}
```

### 7.3 Server-side price recomputation (security fix)

`worker/src/routes/checkout.ts:54` currently inserts `body.total_amount` straight from the client — a customer can post `total_amount: 1` and pay ₹1. This is carried into the new checkout as a **must-fix**:

For every line the Worker re-reads `products`, `product_sizes` and `product_sides`, re-derives `unit_price`, verifies `designs.product_id` matches and that the claimed customized sides actually have objects in `design_json`, recomputes shipping from settings, and compares against the client total. Mismatch → `400 price_mismatch` with the corrected quote. The Razorpay order is created from the **server** total, never the client's.

### 7.4 `items_json` shape

```json
[{
  "product_id": 12,
  "name": "Classic Tee",
  "size": "M",
  "quantity": 2,
  "base_price": 499,
  "size_delta": 0,
  "print_fees": [{ "side": "front", "fee": 99 }, { "side": "back", "fee": 99 }],
  "unit_price": 697,
  "line_total": 1394,
  "design_id": "dsn_9f3c…",
  "previews": { "front": "/img/designs/dsn_9f3c/front.webp", "back": "/img/designs/dsn_9f3c/back.webp" }
}]
```

At order creation the matching `designs` rows get `order_id` set, which both links them and exempts them from orphan cleanup.

---

## 8. Final API surface

**Public**

```
GET    /api/health
GET    /api/settings                      public keys only
GET    /api/products                      ?page&limit&category
GET    /api/products/:id                  → product + sides[] + sizes[]
GET    /img/*                             R2 proxy, immutable cache
POST   /api/uploads/art                   customer art → { url }   (rate-limited)
POST   /api/designs                       → { design_id }
GET    /api/designs/:id                   design_json for re-edit
PUT    /api/designs/:id/preview?side=     binary WebP → R2
POST   /api/checkout                      server-recomputed pricing
POST   /api/webhook/razorpay
GET    /sitemap.xml                       products only
POST   /api/auth/*                        login / register / reset   (kept)
GET    /api/account/*                     profile / orders / designs (kept)
```

**Admin** (all behind `requireAdmin`)

```
GET    /api/admin/dashboard
GET    /api/admin/products                ?q&status
POST   /api/admin/products
PATCH  /api/admin/products/:id
DELETE /api/admin/products/:id
PUT    /api/admin/products/:id/sides/:side     mockup + print area + fee
DELETE /api/admin/products/:id/sides/:side
PUT    /api/admin/products/:id/sizes           bulk replace
POST   /api/admin/upload/presign               (kept, prefix → mockups/)
PUT    /api/admin/upload/put
GET    /api/admin/orders                       ?status&page
GET    /api/admin/orders/:id                   incl. design_json per line
PATCH  /api/admin/orders/:id
GET    /api/admin/customers
GET    /api/admin/settings
PUT    /api/admin/settings
```

Routes deleted: collections, pages, blog, reviews, search, discounts, shipping, gallery, variants, integrations, analytics, staff, contact, download, abandoned-cart.

---

## 9. Deletion inventory

### 9.1 Worker — delete 20 files

```
routes/blog.ts                routes/admin/blog.ts
routes/reviews.ts             routes/admin/reviews.ts
routes/collections.ts         routes/admin/collections.ts
routes/pages.ts               routes/admin/pages.ts
routes/search.ts              routes/admin/analytics.ts
routes/validateDiscount.ts    routes/admin/discounts.ts
routes/shippingRates.ts       routes/admin/shipping.ts
routes/abandonedCart.ts       routes/admin/integrations.ts
routes/download.ts            routes/admin/gallery.ts
routes/contact.ts             routes/admin/variants.ts
routes/admin/staff.ts         lib/permissions.ts
```

Also: the `scheduled()` cron handler and `[triggers] crons` in `wrangler.toml` (replaced later by an orphan-design GC), the abandoned-cart and review-request email templates, `R2_PUBLIC_URL` from `Env`, and `requireSuperAdmin` / granular permissions.

> Admin bootstrap after deleting the staff page: promote one customer once with
> `wrangler d1 execute edgeshop-db --remote --command "UPDATE customers SET role='super_admin' WHERE email='…'"`.
> Document this in `DEPLOY.md`.

### 9.2 Frontend — delete ~45 files

- **All of `src/themes/`** — `artsCrafts/` (7 files) deleted outright; `jewellery/`'s `Header`, `Footer`, `CartDrawer`, `ProductCard`, `ProductGrid` moved to `src/components/` with theme-token indirection and jewellery-specific ornament stripped; `Hero`, `CategoryRow`, `FeaturedBanner`, `Testimonials`, `USPStrip`, `config.ts`, `types.ts`, `index.ts`, `ThemeProvider.tsx` deleted.
- **Storefront pages:** `BlogListPage`, `BlogPostPage`, `CollectionPage`, `SearchPage`, `StaticPage`, `ContactPage`.
- **Admin pages (16):** `AdminAppearance`, `AdminThemeCustomizer`, `AdminFooter`, `AdminHomepage`, `AdminNavigation`, `AdminCollections`, `AdminPages`, `AdminBlog`, `AdminReviews`, `AdminDiscounts`, `AdminShipping`, `AdminImport`, `AdminIntegrations`, `AdminAnalytics`, `AdminStaff`, `LinkPicker`.
- **Components:** `AnnouncementBar`, `PageTransition`, `Skeleton`.
- **Rewritten:** `AdminProductEdit` (1,055 LOC → new sides/sizes editor), `ProductPage` (863 LOC → ~250), `CheckoutPage` (524 → ~350), `cartStore`, `App.tsx`.

Rough count: **~60 files deleted, ~10,000 LOC removed**, before the ~2,500 LOC of editor added back.

---

## 10. Phased task plan

Every phase leaves the app building and runnable.

### Phase 0 — Safety net

- [ ] **0.1** Confirm the `POD` branch is current; tag `pre-pod` on `main` for a clean rollback point.
- [ ] **0.2** Export production D1 (`wrangler d1 export`) and snapshot the R2 key list. The conversion is destructive to the schema.
- [ ] **0.3** Add `POD.md` to the repo and note in `CLAUDE.md` that rule 6 (decoupled themes) no longer applies on this branch.

### Phase 1 — Demolition

- [ ] **1.1** Delete the 20 worker route/lib files in §9.1; strip the corresponding `app.route()` lines from `worker/src/index.ts`.
- [ ] **1.2** Delete the `scheduled()` handler, the cron trigger, and the abandoned-cart email template.
- [ ] **1.3** Delete `frontend/src/themes/artsCrafts/`; move the five reusable `jewellery` components to `src/components/` and strip theme indirection; delete the rest of `src/themes/`.
- [ ] **1.4** Delete the 16 admin pages and 6 storefront pages in §9.2; prune `App.tsx` routes and `AdminLayout` nav to the 7 surviving admin pages.
- [ ] **1.5** Strip `worker/src/types.ts` to the surviving entities.
- [ ] **Acceptance:** `npm run build` passes with zero unused-import or unresolved-module errors; storefront home, product, cart, checkout and admin products/orders/settings all still load against the *old* schema.

### Phase 2 — Same-origin image proxy

- [ ] **2.1** Add `GET /img/*` to the worker with edge caching (§5.8).
- [ ] **2.2** Change `admin/upload.ts` to accept a `prefix` (`mockups` | `uploads`) and return a root-relative `/img/<key>` URL. Remove `R2_PUBLIC_URL` from `Env` and `wrangler.toml`.
- [ ] **2.3** One-off D1 statement rewriting existing absolute R2 URLs to `/img/...`.
- [ ] **Acceptance:** every product image on the storefront loads from the site's own origin; `new Image()` + `canvas.toDataURL()` on one of them succeeds in the browser console (the tainting smoke test).

### Phase 3 — POD schema + catalog API

- [ ] **3.1** Write `worker/migrations/pod-schema.sql` per §6.1 — creates the 8 tables, drops the 14 dead ones, drops the FTS table and triggers.
- [ ] **3.2** Add a `0013_pod_reset.sql` entry to `lib/migrate.ts` so existing deployments converge; seed the new settings keys.
- [ ] **3.3** Rewrite `routes/products.ts`: list returns `is_customizable` + front mockup; detail returns `sides[]` and `sizes[]`.
- [ ] **3.4** Rewrite `routes/admin/products.ts` with sides and sizes sub-resources (§8).
- [ ] **3.5** Seed script: two demo products (tee with front+back, mug with front only).
- [ ] **Acceptance:** `GET /api/products/1` returns sides with normalized print rects and a size list; admin CRUD round-trips through `curl`.

### Phase 4 — Admin product editor

- [ ] **4.1** `PrintAreaSelector` component: mockup rendered fit-to-width, draggable/resizable rect with 8 handles, keyboard nudge, snap-to-centre, live normalized + inch readout. Emits `{ print_x, print_y, print_w, print_h }`.
- [ ] **4.2** `ProductSideCard`: mockup upload (reusing `ImageUploader` + `imageProcessor`, capturing natural dimensions), customizable toggle, `PrintAreaSelector`, `print_width_in`, `print_fee`. "Copy from front" for the back.
- [ ] **4.3** `ProductSizesEditor`: repeatable label / delta / stock rows with drag-reorder.
- [ ] **4.4** Rewrite `AdminProductEdit` around Basics / Sizes / Sides / Preview-check.
- [ ] **4.5** Trim `AdminProducts` list to name, price, customizable badge, status, stock.
- [ ] **Acceptance:** a merchant can create a tee with front+back mockups, draw both print areas, set ₹99/₹79 fees and S–XL sizes, and the values survive a page reload.

### Phase 5 — Storefront shell

- [ ] **5.1** Flatten the moved components into a single Tailwind design system (`components/Header`, `Footer`, `CartDrawer`, `ProductCard`, `ProductGrid`, `Button`, `Field`).
- [ ] **5.2** Rewrite `HomePage` — hero, "How it works" 3-step strip, product grid. No CMS, all static copy plus `store_name`.
- [ ] **5.3** Rewrite `ProductPage` (863 → ~250 LOC): gallery, size picker, price breakdown, Customize / Add-to-cart CTA.
- [ ] **5.4** Rewrite `cartStore` for composite line keys (§7.2) and preview thumbnails.
- [ ] **Acceptance:** a non-customizable product can be browsed, added, and checked out end to end.

### Phase 6 — The customizer

- [x] **6.1** Add `fabric@6.9.1` (exact pin) and lazy-load it via `React.lazy` on `/customize/:productId` only. Verified the main bundle is unchanged — see decisions log.
- [x] **6.2** `EditorStage`: two-layer mockup + canvas + scrim + guides (§5.2), responsive resize preserving normalized coordinates.
- [x] **6.3** `useEditorObjects`: add/select/transform/delete/duplicate/reorder, undo-redo ring buffer (30 steps).
- [x] **6.4** Text tool — curated self-hosted fonts, size, colour, weight, alignment, letter-spacing.
- [x] **6.5** Image tool — drop/pick, client resize guard, SVG sanitize, immediate `POST /api/uploads/art` with a documented Phase-7-only fallback, low-DPI warning badge (§5.1).
- [x] **6.6** Shape tool — rect, circle, triangle, star, line with fill/stroke.
- [x] **6.7** Side tabs holding independent per-side state; live price footer.
- [x] **6.8** Preview state: guides and selection hidden, front/back toggle, Back-to-edit / Add-to-cart (stub — Phase 7 wires persistence).
- [x] **6.9** Mobile layout — bottom tool bar, CSS pinch-zoom on the stage, 44px touch targets.
- [x] **Acceptance:** verified interactively in a real headless-Chromium session against `wrangler dev` — a design with text + an uploaded image (via the 404→blob fallback) + a shape was built on the front side, art dragged past the print edge was clipped by the canvas element, switching to Back showed a genuinely empty canvas (front's objects did not leak), switching back to Front restored them, and Preview hid every guide/scrim/handle. See decisions log for the one deviation (§5.2's optional gutter fallback was not needed — hard clipping alone tested fine) and what Phase 7 still owns.

### Phase 7 — Design persistence, cart, checkout

- [x] **7.1** `POST /api/designs`, `GET /api/designs/:id`, `PUT /api/designs/:id/preview` in the worker.
- [x] **7.2** Preview compositor (§5.6) and the add-to-cart sequence (§3.5).
- [x] **7.3** Cart drawer with design thumbnails, per-side fee breakdown and Edit-design deep link back into the editor.
- [x] **7.4** Rewrite `checkout.ts` with full server-side recomputation (§7.3) and design→order linking; delete the discount and shipping-zone logic.
- [x] **7.5** Update the order-confirmation email template to embed design previews.
- [x] **Acceptance:** a tampered `total_amount` is rejected with `price_mismatch`; a completed order's `items_json` carries the correct per-side fees and design id. Verified live against `wrangler dev` — see decisions log for the exact curl proof.

### Phase 8 — Admin fulfilment

- [x] **8.1** `GET /api/admin/orders/:id` returns `design_json` + side geometry per line.
- [x] **8.2** `PrintFileRenderer` — lazy Fabric, `loadFromJSON`, font preload, `toDataURL` at `print_dpi`, download as `<order>-<line>-<side>.png`.
- [x] **8.3** Order detail design panel: preview, dimensions readout, effective DPI, per-side and whole-order download.
- [x] **8.4** Trim `AdminDashboard` to orders today / revenue / pending fulfilment / low stock.
- [x] **Acceptance:** the downloaded PNG is transparent, exactly `print_width_in × print_dpi` wide (within the safety clamp), and its artwork registers with the customer preview. Verified live against `wrangler dev` + local D1/R2 through headless Chromium (`playwright-core`, the same cached browser Phase 6 used) driving the REAL admin UI end to end — real `/admin/login` form submit, real navigation to `/admin/orders/:id`, real click on "Download print file" and "Download all print files" — not a reimplementation of the renderer. A design with a single 100×100 opaque red `Rect` at a known offset in an 800×800 canonical canvas (product side seeded with `print_width_in=10`, `print_dpi=300`, bleed/safe = 0 via the real admin product + settings APIs; design created via `POST /api/designs`, order via `POST /api/checkout` — both real Phase 7 endpoints, server-side price recomputation matched the hand-computed total on the first try) produced a PNG that the SAME browser then decoded via `data:` URL → `<canvas>` → `getImageData` (no external PNG library): alpha channel 0 at five background sample points including 10px from the rect; pixel size exactly 3000×3000 = `round(10in × 300dpi)`; the rect's bounding box in the output normalizes to x=0.376, y=0.2507, w=0.1227, h=0.1240 against an expected 0.375/0.25/0.125/0.125 (all within 0.3% — the residual is grid-sampling granularity, not misregistration); center pixel exactly `rgba(255,0,0,255)`. A second product with `print_width_in=500` (forcing the safety clamp) produced a real 6324×6324 PNG (matching `sqrt(MAX_CANVAS_AREA_PX)` to the pixel) with the admin UI explicitly showing "13 DPI (reduced — file would exceed a safe canvas size)" instead of silently exporting at the nominal 300. The "download all" zip was verified too (correct filename, PK zip signature, contains the same rendered bytes). See decisions log for the zip-vs-sequential call and why `playwright-core` was installed in a scratch directory rather than added to `frontend/package.json`.

### Phase 9 — Cleanup and ship

- [ ] **9.1** Orphan-design GC: daily cron deleting `designs` with `order_id IS NULL` older than 30 days, plus their R2 previews and any uploads they solely reference.
- [ ] **9.2** Simplify `sitemap.xml` to products; product-page JSON-LD.
- [ ] **9.3** Tests — worker: price recomputation, design validation, side/size CRUD. Frontend: cart line-key dedupe, print-area coordinate maths, preview compositor.
- [ ] **9.4** Rewrite `README.md`, `DEPLOY.md` and `project.md` for POD; archive `plan.md` under `docs/plans/`.
- [ ] **9.5** Bundle audit — confirm Fabric is absent from the main chunk; Lighthouse on home and product pages.

---

## 11. Risks and gotchas

| Risk | Mitigation |
|---|---|
| **Tainted canvas** kills every export | Same-origin `/img/*` proxy (§5.8). Smoke-tested in Phase 2, before any editor code exists. |
| **Mobile memory** on large canvases | Previews only at add-to-cart (~1000px); the 3600px render happens on the merchant's desktop (§5.7). |
| **Font substitution** between preview and print | Self-hosted fonts + `document.fonts.ready` gate before every export (§5.5). |
| **Print/preview misregistration** | Both derive from one normalized rect and one canvas element; the export *is* the canvas, not a re-composited approximation (§5.2). |
| **Low-res customer art** printing blurry | Live DPI computation per object with an inline warning badge; block below ~100 DPI at add-to-cart. |
| **Price tampering** | Full server-side recomputation; Razorpay orders created from server totals only (§7.3). |
| **R2 filling with abandoned designs** | ~150 KB previews only, plus a 30-day orphan GC (Phase 9.1). |
| **Art upload abuse** | Size cap, MIME allow-list, SVG sanitization, per-IP rate limit. |
| **Fabric v6 API churn** | Pin an exact version; isolate all Fabric calls behind `frontend/src/editor/fabric/*` so a library swap touches one directory. |
| **Losing something still wanted** | Phase 0 tag + D1 export; deletions land as one reviewable commit per group. |

---

## 12. Open questions (non-blocking — defaults assumed)

1. **Design ownership / IP** — do we need a "you own the rights to what you upload" checkbox at add-to-cart? *Assumed yes, as a checkout consent line.*
2. **Content moderation** — any screening of uploaded art before print? *Assumed manual review by the merchant at fulfilment.*
3. **Minimum print DPI** — hard block or warn-only? *Assumed: warn below 150, block below 100.*
4. **Fulfilment** — merchant prints in-house, or files go to a third party (Printful/Printrove)? Only affects whether Phase 8 stays a download button or grows an export integration. *Assumed in-house.*
5. **Currency** — INR only, as today? *Assumed yes.*

---

## 13. Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-25 | Convert in place on the `POD` branch rather than scaffolding fresh | Checkout, Razorpay, webhook signature verification, R2 upload and admin JWT auth are all working and non-trivial; keeping them live means every phase is independently verifiable |
| 2026-08-25 | Theme system removed entirely; one hard-coded Tailwind design | Contradicts CLAUDE.md rule 6, which is explicitly retired for this branch — a single-purpose POD store has one look, and the abstraction was costing ~1,500 LOC plus 4 admin pages |
| 2026-08-25 | Size-only variants; no colour variants | Colour changes the mockup image *and* the print-area rectangle, roughly doubling the admin surface; sizes cover the actual POD requirement |
| 2026-08-25 | Print areas stored as normalized 0–1 fractions, never pixels | One value serves the admin selector, the responsive editor and the print export; survives re-uploading a mockup at a different resolution |
| 2026-08-25 | `print_width_in` stored per side | Physical size is the only way to derive real DPI; without it "300 DPI" is meaningless and low-res warnings are impossible |
| 2026-08-25 | Two-layer stage: DOM mockup + a canvas sized to exactly the bleed rect | Clipping becomes native to the canvas element, export needs no cropping maths, and guides are DOM so they can never leak into the print file |
| 2026-08-25 | Fabric.js v6, lazy-loaded on the customize route only | In-canvas text editing, transform controls, JSON serialization and `toDataURL({ multiplier })` are all built in; ~90 KB gz stays out of the main bundle |
| 2026-08-25 | Print files rendered on demand in the admin, not stored at add-to-cart | A 3600px PNG per abandoned cart line would exhaust the R2 free tier, and rendering it on a phone mid-checkout is the likeliest crash point; `design_json` is immutable so on-demand output is identical |
| 2026-08-25 | All R2 objects served same-origin via `GET /img/*`; `R2_PUBLIC_URL` deleted | Cross-origin images taint the canvas and break every export; the proxy removes an entire class of production-only failure and makes stored URLs environment-portable |
| 2026-08-25 | Fonts self-hosted, not loaded from a CDN | The print file must match the approved preview exactly; a silently-failed CDN font would change the artwork after purchase |
| 2026-08-25 | Print fee charged per customized side, stored on `product_sides` | Front and back have genuinely different costs; per-side storage also makes "back is optional" pricing obvious to the customer |
| 2026-08-25 | Cart lines keyed by `product_id:size:design_id` | Two shirts with different artwork are different line items; the current `product_id` dedupe would silently merge them |
| 2026-08-25 | Checkout recomputes all prices server-side | The existing `checkout.ts` trusts the client's `total_amount` — an exploitable flaw carried forward from v1 that must not survive the rewrite |
| 2026-08-25 | Customer accounts kept | Enables "My Designs" re-order and re-edit, which is a natural fit for POD and reuses auth code that already exists and works |
| 2026-08-25 | Staff management UI dropped; single admin promoted via a D1 command | One-merchant store; granular per-staff permissions were ~275 LOC serving a case this product does not have |
| 2026-08-25 | Phase 6: one shared Fabric canvas for both sides, swapped via JSON snapshot on tab change, not one canvas instance per side | Two live canvases would double the DOM/GPU cost and complicate "which canvas is the stage" for guides/scrim; a snapshot cache (`{json, width, height}` per side) inside `EditorStage` restores each side at the pixel size it was saved at, then rescales to the current stage size, so a window resize that happens while a side is inactive doesn't misregister it when the shopper switches back |
| 2026-08-25 | Undo/redo history is explicitly suspended (`suspendHistory`/`resumeAndReseedHistory`) around the side-swap's `canvas.clear()` + `loadFromJSON`, not left to the normal object:added/removed listeners | Fabric fires one event per object added/removed during a bulk swap; left unmuted, each side switch would pollute the other side's undo stack with partial intermediate states. The pure-resize path (`resizeCanvasScaled`) needed no such guard — it mutates existing objects in place and fires no add/remove events |
| 2026-08-25 | Fabric v6's `object.type` is PascalCase (`'IText'`, `'Image'`, `'Rect'`...), not the lowercase `'i-text'`/`'image'` from Fabric v5 | Discovered by reading the compiled `fabric` package directly (`classRegistry.setClass(IText, 'i-text')` is only a backward-compat deserialization alias — the object's own `.type` is `'IText'`). Every type check in `fabric/selection.ts` and `components/PropertiesPanel.tsx` uses the v6 strings; a copy-pasted v5 snippet here would silently never match |
| 2026-08-25 | `canvas.toJSON()` takes no arguments in Fabric v6 (it's sugar for `JSON.stringify(this.toObject())`); `canvas.toObject(propertiesToInclude)` is the one that accepts the extra-properties list | POD.md's own snippets imply `toJSON`/`loadFromJSON` symmetry; `snapshotCanvas` calls `toObject([...CUSTOM_OBJECT_PROPS])` so `assetNaturalWidth` etc. survive serialization for the low-DPI badge to work after an undo or a side reload |
| 2026-08-25 | Design fonts are real, self-hosted woff2 binaries, not placeholders | Downloaded 5 families' source TTFs (static or variable) from `github.com/google/fonts` (OFL-licensed) and converted to true static-instance woff2 with `fontTools` + `brotli` locally (pinning every variation axis, not just `wght`, avoided a ~30x size bloat on Merriweather's opsz/wdth/wght variable font). 10 curated families, 15 woff2 files, 1.6MB total, each family's `OFL.txt` copied alongside it under `frontend/public/fonts/<slug>/` |
| 2026-08-25 | Scrim implemented as one absolutely-positioned div at the bleed rect with a huge CSS `box-shadow` spread, clipped by the stage's `overflow:hidden`, instead of 4 separate rectangles | Half the DOM, no seams at the corners, and it degrades gracefully — a fractional-pixel geometry error shows as a 1px scrim misalignment, never a visible gap |
| 2026-08-25 | The design canvas's position is set by writing directly to `canvas.wrapperEl` (Fabric's own `.canvas-container` div), not to the `<canvas>` ref React was given | Fabric v6 replaces the element you hand it with its own wrapper (holding a lower + upper canvas pair) on construction; positioning the ref itself is a no-op once Fabric has taken over the DOM node — this is called out in `fabric/canvas.ts`'s `positionCanvasWrapper` so it doesn't get "fixed" back to the wrong element later |
| 2026-08-25 | Mobile pinch-zoom (§6.9) is native CSS `touch-action: pinch-zoom` on the stage container plus `touch-action: none` on the canvas wrapper, not a custom Fabric viewport-transform pinch handler | A real viewport-zoom feature (rescaling Fabric's coordinate system on a pinch gesture) is materially more code and risk to the print-registration math for a "nice to have" on a route that's still keyboard/mouse-first on desktop; the CSS-only approach gets native OS pinch-zoom over the stage for free while `touch-action: none` on the canvas wrapper stops a one-finger object-drag from also scrolling the page (the classic Fabric-on-mobile bug). Documented as a scope simplification versus a bespoke gesture engine |
| 2026-08-25 | "Bottom sheet" tool rail (§6.9) is a normal-flow horizontally-scrollable bar above the price footer, not a swipeable expand/collapse sheet | A `position:fixed` sheet would have fought the price footer for the bottom of the viewport (both want `bottom:0`); the simpler flowing bar avoids that collision entirely, still meets the 44px touch-target requirement, and was the layout actually screenshotted in verification. A true swipe-to-expand sheet is a reasonable follow-up if the tool count grows |
| 2026-08-25 | Low-DPI blocking check (§5.1: "block below 100 DPI") scans only the currently-active side's live canvas, not both sides' persisted state | Phase 6 has no persistence yet (`design_json` isn't saved anywhere until Phase 7's `POST /api/designs`), so there is no durable cross-side store to check against; the authoritative check belongs at the real add-to-cart/checkout boundary in Phase 7, once `design_json` exists for both sides regardless of which one is on screen. Noted directly in `CustomizerEditor.tsx` as a scope boundary, not silently narrowed |
| 2026-08-25 | `POST /api/uploads/art` 404 fallback (§6.5) also covers plain network failures (`fetch` throwing), not just an HTTP 404 | In `wrangler dev` before Phase 7 exists, the route isn't mounted at all — verified interactively that this correctly falls back to `URL.createObjectURL` with a toast, rather than surfacing a raw fetch error and leaving the editor stuck |
| 2026-08-25 | Phase 7: `design_json` stores each side at a CANONICAL reference size (`canvasWidth`/`canvasHeight` alongside Fabric's own `objects`/`background`), not raw viewport-relative pixels as POD.md §5.4's sketch literally shows | Fabric's serialized `left`/`top`/`scaleX`/`scaleY` are only meaningful relative to the canvas pixel size active when they were captured; without recording that size, re-editing on a different device (or the preview compositor, which renders independently of any live viewport) would misregister every object. The reference size is derived once via `geometry.ts`'s new `computeReferenceGeometry(imageNaturalW, imageNaturalH, printRect, bleed, safe, PREVIEW_REFERENCE_WIDTH=1000)` — a synthetic "stage" that is the mockup rendered at exactly 1000px wide (POD.md §5.6's own preview width) — so persistence and the preview compositor share one coordinate system with zero extra rescale step between them |
| 2026-08-25 | The rescale from a live/cached canvas snapshot to the canonical size is a pure JSON transform (`fabric/rescaleSnapshot.ts`), not a live Fabric canvas resize | Needs zero Fabric module load and is trivially unit-testable; reuses the exact same `left*scaleX, top*scaleY, scaleX*scaleX, scaleY*scaleY` math as `fabric/canvas.ts`'s `resizeCanvasScaled`, just applied to plain JSON instead of a mounted canvas |
| 2026-08-25 | Editing an existing design (`/customize/:id?design=`) always creates a NEW `designs` row on add-to-cart rather than updating the original in place | Matches POD.md §3.7's own "Edit a copy" wording for My Designs; more importantly, a purchased design may already be `order_id`-linked and referenced by a merchant's print queue — silently mutating it out from under a placed order would be a correctness bug, not just a convenience trade-off. `EditorStage` gained `initialSnapshots` (seed the per-side cache once on mount) and `onSnapshotCached` (keep a live copy of the inactive side's last-known `{json,width,height}`) specifically so re-editing didn't need any new persistence path — it reuses the exact same side-swap/snapshot machinery Phase 6 already built |
| 2026-08-25 | `items_json` entries carry BOTH the new §7.4 fields (`unit_price`, `print_fees`, `previews`, …) and legacy-shaped aliases `price` (= `unit_price`) and `image_url` (= `previews.front` or the first preview) | `AdminOrderDetail.tsx` and `AccountOrdersPage.tsx` (both explicitly out of scope for Phase 7 — Phase 8 owns admin fulfilment) read `item.price`/`item.image_url` directly; aliasing costs two extra fields on the stored JSON and avoids shipping a phase that silently breaks two pages that currently work |
| 2026-08-25 | `R2Bucket.put()` rejects a `ReadableStream` piped through a plain `TransformStream` with "Provided readable stream must have a known length" — discovered live against `wrangler dev`, not from documentation | R2 only accepts a stream straight from a Request/Response body, or a `FixedLengthStream`; a generic transform (even an identity-like byte-counting one) strips that property. `PUT /api/designs/:id/preview`'s streaming size cap therefore reads the body via `getReader()` into an in-memory `Uint8Array` itself (aborting the instant it exceeds 2MB, so a lying `Content-Length` still can't force unbounded buffering) and hands R2 the materialized array, which does have a known length. `POST /api/uploads/art`'s cap is unaffected by this — it feeds a capped stream into `Response(...).formData()`, a generic body read with no such R2-specific constraint, before ever materializing bytes for `BUCKET.put()` |
| 2026-08-25 | Per-IP art-upload rate limiting is an in-memory `Map` scoped to one Worker isolate, not D1- or KV-backed | Documented explicitly as a soft deterrent, not a hardened defense: it resets on cold start and isn't shared across concurrently-running isolates/regions. A D1-backed counter would add a write to every upload attempt (including rejected ones) on the hot path; KV would need a new binding for a v1-scale abuse concern. Sized to stop a casual script using the bucket as free storage, which is the actual threat model at this stage |
| 2026-08-25 | `settings.ts`'s `print_dpi` and `max_art_upload_mb` floors raised from `0` to `72` and `1` respectively | A `print_dpi` of 0 collapses the print export canvas to zero pixels (`printPx = print_width_in * 0`), failing fulfilment silently; a `max_art_upload_mb` of 0 would reject every customer upload outright. 72 is the lowest DPI anyone would plausibly print at (screen resolution); both are hard floors, not soft warnings |
| 2026-08-25 | Checkout's client payload dropped every price field — `items` now carries only `{product_id, quantity, size?, design_id?}`, `total_amount` is kept solely to detect and report a mismatch | Removing price fields from the wire format entirely (rather than accepting-then-ignoring them) makes the trust boundary self-documenting in the type signature (`LineInput` in `lib/pricing.ts`) — there is no field left for a future change to accidentally start trusting |
| 2026-08-25 | Verified live against `wrangler dev` + local D1/R2, not just via unit tests | `POST /api/designs` → `dsn_…`, `PUT .../preview?side=front` (with a genuine oversized-body rejection and the R2 "known length" bug caught and fixed in the process), `POST /api/checkout` with the correct total → `201` with `subtotal:648, print_total:99, shipping_amount:49, total_amount:697` persisted exactly and `designs.order_id` linked; the same order re-submitted with `total_amount: 1` → `400 {"error":"price_mismatch","quote":{"total_amount":697,…}}` and confirmed zero orders were created for the tampered attempt; a design claiming `sides_used:["front","back"]` with an empty `back.objects` → `400 {"error":"design_side_empty"}` at checkout; a 3-quantity order crossing the ₹999 free-shipping threshold → `shipping_amount: 0` persisted |
| 2026-08-25 | Phase 8: the admin's print renderer is the SAME editor code, not a parallel implementation | `renderPrintFile.ts` calls `frontend/src/editor/fabric/loadFabric.ts` (the identical cached dynamic import), `frontend/src/editor/fonts.ts`'s `ensureFontsReady`, and loads the side's canonical `StoredSideSnapshot` (designSchema.ts) into a `fabric.StaticCanvas` via `loadFromJSON` exactly like `editor/preview.ts`'s art layer does — the only new code is `printMath.ts`'s multiplier/clamp maths and exporting on a transparent background instead of compositing onto the mockup. `extractFontFamilies` (private to `preview.ts`) was promoted to `designSchema.ts`'s `extractSnapshotFontFamilies` so both the customer preview compositor and the admin print renderer font-gate off one shared function |
| 2026-08-25 | `design_json`'s stored `canvasWidth`/`canvasHeight` (the canonical bleed-rect size at the `PREVIEW_REFERENCE_WIDTH` reference scale — Phase 7) is used AS-IS for the print export, never recomputed from the product's current `print_x/y/w/h` + live bleed/safe settings | Recomputing would silently misregister every design placed before a merchant later tweaks the global bleed/safe percent settings; the snapshot already carries the exact coordinate system it was authored in, so trusting it is what keeps "the print file is bit-for-bit what the customer approved" true even after settings drift. `GET /api/admin/orders/:id` still returns `product_sides` geometry (`image_url/w/h`, `print_x/y/w/h`, `print_width_in`) per POD.md §8.1's literal spec, but Phase 8's renderer only actually needs `print_width_in` off it — the rest is there for a future admin preview/thumbnail use, not consumed by `renderPrintFile.ts` |
| 2026-08-25 | Print export multiplier formula taken literally from POD.md §5.1/§5.7: `multiplier = (print_width_in * print_dpi) / bleedRectWidthAtReferenceScale` — i.e. `print_width_in` sizes the FULL exported bleed-rect canvas, not just the inner print rect | This is what the plan's own worked example (`printPx = print_width_in * PRINT_DPI`, `canvasScale = printPx / editorCanvasCssWidth` where "the canvas IS the bleed rect" per §5.2) computes; implemented as-is in `printMath.ts` rather than re-deriving a "print rect only" variant, so the delivered renderer matches the plan's documented maths exactly |
| 2026-08-25 | Absurd canvas-size guard uses two independent caps — `MAX_CANVAS_DIMENSION_PX = 16384` and `MAX_CANVAS_AREA_PX = 40,000,000` — clamped in that order (dimension first, then area re-checked at the dimension-clamped size), rather than one combined check | A canvas can be safely narrow on one axis and still OOM a tab if the other axis is huge — verified live in the browser: a 500in `print_width_in` test product hit the dimension cap first (would-be 150,000px), then the area cap further reduced it to a real 6324×6324 output (`≈ sqrt(40M)`), matching hand-computed maths exactly. Both caps are conservative, documented engineering judgment calls (not exact browser specs, which vary by engine/OS) — sized so realistic apparel prints (e.g. 12in×16in @ 300dpi ≈ 17.3MP) render unclamped while pathological `print_width_in`/`print_dpi` combinations get caught. The effective DPI (`print_dpi × actualMultiplier/desiredMultiplier`) is always computed from the ACTUAL clamped multiplier and surfaced in the UI (`"13 DPI (reduced — file would exceed a safe canvas size)"`) rather than exporting quietly at a lower resolution |
| 2026-08-25 | Zip chosen over sequential downloads for "Download all print files", via `fflate` (`zipSync`, level 0/store-only), lazy-loaded inside `downloadAllPrintFiles` exactly like Fabric is lazy-loaded for the renderer | `fflate` is ~8KB min+gzip, dependency-free, and needs no Node/Buffer polyfill in the browser. Chrome (and other browsers) throttle or prompt-gate more than a handful of programmatic downloads fired in a loop, which would make a 10-line order's "download all" flaky under the sequential-downloads fallback POD.md flagged as acceptable; a single zip sidesteps that. PNGs are already compressed, so the zip container uses `level: 0` (store-only) rather than re-deflating — verified live in the browser (`PK` magic number, correct `<order_id>-print-files.zip` name, size ≥ the single PNG it contains) |
| 2026-08-25 | `playwright-core` was installed in a throwaway scratch directory (`$TMPDIR/…/scratchpad/verify`) with its own tiny `package.json`, not added to `frontend/package.json`, and launched via `chromium.launch({ executablePath })` pointing at the cached `~/Library/Caches/ms-playwright/chromium-1208` build rather than the version `playwright-core` itself expects | It is a one-off verification tool for this phase's live-browser proof, not a runtime or test-suite dependency (`vitest run` never imports it) — permanently adding it to the app's `package.json` would misrepresent it as part of the shipped project. The installed `playwright-core@1.48.2`'s bundled browser-revision table (`1140`) didn't match either cached Chromium build (`1124`/`1208`), so revision auto-detection was bypassed entirely by passing `executablePath` directly at a build known to exist in the cache — the same technique the Phase 6 agent's setup implies, since that phase also left no `playwright-core` trace in git history |
| 2026-08-25 | Phase 8's admin order detail totals now read `order.subtotal`/`order.print_total`/`order.shipping_amount` directly off the order row instead of re-deriving a subtotal from `items_json`, and the dead `discount_code`/`discount_amount` display block (columns dropped from the `orders` table back in Phase 3, POD.md §6.1) was deleted | POD.md §6.1 already stores the authoritative split on the order row specifically "so the admin can show the split without re-parsing `items_json`" — Phase 7 left `AdminOrderDetail.tsx` unmodified with its old re-derivation and vestigial discount UI (both always harmlessly wrong/empty against the POD schema) only so the file kept compiling; now that Phase 8 owns the file, both were corrected rather than carried forward |
