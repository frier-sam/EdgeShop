#!/usr/bin/env bash
# EdgeShop POD — non-interactive-ish CLI setup (see deploy.sh for the
# fully interactive walkthrough). Deploys as a SINGLE Cloudflare Worker
# (root wrangler.toml) that serves both the API and the built frontend —
# there is no separate Cloudflare Pages project.
set -e
set -o pipefail

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}[EdgeShop]${NC} $1"; }
success() { echo -e "${GREEN}[EdgeShop]${NC} $1"; }
warn()    { echo -e "${YELLOW}[EdgeShop]${NC} $1"; }
error()   { echo -e "${RED}[EdgeShop]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

DB_NAME="edgeshop-db"
BUCKET_NAME="edgeshop-images"

# ─── Prerequisites ───────────────────────────────────────────────────────────
info "Checking prerequisites..."
command -v node    >/dev/null 2>&1 || error "node not found. Install from https://nodejs.org"
command -v openssl >/dev/null 2>&1 || error "openssl not found."
success "Prerequisites OK"

# ─── Install dependencies ────────────────────────────────────────────────────
info "Installing dependencies (root workspaces: worker + frontend, incl. wrangler)..."
npm install
success "Dependencies installed"

npx wrangler whoami >/dev/null 2>&1 || { info "Not logged in — opening Cloudflare login..."; npx wrangler login; }
success "Logged in to Cloudflare"

# ─── D1 Database ─────────────────────────────────────────────────────────────
info "Creating D1 database (${DB_NAME})..."
DB_OUTPUT=$(npx wrangler d1 create "$DB_NAME" 2>&1 || true)

if echo "$DB_OUTPUT" | grep -q "already exists"; then
  warn "D1 database already exists — fetching existing ID..."
  DB_ID=$(npx wrangler d1 list 2>/dev/null \
    | grep -E "\b${DB_NAME}\b" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1 || true)
else
  DB_ID=$(echo "$DB_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
fi

if [ -z "$DB_ID" ]; then
  error "Could not determine D1 database ID. Check 'npx wrangler d1 list' and update wrangler.toml manually with the correct database_id."
fi

# Patch wrangler.toml (repo root) — match on the KEY, not a specific
# placeholder value, since the committed file carries the original dev
# database's real (but useless-to-you) id, not a literal placeholder string.
sed -i.bak "s/^database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml
rm -f wrangler.toml.bak
grep -q "database_id = \"$DB_ID\"" wrangler.toml \
  || error "Failed to patch database_id in wrangler.toml. Please update it manually: database_id = \"$DB_ID\""
success "D1 database ready (ID: $DB_ID)"

# ─── D1 Schema ────────────────────────────────────────────────────────────────
# A single canonical schema file, not a sequence of numbered migrations —
# see worker/migrations/schema.sql. (An existing pre-POD deployment instead
# converges automatically via worker/src/lib/migrate.ts on first request;
# this path is for a brand-new database only.)
info "Applying schema..."
npx wrangler d1 execute "$DB_NAME" --remote --file=worker/migrations/schema.sql
success "Schema applied"

# ─── R2 Bucket ───────────────────────────────────────────────────────────────
info "Creating R2 bucket (${BUCKET_NAME})..."
R2_OUTPUT=$(npx wrangler r2 bucket create "$BUCKET_NAME" 2>&1 || true)
if echo "$R2_OUTPUT" | grep -q "already exists"; then
  warn "R2 bucket already exists — skipping creation"
else
  success "R2 bucket created"
fi
sed -i.bak "s/^bucket_name = \".*\"/bucket_name = \"$BUCKET_NAME\"/" wrangler.toml
rm -f wrangler.toml.bak

success "R2 bucket ready — it stays private; images are proxied through the worker at /img/<key>"

# ─── Secrets ─────────────────────────────────────────────────────────────────
info "Setting secrets..."

JWT_SECRET=$(openssl rand -hex 32)
printf '%s' "$JWT_SECRET" | npx wrangler secret put JWT_SECRET
success "JWT_SECRET auto-generated and set"

echo ""
warn "Razorpay webhook secret is optional — Cash on Delivery needs no payment setup at all,"
warn "and Razorpay API keys themselves are configured later in Admin → Settings → Payments."
read -rp "$(echo -e "${CYAN}RAZORPAY_WEBHOOK_SECRET (press Enter to skip):${NC} ")" RZP_SECRET
if [ -n "$RZP_SECRET" ]; then
  printf '%s' "$RZP_SECRET" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
  success "RAZORPAY_WEBHOOK_SECRET set"
else
  warn "Skipped — set later with: npx wrangler secret put RAZORPAY_WEBHOOK_SECRET"
fi

# ─── Build + Deploy ────────────────────────────────────────────────────────────
info "Building frontend and deploying the worker..."
DEPLOY_OUT=$(npm run deploy 2>&1)
echo "$DEPLOY_OUT"
success "Deployed"

WORKER_URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://[a-zA-Z0-9._-]+\.workers\.dev' | head -1 || true)
WORKER_URL="${WORKER_URL:-https://edgeshop.<your-subdomain>.workers.dev}"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  EdgeShop deployed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Storefront:  ${CYAN}${WORKER_URL}${NC}"
echo -e "  Admin:       ${CYAN}${WORKER_URL}/admin${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Create your admin account — there is no seeded admin user:"
echo "     Register normally at ${WORKER_URL}/account/register."
echo "     The FIRST customer ever created is auto-promoted to super_admin."
echo "     To promote a LATER account instead:"
echo "       npx wrangler d1 execute ${DB_NAME} --remote --command \\"
echo "         \"UPDATE customers SET role='super_admin' WHERE email='you@example.com'\""
echo ""
echo "  2. Protect /admin with Cloudflare Access (optional but recommended):"
echo "     Zero Trust Dashboard → Access → Applications → Add Self-hosted"
echo "     Application URL: ${WORKER_URL}/admin/*"
echo ""
echo "  3. Configure payments and email (optional):"
echo "     Admin → Settings → Payments (Razorpay) / Email (Resend, SendGrid, Brevo)"
echo ""
echo "  4. Set your store name and currency:"
echo "     Admin → Settings → Store"
echo ""
echo -e "${YELLOW}To deploy updates in future:${NC}"
echo "  npm run deploy"
echo ""
