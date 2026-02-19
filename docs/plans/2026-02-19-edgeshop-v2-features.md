# EdgeShop v2 — Full E-commerce Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend EdgeShop from a basic product-listing + checkout app into a fully featured e-commerce platform at Shopify-feature parity, running entirely on Cloudflare's free tier.

**Architecture:** All features build on the existing Hono Worker + React/Vite Pages monorepo. New D1 tables are added via a single migration file. Email uses the Resend HTTP API (no TCP SMTP). Customer auth uses PBKDF2 + manual JWT (Web Crypto — no Node.js crypto). Theme customizer injects CSS custom properties from D1 settings into `:root`.

**Tech Stack:** Hono v4, D1 (SQLite + FTS5), R2, Resend HTTP API, Web Crypto (PBKDF2 + HMAC-SHA256 JWT), React 18, TanStack Query v5, Zustand, Tailwind CSS v4, Cloudflare Cron Triggers.

---

## Phase 1 — Make It Usable (Tasks 1–23)

---

### Task 1: D1 v2 Schema Migration

**Files:**
- Create: `worker/migrations/0002_v2_schema.sql`

**Step 1: Write the migration**

```sql
-- worker/migrations/0002_v2_schema.sql

-- ── Product variants ──────────────────────────────────────────
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

-- ── Product images (gallery) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ── Collections ───────────────────────────────────────────────
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

CREATE TABLE IF NOT EXISTS product_collections (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

-- ── Full-text search (FTS5) ───────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  name, description, tags,
  content=products,
  content_rowid=id
);

-- ── Customers ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- ── Discount codes ────────────────────────────────────────────
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

-- ── Static pages ──────────────────────────────────────────────
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

-- ── Shipping ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  countries_json TEXT NOT NULL DEFAULT '["India"]'
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  zone_id INTEGER NOT NULL REFERENCES shipping_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_weight REAL NOT NULL DEFAULT 0,
  max_weight REAL NOT NULL DEFAULT 9999,
  price REAL NOT NULL DEFAULT 0,
  free_above_cart_total REAL NOT NULL DEFAULT 0
);

-- ── Blog ──────────────────────────────────────────────────────
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

-- ── Product reviews ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT DEFAULT '',
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Existing table column additions ──────────────────────────
ALTER TABLE products ADD COLUMN compare_price REAL DEFAULT NULL;
ALTER TABLE products ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft'));
ALTER TABLE products ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'physical' CHECK (product_type IN ('physical', 'digital'));
ALTER TABLE products ADD COLUMN digital_file_key TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN weight REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN seo_title TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN seo_description TEXT DEFAULT '';

ALTER TABLE orders ADD COLUMN discount_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN shipping_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tracking_number TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN internal_notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT NULL;

-- ── New settings keys (seed defaults) ────────────────────────
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
  ('theme_overrides_json', '{}');

-- ── Seed default shipping zone ────────────────────────────────
INSERT OR IGNORE INTO shipping_zones (id, name, countries_json) VALUES (1, 'India', '["India"]');
INSERT OR IGNORE INTO shipping_rates (zone_id, name, price, free_above_cart_total) VALUES (1, 'Standard Shipping', 50, 500);
```

**Step 2: Apply migration locally**

```bash
cd worker
npx wrangler d1 execute edgeshop-db --local --file=migrations/0002_v2_schema.sql
```
Expected: `Successfully applied migration`.

**Step 3: Commit**

```bash
git add worker/migrations/0002_v2_schema.sql
git commit -m "feat: v2 D1 schema (variants, collections, customers, discounts, pages, shipping, blog, reviews)"
```

---

### Task 2: Product Variants API

**Files:**
- Create: `worker/src/routes/admin/variants.ts`
- Modify: `worker/src/routes/products.ts` (include variants in GET /products/:id)
- Modify: `worker/src/index.ts`
- Modify: `worker/src/types.ts`

**Step 1: Add types**

```typescript
// add to worker/src/types.ts
export interface ProductVariant {
  id: number
  product_id: number
  name: string
  options_json: string
  price: number
  stock_count: number
  image_url: string
  sku: string
}
```

**Step 2: Update GET /api/products/:id to include variants**

```typescript
// In worker/src/routes/products.ts — update the /:id handler
products.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const product = await c.env.DB.prepare(
    'SELECT * FROM products WHERE id = ? AND status = ?'
  ).bind(id, 'active').first<Product>()
  if (!product) return c.json({ error: 'Not found' }, 404)

  const { results: variants } = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC'
  ).bind(id).all<ProductVariant>()

  const { results: images } = await c.env.DB.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all<{ id: number; url: string; sort_order: number }>()

  return c.json({ ...product, variants, images })
})
```

**Step 3: Create admin variants route**

```typescript
// worker/src/routes/admin/variants.ts
import { Hono } from 'hono'
import type { Env } from '../../index'
import type { ProductVariant } from '../../types'

const variants = new Hono<{ Bindings: Env }>()

variants.get('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC'
  ).bind(productId).all<ProductVariant>()
  return c.json({ variants: results })
})

variants.post('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  const body = await c.req.json<{
    name: string; options_json?: string; price: number
    stock_count?: number; image_url?: string; sku?: string
  }>()
  const result = await c.env.DB.prepare(`
    INSERT INTO product_variants (product_id, name, options_json, price, stock_count, image_url, sku)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    productId,
    body.name,
    body.options_json ?? '{}',
    body.price,
    body.stock_count ?? 0,
    body.image_url ?? '',
    body.sku ?? ''
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

variants.put('/:variantId', async (c) => {
  const variantId = Number(c.req.param('variantId'))
  const body = await c.req.json<Partial<ProductVariant>>()
  const allowed = ['name', 'options_json', 'price', 'stock_count', 'image_url', 'sku']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE product_variants SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), variantId).run()
  return c.json({ ok: true })
})

variants.delete('/:variantId', async (c) => {
  const variantId = Number(c.req.param('variantId'))
  await c.env.DB.prepare('DELETE FROM product_variants WHERE id = ?').bind(variantId).run()
  return c.json({ ok: true })
})

export default variants
```

**Step 4: Mount in index.ts**

```typescript
import variants from './routes/admin/variants'
// Mount under admin products (nested route)
app.route('/api/admin/products/:productId/variants', variants)
```

**Step 5: Commit**

```bash
git add worker/src/routes/admin/variants.ts worker/src/routes/products.ts worker/src/index.ts worker/src/types.ts
git commit -m "feat: product variants API (CRUD per product)"
```

---

### Task 3: Product Gallery API

**Files:**
- Create: `worker/src/routes/admin/gallery.ts`
- Modify: `worker/src/index.ts`

**Step 1: Create gallery route**

```typescript
// worker/src/routes/admin/gallery.ts
import { Hono } from 'hono'
import type { Env } from '../../index'

const gallery = new Hono<{ Bindings: Env }>()

gallery.get('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(productId).all()
  return c.json({ images: results })
})

gallery.post('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  const { url, sort_order } = await c.req.json<{ url: string; sort_order?: number }>()
  const result = await c.env.DB.prepare(
    'INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)'
  ).bind(productId, url, sort_order ?? 0).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

gallery.delete('/:imageId', async (c) => {
  const imageId = Number(c.req.param('imageId'))
  await c.env.DB.prepare('DELETE FROM product_images WHERE id = ?').bind(imageId).run()
  return c.json({ ok: true })
})

// Reorder: accepts [{ id, sort_order }]
gallery.put('/reorder', async (c) => {
  const { order } = await c.req.json<{ order: Array<{ id: number; sort_order: number }> }>()
  const stmts = order.map(({ id, sort_order }) =>
    c.env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ?').bind(sort_order, id)
  )
  await c.env.DB.batch(stmts)
  return c.json({ ok: true })
})

export default gallery
```

**Step 2: Mount**

```typescript
app.route('/api/admin/products/:productId/images', gallery)
```

**Step 3: Commit**

```bash
git add worker/src/routes/admin/gallery.ts worker/src/index.ts
git commit -m "feat: product image gallery API (add/delete/reorder)"
```

---

### Task 4: Collections API

**Files:**
- Create: `worker/src/routes/collections.ts` (public)
- Create: `worker/src/routes/admin/collections.ts`
- Modify: `worker/src/types.ts`
- Modify: `worker/src/index.ts`

**Step 1: Add Collection type**

```typescript
// add to worker/src/types.ts
export interface Collection {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
  created_at: string
}
```

**Step 2: Public collections route**

```typescript
// worker/src/routes/collections.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import type { Collection, Product } from '../types'

const collections = new Hono<{ Bindings: Env }>()

collections.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM collections ORDER BY sort_order ASC, name ASC'
  ).all<Collection>()
  return c.json({ collections: results })
})

collections.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const collection = await c.env.DB.prepare(
    'SELECT * FROM collections WHERE slug = ?'
  ).bind(slug).first<Collection>()
  if (!collection) return c.json({ error: 'Not found' }, 404)

  const { results: products } = await c.env.DB.prepare(`
    SELECT p.* FROM products p
    JOIN product_collections pc ON pc.product_id = p.id
    WHERE pc.collection_id = ? AND p.status = 'active'
    ORDER BY p.created_at DESC
  `).bind(collection.id).all<Product>()

  return c.json({ collection, products })
})

export default collections
```

**Step 3: Admin collections route**

```typescript
// worker/src/routes/admin/collections.ts
import { Hono } from 'hono'
import type { Env } from '../../index'

const adminCollections = new Hono<{ Bindings: Env }>()

adminCollections.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM collections ORDER BY sort_order ASC'
  ).all()
  return c.json({ collections: results })
})

adminCollections.post('/', async (c) => {
  const body = await c.req.json<{
    name: string; slug: string; description?: string
    image_url?: string; sort_order?: number
    seo_title?: string; seo_description?: string
  }>()
  const result = await c.env.DB.prepare(`
    INSERT INTO collections (name, slug, description, image_url, sort_order, seo_title, seo_description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name, body.slug,
    body.description ?? '', body.image_url ?? '',
    body.sort_order ?? 0,
    body.seo_title ?? '', body.seo_description ?? ''
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminCollections.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['name', 'slug', 'description', 'image_url', 'sort_order', 'seo_title', 'seo_description']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE collections SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id).run()
  return c.json({ ok: true })
})

adminCollections.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// Assign products to collection
adminCollections.put('/:id/products', async (c) => {
  const collectionId = Number(c.req.param('id'))
  const { product_ids } = await c.req.json<{ product_ids: number[] }>()
  // Replace entire product list for this collection
  await c.env.DB.prepare('DELETE FROM product_collections WHERE collection_id = ?')
    .bind(collectionId).run()
  if (product_ids.length > 0) {
    const stmts = product_ids.map(pid =>
      c.env.DB.prepare('INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)')
        .bind(pid, collectionId)
    )
    await c.env.DB.batch(stmts)
  }
  return c.json({ ok: true })
})

export default adminCollections
```

**Step 4: Mount routes**

```typescript
app.route('/api/collections', collections)
app.route('/api/admin/collections', adminCollections)
```

**Step 5: Commit**

```bash
git add worker/src/routes/collections.ts worker/src/routes/admin/collections.ts worker/src/index.ts worker/src/types.ts
git commit -m "feat: collections API (public read + admin CRUD + product assignment)"
```

---

### Task 5: Full-Text Search API

**Files:**
- Create: `worker/src/routes/search.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/migrations/0002_v2_schema.sql` (already includes FTS5 table — add trigger)

**Step 1: Add FTS5 sync trigger to migration 0002 (if not already present)**

Append to the end of `worker/migrations/0002_v2_schema.sql`:

```sql
-- FTS sync triggers
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
```

**Step 2: Implement search route**

```typescript
// worker/src/routes/search.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product } from '../types'

const search = new Hono<{ Bindings: Env }>()

search.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const collection = c.req.query('collection') ?? ''
  const minPrice = Number(c.req.query('min_price') ?? 0)
  const maxPrice = Number(c.req.query('max_price') ?? 999999)
  const sortBy = c.req.query('sort') ?? 'newest' // newest | price_asc | price_desc | best_selling

  let products: Product[] = []

  if (q.trim()) {
    // FTS5 search
    const { results } = await c.env.DB.prepare(`
      SELECT p.* FROM products p
      JOIN products_fts ON products_fts.rowid = p.id
      WHERE products_fts MATCH ?
        AND p.status = 'active'
        AND p.price BETWEEN ? AND ?
      ORDER BY rank
    `).bind(`${q}*`, minPrice, maxPrice).all<Product>()
    products = results
  } else {
    // Browse with filters
    let sql = `
      SELECT DISTINCT p.* FROM products p
      ${collection ? 'JOIN product_collections pc ON pc.product_id = p.id JOIN collections c ON c.id = pc.collection_id' : ''}
      WHERE p.status = 'active'
        AND p.price BETWEEN ? AND ?
      ${collection ? "AND c.slug = ?" : ''}
    `
    const params: (string | number)[] = [minPrice, maxPrice]
    if (collection) params.push(collection)

    const orderMap: Record<string, string> = {
      newest: 'p.created_at DESC',
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
    }
    sql += ` ORDER BY ${orderMap[sortBy] ?? 'p.created_at DESC'}`
    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Product>()
    products = results
  }

  return c.json({ products, total: products.length })
})

export default search
```

**Step 3: Mount**

```typescript
import search from './routes/search'
app.route('/api/search', search)
```

**Step 4: Commit**

```bash
git add worker/src/routes/search.ts worker/src/index.ts
git commit -m "feat: FTS5 full-text search API with filter/sort"
```

---

### Task 6: Theme Customizer — Settings API

**Files:**
- Modify: `worker/src/routes/settings.ts` (extend PUT to allow theme_overrides_json)

**Step 1: Update the settings PUT allowed keys list**

In `worker/src/routes/settings.ts`, update the `allowed` array:

```typescript
const allowed = [
  'store_name', 'active_theme', 'cod_enabled',
  'razorpay_key_id', 'razorpay_key_secret', 'currency',
  // v2 additions
  'email_provider', 'email_api_key', 'email_from_name',
  'email_from_address', 'merchant_email',
  'navigation_json',
  'announcement_bar_text', 'announcement_bar_enabled', 'announcement_bar_color',
  'theme_overrides_json',
]
```

**Step 2: Commit**

```bash
git add worker/src/routes/settings.ts
git commit -m "feat: extend settings API to allow v2 keys (theme overrides, email, navigation, announcement bar)"
```

---

### Task 7: Theme Customizer — CSS Custom Properties

**Files:**
- Modify: `frontend/src/themes/ThemeProvider.tsx`
- Modify: `frontend/src/themes/types.ts`

**Step 1: Add `cssVars` optional field to Theme type**

```typescript
// In frontend/src/themes/types.ts — add to Theme interface
export interface ThemeOverrides {
  '--color-primary'?: string
  '--color-accent'?: string
  '--color-bg'?: string
  '--color-text'?: string
  '--font-heading'?: string
  '--font-body'?: string
  '--logo-url'?: string
  '--tagline'?: string
  '--hero-image'?: string
}

// Update Theme interface
export interface Theme {
  id: string
  name: string
  description: string
  defaultCssVars: ThemeOverrides   // theme's own defaults
  components: {
    Header: React.ComponentType<HeaderProps>
    Footer: React.ComponentType<FooterProps>
    Hero: React.ComponentType<HeroProps>
    ProductCard: React.ComponentType<ProductCardProps>
    ProductGrid: React.ComponentType<ProductGridProps>
    CartDrawer: React.ComponentType<CartDrawerProps>
  }
}
```

**Step 2: Update ThemeProvider to inject CSS variables**

```typescript
// In frontend/src/themes/ThemeProvider.tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()) as Promise<Record<string, string>>,
    staleTime: 5 * 60 * 1000,
  })

  const activeThemeId = settings?.active_theme ?? 'jewellery'
  const theme = themes[activeThemeId] ?? null

  // Merge theme defaults with merchant overrides from D1
  useEffect(() => {
    if (!theme) return
    const overrides: ThemeOverrides = settings?.theme_overrides_json
      ? JSON.parse(settings.theme_overrides_json)[activeThemeId] ?? {}
      : {}
    const merged = { ...theme.defaultCssVars, ...overrides }
    const root = document.documentElement
    for (const [prop, value] of Object.entries(merged)) {
      root.style.setProperty(prop, value as string)
    }
  }, [theme, settings, activeThemeId])

  return (
    <ThemeContext.Provider value={{ theme, isLoading, activeThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}
```

**Step 3: Update each theme's index.ts to export `defaultCssVars`**

For `frontend/src/themes/jewellery/index.ts`:
```typescript
const jewellery: Theme = {
  id: 'jewellery',
  name: 'Jewellery',
  description: 'Elegant, minimal, gold-accented.',
  defaultCssVars: {
    '--color-primary': '#1A1A1A',
    '--color-accent': '#C9A96E',
    '--color-bg': '#FAFAF8',
    '--color-text': '#1A1A1A',
    '--font-heading': '"Playfair Display", serif',
    '--font-body': 'system-ui, sans-serif',
  },
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}
```

For `frontend/src/themes/artsCrafts/index.ts`:
```typescript
const artsCrafts: Theme = {
  id: 'artsCrafts',
  name: 'Arts & Crafts',
  description: 'Warm, earthy, handmade aesthetic.',
  defaultCssVars: {
    '--color-primary': '#2C2416',
    '--color-accent': '#C4622D',
    '--color-bg': '#F5F0E8',
    '--color-text': '#2C2416',
    '--font-heading': 'system-ui, sans-serif',
    '--font-body': 'system-ui, sans-serif',
  },
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}
```

**Step 4: Update theme components to use CSS variables**

In each theme, replace hardcoded hex values with `var(--color-accent)` etc. in className strings where appropriate — at minimum in the Header and Hero components.

**Step 5: Commit**

```bash
git add frontend/src/themes/
git commit -m "feat: theme CSS custom properties (merchant-overridable via D1 settings)"
```

---

### Task 8: Theme Customizer — Admin Panel

**Files:**
- Create: `frontend/src/admin/pages/AdminThemeCustomizer.tsx`
- Modify: `frontend/src/admin/AdminLayout.tsx` (add route)
- Modify: `frontend/src/App.tsx` (add route)

**Step 1: Create customizer page**

```tsx
// frontend/src/admin/pages/AdminThemeCustomizer.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { themes } from '../../themes'

export default function AdminThemeCustomizer() {
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()) as Promise<Record<string, string>>,
  })

  const activeThemeId = settings?.active_theme ?? 'jewellery'
  const overrides = settings?.theme_overrides_json
    ? JSON.parse(settings.theme_overrides_json)
    : {}

  const [form, setForm] = useState<Record<string, string>>(overrides[activeThemeId] ?? {})

  const save = useMutation({
    mutationFn: async () => {
      const merged = { ...overrides, [activeThemeId]: form }
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_overrides_json: JSON.stringify(merged) }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const fields = [
    { key: '--color-accent', label: 'Accent Color', type: 'color' },
    { key: '--color-bg', label: 'Background Color', type: 'color' },
    { key: '--color-text', label: 'Text Color', type: 'color' },
    { key: '--logo-url', label: 'Logo URL', type: 'text' },
    { key: '--tagline', label: 'Tagline', type: 'text' },
    { key: '--hero-image', label: 'Hero Image URL', type: 'text' },
  ]

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Theme Customizer</h1>
      <p className="text-gray-500 text-sm">Customising: <strong>{themes[activeThemeId]?.name}</strong></p>
      {fields.map(({ key, label, type }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <input
            type={type}
            value={form[key] ?? ''}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            placeholder={themes[activeThemeId]?.defaultCssVars[key as keyof typeof themes[string]['defaultCssVars']] ?? ''}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button
        onClick={() => save.mutate()}
        className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 text-sm"
      >
        {save.isPending ? 'Saving…' : 'Save Customization'}
      </button>
    </div>
  )
}
```

**Step 2: Add route in App.tsx**

```tsx
<Route path="theme" element={<AdminThemeCustomizer />} />
```

**Step 3: Add nav link in AdminLayout.tsx**

```tsx
// Add 'theme' to the nav links array
{['products', 'orders', 'settings', 'theme'].map(link => (...))}
```

**Step 4: Commit**

```bash
git add frontend/src/admin/pages/AdminThemeCustomizer.tsx frontend/src/admin/AdminLayout.tsx frontend/src/App.tsx
git commit -m "feat: admin theme customizer panel with live CSS variable overrides"
```

---

### Task 9: Static Pages CMS — API

**Files:**
- Create: `worker/src/routes/pages.ts`
- Create: `worker/src/routes/admin/pages.ts`
- Modify: `worker/src/types.ts`
- Modify: `worker/src/index.ts`

**Step 1: Add Page type**

```typescript
export interface Page {
  id: number
  slug: string
  title: string
  content_html: string
  meta_title: string
  meta_description: string
  is_visible: number
  created_at: string
}
```

**Step 2: Public pages route**

```typescript
// worker/src/routes/pages.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import type { Page } from '../types'

const pages = new Hono<{ Bindings: Env }>()

pages.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const page = await c.env.DB.prepare(
    'SELECT * FROM pages WHERE slug = ? AND is_visible = 1'
  ).bind(slug).first<Page>()
  if (!page) return c.json({ error: 'Not found' }, 404)
  return c.json(page)
})

export default pages
```

**Step 3: Admin pages route (CRUD)**

```typescript
// worker/src/routes/admin/pages.ts
import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Page } from '../../types'

const adminPages = new Hono<{ Bindings: Env }>()

adminPages.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM pages ORDER BY slug ASC').all<Page>()
  return c.json({ pages: results })
})

adminPages.post('/', async (c) => {
  const body = await c.req.json<{
    slug: string; title: string; content_html?: string
    meta_title?: string; meta_description?: string; is_visible?: number
  }>()
  const result = await c.env.DB.prepare(`
    INSERT INTO pages (slug, title, content_html, meta_title, meta_description, is_visible)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.slug, body.title,
    body.content_html ?? '', body.meta_title ?? '', body.meta_description ?? '',
    body.is_visible ?? 1
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminPages.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['slug', 'title', 'content_html', 'meta_title', 'meta_description', 'is_visible']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  await c.env.DB.prepare(`UPDATE pages SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id).run()
  return c.json({ ok: true })
})

adminPages.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default adminPages
```

**Step 4: Mount**

```typescript
import pages from './routes/pages'
import adminPages from './routes/admin/pages'
app.route('/api/pages', pages)
app.route('/api/admin/pages', adminPages)
```

**Step 5: Commit**

```bash
git add worker/src/routes/pages.ts worker/src/routes/admin/pages.ts worker/src/index.ts worker/src/types.ts
git commit -m "feat: static pages CMS (API + admin CRUD)"
```

---

### Task 10: Static Pages — Storefront

**Files:**
- Create: `frontend/src/pages/StaticPage.tsx`
- Create: `frontend/src/admin/pages/AdminPages.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create storefront static page component**

```tsx
// frontend/src/pages/StaticPage.tsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'

export default function StaticPage() {
  const { slug } = useParams<{ slug: string }>()
  const { theme } = useTheme()
  const { data: page, isLoading, error } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => fetch(`/api/pages/${slug}`).then(r => {
      if (!r.ok) throw new Error('Not found')
      return r.json() as Promise<{ title: string; content_html: string; meta_title: string }>
    }),
  })

  if (isLoading) return <div className="p-8 text-center">Loading…</div>
  if (error || !page) return <div className="p-8 text-center">Page not found.</div>
  if (!theme) return null

  const { Header, Footer } = theme.components

  return (
    <div>
      <Header storeName="" cartCount={0} onCartOpen={() => {}} />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content_html }}
        />
      </main>
      <Footer storeName="" />
    </div>
  )
}
```

**Step 2: Add route in App.tsx**

```tsx
<Route path="/pages/:slug" element={<StaticPage />} />
```

**Step 3: Admin pages management page (table + simple HTML editor)**

`frontend/src/admin/pages/AdminPages.tsx` — table of pages with slug, title, visibility; modal editor with textarea for HTML content.

**Step 4: Add admin route**

```tsx
<Route path="pages" element={<AdminPages />} />
```

**Step 5: Commit**

```bash
git add frontend/src/pages/StaticPage.tsx frontend/src/admin/pages/AdminPages.tsx frontend/src/App.tsx
git commit -m "feat: static pages storefront (/pages/:slug) + admin editor"
```

---

### Task 11: Navigation Menu Editor

**Files:**
- Create: `frontend/src/admin/pages/AdminNavigation.tsx`
- Modify: `frontend/src/themes/ThemeProvider.tsx` (provide nav items via context)
- Modify: `frontend/src/themes/types.ts` (add navItems to HeaderProps)

**Step 1: Update HeaderProps**

```typescript
// In frontend/src/themes/types.ts
export interface NavItem {
  label: string
  href: string
}

export interface HeaderProps {
  storeName: string
  cartCount: number
  onCartOpen: () => void
  navItems: NavItem[]
}
```

**Step 2: Parse nav from settings in ThemeProvider and expose via context**

```typescript
// In ThemeContextValue — add navItems
interface ThemeContextValue {
  theme: Theme | null
  isLoading: boolean
  activeThemeId: string
  navItems: NavItem[]
  settings: Record<string, string>
}

// In ThemeProvider — parse navigation_json
const navItems: NavItem[] = settings?.navigation_json
  ? JSON.parse(settings.navigation_json)
  : []
```

**Step 3: Admin navigation editor**

```tsx
// frontend/src/admin/pages/AdminNavigation.tsx
// List of nav items (label, href) with add/remove/reorder.
// Save as JSON to PUT /api/settings { navigation_json: JSON.stringify(items) }
```

**Step 4: Update Header components in both themes to render navItems**

**Step 5: Commit**

```bash
git add frontend/src/admin/pages/AdminNavigation.tsx frontend/src/themes/
git commit -m "feat: navigation menu editor (admin) + dynamic nav in themes"
```

---

### Task 12: Announcement Bar

**Files:**
- Modify: `frontend/src/themes/ThemeProvider.tsx` (render bar if enabled)
- Create: `frontend/src/components/AnnouncementBar.tsx`

**Step 1: Create AnnouncementBar component**

```tsx
// frontend/src/components/AnnouncementBar.tsx
interface Props {
  text: string
  color?: string
}

export default function AnnouncementBar({ text, color = '#1A1A1A' }: Props) {
  return (
    <div
      className="w-full py-2 px-4 text-center text-sm text-white"
      style={{ backgroundColor: color }}
    >
      {text}
    </div>
  )
}
```

**Step 2: Render in ThemeProvider above children**

```tsx
// In ThemeProvider JSX:
const announcementEnabled = settings?.announcement_bar_enabled === 'true'
const announcementText = settings?.announcement_bar_text ?? ''
const announcementColor = settings?.announcement_bar_color ?? '#1A1A1A'

return (
  <ThemeContext.Provider value={...}>
    {announcementEnabled && announcementText && (
      <AnnouncementBar text={announcementText} color={announcementColor} />
    )}
    {children}
  </ThemeContext.Provider>
)
```

**Step 3: Expose settings in admin Settings page for announcement bar**

Add fields to `AdminSettings.tsx`:
- "Announcement Bar Text" input
- "Enable Announcement Bar" checkbox
- "Bar Color" color picker

**Step 4: Commit**

```bash
git add frontend/src/components/AnnouncementBar.tsx frontend/src/themes/ThemeProvider.tsx frontend/src/admin/pages/AdminSettings.tsx
git commit -m "feat: announcement bar (enabled/text/color from D1 settings)"
```

---

### Task 13: Email — Resend Integration

**Files:**
- Create: `worker/src/lib/email.ts`
- Modify: `worker/src/types.ts`

**Step 1: Create email helper**

```typescript
// worker/src/lib/email.ts

export interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail(
  options: EmailOptions,
  settings: { email_api_key: string; email_from_name: string; email_from_address: string }
): Promise<void> {
  if (!settings.email_api_key || !settings.email_from_address) {
    console.warn('Email not configured — skipping send')
    return
  }

  const from = `${settings.email_from_name} <${settings.email_from_address}>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.email_api_key}`,
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Resend API error:', res.status, error)
  }
}
```

**Step 2: Create email templates**

```typescript
// worker/src/lib/emailTemplates.ts

export function orderConfirmationHtml(order: {
  id: string
  customer_name: string
  items_json: string
  total_amount: number
  payment_method: string
  shipping_address: string
}): string {
  const items = JSON.parse(order.items_json) as Array<{
    name: string; quantity: number; price: number
  }>
  const itemRows = items
    .map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>₹${i.price}</td></tr>`)
    .join('')

  return `
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi ${order.customer_name}, your order <strong>${order.id}</strong> has been placed.</p>
    <table>
      <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
      ${itemRows}
    </table>
    <p><strong>Total: ₹${order.total_amount}</strong></p>
    <p>Payment: ${order.payment_method.toUpperCase()}</p>
    <p>Shipping to: ${order.shipping_address}</p>
  `
}

export function shippingUpdateHtml(order: {
  id: string
  customer_name: string
  tracking_number: string
}): string {
  return `
    <h2>Your order has shipped! 📦</h2>
    <p>Hi ${order.customer_name}, order <strong>${order.id}</strong> is on its way.</p>
    <p>Tracking number: <strong>${order.tracking_number}</strong></p>
  `
}
```

**Step 3: Commit**

```bash
git add worker/src/lib/email.ts worker/src/lib/emailTemplates.ts
git commit -m "feat: Resend email helper + order confirmation/shipping templates"
```

---

### Task 14: Email — Order Confirmation Trigger

**Files:**
- Modify: `worker/src/routes/checkout.ts` (send confirmation after COD order)
- Modify: `worker/src/routes/webhook.ts` (send confirmation after Razorpay payment.captured)

**Step 1: Add email send after COD order creation**

```typescript
// In checkout.ts — after the COD INSERT:
const emailSettings = await c.env.DB.prepare(
  "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','merchant_email')"
).all<{ key: string; value: string }>()
const eCfg: Record<string, string> = {}
for (const r of emailSettings.results) eCfg[r.key] = r.value

// Send to customer
await sendEmail(
  { to: body.customer_email, subject: `Order ${orderId} Confirmed`, html: orderConfirmationHtml({ ...body, id: orderId, items_json: JSON.stringify(body.items) }) },
  eCfg as Parameters<typeof sendEmail>[1]
)
// Alert merchant
if (eCfg.merchant_email) {
  await sendEmail(
    { to: eCfg.merchant_email, subject: `New Order: ${orderId}`, html: `<p>New COD order from ${body.customer_name} — ₹${body.total_amount}</p>` },
    eCfg as Parameters<typeof sendEmail>[1]
  )
}
```

**Step 2: Same pattern in webhook.ts for Razorpay `payment.captured`**

Fetch order from DB by razorpay_order_id, then send confirmation email.

**Step 3: Commit**

```bash
git add worker/src/routes/checkout.ts worker/src/routes/webhook.ts
git commit -m "feat: email order confirmation on COD + Razorpay payment captured"
```

---

### Task 15: Admin Dashboard Stats

**Files:**
- Create: `worker/src/routes/admin/dashboard.ts`
- Create: `frontend/src/admin/pages/AdminDashboard.tsx`
- Modify: `worker/src/index.ts`

**Step 1: Dashboard API**

```typescript
// worker/src/routes/admin/dashboard.ts
import { Hono } from 'hono'
import type { Env } from '../../index'

const dashboard = new Hono<{ Bindings: Env }>()

dashboard.get('/', async (c) => {
  const [
    revenueAll, revenueToday, totalOrders, pendingOrders, recentOrders, lowStock
  ] = await Promise.all([
    c.env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE payment_status='paid'").first<{ v: number }>(),
    c.env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as v FROM orders WHERE payment_status='paid' AND date(created_at)=date('now')").first<{ v: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as v FROM orders').first<{ v: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) as v FROM orders WHERE order_status='placed'").first<{ v: number }>(),
    c.env.DB.prepare('SELECT id, customer_name, total_amount, order_status, created_at FROM orders ORDER BY created_at DESC LIMIT 5').all(),
    c.env.DB.prepare('SELECT id, name, stock_count FROM products WHERE stock_count < 5 AND status=? ORDER BY stock_count ASC LIMIT 10').bind('active').all(),
  ])

  return c.json({
    revenue_all_time: revenueAll?.v ?? 0,
    revenue_today: revenueToday?.v ?? 0,
    total_orders: totalOrders?.v ?? 0,
    pending_orders: pendingOrders?.v ?? 0,
    recent_orders: recentOrders.results,
    low_stock_products: lowStock.results,
  })
})

export default dashboard
```

**Step 2: Mount**

```typescript
import dashboard from './routes/admin/dashboard'
app.route('/api/admin/dashboard', dashboard)
```

**Step 3: Frontend dashboard page**

`frontend/src/admin/pages/AdminDashboard.tsx` — stat cards (Revenue All Time, Revenue Today, Total Orders, Pending Orders) + recent orders table + low-stock products list.

**Step 4: Commit**

```bash
git add worker/src/routes/admin/dashboard.ts frontend/src/admin/pages/AdminDashboard.tsx worker/src/index.ts
git commit -m "feat: admin dashboard stats (revenue, orders, pending, low stock)"
```

---

### Task 16: Discount Codes — API

**Files:**
- Create: `worker/src/routes/admin/discounts.ts`
- Create: `worker/src/routes/validateDiscount.ts`
- Modify: `worker/src/types.ts`
- Modify: `worker/src/index.ts`

**Step 1: Add DiscountCode type**

```typescript
export interface DiscountCode {
  id: number
  code: string
  type: 'percent' | 'fixed' | 'free_shipping'
  value: number
  min_order_amount: number
  max_uses: number
  uses_count: number
  expires_at: string | null
  is_active: number
}
```

**Step 2: Public discount validation endpoint**

```typescript
// worker/src/routes/validateDiscount.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import type { DiscountCode } from '../types'

const validateDiscount = new Hono<{ Bindings: Env }>()

validateDiscount.post('/', async (c) => {
  const { code, cart_total } = await c.req.json<{ code: string; cart_total: number }>()

  const discount = await c.env.DB.prepare(`
    SELECT * FROM discount_codes
    WHERE code = ? COLLATE NOCASE AND is_active = 1
  `).bind(code).first<DiscountCode>()

  if (!discount) return c.json({ error: 'Invalid discount code' }, 404)

  if (discount.expires_at && new Date(discount.expires_at) < new Date()) {
    return c.json({ error: 'Discount code has expired' }, 400)
  }

  if (discount.max_uses > 0 && discount.uses_count >= discount.max_uses) {
    return c.json({ error: 'Discount code usage limit reached' }, 400)
  }

  if (cart_total < discount.min_order_amount) {
    return c.json({ error: `Minimum order amount is ₹${discount.min_order_amount}` }, 400)
  }

  let discount_amount = 0
  if (discount.type === 'percent') {
    discount_amount = Math.round((cart_total * discount.value) / 100 * 100) / 100
  } else if (discount.type === 'fixed') {
    discount_amount = Math.min(discount.value, cart_total)
  }
  // free_shipping: discount_amount = 0 (shipping waived at checkout)

  return c.json({
    valid: true,
    discount_amount,
    type: discount.type,
    code: discount.code,
  })
})

export default validateDiscount
```

**Step 3: Admin discount codes CRUD**

```typescript
// worker/src/routes/admin/discounts.ts
// Standard CRUD: GET list, POST create, PUT /:id update, DELETE /:id
```

**Step 4: Mount**

```typescript
app.route('/api/discount/validate', validateDiscount)
app.route('/api/admin/discounts', adminDiscounts)
```

**Step 5: Commit**

```bash
git add worker/src/routes/validateDiscount.ts worker/src/routes/admin/discounts.ts worker/src/index.ts worker/src/types.ts
git commit -m "feat: discount codes API (validate + admin CRUD)"
```

---

### Task 17: Discount Codes — Checkout Integration

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx`
- Modify: `worker/src/routes/checkout.ts`

**Step 1: Add discount code input to CheckoutPage**

```tsx
// In CheckoutPage.tsx — add discount code field above payment section
const [discountCode, setDiscountCode] = useState('')
const [discountResult, setDiscountResult] = useState<{
  discount_amount: number; type: string; code: string
} | null>(null)

async function applyDiscount() {
  const res = await fetch('/api/discount/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: discountCode, cart_total: cartTotal }),
  })
  if (res.ok) {
    setDiscountResult(await res.json())
  } else {
    const err = await res.json()
    alert(err.error)
  }
}
```

**Step 2: Pass discount_code + discount_amount in checkout POST body**

**Step 3: Update checkout.ts to record discount and increment uses_count**

```typescript
// After inserting order in checkout.ts:
if (body.discount_code) {
  await c.env.DB.prepare(
    'UPDATE discount_codes SET uses_count = uses_count + 1 WHERE code = ? COLLATE NOCASE'
  ).bind(body.discount_code).run()
}
```

**Step 4: Commit**

```bash
git add frontend/src/pages/CheckoutPage.tsx worker/src/routes/checkout.ts
git commit -m "feat: discount code input at checkout (validate + apply + uses_count tracking)"
```

---

### Task 18: Customer Accounts — Registration & Login API

**Files:**
- Create: `worker/src/routes/auth.ts`
- Create: `worker/src/lib/auth.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/src/types.ts`

**Step 1: Web Crypto auth helpers**

```typescript
// worker/src/lib/auth.ts

const PBKDF2_ITERATIONS = 100_000
const JWT_SECRET_KEY = 'EDGESHOP_JWT_SECRET' // read from env/settings

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const hash = new Uint8Array(bits)
  const combined = new Uint8Array(salt.length + hash.length)
  combined.set(salt)
  combined.set(hash, salt.length)
  return btoa(String.fromCharCode(...combined))
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const enc = new TextEncoder()
  const combined = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
  const salt = combined.slice(0, 16)
  const storedHash = combined.slice(16)
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const hash = new Uint8Array(bits)
  // Constant-time comparison
  if (hash.length !== storedHash.length) return false
  let diff = 0
  for (let i = 0; i < hash.length; i++) diff |= hash[i] ^ storedHash[i]
  return diff === 0
}

export async function createJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 }))
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${data}.${sigB64}`
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const [header, body, sig] = token.split('.')
  if (!header || !body || !sig) return null
  const enc = new TextEncoder()
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
  if (!valid) return null
  const payload = JSON.parse(atob(body)) as Record<string, unknown>
  if ((payload.exp as number) < Math.floor(Date.now() / 1000)) return null
  return payload
}
```

**Step 2: Auth routes**

```typescript
// worker/src/routes/auth.ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { hashPassword, verifyPassword, createJWT } from '../lib/auth'

const auth = new Hono<{ Bindings: Env }>()

auth.post('/register', async (c) => {
  const { email, password, name, phone } = await c.req.json<{
    email: string; password: string; name?: string; phone?: string
  }>()
  if (!email || !password || password.length < 8) {
    return c.json({ error: 'Email and password (min 8 chars) required' }, 400)
  }
  const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first()
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const password_hash = await hashPassword(password)
  const result = await c.env.DB.prepare(
    'INSERT INTO customers (email, password_hash, name, phone) VALUES (?, ?, ?, ?)'
  ).bind(email, password_hash, name ?? '', phone ?? '').run()

  // Read JWT secret from settings
  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key='jwt_secret'").first<{ value: string }>()
  const secret = secretRow?.value ?? 'default-change-me'
  const token = await createJWT({ sub: result.meta.last_row_id, email }, secret)

  return c.json({ token, customer_id: result.meta.last_row_id }, 201)
})

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  const customer = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE email = ?'
  ).bind(email).first<{ id: number; email: string; password_hash: string; name: string }>()
  if (!customer) return c.json({ error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, customer.password_hash)
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401)

  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key='jwt_secret'").first<{ value: string }>()
  const secret = secretRow?.value ?? 'default-change-me'
  const token = await createJWT({ sub: customer.id, email: customer.email }, secret)

  return c.json({ token, customer_id: customer.id, name: customer.name })
})

export default auth
```

**Step 3: Mount**

```typescript
import auth from './routes/auth'
app.route('/api/auth', auth)
```

**Step 4: Add JWT secret seed to migration**

```sql
-- append to 0002_v2_schema.sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('jwt_secret', '');
```

**Step 5: Commit**

```bash
git add worker/src/lib/auth.ts worker/src/routes/auth.ts worker/src/index.ts
git commit -m "feat: customer auth API (register/login, PBKDF2 + JWT via Web Crypto)"
```

---

### Task 19: Customer Accounts — Frontend Pages

**Files:**
- Create: `frontend/src/pages/account/LoginPage.tsx`
- Create: `frontend/src/pages/account/RegisterPage.tsx`
- Create: `frontend/src/pages/account/AccountOrdersPage.tsx`
- Create: `frontend/src/store/authStore.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Auth store (Zustand + localStorage)**

```typescript
// frontend/src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  customerId: number | null
  customerName: string
  setAuth: (token: string, customerId: number, name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      customerId: null,
      customerName: '',
      setAuth: (token, customerId, customerName) => set({ token, customerId, customerName }),
      logout: () => set({ token: null, customerId: null, customerName: '' }),
    }),
    { name: 'edgeshop-auth' }
  )
)
```

**Step 2: Login page** — form with email/password, calls POST /api/auth/login, stores token, redirects to /account.

**Step 3: Register page** — same pattern with POST /api/auth/register.

**Step 4: Account orders page** — fetch orders where customer_id matches (add `/api/account/orders` endpoint returning orders for authenticated customer).

**Step 5: Add routes**

```tsx
<Route path="/account/login" element={<LoginPage />} />
<Route path="/account/register" element={<RegisterPage />} />
<Route path="/account/orders" element={<AccountOrdersPage />} />
```

**Step 6: Commit**

```bash
git add frontend/src/pages/account/ frontend/src/store/authStore.ts frontend/src/App.tsx
git commit -m "feat: customer account pages (login, register, order history)"
```

---

### Task 20: Digital Products — Download API

**Files:**
- Create: `worker/src/routes/download.ts`
- Modify: `worker/src/routes/checkout.ts` (generate download token for digital orders)
- Modify: `worker/src/index.ts`

**Step 1: Generate HMAC-signed download token on checkout**

```typescript
// In worker/src/lib/auth.ts — add:
export async function createDownloadToken(
  orderId: string, productId: number, secret: string
): Promise<string> {
  const payload = { orderId, productId, exp: Math.floor(Date.now() / 1000) + 3600 * 48 }
  const enc = new TextEncoder()
  const data = btoa(JSON.stringify(payload))
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${data}.${sigHex}`
}
```

**Step 2: Download route**

```typescript
// worker/src/routes/download.ts
import { Hono } from 'hono'
import type { Env } from '../index'

const download = new Hono<{ Bindings: Env }>()

download.get('/', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'Missing token' }, 400)

  const [data, sig] = token.split('.')
  // Verify HMAC sig
  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key='jwt_secret'").first<{ value: string }>()
  const secret = secretRow?.value ?? 'default-change-me'
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
  if (!valid) return c.json({ error: 'Invalid token' }, 401)

  const payload = JSON.parse(atob(data)) as { orderId: string; productId: number; exp: number }
  if (payload.exp < Math.floor(Date.now() / 1000)) return c.json({ error: 'Token expired' }, 401)

  // Get the digital file key from product
  const product = await c.env.DB.prepare('SELECT digital_file_key FROM products WHERE id = ?')
    .bind(payload.productId).first<{ digital_file_key: string }>()
  if (!product?.digital_file_key) return c.json({ error: 'No file' }, 404)

  const object = await c.env.BUCKET.get(product.digital_file_key)
  if (!object) return c.json({ error: 'File not found in storage' }, 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${product.digital_file_key.split('/').pop()}"`,
    },
  })
})

export default download
```

**Step 3: Mount**

```typescript
app.route('/api/download', download)
```

**Step 4: Commit**

```bash
git add worker/src/routes/download.ts worker/src/lib/auth.ts worker/src/routes/checkout.ts worker/src/index.ts
git commit -m "feat: digital product downloads (HMAC-signed time-limited tokens, R2 streaming)"
```

---

### Task 21: Collection Storefront Page

**Files:**
- Create: `frontend/src/pages/CollectionPage.tsx`
- Create: `frontend/src/components/SearchBar.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Create collection page**

```tsx
// frontend/src/pages/CollectionPage.tsx
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { theme } = useTheme()
  const addItem = useCartStore(s => s.addItem)

  const sort = searchParams.get('sort') ?? 'newest'

  const { data } = useQuery({
    queryKey: ['collection', slug, sort],
    queryFn: () => fetch(`/api/collections/${slug}`).then(r => r.json()),
  })

  if (!theme || !data) return null

  const { Header, Footer, ProductGrid } = theme.components

  return (
    <div>
      <Header storeName="" cartCount={0} onCartOpen={() => {}} navItems={[]} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">{data.collection.name}</h1>
        {data.collection.description && (
          <p className="text-gray-600 mb-6">{data.collection.description}</p>
        )}
        {/* Sort controls */}
        <div className="flex gap-2 mb-6">
          {['newest', 'price_asc', 'price_desc'].map(s => (
            <button
              key={s}
              onClick={() => setSearchParams({ sort: s })}
              className={`px-3 py-1 text-sm rounded border ${sort === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'}`}
            >
              {s === 'newest' ? 'Newest' : s === 'price_asc' ? 'Price ↑' : 'Price ↓'}
            </button>
          ))}
        </div>
        <ProductGrid
          products={data.products}
          currency="₹"
          onAddToCart={(id) => {
            const p = data.products.find((p: { id: number }) => p.id === id)
            if (p) addItem({ product_id: p.id, name: p.name, price: p.price, quantity: 1, image_url: p.image_url })
          }}
        />
      </main>
      <Footer storeName="" />
    </div>
  )
}
```

**Step 2: Search page** — simple page that reads `?q=` and calls `/api/search`.

**Step 3: Add routes**

```tsx
<Route path="/collections/:slug" element={<CollectionPage />} />
<Route path="/search" element={<SearchPage />} />
```

**Step 4: Commit**

```bash
git add frontend/src/pages/CollectionPage.tsx frontend/src/pages/SearchPage.tsx frontend/src/App.tsx
git commit -m "feat: collection storefront page + search results page"
```

---

### Task 22: Admin Collections & Pages Management

**Files:**
- Create: `frontend/src/admin/pages/AdminCollections.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminLayout.tsx`

**Step 1: Admin collections page**

Table of collections with CRUD. Each row has edit (opens modal with name/slug/description/image), delete. "Assign Products" modal with multi-select checklist.

**Step 2: Add routes and nav**

```tsx
<Route path="collections" element={<AdminCollections />} />
<Route path="pages" element={<AdminPages />} />
<Route path="discounts" element={<AdminDiscounts />} />
<Route path="navigation" element={<AdminNavigation />} />
```

Add `'collections', 'discounts', 'pages', 'navigation'` to the admin sidebar nav links.

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminCollections.tsx frontend/src/App.tsx frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin collections management + extended sidebar nav"
```

---

### Task 23: Discount Codes Admin UI

**Files:**
- Create: `frontend/src/admin/pages/AdminDiscounts.tsx`

**Step 1: Create discount admin page**

Table with columns: Code, Type, Value, Min Order, Uses/Max, Expires, Active. Add/Edit modal with all fields.

**Step 2: Commit**

```bash
git add frontend/src/admin/pages/AdminDiscounts.tsx
git commit -m "feat: admin discount codes management UI"
```

---

## Phase 2 — Make It Complete (Tasks 24–35)

---

### Task 24: Order Detail Page (Admin)

**Files:**
- Create: `frontend/src/admin/pages/AdminOrderDetail.tsx`
- Modify: `worker/src/routes/admin/orders.ts` (add GET /:id endpoint)
- Modify: `frontend/src/App.tsx`

**Step 1: Add GET /api/admin/orders/:id**

```typescript
adminOrders.get('/:id', async (c) => {
  const id = c.req.param('id')
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()
  if (!order) return c.json({ error: 'Not found' }, 404)
  return c.json(order)
})
```

**Step 2: Order detail page** — full view with: customer info, parsed line items table, payment/order status badges, tracking number input + save button, internal notes textarea.

**Step 3: Add route**

```tsx
<Route path="orders/:id" element={<AdminOrderDetail />} />
```

**Step 4: Commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx worker/src/routes/admin/orders.ts frontend/src/App.tsx
git commit -m "feat: admin order detail page (line items, tracking, notes)"
```

---

### Task 25: Tracking Numbers + Shipping Email

**Files:**
- Modify: `worker/src/routes/admin/orders.ts` (add PATCH /:id/tracking)
- Modify: `worker/src/routes/admin/orders.ts` (send email on tracking update)

**Step 1: Add tracking update endpoint**

```typescript
adminOrders.patch('/:id/tracking', async (c) => {
  const id = c.req.param('id')
  const { tracking_number } = await c.req.json<{ tracking_number: string }>()
  await c.env.DB.prepare('UPDATE orders SET tracking_number = ?, order_status = ? WHERE id = ?')
    .bind(tracking_number, 'shipped', id).run()

  // Send shipping email
  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<Order>()
  if (order) {
    const emailSettings = await getEmailSettings(c.env.DB)
    await sendEmail(
      { to: order.customer_email, subject: `Your order ${id} has shipped!`, html: shippingUpdateHtml({ id, customer_name: order.customer_name, tracking_number }) },
      emailSettings
    )
  }

  return c.json({ ok: true })
})
```

**Step 2: Commit**

```bash
git add worker/src/routes/admin/orders.ts
git commit -m "feat: tracking number update + automatic shipping email"
```

---

### Task 26: SEO Fields — Products & Collections

**Files:**
- Modify: `frontend/src/pages/ProductPage.tsx` (add react-helmet or document title)
- Modify: `frontend/src/pages/CollectionPage.tsx`

**Step 1: Dynamic meta tags via document.title + meta description**

```tsx
// In ProductPage.tsx — useEffect to set title and meta
useEffect(() => {
  if (!product) return
  document.title = product.seo_title || product.name
  const meta = document.querySelector('meta[name="description"]')
  if (meta) meta.setAttribute('content', product.seo_description || product.description.slice(0, 160))
}, [product])
```

**Step 2: Same pattern in CollectionPage and StaticPage**

**Step 3: Admin: add SEO fields to AdminProducts edit modal**

Add `seo_title` and `seo_description` inputs to the product add/edit form.

**Step 4: Commit**

```bash
git add frontend/src/pages/ frontend/src/admin/pages/AdminProducts.tsx
git commit -m "feat: SEO meta title + description for products and collections"
```

---

### Task 27: Sitemap.xml

**Files:**
- Create: `worker/src/routes/sitemap.ts`
- Modify: `worker/src/index.ts`

**Step 1: Sitemap route**

```typescript
// worker/src/routes/sitemap.ts
import { Hono } from 'hono'
import type { Env } from '../index'

const sitemap = new Hono<{ Bindings: Env }>()

sitemap.get('/', async (c) => {
  const frontendUrl = c.env.FRONTEND_URL ?? 'https://edgeshop.pages.dev'

  const [products, collections, pages] = await Promise.all([
    c.env.DB.prepare('SELECT id FROM products WHERE status = ?').bind('active').all<{ id: number }>(),
    c.env.DB.prepare('SELECT slug FROM collections').all<{ slug: string }>(),
    c.env.DB.prepare('SELECT slug FROM pages WHERE is_visible = 1').all<{ slug: string }>(),
  ])

  const urls: string[] = [
    `<url><loc>${frontendUrl}/</loc></url>`,
    ...products.results.map(p => `<url><loc>${frontendUrl}/product/${p.id}</loc></url>`),
    ...collections.results.map(c2 => `<url><loc>${frontendUrl}/collections/${c2.slug}</loc></url>`),
    ...pages.results.map(p => `<url><loc>${frontendUrl}/pages/${p.slug}</loc></url>`),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
})

export default sitemap
```

**Step 2: Mount**

```typescript
import sitemap from './routes/sitemap'
app.route('/sitemap.xml', sitemap)
```

**Step 3: Commit**

```bash
git add worker/src/routes/sitemap.ts worker/src/index.ts
git commit -m "feat: sitemap.xml auto-generated from D1 (products, collections, pages)"
```

---

### Task 28: Shipping Zones — API

**Files:**
- Create: `worker/src/routes/admin/shipping.ts`
- Create: `worker/src/routes/shippingRates.ts`
- Modify: `worker/src/index.ts`

**Step 1: Public shipping rates calculator**

```typescript
// worker/src/routes/shippingRates.ts
import { Hono } from 'hono'
import type { Env } from '../index'

const shippingRates = new Hono<{ Bindings: Env }>()

shippingRates.post('/calculate', async (c) => {
  const { cart_total, weight, country } = await c.req.json<{
    cart_total: number; weight?: number; country?: string
  }>()

  const zone = await c.env.DB.prepare(
    "SELECT sz.id FROM shipping_zones sz WHERE sz.countries_json LIKE ?"
  ).bind(`%${country ?? 'India'}%`).first<{ id: number }>()

  if (!zone) return c.json({ shipping_amount: 0, rate_name: 'Free Shipping' })

  const rate = await c.env.DB.prepare(`
    SELECT * FROM shipping_rates
    WHERE zone_id = ?
      AND min_weight <= ?
      AND max_weight >= ?
    ORDER BY price ASC LIMIT 1
  `).bind(zone.id, weight ?? 0, weight ?? 0).first<{
    name: string; price: number; free_above_cart_total: number
  }>()

  if (!rate) return c.json({ shipping_amount: 0, rate_name: 'Free Shipping' })

  const shipping_amount = rate.free_above_cart_total > 0 && cart_total >= rate.free_above_cart_total
    ? 0 : rate.price

  return c.json({ shipping_amount, rate_name: rate.name })
})

export default shippingRates
```

**Step 2: Admin shipping management CRUD** (zones + rates)

**Step 3: Mount**

```typescript
app.route('/api/shipping', shippingRates)
app.route('/api/admin/shipping', adminShipping)
```

**Step 4: Commit**

```bash
git add worker/src/routes/shippingRates.ts worker/src/routes/admin/shipping.ts worker/src/index.ts
git commit -m "feat: shipping zones + rates API (calculate + admin CRUD)"
```

---

### Task 29: Shipping at Checkout

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx` (calculate + show shipping cost)

**Step 1: Call shipping calculator in CheckoutPage**

When the shipping address country/weight is known, call `POST /api/shipping/calculate` and display the shipping cost. Add it to the order total.

**Step 2: Pass `shipping_amount` in checkout POST body**

**Step 3: Commit**

```bash
git add frontend/src/pages/CheckoutPage.tsx
git commit -m "feat: shipping cost calculation at checkout"
```

---

### Task 30: Product Reviews

**Files:**
- Create: `worker/src/routes/reviews.ts`
- Create: `worker/src/routes/admin/reviews.ts`
- Modify: `frontend/src/pages/ProductPage.tsx` (show reviews + submit form)
- Modify: `worker/src/index.ts`

**Step 1: Public reviews endpoint**

```typescript
// worker/src/routes/reviews.ts — GET /api/products/:id/reviews + POST /api/products/:id/reviews
```

**Step 2: Admin moderation**

```typescript
// worker/src/routes/admin/reviews.ts — GET all unapproved, PATCH /:id approve/reject, DELETE /:id
```

**Step 3: Product page reviews section** — display approved reviews with star rating, submit form for new review.

**Step 4: Commit**

```bash
git add worker/src/routes/reviews.ts worker/src/routes/admin/reviews.ts frontend/src/pages/ProductPage.tsx worker/src/index.ts
git commit -m "feat: product reviews (public submit + admin moderation)"
```

---

### Task 31: Blog / Articles

**Files:**
- Create: `worker/src/routes/blog.ts`
- Create: `worker/src/routes/admin/blog.ts`
- Create: `frontend/src/pages/BlogListPage.tsx`
- Create: `frontend/src/pages/BlogPostPage.tsx`
- Modify: `worker/src/index.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Blog routes (public + admin CRUD)**

**Step 2: Blog list page** — grid of post cards with cover image, title, date, excerpt.

**Step 3: Blog post page** — full post with `dangerouslySetInnerHTML` for content_html.

**Step 4: Routes**

```tsx
<Route path="/blog" element={<BlogListPage />} />
<Route path="/blog/:slug" element={<BlogPostPage />} />
```

**Step 5: Commit**

```bash
git add worker/src/routes/blog.ts worker/src/routes/admin/blog.ts frontend/src/pages/Blog*.tsx frontend/src/App.tsx worker/src/index.ts
git commit -m "feat: blog/articles (API + storefront + admin CRUD)"
```

---

### Task 32: Refunds (Admin)

**Files:**
- Modify: `worker/src/routes/admin/orders.ts` (add PATCH /:id/refund)

**Step 1: Refund endpoint**

```typescript
adminOrders.patch('/:id/refund', async (c) => {
  const id = c.req.param('id')
  const { notes } = await c.req.json<{ notes?: string }>()
  await c.env.DB.prepare(`
    UPDATE orders SET payment_status = 'refunded', internal_notes = ? WHERE id = ?
  `).bind(notes ?? '', id).run()
  return c.json({ ok: true })
})
```

**Step 2: Refund button in AdminOrderDetail page**

**Step 3: Commit**

```bash
git add worker/src/routes/admin/orders.ts frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "feat: refund support (mark order as refunded with notes)"
```

---

### Task 33: Analytics Charts

**Files:**
- Create: `worker/src/routes/admin/analytics.ts`
- Create: `frontend/src/admin/pages/AdminAnalytics.tsx`
- Modify: `worker/src/index.ts`

**Step 1: Analytics API**

```typescript
// worker/src/routes/admin/analytics.ts
dashboard.get('/revenue', async (c) => {
  const days = Number(c.req.query('days') ?? 30)
  const { results } = await c.env.DB.prepare(`
    SELECT date(created_at) as day, SUM(total_amount) as revenue, COUNT(*) as orders
    FROM orders
    WHERE payment_status = 'paid'
      AND created_at >= datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).bind(`-${days} days`).all()
  return c.json({ data: results })
})
```

**Step 2: Analytics page** — CSS bar chart (no external library) showing revenue/day for 30d and 90d toggle.

**Step 3: Commit**

```bash
git add worker/src/routes/admin/analytics.ts frontend/src/admin/pages/AdminAnalytics.tsx worker/src/index.ts
git commit -m "feat: revenue analytics chart (D1 GROUP BY + CSS bars)"
```

---

### Task 34: Abandoned Cart Recovery

**Files:**
- Modify: `worker/migrations/` (add `abandoned_carts` table — note: add to 0002 or create 0003)
- Create: `worker/src/routes/abandonedCart.ts`
- Modify: `worker/wrangler.toml` (add cron trigger)

**Step 1: Add abandoned_carts table (migration 0003)**

```sql
-- worker/migrations/0003_abandoned_cart.sql
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  cart_json TEXT NOT NULL,
  recovery_sent INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Step 2: Save cart endpoint (called when email entered at checkout)**

```typescript
// POST /api/cart/save — saves email + cart_json to abandoned_carts
```

**Step 3: Cron handler in index.ts**

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx)
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    // Find carts older than 2h where recovery_sent = 0
    const { results } = await env.DB.prepare(`
      SELECT * FROM abandoned_carts
      WHERE recovery_sent = 0
        AND datetime(created_at, '+2 hours') <= datetime('now')
    `).all()
    for (const cart of results) {
      // Send recovery email
      // Mark recovery_sent = 1
    }
  },
}
```

**Step 4: Add cron to wrangler.toml**

```toml
[triggers]
crons = ["0 * * * *"] # every hour
```

**Step 5: Commit**

```bash
git add worker/migrations/0003_abandoned_cart.sql worker/src/routes/abandonedCart.ts worker/src/index.ts worker/wrangler.toml
git commit -m "feat: abandoned cart recovery (D1 + Cloudflare Cron Trigger + Resend email)"
```

---

### Task 35: OG Tags + Social Sharing

**Files:**
- Modify: `frontend/index.html` (add base OG meta tags)
- Modify: `frontend/src/pages/ProductPage.tsx`
- Modify: `frontend/src/pages/CollectionPage.tsx`

**Step 1: Base OG tags in index.html**

```html
<meta property="og:type" content="website" />
<meta property="og:site_name" content="EdgeShop" />
<meta name="twitter:card" content="summary_large_image" />
```

**Step 2: Dynamic OG tags per page via useEffect**

```typescript
// In ProductPage.tsx:
useEffect(() => {
  if (!product) return
  document.title = product.seo_title || product.name
  setMeta('og:title', product.seo_title || product.name)
  setMeta('og:description', product.seo_description || product.description)
  setMeta('og:image', product.image_url)
}, [product])

function setMeta(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}
```

**Step 3: Commit**

```bash
git add frontend/index.html frontend/src/pages/ProductPage.tsx frontend/src/pages/CollectionPage.tsx
git commit -m "feat: OG meta tags for product and collection pages"
```

---

## Phase 3 — Make It Competitive (Tasks 36–43)

---

### Task 36: Custom 404 Page

**Files:**
- Create: `frontend/src/pages/NotFoundPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: 404 page**

```tsx
// frontend/src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'

export default function NotFoundPage() {
  const { theme } = useTheme()
  const { Header, Footer } = theme?.components ?? {}

  return (
    <div>
      {Header && <Header storeName="" cartCount={0} onCartOpen={() => {}} navItems={[]} />}
      <main className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Page not found</p>
        <Link to="/" className="px-6 py-3 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">
          Back to Home
        </Link>
      </main>
      {Footer && <Footer storeName="" />}
    </div>
  )
}
```

**Step 2: Add as catch-all route in App.tsx**

```tsx
<Route path="*" element={<NotFoundPage />} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/NotFoundPage.tsx frontend/src/App.tsx
git commit -m "feat: custom 404 page with theme header/footer"
```

---

### Task 37: Contact Form

**Files:**
- Create: `frontend/src/pages/ContactPage.tsx`
- Create: `worker/src/routes/contact.ts`
- Modify: `worker/src/index.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Contact endpoint** — POSTs name/email/message and sends it as an email to merchant_email via Resend.

**Step 2: Contact page** — simple form with name, email, message fields.

**Step 3: Commit**

```bash
git add frontend/src/pages/ContactPage.tsx worker/src/routes/contact.ts worker/src/index.ts frontend/src/App.tsx
git commit -m "feat: contact form (sends to merchant email via Resend)"
```

---

### Task 38: Pagination

**Files:**
- Modify: `worker/src/routes/products.ts` (add `?page=&limit=` query params)
- Modify: `worker/src/routes/search.ts`
- Modify: `frontend/src/pages/HomePage.tsx` (add pagination controls)

**Step 1: Update products list API**

```typescript
products.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(48, Math.max(1, Number(c.req.query('limit') ?? 12)))
  const offset = (page - 1) * limit

  const countRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM products WHERE status = ?').bind('active').first<{ total: number }>()
  const total = countRow?.total ?? 0

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM products WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind('active', limit, offset).all<Product>()

  return c.json({ products: results, total, page, limit, pages: Math.ceil(total / limit) })
})
```

**Step 2: Pagination component** — Prev/Next buttons + page number display.

**Step 3: Commit**

```bash
git add worker/src/routes/products.ts worker/src/routes/search.ts frontend/src/pages/HomePage.tsx
git commit -m "feat: pagination for product list and search results"
```

---

### Task 39: Admin Search & Filter

**Files:**
- Modify: `worker/src/routes/admin/products.ts` (add search/filter query params)
- Modify: `worker/src/routes/admin/orders.ts` (add search/filter)
- Modify: `frontend/src/admin/pages/AdminProducts.tsx`
- Modify: `frontend/src/admin/pages/AdminOrders.tsx`

**Step 1: Searchable admin products list**

```typescript
adminProducts.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const status = c.req.query('status') ?? ''
  let sql = 'SELECT * FROM products WHERE 1=1'
  const params: (string | number)[] = []
  if (q) { sql += ' AND (name LIKE ? OR sku LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY created_at DESC'
  const { results } = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ products: results })
})
```

**Step 2: Add search inputs to admin product and order tables**

**Step 3: Commit**

```bash
git add worker/src/routes/admin/products.ts worker/src/routes/admin/orders.ts frontend/src/admin/pages/AdminProducts.tsx frontend/src/admin/pages/AdminOrders.tsx
git commit -m "feat: admin product and order search/filter"
```

---

### Task 40: Admin Blog Management

**Files:**
- Create: `frontend/src/admin/pages/AdminBlog.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminLayout.tsx`

**Step 1: Admin blog page** — table of posts with slug, title, published date, status. Add/edit modal with title, slug, content HTML textarea, cover image upload, tags, publish date.

**Step 2: Add route and nav**

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminBlog.tsx frontend/src/App.tsx frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin blog management UI"
```

---

### Task 41: Admin Shipping Management UI

**Files:**
- Create: `frontend/src/admin/pages/AdminShipping.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminLayout.tsx`

**Step 1: Shipping zones + rates UI** — show zones with their rates listed. Add/edit/delete zones. Add/edit/delete rates per zone.

**Step 2: Commit**

```bash
git add frontend/src/admin/pages/AdminShipping.tsx frontend/src/App.tsx frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin shipping zones and rates management UI"
```

---

### Task 42: Admin Reviews Moderation

**Files:**
- Create: `frontend/src/admin/pages/AdminReviews.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminLayout.tsx`

**Step 1: Reviews moderation UI** — table of unapproved reviews with Approve/Reject buttons.

**Step 2: Commit**

```bash
git add frontend/src/admin/pages/AdminReviews.tsx frontend/src/App.tsx frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin reviews moderation UI"
```

---

### Task 43: Deploy v2 + Update Migration

**Files:**
- Modify: `deploy.sh` (apply 0002 and 0003 migrations)
- Modify: `DEPLOY.md` or `README.md` (document new setup steps)

**Step 1: Apply v2 migrations in deploy.sh**

After the existing `wrangler d1 execute "$DB_NAME" --file=migrations/0001_initial.sql` line, add:

```bash
wrangler d1 execute "$DB_NAME" --file=migrations/0002_v2_schema.sql
wrangler d1 execute "$DB_NAME" --file=migrations/0003_abandoned_cart.sql
```

**Step 2: Update DEPLOY.md with new env vars (Resend API key, JWT secret)**

**Step 3: Set JWT secret as Worker secret**

```bash
echo "your-random-secret" | wrangler secret put JWT_SECRET
```

**Step 4: Final commit**

```bash
git add deploy.sh
git commit -m "chore: update deploy script for v2 migrations + new secrets"
```

---

## Key Decisions Log (v2)

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-19 | FTS5 virtual table for search | Built into D1/SQLite; no extra service; sync via triggers |
| 2026-02-19 | CSS custom properties for theme overrides | Injected from D1 at runtime; zero rebuild to change theme colours |
| 2026-02-19 | Resend HTTP API for email | Workers can't open raw TCP connections; Resend is HTTP-based and has 3k free emails/month |
| 2026-02-19 | PBKDF2 + HMAC-SHA256 JWT for customer auth | Web Crypto API — edge-compatible, no Node.js `crypto` needed |
| 2026-02-19 | HMAC-signed time-limited tokens for digital downloads | Files stay private in R2; tokens expire after 48h |
| 2026-02-19 | Discount validation is server-side only | Prevents client-side cart manipulation; uses_count incremented atomically in D1 |
| 2026-02-19 | Cloudflare Cron Trigger for abandoned cart | Scheduled workers run at edge; no external cron service needed |
| 2026-02-19 | CSS bar chart (no Chart.js) | Keeps bundle small; D1 GROUP BY provides data; CSS flex bars are sufficient for admin analytics |
| 2026-02-19 | Sitemap generated dynamically from D1 | Always up-to-date; no build step; Worker handles /sitemap.xml requests |
