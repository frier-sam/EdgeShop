# Deployment Guide

EdgeShop deploys as a **single Cloudflare Worker** that serves both the API and the React frontend. No separate Pages project needed.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- Node.js 18+

---

## Option A — Cloudflare Dashboard (GUI)

### 1. Create D1 Database

**Workers & Pages → D1 → Create database**
- Name: `edgeshop-db`
- Click **Create**, then copy the **Database ID**

### 2. Run the Schema

In the D1 database page → **Console** tab, paste the entire contents of `worker/migrations/schema.sql` and click **Execute**. This creates all tables, indexes, and default settings in one shot.

### 3. Create R2 Bucket

**Workers & Pages → R2 → Create bucket**
- Name: `edgeshop-images`

No public access toggle needed — all R2 objects (mockups, customer uploads, design previews) are served same-origin through the worker at `/img/<key>`, so the bucket stays private.

### 4. Update wrangler.toml

Edit `wrangler.toml` in the repo root:
- Set `database_id` under `[[d1_databases]]` to **your own** D1 Database ID from step 1 (the value checked into this repo belongs to the original development database — it will not work for you)
- Optionally change `bucket_name` under `[[r2_buckets]]` to match the bucket name you'll create in step 3
- Commit and push to GitHub

### 5. Deploy the Worker

**Workers & Pages → Create → Worker → Connect to Git**
- Select `frier-sam/EdgeShop`
- **Root directory:** *(leave empty — wrangler.toml is at the repo root)*
- **Build command:** `npm install && npm run build`
- **Deploy command:** `wrangler deploy`

After first deploy, go to the Worker → **Settings → Bindings** and add:
- **D1 Database** → variable `DB` → select `edgeshop-db`
- **R2 Bucket** → variable `BUCKET` → select `edgeshop-images`

### 6. Set Secrets

In the Worker → **Settings → Variables and Secrets**, add these as **Secrets** (not plain vars):
- `JWT_SECRET` → any random 32+ character string (e.g. generate at [1password.com/password-generator](https://1password.com/password-generator/)) — required for customer/admin auth to work at all.
- `RAZORPAY_WEBHOOK_SECRET` → only needed if you use Razorpay (the webhook signature is verified against this). Set later if you're starting with COD-only.

### 7. First admin login (read this before you go looking for a staff page — there isn't one)

There is no seeded admin user and no staff-invite screen. Instead:

1. Go to `https://your-worker.workers.dev/account/register` and register a normal customer account.
2. Because this is the **first** customer ever created in a fresh database, the Worker auto-promotes it to `role = 'super_admin'` (see `worker/src/routes/auth.ts`).
3. Log out and log back in (or just reload) — `/admin` is now accessible with that account.

**To promote a later account** (e.g. you registered a test customer first by mistake, or want a second admin), run:

```bash
npx wrangler d1 execute edgeshop-db --remote --command \
  "UPDATE customers SET role='super_admin' WHERE email='someone@example.com'"
```

Without one of these two steps, the merchant cannot get into their own admin panel — this is not optional.

### 8. Protect Admin (optional but recommended)

In [Cloudflare Zero Trust](https://one.dash.cloudflare.com):
1. **Access → Applications → Add → Self-hosted**
2. Domain: `your-worker.workers.dev/admin*`
3. Add a policy (e.g. allow by email)

No code changes needed — Cloudflare Access blocks `/admin` at the edge, in addition to (not instead of) the app's own `role` check.

---

## Option B — CLI

```bash
# 1. Login
npx wrangler login

# 2. Create D1 database and update wrangler.toml with the printed database_id
npx wrangler d1 create edgeshop-db

# 3. Apply schema
npx wrangler d1 execute edgeshop-db --remote --file=worker/migrations/schema.sql

# 4. Create R2 bucket (stays private — images are proxied through /img/*)
npx wrangler r2 bucket create edgeshop-images

# 5. Set JWT secret (required)
echo "$(openssl rand -hex 32)" | npx wrangler secret put JWT_SECRET

# 5b. Razorpay webhook secret (optional — only if you use Razorpay)
# echo "your-razorpay-webhook-secret" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET

# 6. Build frontend + deploy everything
npm install && npm run deploy

# 7. First admin: register a customer at /account/register — the FIRST
#    customer ever created is auto-promoted to super_admin. Promote a
#    later account with:
#    npx wrangler d1 execute edgeshop-db --remote --command \
#      "UPDATE customers SET role='super_admin' WHERE email='you@example.com'"
```

---

## Local Development

```bash
# Terminal 1 — Worker + frontend assets (http://localhost:8787)
npm run dev:worker

# Terminal 2 — Vite dev server with HMR (http://localhost:5173, proxies /api → :8787)
npm run dev:frontend
```

For local D1 setup (first time only):
```bash
npx wrangler d1 execute edgeshop-db --local --file=worker/migrations/schema.sql
```

---

## Applying Updates

```bash
git pull
npm run deploy   # builds frontend + deploys worker
```

The worker auto-applies any new migrations from `worker/src/lib/migrate.ts` on the first request after deploy.

---

## Configuration after deploy

Everything is configured from a single **Admin → Settings** page (there is no separate Integrations screen):

| Setting group | Covers |
|---|---|
| Store | Store name, currency, default phone country code |
| Payments | Cash on Delivery toggle, Razorpay Key ID / Key Secret |
| Shipping | Flat shipping amount, free-shipping-over threshold |
| Printing | Default print fee, print DPI, bleed/safe-area %, max art upload size, orphan-design retention window (days) |
| Email | Provider (Resend/SendGrid/Brevo), API key, from name/address, merchant notification address |

---

## CI/CD — Auto-deploy on push

Add to GitHub **Settings → Secrets → Actions**:

| Secret | Where to find |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |

Copy the example workflow from `.github/workflows-example/deploy.yml` to `.github/workflows/deploy.yml` to enable it (it's kept out of `workflows/` on purpose, so a fork doesn't start deploying to someone else's Cloudflare account the moment it's pushed). It builds the frontend and runs `wrangler deploy` on every push to `main` — no separate Pages deploy step, since the frontend is served by the same Worker.
