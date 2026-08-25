Project: "EdgeShop POD" — Print-on-Demand Storefront on the Cloudflare Free Tier

## 1. Application Overview

EdgeShop POD is a lean, single-purpose print-on-demand storefront: a shopper browses a product, customizes it with text, images and shapes directly on a mockup in the browser, previews exactly what will be printed, adds it to the cart, and checks out. The merchant manages products, print areas and orders from a small admin panel and downloads a print-ready file per order line when it's time to fulfil.

Target: A single small merchant selling customizable apparel/merchandise (T-shirts, mugs, etc.) — not a multi-tenant or general-purpose e-commerce platform.

Primary Goal: Zero monthly hosting cost (Cloudflare Workers + D1 + R2, all within the free tier) while supporting a genuinely interactive design editor.

Key Innovation ("Zero-CPU image logic"): every pixel operation — mockup resizing at upload time, the live customization canvas, the add-to-cart preview composite, and the 300 DPI print-file export — runs in a browser (the admin's or the customer's), never in the Worker. The Worker's job is auth, pricing, and streaming bytes to/from D1 and R2; it never touches image bytes beyond passthrough.

Non-goals (deliberately removed from the older EdgeShop codebase this was converted from): themes/CMS, blog, product reviews, collections, discount codes, shipping zones, full-text search, colour/material variants, staff role management. See `POD.md` for the full deletion inventory and rationale.

## 2. Technical Stack

- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS v4, React Router v6, TanStack Query v5, Zustand (cart store). One hard-coded design system — no theme abstraction.
- **Customization editor:** Fabric.js v6, lazy-loaded only on `/customize/:productId` so it never inflates the main bundle. `fflate` for the admin's "download all print files" zip, also lazy-loaded.
- **API:** Hono v4 on Cloudflare Workers, serving `/api/*`, `/img/*`, `/sitemap.xml`, and (via the `[assets]` binding) the built frontend — all from **one** Worker deployment.
- **Database:** Cloudflare D1 (serverless SQLite) — 8 tables: `products`, `product_sides`, `product_sizes`, `designs`, `orders`, `order_events`, `customers`, `settings`.
- **File storage:** Cloudflare R2 — mockup images, customer-uploaded art, and flattened design previews. The bucket is never public; everything is served same-origin through the Worker.
- **Payments:** Razorpay (UPI/cards/netbanking) + Cash on Delivery.
- **Auth:** Customer accounts via PBKDF2 password hashing + JWT (register/login/reset). Admin access is gated by a `role` column on `customers` (`customer` | `staff` | `super_admin`) — the first customer to ever register is auto-promoted to `super_admin`; there is no separate staff-management UI (see `DEPLOY.md` for how to promote later admins).

## 3. Architecture Overview

Edge-first, single deployable:

- One Cloudflare Worker (`wrangler.toml` at the repo root) serves everything. `/api/*` and `/sitemap.xml` hit the Hono app; `/img/*` streams R2 objects through an edge-cached proxy; everything else falls through to the built React app via the `ASSETS` binding, with a SPA fallback to `/` on a 404 asset lookup.
- **Same-origin image proxy (`GET /img/<key>`)** is the one architectural decision that makes the whole editor possible: R2 objects used to be served from a separate `R2_PUBLIC_URL` origin, and drawing a cross-origin image into a `<canvas>` taints it — every subsequent `toDataURL()` throws. Serving mockups, customer uploads and design previews same-origin removes that failure class entirely, and it's edge-cached (content-addressed UUID keys, immutable) so it costs almost nothing after the first hit.
- **Normalized print coordinates.** Each product side's print area is stored as fractions of the mockup's natural dimensions (`print_x, print_y, print_w, print_h ∈ [0,1]`), plus a physical `print_width_in`. One set of numbers drives the admin's print-area selector, the responsive customization canvas, and the final print export — nothing is ever stored in pixels, so re-uploading a mockup at a different resolution or resizing the browser window never desyncs the geometry.
- **Two-layer stage.** The customizer overlays a plain `<img>` mockup with a Fabric canvas element sized to exactly the print area's bleed rectangle, plus DOM-only scrim/guide overlays. Clipping is native to the canvas element (art dragged past the edge is trimmed with zero clip-path math), and export is just `canvas.toDataURL()` — no cropping or offset arithmetic, and the guides can never leak into an export because they aren't canvas objects.
- **On-demand print rendering.** No high-resolution print file is generated at add-to-cart time — only a ~150KB WebP preview per designed side. The 300 DPI (configurable) transparent PNG is rendered in the merchant's own browser, on demand, from the immutable `design_json` when they click "Download print file" in the admin. This keeps R2 usage tiny and avoids ever rendering a multi-megapixel canvas on a customer's phone mid-checkout.
- **Server-authoritative pricing.** The client's cart only ever sends `{product_id, quantity, size?, design_id?}` — no price of any kind. `POST /api/checkout` re-reads the product, size, sides and design fresh from D1 for every line, recomputes the full order total server-side, and rejects a mismatched client total with `400 price_mismatch`. The Razorpay order is created from the server total, never the client's.

## 4. Detailed Component Breakdown

### A. The Storefront (Customer Facing)

- **Shop (`/`, `/shop`):** product grid, "Customizable" badge, optional category chips.
- **Product page (`/product/:id-or-slug`):** mockup gallery (front/back), size picker, price breakdown (base + per-side print fee), and either a **Customize** CTA (customizable products) or **Add to cart** (plain products).
- **Customizer (`/customize/:productId`):** full-screen canvas editor — text (curated self-hosted fonts), image upload (client-resized, SVG sanitized, low-DPI warning badge), shapes, per-object properties, undo/redo, front/back side tabs, live price footer — then a **Preview** state with every guide/handle hidden, showing exactly what will print.
- **Cart:** composite line identity `product_id:size:design_id` (two shirts with different artwork are different lines, unlike the old build's `product_id`-only dedupe), design thumbnail, per-side fee breakdown, Edit-design deep link back into the editor.
- **Checkout:** name/email/phone/address, COD or Razorpay, flat shipping with a free-over threshold — all server-recomputed (see §3).
- **Account (kept from the pre-POD build):** register/login/reset, order history, plus a **My Designs** view for re-ordering or editing a copy of a past design.

### B. The Admin Dashboard (Merchant Facing)

Seven pages: Dashboard, Products, Product editor, Orders, Order detail, Customers, Settings.

- **Product editor:** basics, a repeatable size list (label/price-delta/stock), and a Front/Back side card each with mockup upload, a draggable/resizable print-area selector (normalized-coordinate + inch readout), physical print width, and a per-side print fee.
- **Order detail:** status transitions, tracking, event timeline, and per line item a design panel with the customer's preview plus a **Download print file** button (and a "download all" zip for the whole order) that renders the 300 DPI PNG client-side from `design_json`.
- **Settings:** store/payment/shipping/printing/email configuration in one page, including the print DPI, bleed/safe-area percentages, max art upload size, and the orphan-design retention window (see §5).

### C. The "Zero-CPU" Image Pipeline

Nothing server-side ever decodes or re-encodes an image:

1. **Mockup upload (admin):** browser resizes to ≤1600px and converts to WebP via the Canvas API, then uploads directly to R2 through a presigned-key flow.
2. **Customer art upload:** accepted as PNG/JPG/WebP/SVG (SVG sanitized client-side before it ever leaves the browser — it will be served back same-origin, so an unsanitized SVG would be stored XSS), uploaded at original resolution at drop time (not add-to-cart), rate-limited per IP.
3. **Preview composite (add-to-cart):** the browser draws the mockup plus the Fabric canvas onto an offscreen ~1000px canvas and uploads a WebP blob.
4. **Print export (admin, on demand):** the browser loads the same `design_json` into an offscreen Fabric canvas sized to `print_width_in × print_dpi` and exports a transparent PNG — clamped against two independent absurd-canvas-size guards (per-dimension and total-area) so a pathological input can't OOM the tab.

## 5. Orphan-design cleanup

A design row is created the moment a shopper starts a customization (before checkout), so an abandoned session leaves a D1 row plus up to two R2 preview objects behind forever unless something reaps them. A daily Cloudflare Cron Trigger (`worker/src/index.ts`'s `scheduled()` handler, logic in `worker/src/lib/gc.ts`) deletes `designs` rows with `order_id IS NULL` older than the `design_retention_days` setting (default 30) along with their `designs/<id>/` R2 objects. A design linked to an order (`order_id` set) is never touched, at any age. Cleanup of the underlying customer-uploaded art (`uploads/`) is intentionally deferred — see the comment above `runOrphanDesignGC` in `gc.ts` for why a naive implementation would risk deleting artwork still referenced by a paid order.

## 6. Integration Flows

**Razorpay:** Worker creates a Razorpay order from the server-computed total → customer pays via the Razorpay Modal → Razorpay hits `POST /api/webhook/razorpay` → Worker verifies the HMAC signature via Web Crypto (`crypto.subtle`) → order status updates to paid in D1.

**Email (optional):** transactional order-confirmation and merchant new-order-alert emails via Resend/SendGrid/Brevo, configured in Admin → Settings; confirmation emails embed the design preview images.

## 7. Data Model (D1 SQL — abridged; see `worker/migrations/schema.sql` for the authoritative, fully-commented version)

```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  base_price REAL NOT NULL,
  category TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  is_customizable INTEGER NOT NULL DEFAULT 0,
  stock_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_sides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('front','back')),
  image_url TEXT NOT NULL,
  print_x REAL NOT NULL DEFAULT 0,   -- normalized 0..1, NOT pixels
  print_y REAL NOT NULL DEFAULT 0,
  print_w REAL NOT NULL DEFAULT 0,
  print_h REAL NOT NULL DEFAULT 0,
  print_width_in REAL NOT NULL DEFAULT 12,
  print_fee REAL NOT NULL DEFAULT 0,
  UNIQUE (product_id, side)
);

CREATE TABLE designs (
  id TEXT PRIMARY KEY,               -- 'dsn_<uuid>'
  product_id INTEGER NOT NULL REFERENCES products(id),
  design_json TEXT NOT NULL,         -- Fabric's own serialization, per side
  preview_json TEXT NOT NULL DEFAULT '{}',
  sides_used TEXT NOT NULL,          -- 'front' | 'front,back'
  order_id TEXT REFERENCES orders(id) -- NULL = not yet purchased (GC target after retention window)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  items_json TEXT NOT NULL,          -- resolved line items, incl. per-side print fees + preview URLs
  subtotal REAL NOT NULL,
  print_total REAL NOT NULL DEFAULT 0,
  shipping_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('razorpay','cod')),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'placed'
);
```

## 8. Instructions for Claude Code (working on this project)

- The authoritative plan is `POD.md` — read it before making architectural changes; it documents the coordinate system, the two-layer stage, the pricing model, and a running decisions log with the rationale behind every non-obvious choice.
- Preserve the "browser does the pixel work" constraint: don't add server-side image processing to the Worker.
- Preserve `/img/*` as the only way R2 objects are ever served — never reintroduce a public R2 URL.
- Preserve server-side price recomputation at checkout; never trust a client-supplied price.
- There is no theme system on this branch (see `CLAUDE.md` rule 6) — one Tailwind design, not a swappable one.
- Prioritize Cloudflare Workers runtime compatibility — avoid Node-specific APIs the Workers runtime doesn't support.
