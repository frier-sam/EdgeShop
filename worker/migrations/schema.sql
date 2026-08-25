-- ────────────────────────────────────────────────────────────
-- EdgeShop POD — canonical fresh-install schema
-- ────────────────────────────────────────────────────────────
-- This is the target schema for the print-on-demand build
-- (see /POD.md §6.1). It is safe to paste directly into an
-- empty D1 database's Console — it creates all 8 tables, their
-- indexes, the migration bookkeeping table, and seeds default
-- settings in one shot.
--
-- For an EXISTING (pre-POD) deployment, do not run this file —
-- the worker's own migration runner (worker/src/lib/migrate.ts,
-- migration 0013_pod_reset.sql) converges the live schema onto
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
  seo_title       TEXT    DEFAULT '',
  seo_description TEXT    DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_sides (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  side           TEXT    NOT NULL CHECK (side IN ('front','back')),
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
-- Sales
-- ────────────────────────────────────────────────────────────

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
  ('0014_design_retention_setting.sql');

-- ────────────────────────────────────────────────────────────
-- Seed default settings
-- ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name',              'EdgeShop'),
  ('currency',                'INR'),
  ('cod_enabled',             'true'),
  ('razorpay_key_id',         ''),
  ('razorpay_key_secret',     ''),
  ('email_provider',          'resend'),
  ('email_api_key',           ''),
  ('email_from_name',         'EdgeShop'),
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
