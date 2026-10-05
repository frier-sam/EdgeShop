import type { D1Database } from '@cloudflare/workers-types'
import { BASE_SCHEMA_SQL } from './schemaSql.generated'

// Splits a .sql file's contents into individual statements suitable for
// db.batch() (see the Migration interface comment below for why db.exec()
// is avoided). Strips full-line `--` comments, then splits on `;`.
//
// This is a deliberately naive split — it does NOT understand string
// literals or comments containing a literal `;`. That's safe ONLY because
// schema.sql is verified (by migrate.test.ts, which re-parses the actual
// committed file) to contain no semicolons inside string literals or
// comments. Do not reuse this on arbitrary SQL without re-checking that
// assumption.
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  return withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// schema.sql ends with `INSERT OR IGNORE INTO _migrations (name) VALUES
// (...), (...), ...;` — the canonical list of every numbered migration a
// fresh-install (schema.sql-shaped) database should be considered to have
// already run. Extracted from the statement itself (rather than hand-
// copied into a second list here) so there is exactly one place that list
// is written down.
function extractLegacyMigrationNames(statements: string[]): string[] {
  const stmt = statements.find((s) => /^INSERT OR IGNORE INTO _migrations\b/i.test(s))
  if (!stmt) return []
  const names: string[] = []
  const re = /'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stmt))) names.push(m[1])
  return names
}

const BASE_SCHEMA_STATEMENTS = splitSqlStatements(BASE_SCHEMA_SQL)
const BASE_SCHEMA_MIGRATION_NAME = '0000_base_schema'
// The 0001..0015 names schema.sql's own bookkeeping INSERT marks as
// already-applied. Used below to keep runMigrations' in-memory `applied`
// set consistent with what 0000_base_schema's phases just wrote to the
// real _migrations table in the same run (see runMigrations for why that
// matters — without it, a fresh database would immediately try to re-run
// 0012-0015 against the final schema 0000 just created, and fail).
const LEGACY_MIGRATION_NAMES = extractLegacyMigrationNames(BASE_SCHEMA_STATEMENTS)

export interface Migration {
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
// Exported (read-only, via the type below) only so migrate.test.ts can
// assert on individual migrations' SQL shape without a live D1 database.
export const MIGRATIONS: readonly Migration[] = [
  {
    // Cloudflare deploy-automation hardening (see DEPLOY.md's "What gets
    // created automatically" section) — an automatically-provisioned D1
    // database starts completely empty: no tables at all, not even
    // `products`. Without this entry, the very first request after a
    // fresh Git-connected deploy 500s with "no such table: products"
    // (0012_rewrite_image_urls.sql below is the first statement that
    // touches `products`, and it assumes the table already exists).
    //
    // BASE_SCHEMA_STATEMENTS is generated from worker/migrations/schema.sql
    // (see schemaSql.generated.ts and worker/scripts/generate-schema-sql.mjs)
    // — the same file that's safe to paste directly into the D1 dashboard
    // Console. Every CREATE TABLE/INDEX in it is IF NOT EXISTS and every
    // seed INSERT is OR IGNORE, so running this migration against an
    // ALREADY-migrated database (the path every existing deployment takes)
    // is a genuine no-op: no table is altered, no row is overwritten.
    //
    // This must stay the FIRST entry in MIGRATIONS — later migrations
    // (0012+) assume the base tables already exist.
    name: BASE_SCHEMA_MIGRATION_NAME,
    phases: [BASE_SCHEMA_STATEMENTS],
  },
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
  {
    // Phase 9.1 (POD.md §9.1 / §11) — seed the orphan-design GC's
    // retention window for databases that already ran 0013_pod_reset.sql
    // before this setting existed. schema.sql's fresh-install seed
    // already includes it (INSERT OR IGNORE), so this migration only
    // matters for a live deployment converging via the migration runner.
    name: '0014_design_retention_setting.sql',
    phases: [
      [`INSERT OR IGNORE INTO settings (key, value) VALUES ('design_retention_days', '30')`],
    ],
  },
  {
    // POD-UI2.md §2 — brand rename, EdgeShop → ESPOD. Only touches rows
    // still holding the literal old value, so it's a no-op (and safe to
    // "apply" via bookkeeping only, as schema.sql's fresh-install seed
    // does) on any database where an admin already renamed the store via
    // Settings, or where a fresh install seeded 'ESPOD' directly.
    name: '0015_espod_rename.sql',
    phases: [
      [
        `UPDATE settings SET value = 'ESPOD' WHERE key IN ('store_name', 'email_from_name') AND value = 'EdgeShop'`,
      ],
    ],
  },
  {
    // POD-V2.md §1.1/§3/§5/§6/§10, §11 Phase 1.1 — second option axis,
    // bulk price breaks, and design templates. schema.sql (and therefore
    // BASE_SCHEMA_STATEMENTS / 0000_base_schema above) already creates
    // these 5 tables and carries schema.sql's own bookkeeping INSERT for
    // this migration's name, so on a brand-new database this entry is
    // never actually executed at all — runMigrations' post-0000 mirroring
    // of LEGACY_MIGRATION_NAMES (see below) marks it applied before the
    // loop ever reaches it. It only runs for real against an EXISTING
    // database that already converged on 0015 and is missing these
    // tables/columns, where CREATE TABLE IF NOT EXISTS and a plain ADD
    // COLUMN (D1/SQLite has no ADD COLUMN IF NOT EXISTS, but each
    // migration here — per the _migrations bookkeeping table this whole
    // runner is built on — runs at most once per database, which is the
    // guard) converge it onto the same shape schema.sql already
    // describes, with no data loss.
    name: '0016_v2_options_bulk_templates.sql',
    phases: [
      // ── Phase A: the 5 new tables. product_side_images and
      // design_templates reference product_variants and
      // template_collections respectively, so those are created first —
      // not that SQLite requires the ordering at CREATE TABLE time, but
      // it keeps this phase readable in the same dependency order as
      // schema.sql itself.
      [
        // Axis 2 — see schema.sql's product_variants comment for why
        // swatch_hex is nullable (a finish like matte/glossy has no
        // colour; the storefront must degrade to a plain labelled pill)
        // and why there is deliberately no price column (axis 2 never
        // bears a price delta, keeping it out of lib/pricing.ts entirely).
        `CREATE TABLE IF NOT EXISTS product_variants (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          label      TEXT    NOT NULL,
          swatch_hex TEXT    DEFAULT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          UNIQUE (product_id, label)
        )`,
        `CREATE TABLE IF NOT EXISTS product_side_images (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          side_id    INTEGER NOT NULL REFERENCES product_sides(id) ON DELETE CASCADE,
          variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
          image_url  TEXT    NOT NULL,
          image_w    INTEGER NOT NULL,
          image_h    INTEGER NOT NULL,
          UNIQUE (side_id, variant_id)
        )`,
        `CREATE TABLE IF NOT EXISTS product_price_breaks (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          min_qty    INTEGER NOT NULL,
          unit_price REAL    NOT NULL,
          UNIQUE (product_id, min_qty)
        )`,
        `CREATE TABLE IF NOT EXISTS template_collections (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL,
          category   TEXT    NOT NULL DEFAULT '',
          status     TEXT    NOT NULL DEFAULT 'active',
          sort_order INTEGER NOT NULL DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS design_templates (
          id            INTEGER PRIMARY KEY AUTOINCREMENT,
          collection_id INTEGER NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
          name          TEXT    NOT NULL,
          design_json   TEXT    NOT NULL,
          canvas_w      REAL    NOT NULL,
          canvas_h      REAL    NOT NULL,
          preview_url   TEXT    NOT NULL DEFAULT '',
          tags          TEXT    NOT NULL DEFAULT '',
          status        TEXT    NOT NULL DEFAULT 'active',
          sort_order    INTEGER NOT NULL DEFAULT 0,
          created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      ],
      // ── Phase B: new columns on existing tables. A fresh phase so
      // Phase A's CREATE TABLEs are committed first (product_side_images
      // above references product_sides, unaffected by this phase, but
      // keeping the "tables, then columns" ordering matches schema.sql
      // and 0013_pod_reset's own phase-separation convention).
      [
        `ALTER TABLE products ADD COLUMN axis1_label TEXT NOT NULL DEFAULT 'Size'`,
        `ALTER TABLE products ADD COLUMN axis2_label TEXT NOT NULL DEFAULT 'Colour'`,
        `ALTER TABLE products ADD COLUMN min_order_qty INTEGER NOT NULL DEFAULT 1`,
        `ALTER TABLE product_sides ADD COLUMN label TEXT NOT NULL DEFAULT ''`,
      ],
    ],
  },
  {
    // POD-UI4.md §4.1 / P2, §11 (E.3) — the product page's "Key Features"
    // box. schema.sql (and therefore BASE_SCHEMA_STATEMENTS / 0000_base_schema
    // above) already creates `products.highlights` and carries schema.sql's
    // own bookkeeping INSERT for this migration's name, so — exactly like
    // 0016 above — this entry never actually runs on a brand-new database;
    // runMigrations' post-0000 mirroring of LEGACY_MIGRATION_NAMES marks it
    // applied before the loop reaches it. It only runs for real against an
    // EXISTING database that already converged on 0016 and is missing the
    // column. SQLite permits `NOT NULL` on `ADD COLUMN` only when a
    // non-null, non-expression DEFAULT is supplied (D1 enforces the same
    // restriction) — `DEFAULT ''` qualifies, same as 0016's own
    // `min_order_qty`/`axis1_label` columns above.
    name: '0017_product_highlights.sql',
    phases: [[`ALTER TABLE products ADD COLUMN highlights TEXT NOT NULL DEFAULT ''`]],
  },
  {
    // Vendor enrollment — admin-managed list of outside producers an order
    // can be assigned to. Like 0016/0017, schema.sql already carries the
    // table, the column and this name, so a fresh database never runs this
    // entry; it only upgrades an existing database.
    name: '0018_vendors.sql',
    phases: [
      [
        `CREATE TABLE IF NOT EXISTS vendors (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL,
          contact    TEXT    NOT NULL DEFAULT '',
          email      TEXT    NOT NULL DEFAULT '',
          phone      TEXT    NOT NULL DEFAULT '',
          notes      TEXT    NOT NULL DEFAULT '',
          active     INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      ],
      [`ALTER TABLE orders ADD COLUMN vendor_id INTEGER REFERENCES vendors(id)`],
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
    applied.add(migration.name)
    if (migration.name === BASE_SCHEMA_MIGRATION_NAME) {
      // 0000_base_schema's own phases just wrote an `INSERT OR IGNORE INTO
      // _migrations (...)` row for every one of 0001..0015 (schema.sql's
      // bookkeeping list) directly to the database. Mirror that into this
      // run's in-memory `applied` set too — otherwise the loop below would
      // still think 0012-0015 are unapplied (this Set was computed once,
      // before 0000 ran) and try to re-run them against the schema 0000
      // just finished creating, which fails: e.g. 0013_pod_reset.sql
      // selects a `products.image_url` column that the fresh POD-shaped
      // `products` table never had.
      for (const name of LEGACY_MIGRATION_NAMES) applied.add(name)
    }
    console.log(`[migrate] applied ${migration.name}`)
  }
}
