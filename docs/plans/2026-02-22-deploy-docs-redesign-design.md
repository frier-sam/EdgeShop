# Design: Deploy Docs Redesign + Deployment Automation

**Date:** 2026-02-22
**Status:** Approved

## Goal

Update `README.md` and `DEPLOY.md` to reflect the current state of EdgeShop (v2, 11 migrations, integrations, staff roles, customer accounts, etc.), add a "Deploy to Cloudflare" button, create a first-time setup script (`scripts/setup.sh`), migrate to wrangler's built-in D1 migrations tracking, and add a GitHub Actions CI/CD workflow for automated deploys on push to main.

## Decisions

### 1. D1 Migrations — Switch to wrangler built-in tracking

Add `migrations_dir = "migrations"` to `[[d1_databases]]` in `worker/wrangler.toml`. Wrangler creates a `d1_migrations` tracking table in D1 and `wrangler d1 migrations apply --remote` only applies pending migrations. Replaces the current manual `--file=` per-migration approach.

### 2. Deploy script in worker/package.json

Add a `deploy` script that chains migrations + worker deploy:
```
"deploy": "wrangler d1 migrations apply edgeshop-db --remote && wrangler deploy"
```
Users run `npm run deploy` instead of bare `wrangler deploy`. Migrations are always applied first, idempotently.

### 3. scripts/setup.sh — First-time setup

Covers the entire first-time install:
- Checks for `wrangler` CLI and login
- Creates D1 database, captures `database_id`, auto-patches `worker/wrangler.toml`
- Runs `wrangler d1 migrations apply edgeshop-db --remote` (all 11 migrations)
- Creates R2 bucket, prompts user to enable public access + paste the public URL, auto-patches `wrangler.toml`
- Auto-generates JWT secret via `openssl rand -hex 32`, sets via `wrangler secret put JWT_SECRET`
- Optionally prompts for `RAZORPAY_WEBHOOK_SECRET` (skippable — can be added later)
- Deploys the Worker (`npm run deploy` in worker/)
- Builds and deploys the frontend to Pages
- Prints a summary (admin URL, next steps: Cloudflare Access setup)

Idempotent: checks if resources already exist before creating.

### 4. .github/workflows/deploy.yml — CI/CD on push to main

Two jobs:
- **deploy-worker**: `cd worker && npm run deploy` (runs migrations + deploys Worker)
- **deploy-frontend**: `cd frontend && npm run build && wrangler pages deploy dist --project-name edgeshop`

Required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`.
Migrations are handled by the `npm run deploy` script — no separate migrations step needed in CI.

### 5. README.md updates

- Add "Deploy to Cloudflare" badge at top (placeholder: `github.com/YOUR_USERNAME/edgeshop`)
- One-liner setup instructions pointing to `scripts/setup.sh`
- Expand feature list to cover v2 features: customer accounts, digital products, staff/permissions, collections, blog, reviews, discount codes, integrations (ShipRocket, email providers), abandoned cart recovery, sitemap, OG tags
- Update project structure tree
- Keep concise — DEPLOY.md has the detail

### 6. DEPLOY.md rewrite

Sections:
1. Prerequisites
2. One-command setup (setup.sh)
3. Manual step-by-step (for users who want control)
   - Create D1, run migrations via `wrangler d1 migrations apply`
   - Create R2, enable public access
   - Set secrets (JWT auto-generated, Razorpay optional)
   - Deploy Worker, deploy Pages
4. Cloudflare Access setup (admin protection)
5. Integrations (Razorpay keys in admin, email providers, ShipRocket)
6. CI/CD with GitHub Actions
7. Local development
8. Applying future updates (`git pull && cd worker && npm run deploy`)

## What we do NOT ask during setup

- Razorpay Key ID / Secret — configured via Admin → Integrations → Payment
- Email provider keys — configured via Admin → Integrations → Email
- ShipRocket credentials — configured via Admin → Integrations → Shipping
