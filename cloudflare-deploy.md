# Deploy ESPOD to Cloudflare — the quick path

This is the short version: connect this repo to Cloudflare and deploy, with **zero manual D1/R2/schema setup** on a fresh account. For the CLI path, the dashboard-GUI-without-Git path, the exact manual fallback if automatic provisioning doesn't fire, local development notes, and what's verified vs. not, see **[DEPLOY.md](./DEPLOY.md)** — this file is the fast path through the same steps, not a separate guide.

> The D1 database (`edgeshop-db`), R2 bucket (`edgeshop-images`) and GitHub repo path (`frier-sam/EdgeShop`) below intentionally still say "EdgeShop" — see DEPLOY.md's naming note for why those infra identifiers weren't renamed along with the brand.

ESPOD runs as a **single Cloudflare Worker** — it serves both the API and the React frontend from one deployment. No separate Pages project, no editing config files, no pasting SQL into a console.

---

## Prerequisites

- Cloudflare account (free tier is fine)
- Your repo pushed to GitHub (`frier-sam/EdgeShop`)

---

## Step 1 — Connect the repo

**Workers & Pages → Create → Import a repository**, connect your GitHub account, select your repo.

> **Set the branch to `POD`.** This code lives on the `POD` branch, not `main` — the setup wizard may default to `main`. Explicitly pick `POD` in the Git integration's branch setting, or merge `POD` into `main` yourself first. This is not done automatically.

---

## Step 2 — Build configuration

| Field | Value |
|---|---|
| Root directory | *(leave empty)* |
| Build command | `npm install && npm run build` |
| Deploy command | `npx wrangler deploy` |

Click **Save and Deploy**.

---

## Step 3 — What just got created automatically (and what didn't)

`wrangler.toml` ships with no `database_id` on its D1 binding and no id on its R2 binding — that's the exact shape Cloudflare's **automatic resource provisioning** (open beta, needs `wrangler` ≥ 4.45.0, which this repo pins) uses as the trigger to create `edgeshop-db` and `edgeshop-images` for you and bind them, with no dashboard clicking required.

**Verification honesty:** provisioning behavior inside a Workers Builds CI run specifically was **not directly testable** in this environment (no Cloudflare login available) — Cloudflare's docs describe the feature but don't explicitly confirm CI/Workers-Builds coverage, and it's open beta. What **was** verified, thoroughly, locally: regardless of how the database gets created, this app creates its own schema — all 8 tables, indexes, and default settings — on the very first API request, against a database with nothing in it. A second cold start applies nothing further (confirmed idempotent), and an already-populated database is left untouched apart from one bookkeeping row. See DEPLOY.md's "Self-bootstrapping schema" section for the exact test evidence.

If the deploy fails because it can't find a D1 database, **DEPLOY.md's "Manual fallback" section** walks through pinning one explicitly with `wrangler d1 create` — about two minutes, not a dead end.

---

## Step 4 — Secrets

Worker → **Settings → Variables and Secrets**:

| Key | Type | Needed? |
|---|---|---|
| `RAZORPAY_WEBHOOK_SECRET` | Secret | Only if you use Razorpay. Skip it to start with Cash on Delivery only. |

That's the only one. **Not** a dashboard secret, on purpose:
- The JWT signing key — the Worker generates and stores its own the first time it's needed. There's no `JWT_SECRET` to set.
- Razorpay Key ID/Secret and your email provider's API key — set later, after logging in, at **Admin → Settings**. They live in the database, not Worker env vars.

---

## Step 5 — First admin login

There's no seeded admin account and no invite screen:

1. Open your worker URL → `/account/register` → register a normal account.
2. The **first** customer ever created in the database is auto-promoted to `role = 'super_admin'`.
3. Log back in (or reload) — `/admin` is now accessible.

To promote a different/later account:
```bash
npx wrangler login
npx wrangler d1 execute edgeshop-db --remote --command \
  "UPDATE customers SET role='super_admin' WHERE email='someone@example.com'"
```

---

## Step 6 — Upload product images

The R2 bucket starts **completely empty**, whether it was auto-provisioned or created manually. Go to **Admin → Products → Add Product** and upload mockups there — the admin UI writes to R2 through the Worker itself, so there's no separate "get the R2 public URL" step (images are served same-origin at `/img/<key>`, by design — see `README.md`).

---

## Step 7 (optional) — Protect `/admin`

[Cloudflare Zero Trust](https://one.dash.cloudflare.com) → **Access → Applications → Add → Self-hosted** → domain `your-worker.workers.dev/admin*` → add a policy (e.g. allow by email). No code changes needed.

---

## Updating later

```bash
git pull
npm run deploy
```

The worker re-applies any new migrations (including the base schema, if it somehow never ran) on the first request after each deploy.

---

Everything else — the CLI-only path, the dashboard-without-Git path, local dev (including a one-time note for anyone with a pre-existing local database), and a full "what's auto-created vs. not" table — is in **[DEPLOY.md](./DEPLOY.md)**.
