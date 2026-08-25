# Deploying EdgeShop to Cloudflare

EdgeShop runs as a **single Cloudflare Worker** — it serves both the API and the React frontend from one deployment. No separate Pages project needed. No editing config files.

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

That's it — no public access toggle needed. All R2 objects (mockups, customer uploads, design previews) are served same-origin through the worker at `/img/<key>`, not from R2's own public URL, so the bucket stays private.

---

## Step 4 — Deploy the Worker

1. Go to **Workers & Pages → Create**
2. Choose **Worker → Connect to Git**
3. Select your repository (`frier-sam/EdgeShop`)
4. Set these fields:
   - **Root directory:** *(leave empty)*
   - **Build command:** `npm install && npm run build`
   - **Deploy command:** `npx wrangler deploy`
5. Click **Deploy**

---

## Step 5 — Add Bindings

After the first deploy, open your Worker → **Settings → Bindings** and add:

| Type | Variable name | Value |
|---|---|---|
| D1 Database | `DB` | `edgeshop-db` |
| R2 Bucket | `BUCKET` | `edgeshop-images` |

---

## Step 6 — Add Variables & Secrets

Open **Settings → Variables and Secrets** and add:

| Key | Type | Value |
|---|---|---|
| `JWT_SECRET` | **Secret** | Any random 32+ character string — required, customer/admin auth won't work without it |
| `RAZORPAY_WEBHOOK_SECRET` | **Secret** | Only needed if you use Razorpay; can be added later |

To generate a JWT secret: [1password.com/password-generator](https://1password.com/password-generator/) (set length to 40, letters + numbers).

---

## Step 7 — Redeploy

Trigger a redeploy from the Worker dashboard so the new bindings and secrets take effect.

---

## Step 8 — First Admin Login

There is no seeded admin user and no staff-invite screen — the app deliberately doesn't have one. Instead:

1. Open your worker URL and register a normal customer account at `/account/register`.
2. The **first** customer ever created in a fresh database is automatically promoted to `role = 'super_admin'` (see `worker/src/routes/auth.ts`) — no manual step needed for the very first account.
3. Log back in (or reload) and `/admin` is now accessible.

To promote a *later* account (e.g. a second admin, or you registered a test account first by accident):

```bash
npx wrangler d1 execute edgeshop-db --remote --command \
  "UPDATE customers SET role='super_admin' WHERE email='someone@example.com'"
```

Once logged in, everything else — store name/currency, payments (Razorpay), shipping, printing (DPI/bleed/safe-area/upload limits), and email (Resend/SendGrid/Brevo) — is configured in one place: **Admin → Settings**.

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

Copy `.github/workflows-example/deploy.yml` to `.github/workflows/deploy.yml` to enable it (kept out of `workflows/` on purpose so a fork doesn't auto-deploy to someone else's account). It builds the frontend and runs `wrangler deploy` on every push to `main`.
