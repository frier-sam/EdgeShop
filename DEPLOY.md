# Deployment Guide

## Prerequisites
- Cloudflare account (free tier is sufficient)
- `wrangler` CLI: `npm install -g wrangler`
- Logged in: `wrangler login`

## First-time Setup

### 1. Create D1 Database
```bash
npx wrangler d1 create edgeshop-db
```
Copy the `database_id` from the output and update `worker/wrangler.toml`.

### 2. Run Migrations
```bash
cd worker
npx wrangler d1 execute edgeshop-db --file=migrations/0001_initial.sql
npx wrangler d1 execute edgeshop-db --file=migrations/0002_v2_schema.sql
npx wrangler d1 execute edgeshop-db --file=migrations/0003_abandoned_cart.sql
```

### 3. Create R2 Bucket
```bash
npx wrangler r2 bucket create edgeshop-images
```
Enable public access in the Cloudflare dashboard under R2 > edgeshop-images > Settings > Public Access.
Copy the public URL and update `R2_PUBLIC_URL` in `worker/wrangler.toml`.

### 4. Set Secrets
```bash
cd worker
# Required for Razorpay payment webhooks
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET

# Required for customer auth (JWT tokens) — use a long random string
echo "your-random-secret-here" | npx wrangler secret put JWT_SECRET

# Optional: Resend API key for transactional email (order confirmations, shipping updates, abandoned cart recovery)
# Can also be set later via Admin → Settings → Email
npx wrangler secret put RESEND_API_KEY  # then seed: wrangler d1 execute edgeshop-db --command="INSERT OR REPLACE INTO settings (key, value) VALUES ('email_api_key', 'YOUR_KEY')"
```

**New in v2:** The following settings can be configured via Admin → Settings after deployment:
- `email_api_key` — Resend API key
- `email_from_address` — From email address for transactional emails
- `email_from_name` — From name
- `merchant_email` — Merchant email (receives contact form submissions and new order alerts)

### 5. Deploy Worker
```bash
cd worker
npx wrangler deploy
```
Note the worker URL (e.g., `https://edgeshop-worker.your-subdomain.workers.dev`).

### 6. Deploy Frontend
Update `FRONTEND_URL` in `worker/wrangler.toml` to your Pages URL first.
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name edgeshop
```

### 7. Configure Cloudflare Access (Admin Protection)
In Cloudflare Zero Trust dashboard:
- Create an Application for `https://edgeshop.pages.dev/admin/*`
- Add an Access Policy (e.g., allow by email)

## Development

```bash
# Terminal 1: Start worker
cd worker && npx wrangler dev

# Terminal 2: Start frontend (proxies /api to :8787)
cd frontend && npm run dev
```

## Re-deploying
```bash
# Worker
cd worker && npx wrangler deploy

# Frontend
cd frontend && npm run build && npx wrangler pages deploy dist --project-name edgeshop
```
