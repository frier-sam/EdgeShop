# Deploy Docs Redesign + Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul `README.md` and `DEPLOY.md` to reflect EdgeShop's current state, add a Deploy to Cloudflare button, switch D1 migrations to wrangler's built-in tracking, create a one-command `scripts/setup.sh`, and add a GitHub Actions CI/CD workflow.

**Architecture:** Wrangler's `migrations_dir` setting turns `wrangler d1 migrations apply` into an idempotent tracked migration runner — this replaces the current manual `--file=` per-migration approach and handles both first-time setup and future updates. The `worker/package.json` deploy script chains migrations + deploy so `npm run deploy` is always safe. `scripts/setup.sh` covers the one-time infra setup (D1, R2, secrets, initial deploy). GitHub Actions automates all of this on push to main.

**Tech Stack:** Bash, wrangler CLI, GitHub Actions, Cloudflare Workers/Pages/D1/R2.

---

## Task 1: Enable wrangler D1 migration tracking

**Files:**
- Modify: `worker/wrangler.toml`
- Modify: `worker/package.json`
- Modify: `package.json` (root)

Wrangler has a built-in migration tracker. Add `migrations_dir = "migrations"` to the `[[d1_databases]]` block and wrangler will create a `d1_migrations` table in D1, tracking which files have been applied. Running `wrangler d1 migrations apply <db-name> --remote` then only applies pending ones — idempotent and safe to run on every deploy.

**Step 1:** Update `worker/wrangler.toml` — add `migrations_dir` to the D1 block and clean up the stale manual comments at the bottom:

```toml
name = "edgeshop-worker"
main = "src/index.ts"
compatibility_date = "2024-10-22"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "edgeshop-db"
database_id = "placeholder-replace-after-creation"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "edgeshop-images"

[vars]
R2_PUBLIC_URL = "https://pub-REPLACE.r2.dev"
FRONTEND_URL = "https://edgeshop.pages.dev"

[triggers]
crons = ["0 * * * *"]
```

Note: `RAZORPAY_WEBHOOK_SECRET` moved out of `[vars]` (it was blank anyway — it's a secret set via `wrangler secret put`, not a var).

**Step 2:** Update `worker/package.json` — change the `deploy` script to run migrations first, then deploy:

```json
{
  "name": "@edgeshop/worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler d1 migrations apply edgeshop-db --remote && wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.6.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241022.0",
    "typescript": "^5.5.0",
    "wrangler": "^3.80.0"
  }
}
```

**Step 3:** Update root `package.json` — align `deploy:worker` to use `npm run deploy` (which now includes migrations):

```json
{
  "name": "edgeshop",
  "private": true,
  "workspaces": ["worker", "frontend"],
  "scripts": {
    "dev:worker": "cd worker && wrangler dev",
    "dev:frontend": "cd frontend && vite",
    "deploy:worker": "cd worker && npm run deploy",
    "deploy:frontend": "cd frontend && npm run build && npx wrangler pages deploy dist --project-name edgeshop"
  }
}
```

**Step 4:** Commit:
```bash
git add worker/wrangler.toml worker/package.json package.json
git commit -m "chore: switch D1 to wrangler migration tracking, chain migrations into deploy script"
```

---

## Task 2: Create scripts/setup.sh

**Files:**
- Create: `scripts/setup.sh`

This is the one-command first-time setup. It covers: check prerequisites → create D1 → apply all migrations → create R2 → prompt for R2 public URL → patch wrangler.toml → auto-generate JWT secret → optionally set Razorpay webhook secret → deploy worker → build + deploy frontend → print summary.

Key implementation notes:
- Use `sed -i` to patch `worker/wrangler.toml` with real `database_id` and `R2_PUBLIC_URL`
- Use `openssl rand -hex 32` for JWT secret auto-generation
- Check if D1/R2 already exist before creating (idempotent)
- Run from repo root (not `worker/`)

**Step 1:** Create `scripts/setup.sh`:

```bash
#!/usr/bin/env bash
set -e

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[EdgeShop]${NC} $1"; }
success() { echo -e "${GREEN}[EdgeShop]${NC} $1"; }
warn()    { echo -e "${YELLOW}[EdgeShop]${NC} $1"; }
error()   { echo -e "${RED}[EdgeShop]${NC} $1"; exit 1; }

# ─── Prerequisites ───────────────────────────────────────────────────────────
info "Checking prerequisites..."
command -v wrangler >/dev/null 2>&1 || error "wrangler not found. Run: npm install -g wrangler"
command -v node    >/dev/null 2>&1 || error "node not found. Install from https://nodejs.org"
command -v openssl >/dev/null 2>&1 || error "openssl not found."
wrangler whoami >/dev/null 2>&1    || error "Not logged in to Cloudflare. Run: wrangler login"
success "Prerequisites OK"

# ─── Install dependencies ────────────────────────────────────────────────────
info "Installing dependencies..."
npm install --silent
success "Dependencies installed"

# ─── D1 Database ─────────────────────────────────────────────────────────────
info "Creating D1 database (edgeshop-db)..."
DB_OUTPUT=$(wrangler d1 create edgeshop-db 2>&1 || true)

if echo "$DB_OUTPUT" | grep -q "already exists"; then
  warn "D1 database already exists — fetching existing ID..."
  DB_ID=$(wrangler d1 list --json 2>/dev/null | grep -A1 '"name": "edgeshop-db"' | grep '"uuid"' | sed 's/.*"uuid": "\([^"]*\)".*/\1/' || true)
  # Fallback: parse from info command
  if [ -z "$DB_ID" ]; then
    DB_ID=$(wrangler d1 info edgeshop-db 2>&1 | grep -i "database_id\|uuid" | head -1 | awk '{print $NF}' | tr -d '",' || true)
  fi
else
  DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | awk '{print $NF}' | tr -d '",' || true)
fi

if [ -z "$DB_ID" ]; then
  error "Could not determine D1 database ID. Check 'wrangler d1 list' and update worker/wrangler.toml manually."
fi

# Patch wrangler.toml
sed -i.bak "s/database_id = \"placeholder-replace-after-creation\"/database_id = \"$DB_ID\"/" worker/wrangler.toml
rm -f worker/wrangler.toml.bak
success "D1 database ready (ID: $DB_ID)"

# ─── D1 Migrations ───────────────────────────────────────────────────────────
info "Applying D1 migrations..."
cd worker
wrangler d1 migrations apply edgeshop-db --remote
cd ..
success "All migrations applied"

# ─── R2 Bucket ───────────────────────────────────────────────────────────────
info "Creating R2 bucket (edgeshop-images)..."
wrangler r2 bucket create edgeshop-images 2>&1 | grep -v "already exists" || true
success "R2 bucket ready"

echo ""
warn "ACTION REQUIRED: Enable public access on your R2 bucket."
warn "  1. Go to Cloudflare Dashboard → R2 → edgeshop-images → Settings → Public Access"
warn "  2. Enable public access and copy the public URL (looks like: https://pub-xxxx.r2.dev)"
echo ""
read -rp "$(echo -e "${CYAN}Paste your R2 public URL:${NC} ")" R2_PUBLIC_URL

if [ -z "$R2_PUBLIC_URL" ]; then
  warn "No R2 URL provided — skipping. Update R2_PUBLIC_URL in worker/wrangler.toml manually."
else
  sed -i.bak "s|R2_PUBLIC_URL = \"https://pub-REPLACE.r2.dev\"|R2_PUBLIC_URL = \"$R2_PUBLIC_URL\"|" worker/wrangler.toml
  rm -f worker/wrangler.toml.bak
  success "R2 public URL set"
fi

# ─── Secrets ─────────────────────────────────────────────────────────────────
info "Setting secrets..."

# JWT secret — auto-generate
JWT_SECRET=$(openssl rand -hex 32)
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET --name edgeshop-worker
success "JWT_SECRET auto-generated and set"

# Razorpay webhook secret — optional
echo ""
warn "Razorpay webhook secret is optional at this stage."
warn "You can set it now, or later via: wrangler secret put RAZORPAY_WEBHOOK_SECRET"
read -rp "$(echo -e "${CYAN}Enter RAZORPAY_WEBHOOK_SECRET (press Enter to skip):${NC} ")" RZP_SECRET
if [ -n "$RZP_SECRET" ]; then
  echo "$RZP_SECRET" | wrangler secret put RAZORPAY_WEBHOOK_SECRET --name edgeshop-worker
  success "RAZORPAY_WEBHOOK_SECRET set"
else
  warn "Skipped — configure Razorpay keys via Admin → Integrations → Payment after deploy"
fi

# ─── Deploy Worker ────────────────────────────────────────────────────────────
info "Deploying Worker..."
cd worker
npm run deploy
cd ..
success "Worker deployed"

# Capture worker URL
WORKER_URL=$(wrangler deployments list --name edgeshop-worker 2>/dev/null | grep "workers.dev" | head -1 | awk '{print $NF}' || echo "https://edgeshop-worker.<your-subdomain>.workers.dev")

# ─── Update FRONTEND_URL ─────────────────────────────────────────────────────
echo ""
warn "What will your Cloudflare Pages URL be?"
warn "  Default: https://edgeshop.pages.dev"
warn "  (You can leave blank to use the default, update later in worker/wrangler.toml)"
read -rp "$(echo -e "${CYAN}Pages URL (press Enter for default):${NC} ")" PAGES_URL
PAGES_URL="${PAGES_URL:-https://edgeshop.pages.dev}"

sed -i.bak "s|FRONTEND_URL = \"https://edgeshop.pages.dev\"|FRONTEND_URL = \"$PAGES_URL\"|" worker/wrangler.toml
rm -f worker/wrangler.toml.bak

# Re-deploy worker with updated FRONTEND_URL
info "Re-deploying Worker with updated FRONTEND_URL..."
cd worker && wrangler deploy && cd ..

# ─── Deploy Frontend ──────────────────────────────────────────────────────────
info "Building and deploying frontend..."
cd frontend
npm install --silent
npm run build
npx wrangler pages deploy dist --project-name edgeshop
cd ..
success "Frontend deployed"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  EdgeShop deployed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Store:  ${CYAN}$PAGES_URL${NC}"
echo -e "  Admin:  ${CYAN}$PAGES_URL/admin${NC}"
echo -e "  API:    ${CYAN}$WORKER_URL${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Protect /admin with Cloudflare Access:"
echo "     Dashboard → Zero Trust → Access → Applications → Add"
echo "     URL: $PAGES_URL/admin/*"
echo ""
echo "  2. Configure payments (optional):"
echo "     Admin → Integrations → Payment → Enter Razorpay keys"
echo ""
echo "  3. Configure email (optional):"
echo "     Admin → Integrations → Email → Enter Resend/SendGrid/Brevo key"
echo ""
echo "  4. Set your store name:"
echo "     Admin → Settings → Store Name"
echo ""
echo -e "${YELLOW}To deploy updates in future:${NC}"
echo "  cd worker && npm run deploy"
echo "  cd frontend && npm run build && npx wrangler pages deploy dist --project-name edgeshop"
echo ""
```

**Step 2:** Make the script executable and commit:
```bash
chmod +x scripts/setup.sh
git add scripts/setup.sh
git commit -m "feat: add one-command setup script (scripts/setup.sh)"
```

---

## Task 3: Create .github/workflows/deploy.yml

**Files:**
- Create: `.github/workflows/deploy.yml`

On every push to `main`, deploy the Worker (with migrations) and the frontend. Requires three GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

**Step 1:** Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy-worker:
    name: Deploy Worker
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: worker
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: worker/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Deploy (migrations + worker)
        run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: deploy-worker
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Pages
        run: npx wrangler pages deploy dist --project-name edgeshop
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Note: `deploy-frontend` runs after `deploy-worker` (`needs: deploy-worker`) so the API is always up-to-date before the frontend is live.

**Step 2:** Commit:
```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions CI/CD workflow (deploy on push to main)"
```

---

## Task 4: Update DEPLOY.md

**Files:**
- Modify: `DEPLOY.md`

Full rewrite. Sections: Prerequisites → One-command setup → Manual step-by-step (all 11 migrations via `wrangler d1 migrations apply`) → Cloudflare Access → Integrations → CI/CD → Local dev → Applying updates.

**Step 1:** Replace the entire contents of `DEPLOY.md`:

```markdown
# Deployment Guide

## Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- Node.js 18+
- wrangler CLI: `npm install -g wrangler`
- Logged in: `wrangler login`

---

## Option A — One-command setup (recommended)

```bash
bash scripts/setup.sh
```

The script handles everything:
- Creates D1 database and applies all migrations
- Creates R2 bucket (you enable public access manually — one click in dashboard)
- Auto-generates a JWT secret
- Optionally sets Razorpay webhook secret (can be skipped — Razorpay keys go in Admin)
- Deploys the Worker and frontend
- Prints your store URL, admin URL, and next steps

---

## Option B — Manual step-by-step

### 1. Create D1 Database

```bash
npx wrangler d1 create edgeshop-db
```

Copy the `database_id` from the output and update `worker/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "edgeshop-db"
database_id = "YOUR_DATABASE_ID_HERE"   # ← replace this
migrations_dir = "migrations"
```

### 2. Apply Migrations

```bash
cd worker
npx wrangler d1 migrations apply edgeshop-db --remote
```

This applies all 11 migrations in order and tracks which ones have run. Safe to re-run — only pending migrations are applied. Run this same command whenever you pull new migrations from an EdgeShop update.

### 3. Create R2 Bucket

```bash
npx wrangler r2 bucket create edgeshop-images
```

Enable public access in the Cloudflare dashboard:
**R2 → edgeshop-images → Settings → Public Access → Enable**

Copy the public URL (e.g. `https://pub-xxxx.r2.dev`) and update `worker/wrangler.toml`:

```toml
[vars]
R2_PUBLIC_URL = "https://pub-xxxx.r2.dev"   # ← replace this
```

### 4. Set Secrets

```bash
cd worker

# Required for customer auth (auto-generated by setup.sh, or generate manually)
echo "$(openssl rand -hex 32)" | npx wrangler secret put JWT_SECRET

# Optional — Razorpay webhook signature verification
# (Razorpay API keys go in Admin → Integrations → Payment, not here)
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
```

### 5. Deploy Worker

```bash
cd worker
npm run deploy
```

This applies any pending migrations, then deploys the Worker. Note the worker URL from the output.

### 6. Deploy Frontend

Update `FRONTEND_URL` in `worker/wrangler.toml` to your Pages URL first, then re-deploy the worker:

```bash
# In worker/wrangler.toml, set:
# FRONTEND_URL = "https://edgeshop.pages.dev"  (or your custom domain)

cd worker && npm run deploy  # re-deploy with updated FRONTEND_URL

cd ../frontend
npm run build
npx wrangler pages deploy dist --project-name edgeshop
```

### 7. Protect Admin with Cloudflare Access

In [Cloudflare Zero Trust](https://one.dash.cloudflare.com):
1. **Access → Applications → Add an application → Self-hosted**
2. Application domain: `edgeshop.pages.dev/admin/*`
3. Add a policy (e.g. allow by email)

No auth code needed in the app — Cloudflare Access intercepts `/admin/*` at the edge.

---

## Integrations

All third-party integrations are configured via **Admin → Integrations** after deployment.

| Integration | Where to configure |
|---|---|
| Razorpay (payments) | Admin → Integrations → Payment |
| Resend / SendGrid / Brevo (email) | Admin → Integrations → Email |
| ShipRocket (shipping) | Admin → Integrations → Shipping |

---

## CI/CD — Auto-deploy on push to main

Add these secrets to your GitHub repository (**Settings → Secrets → Actions**):

| Secret | Where to find it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Cloudflare dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → Create Token → Edit Cloudflare Workers template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar on any page |

Once set, every push to `main` automatically:
1. Applies any pending D1 migrations
2. Deploys the Worker
3. Builds and deploys the frontend to Pages

The workflow is at `.github/workflows/deploy.yml`.

---

## Local Development

```bash
# Terminal 1 — Worker (http://localhost:8787)
cd worker && npx wrangler dev

# Terminal 2 — Frontend (http://localhost:5173, proxies /api to :8787)
cd frontend && npm run dev
```

Local D1 setup (first time only):
```bash
cd worker
npx wrangler d1 migrations apply edgeshop-db --local
```

---

## Applying Updates

When you pull a new version of EdgeShop that adds migrations:

```bash
git pull
cd worker && npm run deploy          # applies new migrations + deploys worker
cd ../frontend && npm run build && npx wrangler pages deploy dist --project-name edgeshop
```

That's it. `npm run deploy` in the worker always runs pending migrations first.
```

**Step 2:** Commit:
```bash
git add DEPLOY.md
git commit -m "docs: rewrite DEPLOY.md with migration tracking, setup script, CI/CD, integrations"
```

---

## Task 5: Update README.md

**Files:**
- Modify: `README.md`

Add deploy button, update feature list, update quick-start to use setup script, update project structure tree.

**Step 1:** Replace the entire contents of `README.md`:

```markdown
# EdgeShop

A complete e-commerce platform that runs entirely on Cloudflare's free tier — no servers, no monthly bills.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/edgeshop)

---

## Why this exists

Most e-commerce platforms charge $30–$300/month just for hosting. Cloudflare gives you Workers, Pages, D1 (SQLite), and R2 (object storage) for free. EdgeShop is built to fit exactly within those limits, making it a viable option for small businesses and independent sellers who want a real storefront without recurring hosting costs.

---

## What it does

**Storefront**
- Product listings with variants (size, colour, etc.)
- Collection pages, full-text search, product detail with image gallery
- Customer accounts (register, login, order history, password reset)
- Blog, static pages, contact form
- Checkout with Razorpay (UPI, cards, netbanking) or Cash on Delivery
- Discount codes, digital product downloads, abandoned cart recovery

**Admin panel**
- Products: CRUD, variants, image gallery, collections, bulk CSV import
- Orders: detail view, status management, tracking numbers, refunds, order events
- Customers: list, order history, delete (GDPR-friendly)
- Discounts, reviews moderation, blog management, static pages editor
- Navigation menu editor, footer editor
- Appearance: live theme switcher + CSS variable customizer
- Integrations: Razorpay, Resend/SendGrid/Brevo email, ShipRocket shipping
- Staff management with per-permission roles
- Analytics: revenue charts, dashboard stats
- Protected by Cloudflare Access (Zero Trust) — no auth code in the app

**Two themes included**
- **Jewellery** — luxury editorial, off-white + gold, Playfair Display serif
- **Arts & Crafts** — warm handmade, linen + terracotta, bold sans-serif

Themes are fully swappable from the admin panel. Each theme has its own Header, Hero, ProductCard, ProductGrid, CartDrawer, and Footer — adding a new theme requires zero changes to page-level code.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v4, React Router v6, TanStack Query v5, Zustand |
| API | [Hono](https://hono.dev/) on Cloudflare Workers |
| Database | Cloudflare D1 (serverless SQLite) |
| File storage | Cloudflare R2 (S3-compatible) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |
| Payments | Razorpay + Cash on Delivery |
| Auth | Cloudflare Access (Zero Trust) for admin; PBKDF2 + JWT for customers |

---

## How image uploads stay within free limits

Cloudflare Workers have a 10ms CPU limit on the free tier. Resizing images server-side would blow past this. Instead, image processing happens entirely in the browser:

1. Admin picks an image
2. Browser resizes it to max 1000px and converts to WebP using the Canvas API
3. Worker issues a key for R2
4. Browser uploads the optimised file directly to R2

No paid image transformation service needed.

---

## Getting started

```bash
# Clone and run the setup script
git clone https://github.com/YOUR_USERNAME/edgeshop.git
cd edgeshop
bash scripts/setup.sh
```

The script creates your D1 database, applies all migrations, sets up R2, generates secrets, and deploys everything. See [DEPLOY.md](./DEPLOY.md) for the full guide and manual steps.

**Local development:**
```bash
# Terminal 1
cd worker && npx wrangler dev

# Terminal 2
cd frontend && npm run dev   # proxies /api to :8787
```

---

## Project structure

```
edgeshop/
├── scripts/
│   └── setup.sh              # One-command first-time setup
├── .github/workflows/
│   └── deploy.yml            # CI/CD: deploy on push to main
├── frontend/                 # React app (Cloudflare Pages)
│   └── src/
│       ├── admin/            # Admin panel pages + components
│       ├── pages/            # Storefront pages
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
```

**Step 2:** Commit:
```bash
git add README.md
git commit -m "docs: update README with deploy button, full feature list, setup script quick-start"
```

---

## Key Decisions

| Decision | Rationale |
|---|---|
| `migrations_dir` + `wrangler d1 migrations apply` | Replaces manual `--file=` per-migration; wrangler tracks applied migrations in `d1_migrations` table; idempotent |
| `npm run deploy` chains migrations + worker deploy | One command is always safe — migrations run first, worker deploys second; no forgetting to apply migrations |
| `scripts/setup.sh` auto-generates JWT secret | No user decision needed; `openssl rand -hex 32` gives 256 bits of entropy; secret stored in Workers secrets vault |
| Razorpay keys not in setup script | Keys go in Admin → Integrations; webhook secret is the only server-side secret needed at deploy time |
| CI/CD `deploy-frontend` depends on `deploy-worker` | Ensures API schema is always updated before the frontend that consumes it goes live |
