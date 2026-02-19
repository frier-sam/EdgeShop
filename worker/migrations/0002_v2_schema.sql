-- EdgeShop v2 schema migration

-- Product variants (size, color, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  price REAL NOT NULL,
  stock_count INTEGER NOT NULL DEFAULT 0,
  image_url TEXT DEFAULT '',
  sku TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product images (multiple images per product)
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Collections (curated product groups)
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product <-> Collection many-to-many
CREATE TABLE IF NOT EXISTS product_collections (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

-- FTS5 virtual table for product search
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name, description, tags,
  content=products,
  content_rowid=id
);

-- Customers (registered storefront users)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customer saved addresses
CREATE TABLE IF NOT EXISTS customer_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  is_default INTEGER NOT NULL DEFAULT 0
);

-- Discount / coupon codes
CREATE TABLE IF NOT EXISTS discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed', 'free_shipping')),
  value REAL NOT NULL DEFAULT 0,
  min_order_amount REAL NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 0,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at DATETIME,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Static CMS pages (About, Terms, etc.)
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  meta_title TEXT DEFAULT '',
  meta_description TEXT DEFAULT '',
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shipping zones (groups of countries)
CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  countries_json TEXT NOT NULL DEFAULT '["India"]'
);

-- Shipping rates per zone
CREATE TABLE IF NOT EXISTS shipping_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_weight REAL NOT NULL DEFAULT 0,
  max_weight REAL NOT NULL DEFAULT 9999,
  price REAL NOT NULL DEFAULT 0,
  free_above_cart_total REAL NOT NULL DEFAULT 0
);

-- Blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  cover_image TEXT DEFAULT '',
  author TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  published_at DATETIME,
  seo_title TEXT DEFAULT '',
  seo_description TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT DEFAULT '',
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Extend products table with v2 columns
-- Note: SQLite ALTER TABLE ADD COLUMN does not support CHECK constraints
ALTER TABLE products ADD COLUMN compare_price REAL DEFAULT NULL;
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'physical';
ALTER TABLE products ADD COLUMN digital_file_key TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN seo_title TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN seo_description TEXT DEFAULT '';

-- Extend orders table with v2 columns
ALTER TABLE orders ADD COLUMN discount_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tracking_number TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN internal_notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT NULL;

-- New settings seeds
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('email_provider', 'resend'),
  ('email_api_key', ''),
  ('email_from_name', 'EdgeShop'),
  ('email_from_address', ''),
  ('merchant_email', ''),
  ('navigation_json', '[]'),
  ('announcement_bar_text', ''),
  ('announcement_bar_enabled', 'false'),
  ('announcement_bar_color', '#1A1A1A'),
  ('theme_overrides_json', '{}'),
  ('jwt_secret', '');

-- Default shipping data
INSERT OR IGNORE INTO shipping_zones (id, name, countries_json) VALUES (1, 'India', '["India"]');
INSERT OR IGNORE INTO shipping_rates (zone_id, name, price, free_above_cart_total) VALUES (1, 'Standard Shipping', 50, 500);

-- FTS5 sync triggers to keep products_fts in sync with products
CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, name, description, tags) VALUES (new.id, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, description, tags) VALUES ('delete', old.id, old.name, old.description, old.tags);
  INSERT INTO products_fts(rowid, name, description, tags) VALUES (new.id, new.name, new.description, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, name, description, tags) VALUES ('delete', old.id, old.name, old.description, old.tags);
END;
