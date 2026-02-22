CREATE TABLE IF NOT EXISTS products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  description       TEXT    DEFAULT '',
  price             REAL    NOT NULL,
  compare_price     REAL    DEFAULT NULL,
  image_url         TEXT    DEFAULT '',
  stock_count       INTEGER DEFAULT 0,
  category          TEXT    DEFAULT '',
  status            TEXT    NOT NULL DEFAULT 'active',
  tags              TEXT    DEFAULT '',
  product_type      TEXT    NOT NULL DEFAULT 'physical',
  digital_file_key  TEXT    DEFAULT '',
  weight            REAL    DEFAULT 0,
  seo_title         TEXT    DEFAULT '',
  seo_description   TEXT    DEFAULT '',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id                  TEXT PRIMARY KEY,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT NOT NULL,
  customer_phone      TEXT DEFAULT '',
  shipping_address    TEXT NOT NULL,
  shipping_city       TEXT DEFAULT '',
  shipping_state      TEXT DEFAULT '',
  shipping_pincode    TEXT DEFAULT '',
  shipping_country    TEXT DEFAULT 'India',
  total_amount        REAL NOT NULL,
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'cod')),
  payment_status      TEXT NOT NULL DEFAULT 'pending',
  order_status        TEXT NOT NULL DEFAULT 'placed',
  razorpay_order_id   TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  items_json          TEXT NOT NULL,
  discount_code       TEXT DEFAULT '',
  discount_amount     REAL DEFAULT 0,
  shipping_amount     REAL DEFAULT 0,
  tax_amount          REAL DEFAULT 0,
  tracking_number     TEXT DEFAULT '',
  customer_notes      TEXT DEFAULT '',
  internal_notes      TEXT DEFAULT '',
  customer_id         INTEGER DEFAULT NULL,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS collections (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT DEFAULT '',
  image_url       TEXT DEFAULT '',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  parent_id       INTEGER DEFAULT NULL REFERENCES collections(id) ON DELETE SET NULL,
  seo_title       TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- Product sub-tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  options_json TEXT   NOT NULL DEFAULT '{}',
  price       REAL    NOT NULL,
  stock_count INTEGER NOT NULL DEFAULT 0,
  image_url   TEXT    DEFAULT '',
  sku         TEXT    DEFAULT '',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_collections (
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

-- ────────────────────────────────────────────────────────────
-- Customer sub-tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customer_addresses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label       TEXT    DEFAULT 'Home',
  address_line TEXT   NOT NULL,
  city        TEXT    NOT NULL,
  state       TEXT    NOT NULL,
  pincode     TEXT    NOT NULL,
  country     TEXT    NOT NULL DEFAULT 'India',
  is_default  INTEGER NOT NULL DEFAULT 0
);

-- ────────────────────────────────────────────────────────────
-- Commerce tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_codes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  type             TEXT    NOT NULL CHECK (type IN ('percent', 'fixed', 'free_shipping')),
  value            REAL    NOT NULL DEFAULT 0,
  min_order_amount REAL    NOT NULL DEFAULT 0,
  max_uses         INTEGER NOT NULL DEFAULT 0,
  uses_count       INTEGER NOT NULL DEFAULT 0,
  expires_at       DATETIME,
  is_active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  countries_json TEXT NOT NULL DEFAULT '["India"]'
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id              INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  min_weight           REAL    NOT NULL DEFAULT 0,
  max_weight           REAL    NOT NULL DEFAULT 9999,
  price                REAL    NOT NULL DEFAULT 0,
  free_above_cart_total REAL   NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL,
  cart_json     TEXT    NOT NULL,
  recovery_sent INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- Order tracking
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS order_emails (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id  TEXT    NOT NULL,
  type      TEXT    NOT NULL,
  recipient TEXT    NOT NULL,
  subject   TEXT    NOT NULL,
  status    TEXT    NOT NULL DEFAULT 'sent',
  sent_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   TEXT    NOT NULL,
  event_type TEXT    NOT NULL,
  data_json  TEXT    NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- Content tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  content_html     TEXT NOT NULL DEFAULT '',
  meta_title       TEXT DEFAULT '',
  meta_description TEXT DEFAULT '',
  is_visible       INTEGER NOT NULL DEFAULT 1,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  content_html    TEXT NOT NULL DEFAULT '',
  cover_image     TEXT DEFAULT '',
  author          TEXT DEFAULT '',
  tags            TEXT DEFAULT '',
  published_at    DATETIME,
  seo_title       TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT    NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT    DEFAULT '',
  is_approved   INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────
-- FTS5 full-text search
-- ────────────────────────────────────────────────────────────

CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name, description, tags,
  content=products,
  content_rowid=id
);

CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, description, tags)
  VALUES (new.id, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, description, tags)
  VALUES ('delete', old.id, old.name, old.description, old.tags);
  INSERT INTO products_fts(rowid, name, description, tags)
  VALUES (new.id, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, description, tags)
  VALUES ('delete', old.id, old.name, old.description, old.tags);
END;

-- ────────────────────────────────────────────────────────────
-- Indexes
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_abandoned_carts_pending
  ON abandoned_carts (recovery_sent, created_at)
  WHERE recovery_sent = 0;

CREATE INDEX IF NOT EXISTS idx_order_emails_order_id ON order_emails(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- ────────────────────────────────────────────────────────────
-- Migration tracking
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Mark all 11 bundled migrations as already applied so the worker
-- does not attempt to re-run them on a fresh install.
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
  ('0011_integrations.sql');

-- ────────────────────────────────────────────────────────────
-- Seed default settings
-- ────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name',                 'EdgeShop'),
  ('active_theme',               'jewellery'),
  ('cod_enabled',                'true'),
  ('razorpay_key_id',            ''),
  ('razorpay_key_secret',        ''),
  ('currency',                   'INR'),
  ('email_provider',             'resend'),
  ('email_api_key',              ''),
  ('email_from_name',            'EdgeShop'),
  ('email_from_address',         ''),
  ('merchant_email',             ''),
  ('navigation_json',            '[]'),
  ('footer_json',                '{}'),
  ('announcement_bar_text',      ''),
  ('announcement_bar_enabled',   'false'),
  ('announcement_bar_color',     '#1A1A1A'),
  ('theme_overrides_json',       '{}'),
  ('default_country_code',       '+91'),
  ('shiprocket_email',           ''),
  ('shiprocket_password',        ''),
  ('shiprocket_pickup_location', 'Primary'),
  ('shiprocket_enabled',         'false'),
  ('shiprocket_token',           ''),
  ('shiprocket_token_expires_at','');

-- Default shipping zone + rate
INSERT OR IGNORE INTO shipping_zones (id, name, countries_json)
  VALUES (1, 'India', '["India"]');
INSERT OR IGNORE INTO shipping_rates (zone_id, name, price, free_above_cart_total)
  VALUES (1, 'Standard Shipping', 50, 500);
