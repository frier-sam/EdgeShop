#!/usr/bin/env bash
# ============================================================
#  EdgeShop POD — One-Click Cloudflare Deploy
#  Usage: bash deploy.sh
#
#  Deploys as a SINGLE Cloudflare Worker (root wrangler.toml)
#  that serves the API (/api/*, /img/*, /sitemap.xml) AND the
#  built React frontend via the [assets] binding. There is no
#  separate Cloudflare Pages project — see README.md / DEPLOY.md.
# ============================================================
set -euo pipefail

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Helpers ───────────────────────────────────────────────────
log()     { echo -e "${BLUE}▶${NC}  $*"; }
success() { echo -e "${GREEN}✓${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
ask()     { echo -e "${YELLOW}?${NC}  $*"; }
hr()      { echo -e "${CYAN}────────────────────────────────────────────────${NC}"; }

header() {
  echo ""
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $*${NC}"
  echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════${NC}"
  echo ""
}

# Cross-platform in-place sed
sed_i() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

cd "$SCRIPT_DIR"

# ── Step 1: Prerequisites ─────────────────────────────────────
check_prerequisites() {
  header "1 / 6 — Checking Prerequisites"

  command -v node >/dev/null 2>&1 \
    || die "Node.js not found. Install from https://nodejs.org"
  success "Node.js $(node --version)"

  command -v npm >/dev/null 2>&1 \
    || die "npm not found."
  success "npm $(npm --version)"

  log "Installing dependencies (root workspaces: worker + frontend)..."
  npm install --silent
  success "Dependencies installed — wrangler is available via npx from the repo root"
}

# ── Step 2: Auth ──────────────────────────────────────────────
check_auth() {
  header "2 / 6 — Cloudflare Authentication"

  if ! npx wrangler whoami >/dev/null 2>&1; then
    warn "Not logged in — opening Cloudflare login..."
    npx wrangler login
  fi

  success "Logged in to Cloudflare ($(npx wrangler whoami 2>/dev/null | grep -oE '[^ ]+@[^ ]+\.[^ ]+' | head -1 || echo 'unknown account'))"
}

# ── Step 3: Collect config ────────────────────────────────────
collect_config() {
  header "3 / 6 — Configuration"

  echo "  Press Enter to accept defaults shown in [brackets]."
  echo ""

  ask "Store display name [EdgeShop]:"
  printf "  › "
  read -r STORE_NAME
  STORE_NAME="${STORE_NAME:-EdgeShop}"

  ask "Razorpay Webhook Secret (leave blank — you can set it later, or skip Razorpay entirely and use COD only):"
  printf "  › "
  read -rs RAZORPAY_SECRET
  echo ""

  JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || true)
  if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET="$(date +%s)-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
  fi
  success "JWT secret auto-generated"

  ask "Resend API Key for transactional email (leave blank — you can set it later in Admin → Settings):"
  printf "  › "
  read -rs RESEND_API_KEY
  echo ""

  hr
  echo "  Store name    : $STORE_NAME"
  echo "  Webhook secret: ${RAZORPAY_SECRET:+(set)}"
  echo "  JWT secret    : (auto-generated)"
  echo "  Resend API key: ${RESEND_API_KEY:+(set)}"
  hr

  DB_NAME="edgeshop-db"
  BUCKET_NAME="edgeshop-images"
}

# ── Step 4: D1 database ───────────────────────────────────────
setup_d1() {
  header "4 / 6 — D1 Database"

  # Check if already created
  EXISTING_DB_ID=$(npx wrangler d1 list 2>/dev/null \
    | grep -E "\b${DB_NAME}\b" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1 || true)

  if [[ -n "$EXISTING_DB_ID" ]]; then
    warn "Database '$DB_NAME' already exists (id: $EXISTING_DB_ID) — skipping creation."
    DB_ID="$EXISTING_DB_ID"
  else
    log "Creating D1 database: $DB_NAME"
    D1_OUT=$(npx wrangler d1 create "$DB_NAME" 2>&1)
    echo "$D1_OUT"
    DB_ID=$(echo "$D1_OUT" \
      | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
      | head -1 || true)
    if [[ -z "$DB_ID" ]]; then
      die "Could not parse database_id from wrangler output. Check output above."
    fi
    success "D1 database created: $DB_ID"
  fi

  # Patch wrangler.toml (repo root) — match on the KEY, not a specific
  # placeholder value, since the committed file already carries the
  # original dev database's real (but useless-to-you) id.
  log "Patching wrangler.toml with your database_id..."
  sed_i "s/^database_id = \".*\"/database_id = \"${DB_ID}\"/" wrangler.toml
  grep -q "database_id = \"${DB_ID}\"" wrangler.toml \
    || die "Failed to patch database_id in wrangler.toml. Set it manually: database_id = \"${DB_ID}\""
  success "wrangler.toml patched"

  # Apply the canonical POD schema — a single file, not a sequence of
  # numbered migrations (those were retired; see worker/migrations/schema.sql).
  log "Applying schema..."
  npx wrangler d1 execute "$DB_NAME" --remote --file=worker/migrations/schema.sql
  success "Schema applied"

  # Seed store name
  log "Seeding store name..."
  npx wrangler d1 execute "$DB_NAME" --remote \
    --command="INSERT OR REPLACE INTO settings (key, value) VALUES ('store_name', '${STORE_NAME}')"
  success "Store name seeded: $STORE_NAME"
}

# ── Step 5: R2 bucket ─────────────────────────────────────────
setup_r2() {
  header "5 / 6 — R2 Image Storage"

  if npx wrangler r2 bucket list 2>/dev/null | grep -q "\b${BUCKET_NAME}\b"; then
    warn "R2 bucket '$BUCKET_NAME' already exists — skipping creation."
  else
    log "Creating R2 bucket: $BUCKET_NAME"
    npx wrangler r2 bucket create "$BUCKET_NAME"
    success "R2 bucket created: $BUCKET_NAME"
  fi

  sed_i "s/^bucket_name = \".*\"/bucket_name = \"${BUCKET_NAME}\"/" wrangler.toml

  success "R2 bucket ready — no public access step needed. All objects (mockups, uploads, design previews) are served same-origin through the worker at /img/<key>, so the bucket stays private."
}

# ── Step 6: Build + deploy ────────────────────────────────────
deploy_worker() {
  header "6 / 6 — Building & Deploying"

  log "Building frontend and deploying the worker (npm run deploy)..."
  WORKER_OUT=$(npm run deploy 2>&1)
  echo "$WORKER_OUT"

  WORKER_URL=$(echo "$WORKER_OUT" \
    | grep -oE 'https://[a-zA-Z0-9._-]+\.workers\.dev' \
    | head -1 || true)

  if [[ -z "$WORKER_URL" ]]; then
    warn "Could not auto-detect worker URL from output."
    ask "Enter your worker URL (shown in Cloudflare dashboard):"
    printf "  › "
    read -r WORKER_URL
  fi
  success "Live: $WORKER_URL"

  # Set Razorpay webhook secret
  if [[ -n "$RAZORPAY_SECRET" ]]; then
    log "Setting RAZORPAY_WEBHOOK_SECRET..."
    echo "$RAZORPAY_SECRET" | npx wrangler secret put RAZORPAY_WEBHOOK_SECRET
    success "Webhook secret set"
  else
    warn "Webhook secret not set. Run later:  npx wrangler secret put RAZORPAY_WEBHOOK_SECRET"
  fi

  # Set JWT secret (required for customer + admin auth)
  log "Setting JWT_SECRET..."
  echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET
  success "JWT secret set"

  # Set Resend API key (optional — used for transactional email)
  if [[ -n "$RESEND_API_KEY" ]]; then
    log "Seeding Resend API key into settings..."
    npx wrangler d1 execute "$DB_NAME" --remote \
      --command="INSERT OR REPLACE INTO settings (key, value) VALUES ('email_api_key', '${RESEND_API_KEY}')"
    success "Resend API key seeded"
  else
    warn "Resend API key not set. Add it later in Admin → Settings."
  fi
}

# ── Summary ───────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║           EdgeShop is live!                         ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Storefront :${NC}  $WORKER_URL"
  echo -e "  ${BOLD}Admin Panel:${NC}  $WORKER_URL/admin"
  echo -e "  ${BOLD}Webhook URL:${NC}  $WORKER_URL/api/webhook/razorpay"
  echo ""
  hr
  echo -e "${BOLD}Next steps:${NC}"
  echo ""
  echo "  1. Create your admin account (there is no seeded admin user):"
  echo "     Go to ${WORKER_URL}/account/register and register normally."
  echo "     The FIRST customer ever created is auto-promoted to super_admin."
  echo "     Log back in and /admin will be accessible."
  echo "     To promote a LATER account:"
  echo "       npx wrangler d1 execute ${DB_NAME} --remote --command \\"
  echo "         \"UPDATE customers SET role='super_admin' WHERE email='you@example.com'\""
  echo ""
  echo "  2. Protect /admin with Cloudflare Access (Zero Trust) (optional but recommended):"
  echo "     https://one.dash.cloudflare.com/"
  echo "     → Create an Application for: ${WORKER_URL}/admin/*"
  echo "     → Add policy: allow by email / GitHub / Google"
  echo ""
  echo "  3. Add Razorpay keys (optional — Cash on Delivery works with no setup):"
  echo "     Go to ${WORKER_URL}/admin → Settings → Payments"
  echo ""
  if [[ -z "$RAZORPAY_SECRET" ]]; then
    echo "  4. Set the Razorpay webhook secret when you're ready:"
    echo "     npx wrangler secret put RAZORPAY_WEBHOOK_SECRET"
    echo "     Then add the webhook in the Razorpay dashboard:"
    echo "     URL: $WORKER_URL/api/webhook/razorpay   Event: payment.captured"
    echo ""
  else
    echo "  4. Register the Razorpay webhook:"
    echo "     Razorpay dashboard → Webhooks → Add:"
    echo "     URL: $WORKER_URL/api/webhook/razorpay   Event: payment.captured"
    echo ""
  fi
  echo "  5. Add your first products:"
  echo "     Go to ${WORKER_URL}/admin → Products → Add Product"
  echo ""
  hr
  echo ""
  echo -e "${YELLOW}To deploy updates in future:${NC}  npm run deploy"
  echo ""
  echo -e "${GREEN}  Happy selling! 🛍️${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║      EdgeShop POD — One-Click Cloudflare Deploy     ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  This script will:"
  echo "   • Create a D1 database and apply the schema"
  echo "   • Create an R2 bucket for images (stays private — no public-access step)"
  echo "   • Build the React frontend and deploy the single Worker that serves it"
  echo ""
  printf "  Press Enter to begin, or Ctrl+C to cancel..."
  read -r
  echo ""

  check_prerequisites
  check_auth
  collect_config
  setup_d1
  setup_r2
  deploy_worker
  print_summary
}

main "$@"
