# ESPOD

A print-on-demand storefront that runs entirely on Cloudflare's free tier — one Worker, D1, R2, no separate servers. Customers design their own T-shirts/mugs/etc. directly on the product in the browser; the merchant gets a lean admin panel and a one-click print-ready file per order.

> ESPOD is the print-on-demand conversion of the original EdgeShop e-commerce engine — that pre-conversion codebase really was called EdgeShop; the brand was renamed EdgeShop → ESPOD afterwards ([`docs/archive/POD-UI2.md`](./docs/archive/POD-UI2.md) §2), so this one historical mention is accurate, not a leftover. See [`POD.md`](./POD.md) for the full conversion plan, architecture rationale and decisions log; see [`project.md`](./project.md) for the product overview.

---

## What it does

**Customer flow:** browse → customize on the product → preview exactly what will print → add to cart → checkout.

- Product grid with a "Customizable" badge on designable products, plain "Add to cart" on the rest.
- Navigation categories are derived from the catalogue itself (`GET /api/categories`, a single `GROUP BY` over active products) — there is no hardcoded category list to drift out of sync, and a category with no active products simply stops appearing.
- **Customizer** (`/customize/:productId`) — full-screen Fabric.js canvas editor over the actual product mockup: text (curated self-hosted fonts), image upload, shapes, drag/resize/rotate/layer/undo-redo, front/back side tabs, a live price footer, and a low-DPI warning badge on art that would print blurry.
- **Preview** — every guide, scrim and handle hidden; shows exactly what gets printed, with a front/back toggle and a last-chance size picker.
- Cart lines are keyed `product_id:size:design_id`, so two shirts with different artwork are correctly two line items, not merged into one.
- Checkout: Razorpay or Cash on Delivery, flat shipping with a free-over threshold — **every price is recomputed server-side**; a tampered client total is rejected with `400 price_mismatch`.
- Customer accounts (register/login/reset, order history) plus a **My Designs** view for re-ordering or editing a copy of a past design.

**Admin panel** (7 pages: Dashboard, Products, Product editor, Orders, Order detail, Customers, Settings):

- Product editor: basics, a repeatable size list (label / price delta / stock), and a Front/Back side card each with mockup upload and a draggable print-area selector (normalized coordinates + a live inch readout).
- Order detail: status timeline, tracking, and per line item a **Download print file** button that renders a transparent 300 DPI PNG client-side from the saved design — plus a "download all" zip for the order.
- Settings: store, payments, shipping, printing (DPI, bleed/safe area, max upload size, design-retention window), and email — all in one page.
- A daily job garbage-collects abandoned designs (never added to a paid order) and their preview images once past a configurable retention window — see [Orphan-design cleanup](#orphan-design-cleanup) below.

**Deliberately not included:** themes/CMS, blog, product reviews, collections, discount codes, shipping zones, search, colour/material variants, a staff-management UI. See `POD.md` §9 for the full deletion inventory and why.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript, Tailwind CSS v4, React Router v6, TanStack Query v5, Zustand |
| Customization editor | Fabric.js v6 (lazy-loaded only on `/customize`), `fflate` (lazy-loaded, admin zip export only) |
| API | [Hono](https://hono.dev/) on Cloudflare Workers — one Worker serves `/api/*`, `/img/*`, `/sitemap.xml` and the built frontend |
| Database | Cloudflare D1 (serverless SQLite) — 8 tables, see `worker/migrations/schema.sql` |
| File storage | Cloudflare R2 (private bucket — see [Same-origin image proxy](#same-origin-image-proxy) below) |
| Payments | Razorpay (UPI/cards/netbanking) + Cash on Delivery |
| Auth | PBKDF2 + JWT for customer accounts; admin access gated by a `role` column, no separate auth system |
| Testing | Vitest — pure-function unit tests on both sides, no mocked-DB or browser-automation test infra |

---

## Architecture decisions a new contributor needs

These aren't incidental — each one closes off a specific failure mode. Full rationale and the decisions log are in `POD.md`.

### Same-origin image proxy

Every R2 object (mockups, customer art, design previews) is served through the Worker at `GET /img/<key>`, never from a separate public R2 URL. **This is load-bearing, not cosmetic:** drawing a cross-origin image into a `<canvas>` taints it, and every subsequent `canvas.toDataURL()` call then throws `SecurityError` — which would break the customizer, the preview compositor, and the print-file renderer simultaneously. Keys are content-addressed UUIDs and immutable, so the response is edge-cached (`Cache-Control: public, max-age=31536000, immutable`) and costs almost nothing after the first hit. The route also enforces a prefix allow-list (`mockups/`, `uploads/`, `designs/` only) and rejects any key containing `..` — see `worker/src/lib/imgGuard.ts`.

### Normalized print coordinates

A product side's print area is stored as fractions of the mockup's natural size — `print_x, print_y, print_w, print_h ∈ [0, 1]` — plus a physical `print_width_in`. Never pixels. One set of numbers drives the admin's print-area selector, the responsive customization canvas, and the final print export; re-uploading a mockup at a different resolution or resizing the browser window never desyncs the geometry. See `frontend/src/editor/geometry.ts`.

### The two-layer stage

The customizer overlays a plain `<img>` mockup with a Fabric canvas element sized to **exactly** the print area's bleed rectangle, plus DOM-only scrim/guide overlays (never canvas objects). This makes clipping native to the canvas element — art dragged past the print edge is trimmed with zero clip-path math — and makes export trivially correct: `canvas.toDataURL()` *is* the print file, with no cropping or offset arithmetic and no way for a guide to leak into an export. See `frontend/src/editor/EditorStage.tsx`.

### On-demand print rendering

No high-resolution print file is generated at add-to-cart time — only a ~150KB WebP preview per designed side gets uploaded then. The 300 DPI (configurable) transparent PNG is rendered **in the merchant's own browser, on demand**, from the immutable `design_json`, when they click "Download print file" in the admin. This keeps R2 usage small (a multi-megabyte PNG per abandoned cart line would burn the free tier fast) and avoids ever rendering a multi-megapixel canvas on a customer's phone mid-checkout — the single likeliest place for that to crash. See `frontend/src/admin/print/renderPrintFile.ts`.

### Server-authoritative pricing

The client's cart payload carries only `{product_id, quantity, size?, design_id?}` — no price of any kind. `POST /api/checkout` re-reads the product, size, sides and design fresh from D1 for **every** line, recomputes the full order total server-side (`worker/src/lib/pricing.ts`), and rejects a mismatched client total with `400 price_mismatch`. The Razorpay order is created from the server total, never the client's.

### Orphan-design cleanup

A `designs` row is created the moment a shopper starts customizing — before checkout — so an abandoned session leaves behind a D1 row plus up to two R2 preview objects forever, unless something reaps them. A daily Cloudflare Cron Trigger (`scheduled()` in `worker/src/index.ts`, logic in `worker/src/lib/gc.ts`) deletes `designs` rows with `order_id IS NULL` older than the `design_retention_days` setting (default 30 days), along with their `designs/<id>/` R2 objects. A design linked to an order is **never** touched, at any age — deleting art still referenced by a paid order would be far worse than leaving an orphan file. Cleanup of the underlying `uploads/` art objects is deliberately deferred; see the comment above `runOrphanDesignGC` in `gc.ts` for why a naive "delete if unreferenced" scan would be unsafe to ship.

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)

### Local development

```bash
git clone <this-repo>
cd edgeshop
npm install          # installs both workspaces (worker + frontend)
```

Two terminals:

```bash
# Terminal 1 — Worker API on http://localhost:8787
npm run dev:worker

# Terminal 2 — Vite dev server with HMR on http://localhost:5173, proxies /api → :8787
npm run dev:frontend
```

No manual schema step needed — the Worker creates its own tables on first request, even against a brand-new empty local D1 (see `worker/src/lib/migrate.ts`'s `0000_base_schema`). Optional demo catalog:

```bash
npx wrangler d1 execute edgeshop-db --local --file=worker/migrations/seed-pod.sql   # optional demo products
```

**First admin account:** there is no seeded admin user and no staff-invite UI. Register a customer account at `/account/register` — the **first** customer to ever register on a fresh database is automatically promoted to `super_admin` (see `worker/src/routes/auth.ts`). Log back in and `/admin` is now accessible. See `DEPLOY.md` for how to promote additional admins on a live deployment.

### Deploying

The **zero-manual-setup path**: connect this repo in the Cloudflare dashboard (Workers & Pages → Create → Import a repository) and deploy — `wrangler.toml` deliberately omits `database_id`, so Cloudflare's automatic resource provisioning (open beta, `wrangler` ≥ 4.45.0) creates the D1 database and R2 bucket for you, and the schema self-bootstraps on first request either way. See [`cloudflare-deploy.md`](./cloudflare-deploy.md) for that path step by step, or [`DEPLOY.md`](./DEPLOY.md) for the full reference (CLI, dashboard-without-Git, manual fallback, local-dev notes). Or run the interactive [`deploy.sh`](./deploy.sh) script. CLI short version:

```bash
npx wrangler login
npx wrangler d1 create edgeshop-db          # update wrangler.toml's database_id with the printed value
npx wrangler r2 bucket create edgeshop-images
npm run deploy                               # builds the frontend, then `wrangler deploy` — schema applies itself
```

There's no `JWT_SECRET` step — the Worker generates and persists its own signing secret in the database the first time it's needed. The only optional deploy-time secret is `RAZORPAY_WEBHOOK_SECRET` (skip it if you're starting with Cash on Delivery only).

---

## Project structure

```
edgeshop/
├── wrangler.toml              # single Worker: D1 + R2 bindings, asset serving, daily GC cron trigger
├── deploy.sh                  # interactive one-command Cloudflare setup
├── scripts/setup.sh           # non-interactive CLI equivalent
├── docs/archive/              # superseded plans, kept for provenance (see Documentation below)
├── frontend/                  # React app — built and served BY the worker (no separate Pages deploy)
│   └── src/
│       ├── admin/             # admin panel pages, product/print-area editors, print-file renderer
│       ├── pages/             # storefront pages (home, shop, product, checkout, account…)
│       ├── editor/            # the customization editor — Fabric.js, coordinate math, design schema
│       ├── store/             # Zustand cart store (composite line keys, see above)
│       ├── components/        # shared storefront UI (Header, Footer, CartDrawer, ProductCard…)
│       └── lib/                # settings, types, shared config
└── worker/                    # Hono API (Cloudflare Workers)
    ├── migrations/
    │   ├── schema.sql          # canonical fresh-install schema (8 tables) + seed settings
    │   └── seed-pod.sql        # optional demo catalog (a tee with front+back, a mug with front only)
    └── src/
        ├── routes/             # API route handlers (+ routes/admin/ for admin-only routes)
        └── lib/                # pricing, auth, email, migrations, orphan-design GC
```

Existing (pre-POD) deployments don't run `schema.sql` directly — the worker's own migration runner (`worker/src/lib/migrate.ts`) converges a live database onto the same schema without losing data, applied automatically on the first request after each deploy.

---

## Documentation

Live docs, kept current:

| File | What it's for |
|---|---|
| [`README.md`](./README.md) | This file — orientation, stack, architecture decisions, getting started |
| [`project.md`](./project.md) | Product definition: what ESPOD is and what it deliberately isn't |
| [`POD.md`](./POD.md) | The build plan of record — task checklists, architecture rationale, and a dated decisions log explaining *why* each non-obvious choice was made |
| [`DEPLOY.md`](./DEPLOY.md) | Full deploy reference: Git flow, CLI, manual fallback, what's verified and what isn't |
| [`cloudflare-deploy.md`](./cloudflare-deploy.md) | The short deploy path, for when you don't need the full reference |
| [`CLAUDE.md`](./CLAUDE.md) | Working agreement for AI agents contributing to this repo |

Historical, in [`docs/archive/`](./docs/archive/):

- `POD-UI.md`, `POD-UI2.md` — the two completed UI rounds (design tokens and mobile overhaul; then ecommerce depth and the EdgeShop → ESPOD rename). **Source-code comments cite these by filename** — e.g. `POD-UI2.md §7.2` — so when you meet such a reference, it lives here.
- `plans/` — 26 dated plan/design documents from the pre-POD EdgeShop era, including the full v1/v2 implementation record.
- `new-dev.md`, `ux-plan.md`, `plan-pointer.md` — superseded trackers from the theme-system era, which no longer exists on this branch.

Nothing in `docs/archive/` describes current behaviour. Read it for provenance — why something was done — not as a guide to how the code works today.

---

## Testing

```bash
cd worker && npx vitest run      # 83 tests — pricing, design/side validation, /img/* proxy guard, orphan-design GC selection
cd frontend && npx vitest run    # 100 tests — cart line-key dedupe, print-area coordinate math, design schema, SVG sanitizer, print-export math
```

Both suites are pure-function unit tests — no mocked D1, no browser automation — following the pattern in `worker/src/lib/pricing.test.ts`: security- and correctness-critical logic is factored out into small, dependency-free functions specifically so it's cheap to test thoroughly.

---

## License

MIT
