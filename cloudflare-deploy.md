# Deploying EdgeShop to Cloudflare

EdgeShop runs as a **single Cloudflare Worker** — it serves both the API and the React frontend from one deployment. No separate Pages project needed.

---

## Prerequisites

- Cloudflare account (free tier is fine)
- Your repo pushed to GitHub (`frier-sam/EdgeShop`)

---

## Step 1 — Create a D1 Database

1. Go to **Workers & Pages → D1**
2. Click **Create database**
   - Name: `edgeshop-db`
3. Click **Create**
4. Copy the **Database ID** (you'll need it in Step 3)

---

## Step 2 — Run the Schema

1. Open your new database → click the **Console** tab
2. Go to `worker/migrations/schema.sql` in the GitHub repo → click **Raw** → copy all the SQL
3. Paste it into the D1 console and click **Execute**

This creates all tables and seeds default settings in one shot.

---

## Step 3 — Create an R2 Bucket

1. Go to **Workers & Pages → R2**
2. Click **Create bucket**
   - Name: `edgeshop-images`
3. After creation: open the bucket → **Settings → Public access → Allow Access**
4. Copy the **Public Development URL** — it looks like `https://pub-xxxx.r2.dev`

---

## Step 4 — Update wrangler.toml

Edit `wrangler.toml` in the repo root and replace the two placeholders:

```toml
database_id = "paste-your-d1-database-id-here"
```

```toml
R2_PUBLIC_URL = "https://pub-xxxx.r2.dev"   # your actual R2 public URL
```

Commit and push to GitHub.

---

## Step 5 — Deploy the Worker

1. Go to **Workers & Pages → Create**
2. Choose **Worker → Connect to Git**
3. Select your repository (`frier-sam/EdgeShop`)
4. Set these fields:
   - **Root directory:** *(leave empty)*
   - **Build command:** `npm install && npm run build`
   - **Deploy command:** `wrangler deploy`
5. Click **Deploy**

---

## Step 6 — Add Bindings

After the first deploy, open your Worker → **Settings → Bindings** and add:

| Type | Variable name | Value |
|---|---|---|
| D1 Database | `DB` | `edgeshop-db` |
| R2 Bucket | `BUCKET` | `edgeshop-images` |

---

## Step 7 — Add Variables & Secrets

Still in **Settings → Variables and Secrets**:

| Key | Type | Value |
|---|---|---|
| `R2_PUBLIC_URL` | Plain variable | Your R2 Public Development URL |
| `JWT_SECRET` | **Secret** | Any random 32+ character string |

To generate a JWT secret: [1password.com/password-generator](https://1password.com/password-generator/) (set length to 40, letters + numbers).

> `FRONTEND_URL` is **not needed** — the worker automatically derives the correct URL from each request.

---

## Step 8 — Redeploy (picks up bindings)

Trigger a redeploy from the Worker dashboard so the new bindings and secrets take effect.

---

## Step 9 — First-time Admin Setup

Open your worker URL (e.g. `https://edgeshop.workers.dev/admin`) and configure:

- **Settings** — store name, currency, your store URL (used in abandoned cart emails)
- **Integrations** — payment (Razorpay), email (Resend/SendGrid/Brevo), shipping (ShipRocket)

---

## Updating Later

```bash
git pull
npm run deploy   # rebuilds frontend + redeploys worker
```

The worker automatically applies any new database migrations on the first request after each deploy.

---

## Optional — Protect the Admin Panel

Use Cloudflare Zero Trust to block `/admin` at the edge — no code changes needed:

1. [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Access → Applications → Add → Self-hosted**
2. Domain: `your-worker.workers.dev/admin*`
3. Add a policy (e.g. allow by email)

---

## Optional — Auto-deploy on Git Push

Add these to GitHub **Settings → Secrets and variables → Actions**:

| Secret | Where to find |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |

The workflow at `.github/workflows/deploy.yml` builds and deploys on every push to `main`.
