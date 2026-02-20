# EdgeShop

A complete e-commerce platform that runs entirely on Cloudflare's free tier — no servers, no monthly bills.

## Why this exists

Most e-commerce platforms charge $30–$300/month just for hosting. Cloudflare gives you Workers, Pages, D1 (SQLite), and R2 (object storage) for free. EdgeShop is built to fit exactly within those limits, making it a viable option for small businesses and independent sellers who want a real storefront without recurring hosting costs.

## What it does

**Storefront** — Product listings, collection pages, product detail pages with variants, search, blog, static pages, customer accounts, and checkout with Razorpay (UPI, cards, netbanking) or Cash on Delivery.

**Admin panel** — Manage products (with variants, images, collections), orders, discounts, reviews, navigation, footer, blog posts, and appearance (themes + CSS customization). Protected by Cloudflare Access.

**Two themes included** — Jewellery (luxury editorial) and Arts & Crafts (warm, handmade). Each theme has its own Header, Hero, ProductCard, ProductGrid, CartDrawer, and Footer. Themes are fully swappable from the admin panel.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS v4, React Router v6, TanStack Query v5 |
| API | [Hono](https://hono.dev/) on Cloudflare Workers |
| Database | Cloudflare D1 (serverless SQLite) |
| File storage | Cloudflare R2 (S3-compatible) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |
| Payments | Razorpay + Cash on Delivery |
| Auth | Cloudflare Access (Zero Trust) for admin |

## How image uploads stay within free limits

Cloudflare Workers have a 10ms CPU limit on the free tier. Resizing images server-side would blow past this. Instead, image processing happens entirely in the browser:

1. Admin picks an image
2. Browser resizes it to max 1000px and converts to WebP using the Canvas API
3. Worker issues a presigned URL for R2
4. Browser uploads the optimized file directly to R2

No paid image transformation service needed.

## Getting started

See [DEPLOY.md](./DEPLOY.md) for the full setup guide. Short version:

```bash
# 1. Create D1 database and R2 bucket via Wrangler
npx wrangler d1 create edgeshop-db
npx wrangler r2 bucket create edgeshop-images

# 2. Run migrations
cd worker
npx wrangler d1 execute edgeshop-db --file=migrations/0001_initial.sql
npx wrangler d1 execute edgeshop-db --file=migrations/0002_v2_schema.sql
npx wrangler d1 execute edgeshop-db --file=migrations/0003_abandoned_cart.sql

# 3. Set secrets
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
npx wrangler secret put JWT_SECRET

# 4. Deploy
npx wrangler deploy                                              # worker
cd ../frontend && npm run build && npx wrangler pages deploy dist --project-name edgeshop
```

**Local development:**
```bash
# Terminal 1
cd worker && npx wrangler dev

# Terminal 2
cd frontend && npm run dev   # proxies /api to :8787
```

## Project structure

```
edgeshop/
├── frontend/          # React app (Cloudflare Pages)
│   └── src/
│       ├── admin/     # Admin panel pages + components
│       ├── pages/     # Storefront pages
│       └── themes/    # Theme components (jewellery, artsCrafts)
└── worker/            # Hono API (Cloudflare Workers)
    ├── migrations/    # D1 SQL migrations
    └── src/routes/    # API route handlers
```

## License

MIT
