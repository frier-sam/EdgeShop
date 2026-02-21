#\!/usr/bin/env bash
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

# ─── Prerequisites ───────────────────────────────────────────────────────────
info "Checking prerequisites..."
command -v wrangler >/dev/null 2>&1 || error "wrangler not found. Run: npm install -g wrangler"
command -v node    >/dev/null 2>&1 || error "node not found. Install from https://nodejs.org"
command -v openssl >/dev/null 2>&1 || error "openssl not found."
wrangler whoami >/dev/null 2>&1    || error "Not logged in to Cloudflare. Run: wrangler login"
success "Prerequisites OK"

# ─── Install dependencies ────────────────────────────────────────────────────
info "Installing dependencies..."
npm install
success "Dependencies installed"

# ─── D1 Database ─────────────────────────────────────────────────────────────
info "Creating D1 database (edgeshop-db)..."
DB_OUTPUT=$(wrangler d1 create edgeshop-db 2>&1 || true)

if echo "$DB_OUTPUT" | grep -q "already exists"; then
  warn "D1 database already exists — fetching existing ID..."
  DB_ID=$(wrangler d1 info edgeshop-db --json 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('uuid',''))" 2>/dev/null || true)
else
  DB_ID=$(echo "$DB_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1 || true)
fi

if [ -z "$DB_ID" ]; then
  error "Could not determine D1 database ID. Check 'wrangler d1 list' and update worker/wrangler.toml manually with the correct database_id."
fi

# Patch wrangler.toml
sed -i.bak "s/database_id = \"placeholder-replace-after-creation\"/database_id = \"$DB_ID\"/" worker/wrangler.toml
rm -f worker/wrangler.toml.bak
grep -q "database_id = \"$DB_ID\"" worker/wrangler.toml \
  || error "Failed to patch database_id in worker/wrangler.toml. Please update it manually: database_id = \"$DB_ID\""
success "D1 database ready (ID: $DB_ID)"

# ─── D1 Migrations ───────────────────────────────────────────────────────────
info "Applying D1 migrations..."
(cd worker && wrangler d1 migrations apply edgeshop-db --remote --yes)
success "All migrations applied"

# ─── R2 Bucket ───────────────────────────────────────────────────────────────
info "Creating R2 bucket (edgeshop-images)..."
R2_OUTPUT=$(wrangler r2 bucket create edgeshop-images 2>&1 || true)
if echo "$R2_OUTPUT" | grep -q "already exists"; then
  warn "R2 bucket already exists — skipping creation"
else
  success "R2 bucket created"
fi

echo ""
warn "ACTION REQUIRED: Enable public access on your R2 bucket."
warn "  1. Go to: Cloudflare Dashboard → R2 → edgeshop-images → Settings → Public Access"
warn "  2. Enable public access and copy the public URL (e.g. https://pub-xxxx.r2.dev)"
echo ""
read -rp "$(echo -e "${CYAN}Paste your R2 public URL (press Enter to skip):${NC} ")" R2_PUBLIC_URL

if [ -n "$R2_PUBLIC_URL" ]; then
  if [[ \! "$R2_PUBLIC_URL" =~ ^https?:// ]]; then
    warn "URL doesn't start with https:// — skipping. Update R2_PUBLIC_URL in worker/wrangler.toml manually."
    R2_PUBLIC_URL=""
  fi
fi

if [ -n "$R2_PUBLIC_URL" ]; then
  python3 -c "
import sys
path = 'worker/wrangler.toml'
old = 'R2_PUBLIC_URL = \"https://pub-REPLACE.r2.dev\"'
new = 'R2_PUBLIC_URL = \"' + sys.argv[1] + '\"'
content = open(path).read()
open(path, 'w').write(content.replace(old, new, 1))
" "$R2_PUBLIC_URL"
  success "R2 public URL set"
else
  warn "Skipped — update R2_PUBLIC_URL in worker/wrangler.toml manually before images will work"
fi

# ─── Secrets ─────────────────────────────────────────────────────────────────
info "Setting secrets..."

JWT_SECRET=$(openssl rand -hex 32)
printf '%s' "$JWT_SECRET" | wrangler secret put JWT_SECRET --name edgeshop-worker
success "JWT_SECRET auto-generated and set"

echo ""
warn "Razorpay webhook secret is optional — Razorpay API keys are configured in Admin → Integrations."
warn "You only need this if you use Razorpay webhooks for payment confirmation."
read -rp "$(echo -e "${CYAN}RAZORPAY_WEBHOOK_SECRET (press Enter to skip):${NC} ")" RZP_SECRET
if [ -n "$RZP_SECRET" ]; then
  printf '%s' "$RZP_SECRET" | wrangler secret put RAZORPAY_WEBHOOK_SECRET --name edgeshop-worker
  success "RAZORPAY_WEBHOOK_SECRET set"
else
  warn "Skipped — set later with: wrangler secret put RAZORPAY_WEBHOOK_SECRET"
fi

# ─── Deploy Worker ────────────────────────────────────────────────────────────
info "Deploying Worker..."
(cd worker && npm run deploy)
success "Worker deployed"

# ─── Update FRONTEND_URL ─────────────────────────────────────────────────────
echo ""
warn "What will your Cloudflare Pages URL be? (default: https://edgeshop.pages.dev)"
warn "You can update this later in worker/wrangler.toml if unsure."
read -rp "$(echo -e "${CYAN}Pages URL (press Enter for default):${NC} ")" PAGES_URL
PAGES_URL="${PAGES_URL:-https://edgeshop.pages.dev}"

python3 -c "
import sys
path = 'worker/wrangler.toml'
old = 'FRONTEND_URL = \"https://edgeshop.pages.dev\"'
new = 'FRONTEND_URL = \"' + sys.argv[1] + '\"'
content = open(path).read()
open(path, 'w').write(content.replace(old, new, 1))
" "$PAGES_URL"

info "Re-deploying Worker with updated FRONTEND_URL..."
(cd worker && npm run deploy)
success "Worker re-deployed"

# ─── Deploy Frontend ──────────────────────────────────────────────────────────
info "Building and deploying frontend..."
(cd frontend && npm install && npm run build && "$REPO_ROOT/worker/node_modules/.bin/wrangler" pages deploy dist --project-name edgeshop)
success "Frontend deployed"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  EdgeShop deployed successfully\!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Store:  ${CYAN}$PAGES_URL${NC}"
echo -e "  Admin:  ${CYAN}$PAGES_URL/admin${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Protect /admin with Cloudflare Access:"
echo "     Zero Trust Dashboard → Access → Applications → Add Self-hosted"
echo "     Application URL: $PAGES_URL/admin/*"
echo ""
echo "  2. Configure payments (optional):"
echo "     Admin → Integrations → Payment → Enter Razorpay keys"
echo ""
echo "  3. Configure email (optional):"
echo "     Admin → Integrations → Email → Enter Resend/SendGrid/Brevo key"
echo ""
echo "  4. Set your store name and currency:"
echo "     Admin → Settings"
echo ""
echo -e "${YELLOW}To deploy updates in future:${NC}"
echo "  cd worker && npm run deploy"
echo "  cd frontend && npm run build && ../worker/node_modules/.bin/wrangler pages deploy dist --project-name edgeshop"
echo ""
