// AUTO-GENERATED — do not edit by hand.
// Source: worker/migrations/schema.sql
// Regenerate: npm run generate:schema (from the worker/ directory, or the
// repo root) — this also runs automatically before dev/build/test.
// worker/src/lib/migrate.test.ts fails if this drifts from schema.sql.
/* eslint-disable */

export const BASE_SCHEMA_SQL = `-- ────────────────────────────────────────────────────────────
-- ESPOD — canonical fresh-install schema
-- (brand renamed from EdgeShop to ESPOD — POD-UI2.md §2. Infra
-- identifiers below, e.g. the D1 database name \`edgeshop-db\` and
-- the R2 bucket \`edgeshop-images\`, intentionally keep the old
-- name — see DEPLOY.md's "Naming note" for why.)
-- ────────────────────────────────────────────────────────────
-- This is the target schema for the print-on-demand build
-- (see /POD.md §6.1, and /POD-V2.md §1.1/§3/§5/§6 for the option-axis-2,
-- bulk-pricing and design-template tables added on top of it). It is safe
-- to paste directly into an empty D1 database's Console — it creates all
-- 14 tables, their indexes, the migration bookkeeping table, and seeds
-- default settings in one shot.
--
-- For an EXISTING (pre-POD) deployment, do not run this file —
-- the worker's own migration runner (worker/src/lib/migrate.ts,
-- migration 0013_pod_reset.sql onward) converges the live schema onto
-- this same shape without losing data.
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- Catalog
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  slug            TEXT    UNIQUE,
  description     TEXT    DEFAULT '',
  base_price      REAL    NOT NULL,
  compare_price   REAL    DEFAULT NULL,
  category        TEXT    DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'active',   -- active | draft
  is_customizable INTEGER NOT NULL DEFAULT 0,
  stock_count     INTEGER NOT NULL DEFAULT 0,          -- used only when no sizes exist
  -- POD-V2.md §1.1 — the two option axes are fixed in number but
  -- merchant-nameable: a bottle merchant renames these to "Volume" /
  -- "Cap colour" from the admin form, and every admin + storefront label
  -- reads these two columns rather than hard-coding "Size"/"Colour".
  axis1_label     TEXT    NOT NULL DEFAULT 'Size',     -- section header for product_sizes
  axis2_label     TEXT    NOT NULL DEFAULT 'Colour',   -- section header for product_variants
  -- POD-V2.md §5 — a flat-goods product (visiting cards, stickers) can
  -- require a minimum order quantity below which checkout must reject,
  -- independent of whether bulk price breaks are configured at all.
  min_order_qty   INTEGER NOT NULL DEFAULT 1,
  -- POD-UI4.md §4.1 / P2 — newline-separated bullet lines rendered as the
  -- product page's "Key Features" box when non-empty. Opaque merchant copy,
  -- never parsed beyond splitting on newlines client-side.
  highlights      TEXT    NOT NULL DEFAULT '',
  seo_title       TEXT    DEFAULT '',
  seo_description TEXT    DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_sides (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  side           TEXT    NOT NULL CHECK (side IN ('front','back')),
  -- POD-V2.md §8 / §11 1.2 — relabel, don't restructure: \`side\` stays the
  -- fixed 'front'/'back' identity that design_json, sides_used, pricing
  -- validation and print-file naming all key off. \`label\` is a purely
  -- cosmetic override ('Wrap', 'Lid') for admin + storefront display;
  -- '' means "fall back to the side name" (front/back are never shown
  -- verbatim to a shopper unless the merchant hasn't relabelled them).
  label          TEXT    NOT NULL DEFAULT '',
  image_url      TEXT    NOT NULL,                     -- '/img/mockups/<uuid>.webp'
  image_w        INTEGER NOT NULL,                     -- natural px
  image_h        INTEGER NOT NULL,
  customizable   INTEGER NOT NULL DEFAULT 1,
  print_x        REAL    NOT NULL DEFAULT 0,           -- normalized 0..1
  print_y        REAL    NOT NULL DEFAULT 0,
  print_w        REAL    NOT NULL DEFAULT 0,
  print_h        REAL    NOT NULL DEFAULT 0,
  print_width_in REAL    NOT NULL DEFAULT 12,          -- physical width, drives DPI
  print_fee      REAL    NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, side)
);

CREATE TABLE IF NOT EXISTS product_sizes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,                        -- 'S', 'M', 'XL'
  price_delta REAL    NOT NULL DEFAULT 0,
  stock_count INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

-- POD-V2.md §3.1 — option axis 2 (colour / finish / material). Deliberately
-- carries no price column: axis 2 never bears a price delta, which is what
-- keeps it out of lib/pricing.ts's computeLine entirely — it stays a pure
-- presentation-and-fulfilment attribute, never a pricing input. The first
-- time a merchant wants "+₹50 for the metallic finish", the answer is a
-- separate product, not a price-bearing column here.
CREATE TABLE IF NOT EXISTS product_variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,                         -- opaque: 'Navy', 'Matte', 'Steel'
  -- Nullable on purpose, not just optional-with-a-fallback: a finish like
  -- matte/glossy has no colour at all, so this is real substrate-agnostic
  -- data, not merely unset. The storefront picker must degrade to a plain
  -- labelled pill when this is NULL rather than assume every option is a
  -- colour swatch (§3.1, §9 decision #9).
  swatch_hex TEXT    DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);

-- POD-V2.md §3.2 — per-option mockup override, wired up in Phase 2. The
-- print rect stays solely on product_sides (shared by every option); this
-- table only overrides the *photo* an option shows, so a photo-less option
-- falls back to product_sides.image_url and never blocks on being shot.
CREATE TABLE IF NOT EXISTS product_side_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  side_id    INTEGER NOT NULL REFERENCES product_sides(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  image_url  TEXT    NOT NULL,
  image_w    INTEGER NOT NULL,
  image_h    INTEGER NOT NULL,
  UNIQUE (side_id, variant_id)
);

-- POD-V2.md §5 — bulk quantity price breaks. Absolute, all-in unit price
-- (§9 decision #1): the tier replaces base_price + print fees rather than
-- discounting off them, which is what makes "250 cards = ₹8 each" possible
-- as a merchant-facing number. Phase 3 wires this into the (still
-- untouched, per this phase's scope) pricing engine.
CREATE TABLE IF NOT EXISTS product_price_breaks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty    INTEGER NOT NULL,
  unit_price REAL    NOT NULL,
  UNIQUE (product_id, min_qty)
);

-- ────────────────────────────────────────────────────────────
-- Designs
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS designs (
  id           TEXT PRIMARY KEY,                       -- 'dsn_<uuid>'
  product_id   INTEGER NOT NULL REFERENCES products(id),
  customer_id  INTEGER REFERENCES customers(id),        -- NULL for guests
  design_json  TEXT NOT NULL,                           -- { version, front:{…}, back:{…} }
  preview_json TEXT NOT NULL DEFAULT '{}',               -- { front:'/img/designs/…', … }
  sides_used   TEXT NOT NULL,                            -- 'front' | 'front,back'
  order_id     TEXT REFERENCES orders(id),                -- NULL = not yet purchased
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_designs_orphan ON designs(created_at) WHERE order_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_designs_customer ON designs(customer_id);

-- ────────────────────────────────────────────────────────────
-- Design templates ("browse designs" — POD-V2.md §6)
--
-- A separate pair of tables, deliberately NOT a flagged \`designs\` row:
-- gc.ts's orphan-design GC deletes \`designs\` where order_id IS NULL past
-- the retention window, and a template is by definition never attached to
-- an order. Storing templates as \`designs\` rows would have the nightly
-- cron quietly eat the merchant's whole template library after
-- design_retention_days. gc.ts only ever queries the \`designs\` table, so
-- these are already outside its reach — see migrate.test.ts /
-- gc.test.ts for the pin.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS template_collections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,                          -- 'Birthday', 'Corporate', 'Minimal'
  category   TEXT    NOT NULL DEFAULT '',                -- '' = every category
  status     TEXT    NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS design_templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  design_json   TEXT    NOT NULL,                        -- one side, as a StoredSideSnapshot
  canvas_w      REAL    NOT NULL,                         -- the bleed rect it was authored at
  canvas_h      REAL    NOT NULL,
  preview_url   TEXT    NOT NULL DEFAULT '',
  tags          TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'active',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- Sales
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  contact    TEXT    NOT NULL DEFAULT '',
  email      TEXT    NOT NULL DEFAULT '',
  phone      TEXT    NOT NULL DEFAULT '',
  notes      TEXT    NOT NULL DEFAULT '',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  customer_id         INTEGER REFERENCES customers(id),
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,
  customer_phone      TEXT DEFAULT '',
  shipping_address    TEXT NOT NULL,
  shipping_city       TEXT DEFAULT '',
  shipping_state      TEXT DEFAULT '',
  shipping_pincode    TEXT DEFAULT '',
  shipping_country    TEXT DEFAULT 'India',
  items_json          TEXT NOT NULL,
  subtotal            REAL NOT NULL,
  print_total         REAL NOT NULL DEFAULT 0,
  shipping_amount     REAL NOT NULL DEFAULT 0,
  total_amount        REAL NOT NULL,
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('razorpay','cod')),
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  order_status        TEXT NOT NULL DEFAULT 'placed',
  razorpay_order_id   TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  tracking_number     TEXT DEFAULT '',
  customer_notes      TEXT DEFAULT '',
  internal_notes      TEXT DEFAULT '',
  vendor_id           INTEGER REFERENCES vendors(id),
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT    NOT NULL,
  event_type TEXT    NOT NULL,
  data_json  TEXT    NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- ────────────────────────────────────────────────────────────
-- Identity & config (unchanged from v2)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  email                   TEXT NOT NULL UNIQUE,
  password_hash           TEXT NOT NULL,
  name                    TEXT DEFAULT '',
  phone                   TEXT DEFAULT '',
  reset_token             TEXT DEFAULT NULL,
  reset_token_expires_at  INTEGER DEFAULT NULL,
  role                    TEXT NOT NULL DEFAULT 'customer',
  permissions_json        TEXT NOT NULL DEFAULT '{}',
  created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- Migration tracking
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mark all bundled migrations as already applied so the worker does not
-- attempt to re-run them (or the pre-POD ones they superseded) on a
-- fresh install — this file already reflects their end state.
INSERT OR IGNORE INTO _migrations (name) VALUES
  ('0001_initial.sql'),
  ('0002_v2_schema.sql'),
  ('0003_abandoned_cart.sql'),
  ('0004_category_hierarchy.sql'),
  ('0005_password_reset.sql'),
  ('0006_order_emails.sql'),
  ('0007_structured_address.sql'),
  ('0008_staff_roles.sql'),
  ('0009_default_country.sql'),
  ('0010_order_events.sql'),
  ('0011_integrations.sql'),
  ('0012_rewrite_image_urls.sql'),
  ('0013_pod_reset.sql'),
  ('0014_design_retention_setting.sql'),
  ('0015_espod_rename.sql'),
  ('0016_v2_options_bulk_templates.sql'),
  ('0017_product_highlights.sql'),
  ('0018_vendors.sql');

-- ────────────────────────────────────────────────────────────
-- Seed default settings
-- ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name',              'ESPOD'),
  ('currency',                'INR'),
  ('cod_enabled',             'true'),
  ('razorpay_key_id',         ''),
  ('razorpay_key_secret',     ''),
  ('email_provider',          'resend'),
  ('email_api_key',           ''),
  ('email_from_name',         'ESPOD'),
  ('email_from_address',      ''),
  ('merchant_email',          ''),
  ('default_country_code',    '+91'),
  ('flat_shipping_amount',    '49'),
  ('free_shipping_over',      '999'),
  ('default_print_fee',       '99'),
  ('print_dpi',               '300'),
  ('print_bleed_percent',     '4'),
  ('print_safe_percent',      '4'),
  ('max_art_upload_mb',       '15'),
  ('design_retention_days',   '30');
-- Note: 'jwt_secret' is intentionally NOT seeded here — it is
-- lazily generated (and persisted) on first use by
-- worker/src/lib/auth.ts:getOrCreateJwtSecret(). Pre-seeding it
-- with a placeholder value would prevent that generation from
-- ever running.
`
