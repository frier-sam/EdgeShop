#!/usr/bin/env bash
# ============================================================
#  EdgeShop — One-Click Cloudflare Deploy
#  Usage: bash deploy.sh
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
WORKER_DIR="$SCRIPT_DIR/worker"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

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

# ── Step 1: Prerequisites ─────────────────────────────────────
check_prerequisites() {
  header "1 / 7 — Checking Prerequisites"

  command -v node >/dev/null 2>&1 \
    || die "Node.js not found. Install from https://nodejs.org"
  success "Node.js $(node --version)"

  command -v npm >/dev/null 2>&1 \
    || die "npm not found."
  success "npm $(npm --version)"

  if ! command -v wrangler >/dev/null 2>&1; then
    warn "wrangler not found — installing globally..."
    npm install -g wrangler
  fi
  success "wrangler $(wrangler --version 2>/dev/null | head -1)"
}

# ── Step 2: Auth ──────────────────────────────────────────────
check_auth() {
  header "2 / 7 — Cloudflare Authentication"

  if ! wrangler whoami >/dev/null 2>&1; then
    warn "Not logged in — opening Cloudflare login..."
    wrangler login
  fi

  WHOAMI=$(wrangler whoami 2>/dev/null || echo "")
  success "Logged in to Cloudflare"

  # Extract account ID from whoami output
  ACCOUNT_ID=$(echo "$WHOAMI" | grep -oE '[0-9a-f]{32}' | head -1 || true)
  if [[ -z "$ACCOUNT_ID" ]]; then
    ask "Could not auto-detect Account ID."
    ask "Find it at: https://dash.cloudflare.com → right sidebar"
    printf "  Account ID: "
    read -r ACCOUNT_ID
  fi
  success "Account ID: $ACCOUNT_ID"
}

# ── Step 3: Collect config ────────────────────────────────────
collect_config() {
  header "3 / 7 — Configuration"

  echo "  Press Enter to accept defaults shown in [brackets]."
  echo ""

  ask "Project / Pages name [edgeshop]:"
  printf "  › "
  read -r PROJECT_NAME
  PROJECT_NAME="${PROJECT_NAME:-edgeshop}"

  ask "Store display name [EdgeShop]:"
  printf "  › "
  read -r STORE_NAME
  STORE_NAME="${STORE_NAME:-EdgeShop}"

  ask "Razorpay Webhook Secret (leave blank — you can set it later):"
  printf "  › "
  read -rs RAZORPAY_SECRET
  echo ""

  ask "JWT Secret for customer auth (leave blank to auto-generate):"
  printf "  › "
  read -rs JWT_SECRET
  echo ""
  if [[ -z "$JWT_SECRET" ]]; then
    JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || true)
    if [[ -z "$JWT_SECRET" ]]; then
      JWT_SECRET="$(date +%s)-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
    fi
    success "JWT secret auto-generated"
  fi

  ask "Resend API Key for transactional email (leave blank — you can set it later):"
  printf "  › "
  read -rs RESEND_API_KEY
  echo ""

  hr
  echo "  Project name  : $PROJECT_NAME"
  echo "  Store name    : $STORE_NAME"
  echo "  Webhook secret: ${RAZORPAY_SECRET:+(set)}"
  echo "  JWT secret    : (set)"
  echo "  Resend API key: ${RESEND_API_KEY:+(set)}"
  hr

  DB_NAME="${PROJECT_NAME}-db"
  BUCKET_NAME="${PROJECT_NAME}-images"
}

# ── Step 4: D1 database ───────────────────────────────────────
setup_d1() {
  header "4 / 7 — D1 Database"

  cd "$WORKER_DIR"

  # Check if already created
  EXISTING_DB_ID=$(wrangler d1 list 2>/dev/null \
    | grep -E "\b${DB_NAME}\b" \
    | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
    | head -1 || true)

  if [[ -n "$EXISTING_DB_ID" ]]; then
    warn "Database '$DB_NAME' already exists (id: $EXISTING_DB_ID) — skipping creation."
    DB_ID="$EXISTING_DB_ID"
  else
    log "Creating D1 database: $DB_NAME"
    D1_OUT=$(wrangler d1 create "$DB_NAME" 2>&1)
    echo "$D1_OUT"
    DB_ID=$(echo "$D1_OUT" \
      | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
      | head -1 || true)
    if [[ -z "$DB_ID" ]]; then
      die "Could not parse database_id from wrangler output. Check output above."
    fi
    success "D1 database created: $DB_ID"
  fi

  # Patch wrangler.toml: database_id + database_name + bucket_name
  log "Patching wrangler.toml..."
  sed_i "s/database_id = \"placeholder-replace-after-creation\"/database_id = \"${DB_ID}\"/" wrangler.toml
  sed_i "s/database_name = \"edgeshop-db\"/database_name = \"${DB_NAME}\"/" wrangler.toml
  sed_i "s/bucket_name = \"edgeshop-images\"/bucket_name = \"${BUCKET_NAME}\"/" wrangler.toml
  sed_i "s/name = \"edgeshop-worker\"/name = \"${PROJECT_NAME}-worker\"/" wrangler.toml
  success "wrangler.toml patched"

  # Run migrations
  log "Applying D1 migrations..."
  wrangler d1 execute "$DB_NAME" --file=migrations/0001_initial.sql
  wrangler d1 execute "$DB_NAME" --file=migrations/0002_v2_schema.sql
  wrangler d1 execute "$DB_NAME" --file=migrations/0003_abandoned_cart.sql
  success "Migrations applied"

  # Seed store name
  log "Seeding store name..."
  wrangler d1 execute "$DB_NAME" \
    --command="INSERT OR REPLACE INTO settings (key, value) VALUES ('store_name', '${STORE_NAME}')"
  success "Store name seeded: $STORE_NAME"
}

# ── Step 5: R2 bucket ─────────────────────────────────────────
setup_r2() {
  header "5 / 7 — R2 Image Storage"

  cd "$WORKER_DIR"

  # Create bucket if it doesn't exist
  if wrangler r2 bucket list 2>/dev/null | grep -q "\b${BUCKET_NAME}\b"; then
    warn "R2 bucket '$BUCKET_NAME' already exists — skipping creation."
  else
    log "Creating R2 bucket: $BUCKET_NAME"
    wrangler r2 bucket create "$BUCKET_NAME"
    success "R2 bucket created: $BUCKET_NAME"
  fi

  success "R2 bucket ready — no public access step needed. All objects (mockups, uploads, design previews) are served same-origin through the worker at /img/<key>, so the bucket stays private."
}

# ── Step 6: Deploy worker ─────────────────────────────────────
deploy_worker() {
  header "6 / 7 — Deploying Worker"

  cd "$WORKER_DIR"

  log "Installing worker dependencies..."
  npm install --silent

  log "Deploying worker to Cloudflare Workers..."
  WORKER_OUT=$(wrangler deploy 2>&1)
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
  success "Worker live: $WORKER_URL"

  # Set Razorpay webhook secret
  if [[ -n "$RAZORPAY_SECRET" ]]; then
    log "Setting RAZORPAY_WEBHOOK_SECRET..."
    echo "$RAZORPAY_SECRET" | wrangler secret put RAZORPAY_WEBHOOK_SECRET
    success "Webhook secret set"
  else
    warn "Webhook secret not set. Run later:  cd worker && wrangler secret put RAZORPAY_WEBHOOK_SECRET"
  fi

  # Set JWT secret (required for customer auth)
  log "Setting JWT_SECRET..."
  echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
  success "JWT secret set"

  # Set Resend API key (optional — used for transactional email)
  if [[ -n "$RESEND_API_KEY" ]]; then
    log "Seeding Resend API key into settings..."
    wrangler d1 execute "$DB_NAME" \
      --command="INSERT OR REPLACE INTO settings (key, value) VALUES ('email_api_key', '${RESEND_API_KEY}')"
    success "Resend API key seeded"
  else
    warn "Resend API key not set. Add it later in Admin → Settings."
  fi
}

# ── Step 7: Deploy frontend ───────────────────────────────────
deploy_frontend() {
  header "7 / 7 — Deploying Frontend (Cloudflare Pages)"

  cd "$FRONTEND_DIR"

  log "Installing frontend dependencies..."
  npm install --silent

  log "Patching robots.txt with Worker URL..."
  sed_i "s|https://YOUR-WORKER-URL/sitemap.xml|${WORKER_URL}/sitemap.xml|" "$FRONTEND_DIR/public/robots.txt"
  success "robots.txt sitemap URL set to ${WORKER_URL}/sitemap.xml"

  log "Building frontend..."
  npm run build

  log "Deploying to Cloudflare Pages (project: ${PROJECT_NAME})..."
  PAGES_OUT=$(wrangler pages deploy dist \
    --project-name "${PROJECT_NAME}" \
    --branch main \
    2>&1)
  echo "$PAGES_OUT"

  PAGES_URL=$(echo "$PAGES_OUT" \
    | grep -oE 'https://[a-zA-Z0-9._-]+\.pages\.dev' \
    | head -1 || true)

  if [[ -z "$PAGES_URL" ]]; then
    warn "Could not auto-detect Pages URL."
    ask "Enter your Cloudflare Pages URL:"
    printf "  › "
    read -r PAGES_URL
  fi
  success "Frontend live: $PAGES_URL"

  # Update FRONTEND_URL in wrangler.toml and redeploy worker
  log "Updating worker CORS with Pages URL and redeploying..."
  cd "$WORKER_DIR"
  sed_i "s|FRONTEND_URL = \"https://edgeshop.pages.dev\"|FRONTEND_URL = \"${PAGES_URL}\"|" wrangler.toml
  wrangler deploy >/dev/null 2>&1
  success "Worker redeployed with CORS for $PAGES_URL"

  # Set WORKER_URL env var for Pages Functions (bot detection middleware)
  log "Setting WORKER_URL in Pages environment..."
  cd "$WORKER_DIR"
  echo "$WORKER_URL" | wrangler pages secret put WORKER_URL \
    --project-name "${PROJECT_NAME}" 2>/dev/null || \
    warn "Could not auto-set WORKER_URL. Set it manually in Cloudflare Pages dashboard:"$'\n'"  Settings → Environment variables → Add: WORKER_URL = $WORKER_URL"
  success "WORKER_URL set to $WORKER_URL"
}

# ── Summary ───────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${GREEN}║           EdgeShop is live!                         ║${NC}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Storefront :${NC}  $PAGES_URL"
  echo -e "  ${BOLD}Admin Panel:${NC}  $PAGES_URL/admin"
  echo -e "  ${BOLD}Worker API :${NC}  $WORKER_URL"
  echo ""
  echo -e "  ${BOLD}SEO note:${NC}   Bot detection middleware active."
  echo "             If WORKER_URL was not auto-set, add it in:"
  echo "             Cloudflare Pages → ${PROJECT_NAME} → Settings → Env Vars"
  echo "             Key: WORKER_URL   Value: \$WORKER_URL"
  echo -e "  ${BOLD}Webhook URL:${NC}  $WORKER_URL/api/webhook/razorpay"
  echo ""
  hr
  echo -e "${BOLD}Next steps:${NC}"
  echo ""
  echo "  1. Protect /admin with Cloudflare Access (Zero Trust):"
  echo "     https://one.dash.cloudflare.com/"
  echo "     → Create an Application for: ${PAGES_URL}/admin/*"
  echo "     → Add policy: allow by email / GitHub / Google"
  echo ""
  echo "  2. Add Razorpay keys:"
  echo "     Go to ${PAGES_URL}/admin → Settings"
  echo "     Enter your Key ID and Key Secret"
  echo ""
  if [[ -z "$RAZORPAY_SECRET" ]]; then
    echo "  3. Set Razorpay webhook secret:"
    echo "     cd worker && wrangler secret put RAZORPAY_WEBHOOK_SECRET"
    echo "     Then add the webhook in Razorpay dashboard:"
    echo "     URL: $WORKER_URL/api/webhook/razorpay"
    echo "     Event: payment.captured"
    echo ""
  else
    echo "  3. Register Razorpay webhook:"
    echo "     In Razorpay dashboard → Webhooks → Add:"
    echo "     URL: $WORKER_URL/api/webhook/razorpay"
    echo "     Event: payment.captured"
    echo ""
  fi
  echo "  4. Add your first products:"
  echo "     Go to ${PAGES_URL}/admin → Products → Add Product"
  echo ""
  hr
  echo ""
  echo -e "${GREEN}  Happy selling! 🛍️${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${CYAN}║         EdgeShop — One-Click Cloudflare Deploy      ║${NC}"
  echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  This script will:"
  echo "   • Create a D1 database and run migrations"
  echo "   • Create an R2 bucket for product images"
  echo "   • Deploy the Hono API worker"
  echo "   • Build and deploy the React frontend to Pages"
  echo ""
  echo "  One manual step: enabling R2 public access (30 seconds)."
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
  deploy_frontend
  print_summary
}

main "$@"
