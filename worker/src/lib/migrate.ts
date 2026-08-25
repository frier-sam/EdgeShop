import type { D1Database } from '@cloudflare/workers-types'

interface Migration {
  name: string
  // Each inner array is one db.batch() transaction, run to completion
  // before the next phase starts. Split into phases (rather than one
  // giant batch) so that a phase reading from a table via SELECT always
  // sees it fully committed before a later phase drops/recreates that
  // table — batching everything as a single call risks the read and the
  // schema-changing statements being prepared against inconsistent
  // table state. Also avoids db.exec(), which is whitespace-sensitive on
  // multi-statement input.
  phases: string[][]
}

// Add future migrations here. The worker auto-applies any that aren't
// recorded in the _migrations table. Never remove or reorder entries.
const MIGRATIONS: Migration[] = [
  {
    // Phase 2.3 (POD.md §5.8) — R2 objects used to be served from an
    // absolute R2_PUBLIC_URL origin. Rewrite any stored absolute URL to
    // the new root-relative /img/<key> form so the frontend can draw
    // them into a <canvas> without tainting it. Idempotent: values that
    // already start with /img/ are left untouched. Must run BEFORE
    // 0013_pod_reset.sql, which moves products.image_url into
    // product_sides and needs it already in /img/... form.
    name: '0012_rewrite_image_urls.sql',
    phases: [
      [
        `UPDATE products
           SET image_url = '/img/' || substr(image_url, instr(image_url, 'mockups/'))
         WHERE image_url LIKE '%mockups/%' AND image_url NOT LIKE '/img/%'`,
        `UPDATE products
           SET image_url = '/img/' || substr(image_url, instr(image_url, 'products/'))
         WHERE image_url LIKE '%products/%' AND image_url NOT LIKE '/img/%'`,
      ],
    ],
  },
  {
    // Phase 3.2 (POD.md §6) — converge an existing v2 database onto the
    // POD schema: 8 tables, size/side sub-resources, split order pricing.
    name: '0013_pod_reset.sql',
    phases: [
      // ── Phase A: drop the 14 dead tables + FTS table + its 3 triggers ──
      [
        `DROP TRIGGER IF EXISTS products_ai`,
        `DROP TRIGGER IF EXISTS products_au`,
        `DROP TRIGGER IF EXISTS products_ad`,
        `DROP TABLE IF EXISTS products_fts`,
        `DROP TABLE IF EXISTS product_collections`,
        `DROP TABLE IF EXISTS product_variants`,
        `DROP TABLE IF EXISTS product_images`,
        `DROP TABLE IF EXISTS collections`,
        `DROP TABLE IF EXISTS discount_codes`,
        `DROP TABLE IF EXISTS shipping_rates`,
        `DROP TABLE IF EXISTS shipping_zones`,
        `DROP TABLE IF EXISTS abandoned_carts`,
        `DROP TABLE IF EXISTS order_emails`,
        `DROP TABLE IF EXISTS pages`,
        `DROP TABLE IF EXISTS blog_posts`,
        `DROP TABLE IF EXISTS reviews`,
        `DROP TABLE IF EXISTS customer_addresses`,
      ],

      // ── Phase B: create the new sub-tables ──────────────────────────
      [
        `CREATE TABLE IF NOT EXISTS product_sides (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          side           TEXT    NOT NULL CHECK (side IN ('front','back')),
          image_url      TEXT    NOT NULL,
          image_w        INTEGER NOT NULL,
          image_h        INTEGER NOT NULL,
          customizable   INTEGER NOT NULL DEFAULT 1,
          print_x        REAL    NOT NULL DEFAULT 0,
          print_y        REAL    NOT NULL DEFAULT 0,
          print_w        REAL    NOT NULL DEFAULT 0,
          print_h        REAL    NOT NULL DEFAULT 0,
          print_width_in REAL    NOT NULL DEFAULT 12,
          print_fee      REAL    NOT NULL DEFAULT 0,
          sort_order     INTEGER NOT NULL DEFAULT 0,
          UNIQUE (product_id, side)
        )`,
        `CREATE TABLE IF NOT EXISTS product_sizes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          label       TEXT    NOT NULL,
          price_delta REAL    NOT NULL DEFAULT 0,
          stock_count INTEGER NOT NULL DEFAULT 0,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          UNIQUE (product_id, label)
        )`,
        `CREATE TABLE IF NOT EXISTS designs (
          id           TEXT PRIMARY KEY,
          product_id   INTEGER NOT NULL REFERENCES products(id),
          customer_id  INTEGER REFERENCES customers(id),
          design_json  TEXT NOT NULL,
          preview_json TEXT NOT NULL DEFAULT '{}',
          sides_used   TEXT NOT NULL,
          order_id     TEXT REFERENCES orders(id),
          created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_designs_orphan ON designs(created_at) WHERE order_id IS NULL`,
        `CREATE INDEX IF NOT EXISTS idx_designs_customer ON designs(customer_id)`,
      ],

      // ── Phase C: snapshot each existing product's image into a plain
      // staging table (no foreign keys) before the products table gets
      // rebuilt. D1 enforces foreign keys, and `DROP TABLE products` in
      // Phase D performs an implicit cascading DELETE per SQLite
      // semantics — if we inserted straight into product_sides here
      // (whose product_id REFERENCES products(id) ON DELETE CASCADE),
      // that DROP would immediately wipe the rows back out. Staging
      // them in an unrelated table sidesteps that entirely.
      [
        `CREATE TABLE _legacy_product_images AS
         SELECT id AS product_id, image_url
         FROM products
         WHERE image_url IS NOT NULL AND image_url != ''`,
      ],

      // ── Phase D: rebuild products — price → base_price, drop dead
      // columns. A fresh phase so the snapshot above is fully committed
      // before this table gets dropped and replaced.
      [
        `CREATE TABLE products_new (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          name            TEXT    NOT NULL,
          slug            TEXT    UNIQUE,
          description     TEXT    DEFAULT '',
          base_price      REAL    NOT NULL,
          compare_price   REAL    DEFAULT NULL,
          category        TEXT    DEFAULT '',
          status          TEXT    NOT NULL DEFAULT 'active',
          is_customizable INTEGER NOT NULL DEFAULT 0,
          stock_count     INTEGER NOT NULL DEFAULT 0,
          seo_title       TEXT    DEFAULT '',
          seo_description TEXT    DEFAULT '',
          created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `INSERT INTO products_new (id, name, slug, description, base_price, compare_price, category, status, is_customizable, stock_count, seo_title, seo_description, created_at)
         SELECT id, name, NULL, description, price, compare_price, category, status, 0, stock_count, seo_title, seo_description, created_at
         FROM products`,
        `DROP TABLE products`,
        `ALTER TABLE products_new RENAME TO products`,
      ],

      // ── Phase D2: now that products is rebuilt (and won't be dropped
      // again), move the staged images into product_sides for real and
      // drop the staging table. Natural pixel dimensions were never
      // recorded pre-POD, so a placeholder (1200x1200) is used — an
      // admin can correct it by re-uploading the mockup through the new
      // side editor (Phase 4).
      [
        `INSERT INTO product_sides (product_id, side, image_url, image_w, image_h, customizable)
         SELECT product_id, 'front', image_url, 1200, 1200, 0
         FROM _legacy_product_images`,
        `DROP TABLE _legacy_product_images`,
      ],

      // ── Phase E: rebuild orders — add subtotal/print_total, drop
      // discount/tax columns.
      [
        `CREATE TABLE orders_new (
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
        )`,
        // Pre-POD orders carried no side/print breakdown, so the whole
        // pre-shipping amount lands in subtotal and print_total is 0.
        `INSERT INTO orders_new (id, customer_id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country, items_json, subtotal, print_total, shipping_amount, total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, tracking_number, customer_notes, internal_notes, created_at)
         SELECT id, customer_id, customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country, items_json,
                MAX(0, total_amount - COALESCE(shipping_amount, 0)) AS subtotal,
                0 AS print_total,
                COALESCE(shipping_amount, 0), total_amount, payment_method, payment_status, order_status, razorpay_order_id, razorpay_payment_id, tracking_number, customer_notes, internal_notes, created_at
         FROM orders`,
        `DROP TABLE orders`,
        `ALTER TABLE orders_new RENAME TO orders`,
      ],

      // ── Phase F: settings — delete retired keys, seed the new POD keys
      [
        `DELETE FROM settings WHERE key IN (
          'active_theme','theme_overrides_json','navigation_json','footer_json','homepage_json',
          'announcement_bar_text','announcement_bar_enabled','announcement_bar_color',
          'reviews_visibility','admin_email_notifications',
          'shiprocket_email','shiprocket_password','shiprocket_pickup_location',
          'shiprocket_enabled','shiprocket_token','shiprocket_token_expires_at'
        )`,
        `INSERT OR IGNORE INTO settings (key, value) VALUES
          ('flat_shipping_amount', '49'),
          ('free_shipping_over', '999'),
          ('default_print_fee', '99'),
          ('print_dpi', '300'),
          ('print_bleed_percent', '4'),
          ('print_safe_percent', '4'),
          ('max_art_upload_mb', '15')`,
      ],
    ],
  },
]

export async function runMigrations(db: D1Database): Promise<void> {
  // Ensure tracking table exists (safe to run on every cold start)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run()

  if (MIGRATIONS.length === 0) return

  const { results } = await db
    .prepare('SELECT name FROM _migrations')
    .all<{ name: string }>()
  const applied = new Set(results.map((r) => r.name))

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue
    for (const phase of migration.phases) {
      await db.batch(phase.map((sql) => db.prepare(sql)))
    }
    await db
      .prepare('INSERT INTO _migrations (name) VALUES (?)')
      .bind(migration.name)
      .run()
    console.log(`[migrate] applied ${migration.name}`)
  }
}
