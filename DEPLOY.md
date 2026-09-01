# Deployment Guide

ESPOD deploys as a **single Cloudflare Worker** that serves both the API and the React frontend. No separate Pages project needed.

> **Naming note.** The storefront's brand was renamed EdgeShop → ESPOD (POD-UI2.md §2), but several infrastructure identifiers below intentionally keep the old name: the D1 database `edgeshop-db`, the R2 bucket `edgeshop-images`, the Worker name in `wrangler.toml`, npm package names, and the GitHub repository path (`frier-sam/EdgeShop`, referenced further down this guide). Renaming any of those would break an existing deploy or point instructions at a repo that doesn't exist — they're left alone on purpose, not missed.

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- Node.js 18+
- `wrangler` ≥ 4.45.0 (pinned in `worker/package.json`; installed automatically by `npm install`)

---

## Deploy from Git (recommended) — the zero-manual-setup path

This is the path for a **brand-new Cloudflare account with nothing set up yet**: no D1 database, no R2 bucket, no schema loaded. Cloudflare Workers Builds' **automatic resource provisioning** (open beta, requires `wrangler` ≥ 4.45.0 — [changelog](https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/)) creates the D1 database and R2 bucket for you, and this app creates its own schema on first request. Read the "What actually happens" box below before relying on this in production — some of it is verified, some of it necessarily is not (open beta + no way to test real provisioning without a Cloudflare login).

1. **Push this repo (or your fork) to GitHub or GitLab**, if you haven't already.

2. **Cloudflare dashboard → Workers & Pages → Create → Import a repository**, and connect the account and pick this repo.

   > **Branch note.** This code currently lives on the `POD` branch. Workers Builds defaults to deploying whichever branch you point it at, but the *first-time setup wizard's default suggestion* is your repo's default branch (`main`, if `main` exists). **Explicitly set the production branch to `POD`** in the Git integration settings, **or** merge `POD` into `main` first — this repo does not do that merge for you, and Workers Builds will otherwise build the wrong (or a nonexistent) branch.

3. **Build configuration** — fill in exactly these fields:

   | Field | Value |
   |---|---|
   | Root directory | *(leave empty — `wrangler.toml` is at the repo root)* |
   | Build command | `npm install && npm run build` |
   | Deploy command | `npx wrangler deploy` |

   (`npm install` at the repo root installs both npm workspaces — `worker/` and `frontend/` — including `wrangler` itself, which is only declared in `worker/package.json` and hoisted. `npm run build` then installs and builds the `frontend/` workspace specifically, producing `frontend/dist` — the directory `wrangler.toml`'s `[assets]` binding serves. Workers Builds is documented as running its own dependency-install step before your build command, which would make the explicit `npm install` redundant — but that wasn't independently verified here, so it's kept explicit rather than relied on.)

4. **Click Save and Deploy.**

   > **What actually happens on this first deploy — verified vs. not:**
   >
   > - ✅ **Verified locally** (cannot log in to Cloudflare in this environment, so real account provisioning was never exercised): `wrangler.toml`'s `[[d1_databases]]` block has **no `database_id`**, and `[[r2_buckets]]` has no bucket id either (R2 bindings never carry one). This is exactly the shape Cloudflare's automatic-provisioning docs describe as the trigger for creating and binding a database/bucket for you.
   > - ⚠️ **Not verified** — and stated plainly rather than assumed: Cloudflare's own docs do not explicitly confirm automatic provisioning fires inside a Workers Builds CI run specifically (vs. `wrangler dev`/`wrangler deploy` from an authenticated local CLI). It is in **open beta**. If it does not fire for your account, the deploy will fail asking for a `database_id` — see **Manual fallback** below, which takes about 2 minutes.
   > - ✅ **Verified locally, thoroughly**: whether or not provisioning creates the D1 database *and its schema*, the schema part is covered regardless — this Worker creates its own tables on the very first request to any `/api/*` route, against a completely empty database, via a self-bootstrapping migration (`worker/src/lib/migrate.ts`'s `0000_base_schema`, generated from `worker/migrations/schema.sql`). Confirmed against a genuinely empty local D1: `/api/settings`, `/api/products`, `/api/categories` all return `200` with no manual schema step, and a second cold start against the same database is a verified no-op. See "Self-bootstrapping schema" below for exactly what was tested.
   > - The R2 bucket, once created (automatically or manually), starts **empty** — no images. See step 7.
   > - ✅ **Verified locally**: `npx wrangler deploy --dry-run` against this exact `wrangler.toml` (no `database_id`, no login) succeeds — reads and bundles `frontend/dist` (46 files), and resolves the `DB`/`BUCKET`/`ASSETS` bindings with no id needed for a dry run. This confirms the *configuration* a real `npx wrangler deploy` would use is valid; it does not (and cannot, without a Cloudflare login) confirm that a real account actually provisions the resources.

5. **Set secrets** — Worker → **Settings → Variables and Secrets**:

   | Key | Type | Required? |
   |---|---|---|
   | `RAZORPAY_WEBHOOK_SECRET` | Secret | Only if you use Razorpay — verifies the webhook payload signature (`worker/src/routes/webhook.ts`). Skip entirely if you're starting with Cash on Delivery only; add it later the same way. |

   That's the **only** environment secret this app reads (`worker/src/index.ts`'s `Env` type: `DB`, `BUCKET`, `ASSETS` bindings, plus `RAZORPAY_WEBHOOK_SECRET`). Two things people expect to see here that are **deliberately not env vars**:
   - **JWT signing secret** — not a dashboard setting at all. The Worker generates a random one itself and persists it in the `settings` table (`worker/src/lib/auth.ts`'s `getOrCreateJwtSecret`) the first time it's needed. There is nothing to set.
   - **Razorpay Key ID/Secret, and the email provider API key** — configured later, after your first login, in **Admin → Settings** (they're stored in D1's `settings` table, not Worker env vars, so they can be changed without a redeploy).

6. **First admin login** (there is no seeded admin user and no staff-invite screen):

   1. Go to `https://<your-worker>.workers.dev/account/register` and register a normal customer account.
   2. Because this is the **first** customer ever created in this database, the Worker auto-promotes it to `role = 'super_admin'` (see `worker/src/routes/auth.ts`).
   3. Log out and back in (or reload) — `/admin` is now accessible with that account.

   To promote a *later* account (e.g. you registered a test account first by mistake, or want a second admin):
   ```bash
   npx wrangler d1 execute edgeshop-db --remote --command \
     "UPDATE customers SET role='super_admin' WHERE email='someone@example.com'"
   ```
   (Needs `npx wrangler login` first — this one command is the one place this whole guide still requires the CLI, since there's no D1-editing UI in the dashboard for arbitrary `UPDATE`s.)

7. **Upload your product images.** A freshly-provisioned R2 bucket is completely empty. `worker/migrations/seed-pod.sql`'s two demo products (if you load it — see Option B below) point at placeholder image paths that don't exist in a fresh bucket, so their mockups will 404 until you either replace them or delete the demo products. For real products: **Admin → Products → Add Product**, and upload mockups there — the admin UI writes straight to R2 through the Worker (`POST /api/admin/upload`), so there is no separate "make the bucket public" or "get the R2 URL" step.

8. **(Optional) Protect `/admin`** with Cloudflare Zero Trust — see the bottom of this guide.

---

## Manual fallback — if automatic provisioning doesn't fire

If step 4's deploy fails complaining it can't find a D1 database (or you'd simply rather pin the resources explicitly up front), this takes about two minutes and is a normal, fully-supported wrangler workflow — nothing here is a workaround:

```bash
# 1. Authenticate the CLI once (separate from the Git integration above)
npx wrangler login

# 2. Create the database — prints a database_id
npx wrangler d1 create edgeshop-db

# 3. Add that id back into wrangler.toml's [[d1_databases]] block:
#    [[d1_databases]]
#    binding = "DB"
#    database_name = "edgeshop-db"
#    database_id = "<the id just printed>"
# Commit and push this change — Workers Builds redeploys on push.

# 4. R2 bucket (only needed if it wasn't auto-created either)
npx wrangler r2 bucket create edgeshop-images
```

No schema step here either — the self-bootstrapping migration handles that regardless of whether the database was auto-provisioned or created by hand in step 2. This is the same `database_id`-pinning shape the repo shipped with before automatic provisioning existed, so it's a well-trodden path, not a new one.

---

## Self-bootstrapping schema — what it does and how it was verified

`worker/migrations/schema.sql` is the canonical schema: 9 `CREATE TABLE`/tracking statements, all `IF NOT EXISTS`, plus `INSERT OR IGNORE` seed data. It has always been safe to paste directly into the D1 dashboard Console by hand. What changed: the Worker now also runs this exact SQL **itself**, automatically, as the first entry (`0000_base_schema`) in `worker/src/lib/migrate.ts`'s migration list — generated from `schema.sql` by `worker/scripts/generate-schema-sql.mjs` (`npm run generate:schema`), not hand-duplicated, and checked for drift by `worker/src/lib/migrate.test.ts` on every `vitest run`.

Why this matters for a Git-connected deploy specifically: an automatically-provisioned D1 database is **completely empty** — no tables, not even `products`. Before this change, the first request would fail with:

```
Error: D1_ERROR: no such table: products: SQLITE_ERROR
```

(That's the actual error, reproduced locally against a genuinely empty D1 before the fix, to confirm the failure was real and not just theoretical.)

What was verified locally (a real Cloudflare login was not available in the environment this was built and verified in, so real account provisioning could not be exercised — everything below is against `wrangler dev` and local D1, which is the same code path a deployed Worker runs):

- A **completely empty** local D1 (a fresh `--persist-to` directory, not the developer's own local database) came up correctly: `/api/settings`, `/api/products`, and `/api/categories` all returned `200`, with the Worker's own log showing `[migrate] applied 0000_base_schema` and nothing else.
- The resulting database ended up with all 8 application tables plus `_migrations`, and `_migrations` correctly listing `0000_base_schema` alongside the 15 historical migration names `schema.sql` itself marks as superseded.
- A **second cold start** against that same now-populated database applied nothing (no `[migrate] applied ...` log line at all — the migration was already recorded) and the endpoints still returned identical `200` responses. Idempotency confirmed, not assumed.
- An **already-populated** existing database (the developer's own local seed data — 3 products, 2 orders, 1 customer) was unaffected: same product/order/customer counts before and after, `_migrations` gained exactly one new bookkeeping row (`0000_base_schema`) and nothing else changed. Every statement in `0000_base_schema` is `CREATE ... IF NOT EXISTS` or `INSERT OR IGNORE`, so running it against a database that already has the final schema is a genuine no-op, not just "probably fine."

---

## Option B — CLI (full manual control, no Git integration)

```bash
# 1. Login
npx wrangler login

# 2. Create D1 database and add the printed database_id to wrangler.toml
npx wrangler d1 create edgeshop-db

# 3. Create R2 bucket (stays private — images are proxied through /img/*)
npx wrangler r2 bucket create edgeshop-images

# 4. Build frontend + deploy everything
npm install && npm run deploy
# Schema is applied automatically on the first request after this deploy —
# no separate `wrangler d1 execute --file=schema.sql` step needed. Optional
# demo catalog (safe to skip, safe to re-run — see the file's own header):
#   npx wrangler d1 execute edgeshop-db --remote --file=worker/migrations/seed-pod.sql

# 5. Razorpay webhook secret (optional — only if you use Razorpay)
# echo "your-razorpay-webhook-secret" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET

# 6. First admin: register a customer at /account/register — the FIRST
#    customer ever created is auto-promoted to super_admin. Promote a
#    later account with:
#    npx wrangler d1 execute edgeshop-db --remote --command \
#      "UPDATE customers SET role='super_admin' WHERE email='you@example.com'"
```

There is no `JWT_SECRET` step — see the note under step 5 of the Git flow above for why.

---

## Option C — Cloudflare Dashboard (GUI, no Git integration)

Same end state as Option B, done by clicking instead of typing:

1. **Workers & Pages → D1 → Create database** — name it `edgeshop-db`, copy the printed database ID into `wrangler.toml`'s `database_id`.
2. **Workers & Pages → R2 → Create bucket** — name it `edgeshop-images`. No public-access toggle needed — see the naming note at the top of this guide.
3. **Workers & Pages → Create → Worker → Connect to Git** and follow the same field values as the Git flow's step 3.
4. Deploy — the schema self-bootstraps exactly as described above; no Console-paste step needed.
5. Bindings, secrets, and first-admin login are the same as the Git flow's steps 5-6 above.

---

## Local Development

```bash
# Terminal 1 — Worker + frontend assets (http://localhost:8787)
npm run dev:worker

# Terminal 2 — Vite dev server with HMR (http://localhost:5173, proxies /api → :8787)
npm run dev:frontend
```

No manual local-D1 setup step is required any more — `wrangler dev` self-bootstraps the same way a deployed Worker does, against whatever local D1 file it resolves to. Optional demo catalog (2 sample products, safe to run any time):

```bash
npx wrangler d1 execute edgeshop-db --local --file=worker/migrations/seed-pod.sql
```

> **One-time note for anyone who already had a local database before this change.** `wrangler.toml`'s `database_id` was removed (see "Enable automatic provisioning" in this repo's decision log, `POD.md` §13) so that automatic provisioning can create a real one on a fresh Cloudflare account. Locally, Miniflare derives the on-disk local D1 file's identity partly from `database_id` — so **the very first `wrangler dev` run after pulling this change gets a brand-new, empty local database**, not your previously-seeded one. It self-bootstraps immediately (empty catalog, working `/api/*`), so nothing breaks, but your old local products/orders/customers won't show up under it. Your old data is **not deleted** — it's still on disk under its old identity — you have two options if you want it back:
> - Reseed the new local database (`seed-pod.sql` above, or use the admin UI), **or**
> - Temporarily add `database_id = "<your old local id>"` back to `wrangler.toml` for local work only (don't commit it) to resolve back to the old file.
>
> This is a one-time transition, not an ongoing quirk — once you're on a database identity (with or without an explicit `database_id`), it stays stable across restarts.

---

## Applying Updates

```bash
git pull
npm run deploy   # builds frontend + deploys worker
```

The worker auto-applies any new migrations from `worker/src/lib/migrate.ts` on the first request after deploy — this now includes bootstrapping the base schema on a database that has never seen it, in addition to the incremental migrations that already existed for that purpose.

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

## What gets created automatically, and what doesn't — summary

| Resource | Auto-created via Git-connected deploy? | Notes |
|---|---|---|
| D1 database (`edgeshop-db`) | Expected via automatic provisioning (open beta) — **not directly verifiable without a Cloudflare login**; manual fallback documented above and takes ~2 minutes if it doesn't fire | `wrangler.toml` deliberately omits `database_id` to make this the default path |
| R2 bucket (`edgeshop-images`) | Same as above | `wrangler.toml`'s R2 binding never had a resource id to remove — it was already in the shape provisioning expects |
| Database **schema** (8 tables + indexes + default settings) | **Yes, verified locally** — the Worker creates it itself on first request, independent of whether the database above was auto-provisioned or created manually | See "Self-bootstrapping schema" above |
| R2 bucket **contents** (product images) | **No** — starts empty regardless of how the bucket was created | Upload via Admin → Products after first login |
| First admin account | **No seed user** — first registration is auto-promoted | See step 6 above |
| `RAZORPAY_WEBHOOK_SECRET`, Razorpay keys, email API key | **No** — set manually (dashboard secret for the webhook secret; Admin → Settings for the rest) | See step 5 above |

---

## CI/CD — Auto-deploy on push (alternative to Workers Builds' own Git integration)

If you'd rather run the deploy from GitHub Actions instead of (or in addition to) connecting the repo directly in the Cloudflare dashboard, add to GitHub **Settings → Secrets → Actions**:

| Secret | Where to find |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |

Copy the example workflow from `.github/workflows-example/deploy.yml` to `.github/workflows/deploy.yml` to enable it (it's kept out of `workflows/` on purpose, so a fork doesn't start deploying to someone else's Cloudflare account the moment it's pushed). As shipped it triggers `on: push: branches: [main]` — **update that to `POD`** (or merge `POD` into `main`) for the same reason as the Workers Builds branch note above; this repo does not make that branch decision for you. It builds the frontend and runs `wrangler deploy` — no separate Pages deploy step, since the frontend is served by the same Worker. Whether `wrangler deploy` run this way benefits from automatic provisioning is subject to the exact same open-beta caveat as the Workers Builds path above.

---

## Optional — Protect Admin

In [Cloudflare Zero Trust](https://one.dash.cloudflare.com):
1. **Access → Applications → Add → Self-hosted**
2. Domain: `your-worker.workers.dev/admin*`
3. Add a policy (e.g. allow by email)

No code changes needed — Cloudflare Access blocks `/admin` at the edge, in addition to (not instead of) the app's own `role` check.
