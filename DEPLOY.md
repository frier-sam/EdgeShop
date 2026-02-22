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
- After creation: **Settings → Public access → Allow Access**
- Copy the **Public Development URL** (e.g. `https://pub-xxxx.r2.dev`)

### 4. Update wrangler.toml

Edit `wrangler.toml` in the repo root:
- Replace `placeholder-replace-after-creation` with your D1 Database ID
- Replace `https://pub-REPLACE.r2.dev` with your R2 public URL
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

Go to **Settings → Variables and Secrets** and update:
- `R2_PUBLIC_URL` → your R2 Public Development URL (e.g. `https://pub-xxxx.r2.dev`)

### 6. Set Secrets

In the Worker → **Settings → Variables and Secrets**, add a **Secret** (not plain var):
- `JWT_SECRET` → any random 32+ character string (e.g. generate at [1password.com/password-generator](https://1password.com/password-generator/))

### 7. Protect Admin (optional but recommended)

In [Cloudflare Zero Trust](https://one.dash.cloudflare.com):
1. **Access → Applications → Add → Self-hosted**
2. Domain: `your-worker.workers.dev/admin*`
3. Add a policy (e.g. allow by email)

No code changes needed — Cloudflare Access blocks `/admin` at the edge.

---

## Option B — CLI

```bash
# 1. Login
npx wrangler login

# 2. Create D1 database and update wrangler.toml with the printed database_id
npx wrangler d1 create edgeshop-db

# 3. Apply schema
npx wrangler d1 execute edgeshop-db --remote --file=worker/migrations/schema.sql

# 4. Create R2 bucket (enable public access in dashboard after)
npx wrangler r2 bucket create edgeshop-images

# 5. Set JWT secret
echo "$(openssl rand -hex 32)" | npx wrangler secret put JWT_SECRET

# 6. Build frontend + deploy everything
npm install && npm run deploy
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

## Integrations

All configured via **Admin → Integrations** after deployment:

| Integration | Where |
|---|---|
| Razorpay (payments) | Admin → Integrations → Payment |
| Resend / SendGrid / Brevo (email) | Admin → Integrations → Email |
| ShipRocket (shipping) | Admin → Integrations → Shipping |

---

## CI/CD — Auto-deploy on push

Add to GitHub **Settings → Secrets → Actions**:

| Secret | Where to find |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |

The workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`.
