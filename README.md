# EdgeShop

A complete e-commerce platform that runs entirely on Cloudflare's free tier — no servers, no monthly bills.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/frier-sam/EdgeShop&dir=worker)

> **Note:** The button deploys the Worker only. For a full setup (D1 database, migrations, R2, secrets, and frontend), run `bash scripts/setup.sh` after cloning — see [Getting started](#getting-started) below.

---

## Why this exists

Most e-commerce platforms charge $30–$300/month just for hosting. Cloudflare gives you Workers, Pages, D1 (SQLite), and R2 (object storage) for free. EdgeShop is built to fit exactly within those limits, making it a viable option for small businesses and independent sellers who want a real storefront without recurring hosting costs.

---

## What it does

**Storefront**
- Product listings with variants (size, colour, material, etc.)
- Collection pages, full-text search, product detail with image gallery
- Customer accounts — register, login, order history, password reset
- Blog, static pages, contact form
- Checkout with Razorpay (UPI, cards, netbanking) or Cash on Delivery
- Discount codes, digital product downloads (HMAC-signed time-limited links)
- Abandoned cart recovery via Cloudflare Cron Triggers + email

**Admin panel**
- Products: CRUD, variants, image gallery, collections, CSV bulk import
- Orders: detail view, status management, tracking numbers, refunds, order event log
- Customers: list with order stats, expandable order history, GDPR-friendly delete
- Discounts, reviews moderation, blog management, static pages editor
- Navigation menu editor, footer editor
- Appearance: live theme switcher + CSS variable customizer with instant preview
- Integrations: Razorpay, Resend/SendGrid/Brevo email, ShipRocket shipping
- Staff management with granular per-permission roles
- Analytics: revenue/day charts, dashboard stats (revenue, orders, pending, low stock)
- Protected by Cloudflare Access (Zero Trust) — no auth code in the app

**Two themes included**
- **Jewellery** — luxury editorial, off-white + gold accent, Playfair Display serif
- **Arts & Crafts** — warm handmade, linen + terracotta accent, bold sans-serif

Themes are fully swappable from the admin panel. Each implements a typed contract (Header, Hero, ProductCard, ProductGrid, CartDrawer, Footer) — adding a new theme requires zero changes to page-level code.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v4, React Router v6, TanStack Query v5, Zustand |
| API | [Hono](https://hono.dev/) on Cloudflare Workers |
| Database | Cloudflare D1 (serverless SQLite, 11 migrations) |
| File storage | Cloudflare R2 (S3-compatible, browser-direct upload) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |
| Payments | Razorpay + Cash on Delivery |
| Auth | Cloudflare Access (admin), PBKDF2 + JWT (customer accounts) |

---

## How image uploads stay within free limits

Cloudflare Workers have a 10ms CPU limit on the free tier. Resizing images server-side would exceed this. Instead, processing happens entirely in the browser:

1. Admin picks a PNG or JPEG
2. Browser resizes to max 1000px wide and converts to WebP using the Canvas API
3. Worker issues a key for R2
4. Browser uploads the optimised WebP directly to R2

No paid image transformation service needed.

---

## Getting started

```bash
git clone https://github.com/frier-sam/EdgeShop.git
cd edgeshop
bash scripts/setup.sh
```

The script creates your D1 database, applies all 11 migrations, sets up R2, auto-generates a JWT secret, and deploys both the Worker and frontend. See [DEPLOY.md](./DEPLOY.md) for the full guide and manual steps.

**Local development:**
```bash
# Terminal 1 — Worker API (http://localhost:8787)
cd worker && npx wrangler dev

# Terminal 2 — Frontend (http://localhost:5173, proxies /api → :8787)
cd frontend && npm run dev
```

**Deploying updates:**
```bash
cd worker && npm run deploy   # applies new migrations + deploys worker
cd frontend && npm run build && npx wrangler pages deploy dist --project-name edgeshop
```

---

## Project structure

```
edgeshop/
├── scripts/
│   └── setup.sh              # One-command first-time setup
├── .github/workflows/
│   └── deploy.yml            # CI/CD: auto-deploy on push to main
├── frontend/                 # React app (Cloudflare Pages)
│   └── src/
│       ├── admin/            # Admin panel pages + components
│       ├── pages/            # Storefront pages (home, product, cart, checkout, account, blog…)
│       ├── store/            # Zustand cart + settings stores
│       └── themes/           # Theme components (jewellery, artsCrafts)
└── worker/                   # Hono API (Cloudflare Workers)
    ├── migrations/           # D1 SQL migrations (0001–0011)
    └── src/
        ├── routes/           # API route handlers
        │   └── admin/        # Admin-only routes
        └── lib/              # Auth, email, permissions helpers
```

---

## License

MIT
