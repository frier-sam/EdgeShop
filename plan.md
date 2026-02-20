# EdgeShop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a zero-cost serverless e-commerce engine on Cloudflare's free tier with a fully decoupled theme system (Jewellery + Arts & Crafts themes) selectable from the admin panel.

**Architecture:** Monorepo with `worker/` (Hono on Cloudflare Workers) and `frontend/` (React + Vite on Cloudflare Pages). D1 stores products/orders/settings; R2 stores product images uploaded directly from the browser as WebP. Theme system uses a typed contract — each theme exports the same set of components and the ThemeProvider swaps them based on the `active_theme` setting stored in D1.

**Tech Stack:** Hono v4, React 18, Vite 5, TypeScript, Tailwind CSS v4, Zustand (cart), TanStack Query v5, React Router v6, Vitest + @cloudflare/vitest-pool-workers (worker tests), Vitest + React Testing Library (frontend tests), Razorpay JS SDK.

---

## Status Legend
- [x] Done
- [x] Done
- [x] Done

---

## Phase 1: Project Scaffolding

### Task 1: Initialise monorepo root [x] Done

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `tsconfig.base.json`

**Step 1:** Create root `package.json`
```json
{
  "name": "edgeshop",
  "private": true,
  "workspaces": ["worker", "frontend"],
  "scripts": {
    "dev:worker": "cd worker && wrangler dev",
    "dev:frontend": "cd frontend && vite",
    "deploy:worker": "cd worker && wrangler deploy",
    "deploy:frontend": "cd frontend && vite build && wrangler pages deploy dist"
  }
}
```

**Step 2:** Create `.gitignore`
```
node_modules/
dist/
.wrangler/
.dev.vars
*.local
.env
```

**Step 3:** Create `tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

**Step 4:** Commit
```bash
git init
git add package.json .gitignore tsconfig.base.json
git commit -m "chore: initialise monorepo root"
```

---

### Task 2: Scaffold Worker package [x] Done

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`

**Step 1:** Create `worker/package.json`
```json
{
  "name": "@edgeshop/worker",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "dependencies": {
    "hono": "^4.6.0",
    "nanoid": "^5.0.7"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.0",
    "@cloudflare/workers-types": "^4.20241022.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.78.0"
  }
}
```

**Step 2:** Create `worker/tsconfig.json`
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 3:** Create `worker/wrangler.toml`
```toml
name = "edgeshop-worker"
main = "src/index.ts"
compatibility_date = "2024-10-22"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "edgeshop-db"
database_id = "REPLACE_WITH_ACTUAL_ID_AFTER_CREATION"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "edgeshop-images"

[vars]
RAZORPAY_WEBHOOK_SECRET = ""

# Local dev secrets — put real values in worker/.dev.vars (gitignored)
# RAZORPAY_KEY_ID = ""
# RAZORPAY_KEY_SECRET = ""
```

**Step 4:** Create `worker/src/index.ts` (minimal skeleton)
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'

export type Env = {
  DB: D1Database
  BUCKET: R2Bucket
  RAZORPAY_WEBHOOK_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*' }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
```

**Step 5:** Install and verify worker compiles
```bash
cd worker && npm install && npx tsc --noEmit
```
Expected: No errors.

**Step 6:** Commit
```bash
git add worker/
git commit -m "chore: scaffold worker package with Hono skeleton"
```

---

### Task 3: Scaffold Frontend package [x] Done

**Files:**
- Create: `frontend/` (via Vite scaffold, then customise)
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Step 1:** Scaffold with Vite
```bash
cd /path/to/edgeshop
npm create vite@latest frontend -- --template react-ts
```

**Step 2:** Add dependencies to `frontend/package.json`
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.56.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 3:** Update `frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
```

**Step 4:** Create `frontend/src/App.tsx` (shell with router)
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/admin/*" element={<div>Admin</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

**Step 5:** Install and verify
```bash
cd frontend && npm install && npx tsc --noEmit
```
Expected: No errors.

**Step 6:** Commit
```bash
git add frontend/
git commit -m "chore: scaffold frontend with React + Vite + Tailwind"
```

---

### Task 4: D1 Schema and Migrations [x] Done

**Files:**
- Create: `worker/migrations/0001_initial.sql`

**Step 1:** Write migration
```sql
-- worker/migrations/0001_initial.sql

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  image_url TEXT DEFAULT '',
  stock_count INTEGER DEFAULT 0,
  category TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT DEFAULT '',
  shipping_address TEXT NOT NULL,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('razorpay', 'cod')),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'placed',
  razorpay_order_id TEXT DEFAULT '',
  razorpay_payment_id TEXT DEFAULT '',
  items_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('store_name', 'EdgeShop'),
  ('active_theme', 'jewellery'),
  ('cod_enabled', 'true'),
  ('razorpay_key_id', ''),
  ('razorpay_key_secret', ''),
  ('currency', 'INR');
```

**Step 2:** Create local D1 for dev
```bash
cd worker
npx wrangler d1 create edgeshop-db
# Copy the database_id output and update wrangler.toml
npx wrangler d1 execute edgeshop-db --local --file=migrations/0001_initial.sql
```
Expected: `Successfully executed migrations` (or similar).

**Step 3:** Commit
```bash
git add worker/migrations/ worker/wrangler.toml
git commit -m "feat: add D1 schema with products, orders, settings tables"
```

---

## Phase 2: Backend API (Worker)

### Task 5: Shared Worker types [x] Done

**Files:**
- Create: `worker/src/types.ts`

**Step 1:** Write types
```typescript
// worker/src/types.ts

export interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  stock_count: number
  category: string
  created_at: string
}

export interface Order {
  id: string
  customer_name: string
  customer_email: string
  customer_phone: string
  shipping_address: string
  total_amount: number
  payment_method: 'razorpay' | 'cod'
  payment_status: string
  order_status: string
  razorpay_order_id: string
  razorpay_payment_id: string
  items_json: string
  created_at: string
}

export interface OrderItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}

export interface Settings {
  store_name: string
  active_theme: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
  currency: string
}
```

**Step 2:** Commit
```bash
git add worker/src/types.ts
git commit -m "feat: add shared worker types"
```

---

### Task 6: Settings API [x] Done

**Files:**
- Create: `worker/src/routes/settings.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/src/tests/settings.test.ts`

**Step 1:** Write failing test for `GET /api/settings`
```typescript
// worker/src/tests/settings.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { UnstableDevWorker } from 'wrangler'

describe('Settings API', () => {
  let worker: UnstableDevWorker

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    })
  })

  afterAll(async () => {
    await worker.stop()
  })

  it('GET /api/settings returns default settings', async () => {
    const res = await worker.fetch('/api/settings')
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, string>
    expect(body.store_name).toBe('EdgeShop')
    expect(body.active_theme).toBe('jewellery')
  })
})
```

**Step 2:** Run test — expect FAIL
```bash
cd worker && npx vitest run src/tests/settings.test.ts
```

**Step 3:** Implement `worker/src/routes/settings.ts`
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'

const settings = new Hono<{ Bindings: Env }>()

settings.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const result: Record<string, string> = {}
  for (const row of rows.results as { key: string; value: string }[]) {
    result[row.key] = row.value
  }
  return c.json(result)
})

settings.put('/', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const allowed = ['store_name', 'active_theme', 'cod_enabled', 'razorpay_key_id', 'razorpay_key_secret', 'currency']
  const stmts = Object.entries(body)
    .filter(([key]) => allowed.includes(key))
    .map(([key, value]) =>
      c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
        .bind(key, value)
    )
  if (stmts.length === 0) return c.json({ error: 'No valid keys' }, 400)
  await c.env.DB.batch(stmts)
  return c.json({ ok: true })
})

export default settings
```

**Step 4:** Mount route in `worker/src/index.ts`
```typescript
import settings from './routes/settings'
// ...
app.route('/api/settings', settings)
```

**Step 5:** Run test — expect PASS
```bash
cd worker && npx vitest run src/tests/settings.test.ts
```

**Step 6:** Commit
```bash
git add worker/src/routes/settings.ts worker/src/index.ts worker/src/tests/
git commit -m "feat: add settings API (GET/PUT)"
```

---

### Task 7: Products API (CRUD) [x] Done

**Files:**
- Create: `worker/src/routes/products.ts`
- Create: `worker/src/tests/products.test.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Write failing tests
```typescript
// worker/src/tests/products.test.ts
describe('Products API', () => {
  it('GET /api/products returns empty array initially', async () => {
    const res = await worker.fetch('/api/products')
    expect(res.status).toBe(200)
    const body = await res.json() as { products: unknown[] }
    expect(Array.isArray(body.products)).toBe(true)
  })

  it('POST /api/admin/products creates a product', async () => {
    const res = await worker.fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ring', price: 999, stock_count: 10 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as { id: number }
    expect(body.id).toBeTypeOf('number')
  })

  it('GET /api/products/:id returns the product', async () => {
    // First create one
    const createRes = await worker.fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bracelet', price: 499, stock_count: 5 }),
    })
    const { id } = await createRes.json() as { id: number }
    const res = await worker.fetch(`/api/products/${id}`)
    expect(res.status).toBe(200)
    const product = await res.json() as { name: string }
    expect(product.name).toBe('Bracelet')
  })
})
```

**Step 2:** Run tests — expect FAIL

**Step 3:** Implement `worker/src/routes/products.ts`
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product } from '../types'

const products = new Hono<{ Bindings: Env }>()

// Public: list all products
products.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM products ORDER BY created_at DESC'
  ).all<Product>()
  return c.json({ products: results })
})

// Public: get single product
products.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const product = await c.env.DB.prepare(
    'SELECT * FROM products WHERE id = ?'
  ).bind(id).first<Product>()
  if (!product) return c.json({ error: 'Not found' }, 404)
  return c.json(product)
})

export default products
```

Create `worker/src/routes/admin/products.ts` for write operations:
```typescript
import { Hono } from 'hono'
import type { Env } from '../../index'

const adminProducts = new Hono<{ Bindings: Env }>()

adminProducts.post('/', async (c) => {
  const body = await c.req.json<{
    name: string; description?: string; price: number
    image_url?: string; stock_count?: number; category?: string
  }>()
  const stmt = c.env.DB.prepare(
    `INSERT INTO products (name, description, price, image_url, stock_count, category)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    body.name,
    body.description ?? '',
    body.price,
    body.image_url ?? '',
    body.stock_count ?? 0,
    body.category ?? ''
  )
  const result = await stmt.run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminProducts.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<{
    name: string; description: string; price: number
    image_url: string; stock_count: number; category: string
  }>>()
  const fields = Object.entries(body)
    .filter(([k]) => ['name','description','price','image_url','stock_count','category'].includes(k))
    .map(([k]) => `${k} = ?`)
    .join(', ')
  if (!fields) return c.json({ error: 'Nothing to update' }, 400)
  await c.env.DB.prepare(`UPDATE products SET ${fields} WHERE id = ?`)
    .bind(...Object.values(body), id)
    .run()
  return c.json({ ok: true })
})

adminProducts.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default adminProducts
```

**Step 4:** Mount routes in `worker/src/index.ts`
```typescript
import products from './routes/products'
import adminProducts from './routes/admin/products'

app.route('/api/products', products)
app.route('/api/admin/products', adminProducts)
```

**Step 5:** Run tests — expect PASS

**Step 6:** Commit
```bash
git commit -am "feat: products CRUD API (public read + admin write)"
```

---

### Task 8: R2 Presigned URL Endpoint [x] Done

**Files:**
- Create: `worker/src/routes/admin/upload.ts`
- Modify: `worker/src/index.ts`

**Note:** Cloudflare R2 presigned URLs require the Worker to generate a signed URL using `BUCKET.createMultipartUpload()` or a simple PUT presigned URL via AWS SDK-compatible approach. Since Workers runtime doesn't include AWS SDK, we'll use a direct upload proxy approach — the Worker creates an R2 upload URL via a signed token approach.

**Actual approach for edge-compatibility:** The Worker creates a time-limited upload token stored briefly, and the browser hits a `PUT /api/admin/upload/:token` endpoint on the Worker, which proxies the binary to R2. This avoids needing AWS SDK on the edge.

```typescript
// worker/src/routes/admin/upload.ts
import { Hono } from 'hono'
import type { Env } from '../../index'

const upload = new Hono<{ Bindings: Env }>()

// Step 1: Client requests an upload slot, gets back a unique key
upload.post('/presign', async (c) => {
  const { filename } = await c.req.json<{ filename: string }>()
  const ext = filename.split('.').pop() ?? 'webp'
  const key = `products/${crypto.randomUUID()}.${ext}`
  // Return the key so the client can use it with the PUT endpoint
  return c.json({ key, uploadUrl: `/api/admin/upload/put` })
})

// Step 2: Client PUTs the binary directly; Worker streams it to R2
upload.put('/put', async (c) => {
  const key = c.req.query('key')
  if (!key || !key.startsWith('products/')) {
    return c.json({ error: 'Invalid key' }, 400)
  }
  const body = c.req.raw.body
  if (!body) return c.json({ error: 'No body' }, 400)
  await c.env.BUCKET.put(key, body, {
    httpMetadata: { contentType: 'image/webp' },
  })
  // Return the public URL (assumes R2 bucket has public access enabled)
  const publicBase = `https://pub-REPLACE.r2.dev` // set via env var in production
  return c.json({ url: `${publicBase}/${key}` })
})

export default upload
```

**Production note:** Add `R2_PUBLIC_URL` to `wrangler.toml` `[vars]` and read it as `c.env.R2_PUBLIC_URL`.

**Step 2:** Mount in `index.ts`
```typescript
import upload from './routes/admin/upload'
app.route('/api/admin/upload', upload)
```

**Step 3:** Commit
```bash
git commit -am "feat: R2 upload endpoint (presign + PUT proxy)"
```

---

### Task 9: Checkout API [x] Done

**Files:**
- Create: `worker/src/routes/checkout.ts`
- Create: `worker/src/tests/checkout.test.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Write failing tests
```typescript
// Tests for COD checkout
it('POST /api/checkout with COD creates order', async () => {
  const res = await worker.fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: 'Test User',
      customer_email: 'test@example.com',
      customer_phone: '9999999999',
      shipping_address: '123 Test St',
      payment_method: 'cod',
      items: [{ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' }],
      total_amount: 999,
    }),
  })
  expect(res.status).toBe(201)
  const body = await res.json() as { order_id: string; payment_method: string }
  expect(body.payment_method).toBe('cod')
  expect(body.order_id).toBeTypeOf('string')
})
```

**Step 2:** Implement `worker/src/routes/checkout.ts`
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import type { OrderItem } from '../types'

const checkout = new Hono<{ Bindings: Env }>()

checkout.post('/', async (c) => {
  const body = await c.req.json<{
    customer_name: string
    customer_email: string
    customer_phone: string
    shipping_address: string
    payment_method: 'razorpay' | 'cod'
    items: OrderItem[]
    total_amount: number
  }>()

  // Generate order ID using crypto (no nanoid to keep edge-safe)
  const orderId = `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

  if (body.payment_method === 'cod') {
    await c.env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone,
        shipping_address, total_amount, payment_method, payment_status,
        order_status, items_json)
      VALUES (?, ?, ?, ?, ?, ?, 'cod', 'pending', 'placed', ?)
    `).bind(
      orderId,
      body.customer_name,
      body.customer_email,
      body.customer_phone,
      body.shipping_address,
      body.total_amount,
      JSON.stringify(body.items)
    ).run()

    return c.json({ order_id: orderId, payment_method: 'cod' }, 201)
  }

  // Razorpay: call Razorpay API to create order
  const settings = await c.env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('razorpay_key_id', 'razorpay_key_secret')"
  ).all<{ key: string; value: string }>()
  const cfg: Record<string, string> = {}
  for (const row of settings.results) cfg[row.key] = row.value

  if (!cfg.razorpay_key_id || !cfg.razorpay_key_secret) {
    return c.json({ error: 'Razorpay not configured' }, 503)
  }

  const authHeader = 'Basic ' + btoa(`${cfg.razorpay_key_id}:${cfg.razorpay_key_secret}`)
  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({
      amount: Math.round(body.total_amount * 100), // paise
      currency: 'INR',
      receipt: orderId,
    }),
  })
  if (!rzpRes.ok) return c.json({ error: 'Razorpay order creation failed' }, 502)
  const rzpOrder = await rzpRes.json() as { id: string }

  await c.env.DB.prepare(`
    INSERT INTO orders (id, customer_name, customer_email, customer_phone,
      shipping_address, total_amount, payment_method, payment_status,
      order_status, razorpay_order_id, items_json)
    VALUES (?, ?, ?, ?, ?, ?, 'razorpay', 'pending', 'placed', ?, ?)
  `).bind(
    orderId,
    body.customer_name,
    body.customer_email,
    body.customer_phone,
    body.shipping_address,
    body.total_amount,
    rzpOrder.id,
    JSON.stringify(body.items)
  ).run()

  return c.json({
    order_id: orderId,
    razorpay_order_id: rzpOrder.id,
    razorpay_key_id: cfg.razorpay_key_id,
    payment_method: 'razorpay',
  }, 201)
})

export default checkout
```

**Step 3:** Mount route
```typescript
import checkout from './routes/checkout'
app.route('/api/checkout', checkout)
```

**Step 4:** Run tests — expect PASS for COD test

**Step 5:** Commit
```bash
git commit -am "feat: checkout API (COD + Razorpay order creation)"
```

---

### Task 10: Razorpay Webhook [x] Done

**Files:**
- Create: `worker/src/routes/webhook.ts`
- Create: `worker/src/tests/webhook.test.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Write failing test (HMAC signature verification)
```typescript
// Construct a valid Razorpay webhook signature for the test
import { createHmac } from 'crypto' // Node crypto — only in test env
// Actual code uses Web Crypto API
it('rejects webhook with invalid signature', async () => {
  const res = await worker.fetch('/api/webhook/razorpay', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'invalidsignature',
    },
    body: JSON.stringify({ event: 'payment.captured', payload: {} }),
  })
  expect(res.status).toBe(401)
})
```

**Step 2:** Implement `worker/src/routes/webhook.ts`
```typescript
import { Hono } from 'hono'
import type { Env } from '../index'

const webhook = new Hono<{ Bindings: Env }>()

async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const sigBytes = hexToBytes(signature)
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return arr
}

webhook.post('/razorpay', async (c) => {
  const signature = c.req.header('x-razorpay-signature') ?? ''
  const rawBody = await c.req.text()
  const secret = c.env.RAZORPAY_WEBHOOK_SECRET

  const valid = await verifyRazorpaySignature(rawBody, signature, secret)
  if (!valid) return c.json({ error: 'Invalid signature' }, 401)

  const event = JSON.parse(rawBody) as {
    event: string
    payload: { payment: { entity: { order_id: string; id: string } } }
  }

  if (event.event === 'payment.captured') {
    const { order_id, id: payment_id } = event.payload.payment.entity
    await c.env.DB.prepare(`
      UPDATE orders
      SET payment_status = 'paid', razorpay_payment_id = ?
      WHERE razorpay_order_id = ?
    `).bind(payment_id, order_id).run()
  }

  return c.json({ ok: true })
})

export default webhook
```

**Step 3:** Mount webhook
```typescript
import webhook from './routes/webhook'
app.route('/api/webhook', webhook)
```

**Step 4:** Run tests — expect PASS

**Step 5:** Commit
```bash
git commit -am "feat: Razorpay webhook with Web Crypto HMAC verification"
```

---

### Task 11: Orders Admin API [x] Done

**Files:**
- Create: `worker/src/routes/admin/orders.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Implement orders admin routes
```typescript
// worker/src/routes/admin/orders.ts
import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Order } from '../../types'

const adminOrders = new Hono<{ Bindings: Env }>()

// List all orders (newest first)
adminOrders.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM orders ORDER BY created_at DESC'
  ).all<Order>()
  return c.json({ orders: results })
})

// Update order status
adminOrders.patch('/:id/status', async (c) => {
  const id = c.req.param('id')
  const { order_status, payment_status } = await c.req.json<{
    order_status?: string
    payment_status?: string
  }>()
  const validOrderStatuses = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']
  const validPaymentStatuses = ['pending', 'paid', 'refunded']

  if (order_status && !validOrderStatuses.includes(order_status)) {
    return c.json({ error: 'Invalid order_status' }, 400)
  }
  if (payment_status && !validPaymentStatuses.includes(payment_status)) {
    return c.json({ error: 'Invalid payment_status' }, 400)
  }

  const updates: string[] = []
  const values: string[] = []
  if (order_status) { updates.push('order_status = ?'); values.push(order_status) }
  if (payment_status) { updates.push('payment_status = ?'); values.push(payment_status) }
  if (!updates.length) return c.json({ error: 'Nothing to update' }, 400)

  await c.env.DB.prepare(
    `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values, id).run()

  return c.json({ ok: true })
})

export default adminOrders
```

**Step 2:** Mount in `index.ts`
```typescript
import adminOrders from './routes/admin/orders'
app.route('/api/admin/orders', adminOrders)
```

**Step 3:** Commit
```bash
git commit -am "feat: orders admin API (list + status update)"
```

---

## Phase 3: Theme System

### Task 12: Theme Contract Interface [x] Done

**Files:**
- Create: `frontend/src/themes/types.ts`

**Design:** Each theme exports a React component tree. The theme system is based on a contract (TypeScript interface) — any component that renders a storefront UI must implement this interface. This means adding a new theme requires zero changes to page-level code.

```typescript
// frontend/src/themes/types.ts

export interface ProductCardProps {
  id: number
  name: string
  price: number
  image_url: string
  currency: string
  onAddToCart: () => void
}

export interface HeaderProps {
  storeName: string
  cartCount: number
  onCartOpen: () => void
}

export interface FooterProps {
  storeName: string
}

export interface HeroProps {
  storeName: string
  tagline: string
}

export interface ProductGridProps {
  products: Array<{ id: number; name: string; price: number; image_url: string; category: string }>
  currency: string
  onAddToCart: (productId: number) => void
}

export interface CartDrawerProps {
  isOpen: boolean
  items: Array<{ product_id: number; name: string; price: number; quantity: number; image_url: string }>
  currency: string
  onClose: () => void
  onUpdateQuantity: (productId: number, quantity: number) => void
  onCheckout: () => void
}

export interface Theme {
  id: string
  name: string
  description: string
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

**Step 2:** Commit
```bash
git add frontend/src/themes/types.ts
git commit -m "feat: define theme component contract (TypeScript interface)"
```

---

### Task 13: ThemeProvider Context [x] Done

**Files:**
- Create: `frontend/src/themes/ThemeProvider.tsx`
- Create: `frontend/src/themes/index.ts` (theme registry)

**Step 1:** Create theme registry (placeholder until themes exist)
```typescript
// frontend/src/themes/index.ts
import type { Theme } from './types'
// Themes imported after creation
// import jewellery from './jewellery'
// import artsCrafts from './artsCrafts'

export const themes: Record<string, Theme> = {
  // jewellery,
  // artsCrafts,
}
```

**Step 2:** Create ThemeProvider
```typescript
// frontend/src/themes/ThemeProvider.tsx
import { createContext, useContext, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Theme } from './types'
import { themes } from './index'

interface ThemeContextValue {
  theme: Theme | null
  isLoading: boolean
}

const ThemeContext = createContext<ThemeContextValue>({ theme: null, isLoading: true })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()) as Promise<Record<string, string>>,
    staleTime: 5 * 60 * 1000, // 5 min cache
  })

  const activeThemeId = settings?.active_theme ?? 'jewellery'
  const theme = themes[activeThemeId] ?? null

  return (
    <ThemeContext.Provider value={{ theme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

**Step 3:** Wrap App in ThemeProvider (`frontend/src/App.tsx`)
```typescript
import { ThemeProvider } from './themes/ThemeProvider'
// Wrap QueryClientProvider children with ThemeProvider
```

**Step 4:** Commit
```bash
git commit -am "feat: ThemeProvider context and theme registry"
```

---

### Task 14: Jewellery Theme [x] Done

**Files:**
- Create: `frontend/src/themes/jewellery/index.ts`
- Create: `frontend/src/themes/jewellery/Header.tsx`
- Create: `frontend/src/themes/jewellery/Footer.tsx`
- Create: `frontend/src/themes/jewellery/Hero.tsx`
- Create: `frontend/src/themes/jewellery/ProductCard.tsx`
- Create: `frontend/src/themes/jewellery/ProductGrid.tsx`
- Create: `frontend/src/themes/jewellery/CartDrawer.tsx`

**Design language:** Elegant minimalism. Off-white background (`#FAFAF8`), deep charcoal text (`#1A1A1A`), gold accent (`#C9A96E`). Serif headings (Playfair Display via Google Fonts). Thin borders. Lots of whitespace. Product cards with large image, name in serif, price small and elegant. Mobile-first grid: 2 cols on mobile, 3 on desktop.

**Step 1:** Create `frontend/src/themes/jewellery/Header.tsx`
```tsx
import type { HeaderProps } from '../types'

export default function Header({ storeName, cartCount, onCartOpen }: HeaderProps) {
  return (
    <header className="border-b border-stone-200 bg-[#FAFAF8] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <h1 className="font-serif text-xl tracking-widest uppercase text-[#1A1A1A]">
          {storeName}
        </h1>
        <button
          onClick={onCartOpen}
          className="relative text-sm tracking-wider uppercase text-[#1A1A1A] hover:text-[#C9A96E] transition-colors"
        >
          Bag
          {cartCount > 0 && (
            <span className="ml-1 text-[#C9A96E] font-semibold">({cartCount})</span>
          )}
        </button>
      </div>
    </header>
  )
}
```

**Step 2:** Create `Hero.tsx`, `ProductCard.tsx`, `ProductGrid.tsx`, `Footer.tsx`, `CartDrawer.tsx` — full implementations following the same design language (off-white, gold accent, serif headings, thin borders).

**Step 3:** Create `frontend/src/themes/jewellery/index.ts`
```typescript
import type { Theme } from '../types'
import Header from './Header'
import Footer from './Footer'
import Hero from './Hero'
import ProductCard from './ProductCard'
import ProductGrid from './ProductGrid'
import CartDrawer from './CartDrawer'

const jewellery: Theme = {
  id: 'jewellery',
  name: 'Jewellery',
  description: 'Elegant, minimal, gold-accented.',
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}

export default jewellery
```

**Step 4:** Register in `frontend/src/themes/index.ts`
```typescript
import jewellery from './jewellery'
export const themes = { jewellery }
```

**Step 5:** Write a Vitest test for the ProductCard
```typescript
// frontend/src/themes/jewellery/__tests__/ProductCard.test.tsx
import { render, screen } from '@testing-library/react'
import ProductCard from '../ProductCard'

it('renders product name and price', () => {
  render(<ProductCard id={1} name="Gold Ring" price={2999} image_url="" currency="₹" onAddToCart={() => {}} />)
  expect(screen.getByText('Gold Ring')).toBeInTheDocument()
  expect(screen.getByText(/2999/)).toBeInTheDocument()
})
```

**Step 6:** Commit
```bash
git commit -am "feat: jewellery theme (elegant, gold-accented, serif)"
```

---

### Task 15: Arts & Crafts Theme [x] Done

**Files:**
- Create: `frontend/src/themes/artsCrafts/` (same component set as jewellery theme)

**Design language:** Warm handmade aesthetic. Cream/linen background (`#F5F0E8`), warm dark text (`#2C2416`), terracotta accent (`#C4622D`). Sans-serif headings (bold, uppercase tracking). Rough/organic border radius. Subtle texture-like elements (border patterns). 2 cols on mobile, 3 on desktop. Cards feel handcrafted: slightly irregular, warm.

**Step 1:** Create all 6 components following the same structure as the jewellery theme but with:
- Background: `#F5F0E8` (linen)
- Text: `#2C2416` (warm dark brown)
- Accent: `#C4622D` (terracotta)
- Font: system sans-serif (bold, uppercase tracking for headings)
- Borders: slightly thicker, warmer colour (`border-amber-200`)
- Cards: rounded corners, earthy hover shadow

**Step 2:** Register in theme registry
```typescript
import artsCrafts from './artsCrafts'
export const themes = { jewellery, artsCrafts }
```

**Step 3:** Write Vitest test for the ProductCard component

**Step 4:** Commit
```bash
git commit -am "feat: arts & crafts theme (warm, earthy, terracotta)"
```

---

## Phase 4: Frontend — Storefront Pages

### Task 16: Cart Store (Zustand + localStorage) [x] DONE

**Files:**
- Create: `frontend/src/store/cartStore.ts`
- Create: `frontend/src/store/cartStore.test.ts`

**Step 1:** Write failing test
```typescript
import { act } from 'react'
import { useCartStore } from './cartStore'

it('adds item to cart and persists count', () => {
  const { addItem, items } = useCartStore.getState()
  act(() => addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' }))
  expect(useCartStore.getState().items).toHaveLength(1)
})

it('increments quantity if same product added twice', () => {
  const { addItem } = useCartStore.getState()
  act(() => addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' }))
  act(() => addItem({ product_id: 1, name: 'Ring', price: 999, quantity: 1, image_url: '' }))
  expect(useCartStore.getState().items[0].quantity).toBe(2)
})
```

**Step 2:** Implement cart store
```typescript
// frontend/src/store/cartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  clearCart: () => void
  totalAmount: () => number
  totalItems: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(i => i.product_id === item.product_id)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.product_id === item.product_id
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
        }),
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter(i => i.product_id !== productId)
            : state.items.map(i => i.product_id === productId ? { ...i, quantity } : i),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter(i => i.product_id !== productId) })),
      clearCart: () => set({ items: [] }),
      totalAmount: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'edgeshop-cart' }
  )
)
```

**Step 3:** Run tests — PASS

**Step 4:** Commit
```bash
git commit -am "feat: cart store with Zustand + localStorage persistence"
```

---

### Task 17: Storefront Pages (Home, Product Detail) [x] DONE

**Files:**
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/ProductPage.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1:** `frontend/src/pages/HomePage.tsx`
```tsx
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'
import { useSettingsStore } from '../store/settingsStore'

export default function HomePage() {
  const { theme } = useTheme()
  const addItem = useCartStore(s => s.addItem)
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => fetch('/api/settings').then(r => r.json()) })
  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then(r => r.json() as Promise<{ products: Product[] }>),
  })

  if (!theme) return <div>Loading theme…</div>
  const { Hero, ProductGrid, Header, Footer, CartDrawer } = theme.components
  // ... render with theme components
}
```

**Step 2:** `frontend/src/pages/ProductPage.tsx` — single product view with "Add to Cart" button

**Step 3:** Update routing in `App.tsx`
```tsx
<Route path="/" element={<HomePage />} />
<Route path="/product/:id" element={<ProductPage />} />
<Route path="/checkout" element={<CheckoutPage />} />
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<AdminDashboard />} />
  <Route path="products" element={<AdminProducts />} />
  <Route path="orders" element={<AdminOrders />} />
  <Route path="settings" element={<AdminSettings />} />
</Route>
```

**Step 4:** Commit
```bash
git commit -am "feat: storefront home and product detail pages"
```

---

### Task 18: Checkout Page [x] DONE

**Files:**
- Create: `frontend/src/pages/CheckoutPage.tsx`
- Create: `frontend/src/utils/razorpay.ts`

**Step 1:** `frontend/src/utils/razorpay.ts` — load Razorpay SDK and open modal
```typescript
export function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = reject
    document.body.appendChild(script)
  })
}

export function openRazorpayModal(options: {
  key: string
  amount: number
  currency: string
  name: string
  order_id: string
  prefill: { name: string; email: string; contact: string }
  onSuccess: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void
  onFailure: () => void
}) {
  const rzp = new (window as any).Razorpay({
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    order_id: options.order_id,
    prefill: options.prefill,
    handler: options.onSuccess,
    modal: { ondismiss: options.onFailure },
  })
  rzp.open()
}
```

**Step 2:** Create `CheckoutPage.tsx` with form (name, email, phone, address) + payment method toggle (COD / Razorpay). On submit:
- Call `POST /api/checkout`
- If Razorpay: open modal via `openRazorpayModal`
- On success: clear cart, redirect to `/order-success`

**Step 3:** Commit
```bash
git commit -am "feat: checkout page with Razorpay modal + COD"
```

---

## Phase 5: Admin Panel

### Task 19: Admin Layout [x] Done

**Files:**
- Create: `frontend/src/admin/AdminLayout.tsx`
- Create: `frontend/src/admin/AdminNav.tsx`

**Note:** Admin routes are protected by Cloudflare Access — no auth code needed in the React app. Cloudflare Access will intercept `/admin/*` before the page loads.

**Design:** Clean, functional. White sidebar on desktop, bottom nav on mobile. Links: Products, Orders, Settings.

```tsx
// frontend/src/admin/AdminLayout.tsx
import { Outlet, NavLink } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <aside className="w-full md:w-56 bg-white border-b md:border-r border-gray-200 p-4 flex md:flex-col gap-2">
        <h2 className="hidden md:block font-semibold text-gray-800 mb-4">Admin Panel</h2>
        {['products', 'orders', 'settings'].map(link => (
          <NavLink
            key={link}
            to={`/admin/${link}`}
            className={({ isActive }) =>
              `capitalize px-3 py-2 rounded text-sm font-medium transition-colors ${
                isActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {link}
          </NavLink>
        ))}
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

**Commit:** `git commit -am "feat: admin layout with sidebar nav"`

---

### Task 20: Image Uploader Component [x] Done

**Files:**
- Create: `frontend/src/admin/ImageUploader.tsx`
- Create: `frontend/src/utils/imageProcessor.ts`

**Step 1:** `frontend/src/utils/imageProcessor.ts` — Canvas API resize + WebP conversion
```typescript
export function processImage(file: File, maxWidth = 1000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/webp',
        0.85
      )
    }
    img.onerror = reject
    img.src = url
  })
}
```

**Step 2:** `frontend/src/admin/ImageUploader.tsx`
```tsx
import { useState, useRef } from 'react'
import { processImage } from '../utils/imageProcessor'

interface Props {
  onUploadComplete: (url: string) => void
}

export default function ImageUploader({ onUploadComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'uploading' | 'done' | 'error'>('idle')
  const [preview, setPreview] = useState<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    try {
      setStatus('processing')
      const webpBlob = await processImage(file)
      setPreview(URL.createObjectURL(webpBlob))

      setStatus('uploading')
      // Get upload key
      const presignRes = await fetch('/api/admin/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name }),
      })
      const { key } = await presignRes.json() as { key: string }

      // Upload WebP blob
      const uploadRes = await fetch(`/api/admin/upload/put?key=${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/webp' },
        body: webpBlob,
      })
      const { url } = await uploadRes.json() as { url: string }
      onUploadComplete(url)
      setStatus('done')
    } catch (e) {
      setStatus('error')
    }
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      {preview && <img src={preview} className="mx-auto mb-4 max-h-48 object-contain" alt="Preview" />}
      <p className="text-sm text-gray-500 mb-2">
        {status === 'processing' && 'Optimising image…'}
        {status === 'uploading' && 'Uploading to R2…'}
        {status === 'done' && 'Upload complete!'}
        {status === 'error' && 'Upload failed. Try again.'}
        {status === 'idle' && 'Click or drag a PNG/JPG image'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
      >
        Choose Image
      </button>
    </div>
  )
}
```

**Step 3:** Commit
```bash
git commit -am "feat: image uploader (Canvas resize to WebP + R2 upload)"
```

---

### Task 21: Admin — Products Page [x] Done

**Files:**
- Create: `frontend/src/admin/pages/AdminProducts.tsx`

**Features:** Table list of products. "Add Product" form slide-over. Edit/Delete inline. Uses `ImageUploader` for product image.

**Commit:** `git commit -am "feat: admin products page (list + add/edit/delete)"`

---

### Task 22: Admin — Orders Page [x] Done

**Files:**
- Create: `frontend/src/admin/pages/AdminOrders.tsx`

**Features:** Table of orders sorted by date. Columns: ID, Customer, Amount, Payment Method, Payment Status, Order Status, Date. Status dropdowns for updating order/payment status inline via `PATCH /api/admin/orders/:id/status`.

**Commit:** `git commit -am "feat: admin orders page with status management"`

---

### Task 23: Admin — Settings Page [x] Done

**Files:**
- Create: `frontend/src/admin/pages/AdminSettings.tsx`

**Features:**
- Store Name input
- Currency selector
- COD toggle (checkbox)
- Razorpay Key ID + Secret inputs (masked)
- **Theme Selector:** Radio cards for each theme in registry — shows theme name, description, and a small colour swatch preview. Changing theme updates `active_theme` via `PUT /api/settings`.

**Theme selector example:**
```tsx
{Object.values(themes).map(t => (
  <label key={t.id} className={`cursor-pointer border-2 rounded-lg p-4 ${activeTheme === t.id ? 'border-gray-900' : 'border-gray-200'}`}>
    <input type="radio" name="theme" value={t.id} checked={activeTheme === t.id} onChange={() => setActiveTheme(t.id)} className="sr-only" />
    <p className="font-semibold">{t.name}</p>
    <p className="text-sm text-gray-500">{t.description}</p>
  </label>
))}
```

**Commit:** `git commit -am "feat: admin settings page with theme selector"`

---

## Phase 6: Deployment Configuration

### Task 24: Cloudflare Pages Configuration [x] Done

**Files:**
- Create: `frontend/public/_redirects`
- Create: `frontend/public/_headers`

**Step 1:** `frontend/public/_redirects` (SPA fallback)
```
/* /index.html 200
```

**Step 2:** `frontend/public/_headers` (security headers)
```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=()
```

**Step 3:** Update `wrangler.toml` with final settings
```toml
[vars]
R2_PUBLIC_URL = "https://pub-REPLACE.r2.dev"
FRONTEND_URL = "https://edgeshop.pages.dev"
```
Update CORS in `index.ts` to use `FRONTEND_URL` in production.

**Step 4:** D1 remote setup commands
```bash
# Create the database in production
npx wrangler d1 create edgeshop-db
# Run migration
npx wrangler d1 execute edgeshop-db --file=migrations/0001_initial.sql
```

**Step 5:** Commit final config
```bash
git commit -am "chore: Cloudflare Pages config and production wrangler.toml"
```

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-19 | Monorepo with worker/ + frontend/ | Simpler management, shared type visibility |
| 2026-02-19 | 2 themes: Jewellery + Arts & Crafts | User choice; both clean, bold, minimal, mobile-first |
| 2026-02-19 | Theme system via TypeScript interface + React context | Zero page-level changes when adding new themes |
| 2026-02-19 | R2 upload via Worker PUT proxy (not native presigned URLs) | Workers runtime lacks AWS SDK; streaming proxy stays within CPU limits |
| 2026-02-19 | Zustand with persist middleware for cart | Lightweight, edge-compatible, auto localStorage sync |
| 2026-02-19 | Razorpay webhook uses Web Crypto API (crypto.subtle) | Node-specific `crypto.createHmac` not available in Workers runtime |
| 2026-02-19 | Cloudflare Access protects /admin (no React auth code needed) | Zero-trust at edge layer is more secure and simpler |
| 2026-02-19 | TanStack Query with 5-min staleTime for settings | Avoids re-fetching theme config on every render; settings change rarely |
| 2026-02-19 | allowImportingTsExtensions + noEmit in frontend tsconfig | Required for Vite projects — tsc type-checks only, Vite handles transpilation; avoids TS5097 error on .tsx imports |
| 2026-02-19 | Frontend scaffold done manually (not via npm create vite) | TTY unavailable in non-interactive shell; all scaffold files created by hand to identical spec |
| 2026-02-19 | cartStore imports CartItem from themes/types.ts (not redefined) | Single source of truth for CartItem shape; avoids type drift between cart state and theme components |
| 2026-02-19 | ProductPage uses theme-neutral Tailwind classes (not theme components) | Product detail is layout-agnostic; forcing it through theme Header/Footer would cause nav duplication and add coupling |
| 2026-02-19 | CheckoutPage and OrderSuccessPage use plain Tailwind, no theme components | Checkout is a conversion-critical flow; keeping it theme-independent ensures consistent UX regardless of active theme |
| 2026-02-19 | Razorpay SDK loaded lazily on checkout submit (not at page load) | Avoids blocking initial page load and only loads the script when the user actually chooses Razorpay |
| 2026-02-19 | window.Razorpay typed via global interface augmentation (not `any`) | Keeps TypeScript strict without needing a separate @types/razorpay package that may lag behind the SDK |
| 2026-02-19 | Migration applied with `wrangler d1 execute --local --file` | Wrangler picks up the migrations/ directory by convention; local apply verified all 3 tables created successfully |
| 2026-02-19 | AdminLayout uses fixed bottom nav on mobile (not top nav) | Bottom nav is thumb-friendly on mobile; avoids obscuring table content scrolled at top |
| 2026-02-19 | AdminProducts fetches from `/api/products` (public) not a separate admin list endpoint | Products list is the same data; no sensitive fields on products justify a separate admin-only read route |
| 2026-02-19 | ImageUploader accepts `existingUrl` prop and initialises preview from it | Enables editing products with pre-filled image previews without requiring a re-upload |
| 2026-02-19 | ImageUploader validates file.type before processing (not just accept attr) | Browser accept attr is advisory only; explicit type check prevents Canvas errors from non-image files dragged in |
| 2026-02-19 | AdminSettings useEffect uses functional form of setForm to avoid stale closure | Avoids the eslint exhaustive-deps footgun; settings query data initialises form once on load without re-running on form changes |
| 2026-02-19 | AdminOrders auto-refetches every 30s via refetchInterval | Keeps orders list fresh for a merchant watching incoming orders without requiring a manual reload |
| 2026-02-20 | AdminLayout rewritten with grouped collapsible sidebar + mobile hamburger drawer | 13-item flat list was too long for a mobile tab bar; grouped sections (Catalog/Sales/Content/Store) with collapsible toggle are navigable at any screen size |
| 2026-02-20 | Theme selector + CSS variable customizer merged into AdminAppearance (/admin/appearance) | Decouples visual configuration from store settings; a single focused page for all theme/style choices; /admin/theme now redirects to /admin/appearance |
| 2026-02-20 | AdminFooter added as dedicated CMS page (/admin/footer) | Footer content (tagline, socials, link columns, copyright) is distinct enough from settings to warrant its own editor; stored as footer_json in D1 settings |
| 2026-02-20 | AdminNavigation upgraded with nested items + type dialog (collection/page/custom link) | Allows building dropdown nav without manually typing slugs; collection and page dropdowns auto-populate label+href; one level of children supported |
| 2026-02-20 | AdminSettings stripped of theme selector (moved to AdminAppearance) | Settings page now contains only operational settings (store info, Razorpay, announcement bar); theme concerns belong in Appearance |
| 2026-02-20 | AdminNavigation fetches pages from /api/pages (public endpoint) | Public pages endpoint returns page titles+slugs, which is sufficient for building nav links; no sensitive data on pages |
| 2026-02-20 | Stock decrement split by payment method (COD at order creation, Razorpay at webhook payment.captured) | Prevents phantom stock reduction for abandoned Razorpay sessions; COD orders are immediately confirmed so stock reduces at placement |
| 2026-02-20 | jwt_secret auto-generated in D1 on first auth request using INSERT OR IGNORE | Zero config for merchant; INSERT OR IGNORE makes it race-safe under simultaneous first-logins; persists until DB is wiped |
| 2026-02-20 | Password reset token is a plain UUID stored in customers table, expires in 1 hour | No separate tokens table needed; UUID entropy (122 bits) + 1h expiry is sufficient at this scale; token cleared after use (single-use) |
| 2026-02-20 | All email sends are fire-and-forget (wrapped in try/catch) | Missing or misconfigured email provider never breaks checkout, login, or password reset flows |
| 2026-02-20 | Customer delete nullifies orders.customer_id instead of cascade-deleting orders | Preserves merchant's order history and revenue analytics; GDPR-style anonymisation |
| 2026-02-20 | Admin customers page uses LEFT JOIN for order_count + total_spent in a single query | Avoids N+1; D1 handles this cleanly at small-merchant scale |
| 2026-02-20 | Structured shipping address: keep shipping_address as address line, add shipping_city/state/pincode/country columns | Backward-compatible; new fields default to '' / 'India' so existing orders keep their data intact |
| 2026-02-20 | Product list collection filter uses DISTINCT JOIN on product_collections | Prevents duplicate rows when a product belongs to multiple collections |
| 2026-02-20 | All admin order fields editable via existing PUT /api/admin/orders/:id endpoint | No new endpoint needed; expanded allowed list covers customer info + address + payment_status |
| 2026-02-21 | Product page wraps in theme Header/Footer/CartDrawer — same pattern as HomePage | Consistent UX; single source of theme config |
| 2026-02-21 | Gallery state is local `manualImage` (null = auto) cleared on variant change | Prevents stale gallery selection when user switches size/color |
| 2026-02-21 | product.images from detail API is ProductImage[] (objects), not string[] — gallery uses img.url | Detail endpoint returns full image objects; list endpoint returns string[] via images_json subquery |
| 2026-02-21 | Recommended products fetch /api/products?category=X&exclude=ID&limit=4 | Reuses existing public endpoint; no new endpoint needed |
| 2026-02-21 | First registered customer auto-becomes super_admin (COUNT WHERE id != last_row_id) | Zero config for merchant; doesn't require manual DB seeding |
| 2026-02-21 | permissions_json stored as JSON blob in customers row; JWT includes role+permissions | Simple; no extra table; stale JWTs accepted (staff re-login picks up changes) |
| 2026-02-21 | PERMISSION_KEYS + allPermissions() extracted to worker/src/lib/permissions.ts | Single source of truth; used by both auth.ts and staff.ts |
| 2026-02-21 | requireSuperAdmin middleware used as route-level guard on staff PUT /:id | Eliminates redundant JWT re-verification; uses Task 7 abstraction as intended |
| 2026-02-21 | adminFetch reads admin-auth from localStorage directly to avoid Zustand circular import | Lets any admin page call adminFetch without importing the store |
| 2026-02-21 | Staff page (/admin/staff) only visible to super_admin via __super_admin__ permission sentinel | No separate role check needed in nav — canAccess() handles it uniformly |
| 2026-02-21 | AdminLayout nav reordered: Catalog / Content / Sales / Store (Blog moved from Catalog to Content) | Blog belongs with Pages/Navigation/Footer in Content section |

---

## V2 Features (see docs/plans/2026-02-19-edgeshop-v2-features.md for full task details)

### Phase 1 — Make It Usable

- [x] Task V2-1: D1 v2 schema migration (variants, collections, customers, discounts, pages, shipping, blog, reviews)
- [x] Task V2-2: Product variants API (CRUD per product)
- [x] Task V2-3: Product gallery API (add/delete/reorder images)
- [x] Task V2-4: Collections API (public read + admin CRUD + product assignment)
- [x] Task V2-5: FTS5 full-text search API with filter/sort
- [x] Task V2-6: Theme customizer — extend settings API with v2 keys
- [x] Task V2-7: Theme customizer — CSS custom properties injected from D1 settings
- [x] Task V2-8: Theme customizer — admin panel with live preview
- [x] Task V2-9: Static pages CMS — API (CRUD)
- [x] Task V2-10: Static pages — storefront (/pages/:slug) + admin editor
- [x] Task V2-11: Navigation menu editor (admin + dynamic nav in themes)
- [x] Task V2-12: Announcement bar (enabled/text/color from D1 settings)
- [x] Task V2-13: Email — Resend integration (helper + templates)
- [x] Task V2-14: Email — order confirmation trigger (COD + Razorpay webhook)
- [x] Task V2-15: Admin dashboard stats (revenue, orders, pending, low stock)
- [x] Task V2-16: Discount codes — API (validate + admin CRUD)
- [x] Task V2-17: Discount codes — checkout integration
- [x] Task V2-18: Customer accounts — registration & login API (PBKDF2 + JWT)
- [x] Task V2-19: Customer accounts — frontend pages (login, register, orders)
- [x] Task V2-20: Digital products — download API (HMAC-signed time-limited tokens)
- [x] Task V2-21: Collection storefront page + search results page
- [x] Task V2-22: Admin collections & pages management
- [x] Task V2-23: Discount codes admin UI

### Phase 2 — Make It Complete

- [x] Task V2-24: Order detail page (admin — line items, tracking, notes)
- [x] Task V2-25: Tracking numbers + automatic shipping email
- [x] Task V2-26: SEO fields — products & collections (meta tags)
- [x] Task V2-27: Sitemap.xml (auto-generated from D1)
- [x] Task V2-28: Shipping zones + rates API (calculate + admin CRUD)
- [x] Task V2-29: Shipping at checkout (calculate + apply)
- [x] Task V2-30: Product reviews (public submit + admin moderation)
- [x] Task V2-31: Blog / articles (API + storefront + admin CRUD)
- [x] Task V2-32: Refunds (admin — mark refunded with notes)
- [x] Task V2-33: Analytics charts (revenue/day CSS bars)
- [x] Task V2-34: Abandoned cart recovery (D1 + Cron Trigger + email)
- [x] Task V2-35: OG tags + social sharing meta

### Phase 3 — Make It Competitive

- [x] Task V2-36: Custom 404 page
- [x] Task V2-37: Contact form (sends to merchant email)
- [x] Task V2-38: Pagination (products list + search)
- [x] Task V2-39: Admin search & filter (products + orders)
- [x] Task V2-40: Admin blog management UI
- [x] Task V2-41: Admin shipping management UI
- [x] Task V2-42: Admin reviews moderation UI
- [x] Task V2-43: Deploy v2 (update deploy.sh + secrets)

## Phase 7: Auth, Email & Customer Management

- [x] Task 7-1: Auto-generate jwt_secret in D1 on first auth request — `getOrCreateJwtSecret()` helper uses INSERT OR IGNORE to be race-safe
- [x] Task 7-2: D1 migration 0005 — add `reset_token` and `reset_token_expires_at` columns to customers table
- [x] Task 7-3: Password reset email template — `passwordResetHtml()` in emailTemplates.ts
- [x] Task 7-4: Forgot-password and reset-password API endpoints — `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`
- [x] Task 7-5: Forgot-password and reset-password frontend pages — ForgotPasswordPage, ResetPasswordPage, "Forgot password?" link on LoginPage
- [x] Task 7-6: Admin customers API — `GET/DELETE /api/admin/customers` with LEFT JOIN order stats
- [x] Task 7-7: Admin customers frontend page — AdminCustomers.tsx with search, expandable order history, delete
