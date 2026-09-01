# Product Page Enhancements + Staff Auth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich the product detail page with header/footer/gallery/recommended products, and add a full staff authentication + role-based permission system to the admin panel.

**Architecture:** Product page gets the theme Header/Footer wrapped around it and fetches sibling products for the "You May Also Like" section. The staff system adds `role` + `permissions_json` columns to the `customers` table; the first registered customer auto-becomes `super_admin`; a Hono middleware guards all `/api/admin/*` routes; the admin frontend adds a login page, a Zustand `adminAuthStore`, a utility `adminFetch` wrapper used by every admin page, a permission-filtered nav, and a staff management page.

**Tech Stack:** Hono v4 middleware, React 18, Zustand persist, TanStack Query v5, Tailwind CSS v4, D1 SQL (SQLite), existing PBKDF2 + JWT auth helpers in `worker/src/lib/auth.ts`.

---

## Phase 1: Product Page Enhancements

### Task 1: Add `category` and `exclude` query params to the public products API

**Files:**
- Modify: `worker/src/routes/products.ts`

**Step 1:** Open `worker/src/routes/products.ts`. In the `products.get('/')` handler, after the existing `limit` parsing, add:

```typescript
const category = (c.req.query('category') ?? '').trim()
const excludeId = Number(c.req.query('exclude') ?? 0)

// Build WHERE clause
let where = "WHERE p.status = 'active'"
const params: (string | number)[] = []
if (category) { where += ' AND p.category = ?'; params.push(category) }
if (excludeId) { where += ' AND p.id != ?'; params.push(excludeId) }
```

Then replace the two hardcoded `WHERE status = 'active'` SQL strings to use the dynamic `where` and `params`. The count query becomes:
```typescript
const countRow = await c.env.DB.prepare(
  `SELECT COUNT(*) as total FROM products p ${where}`
).bind(...params).first<{ total: number }>()
```

And the results query becomes:
```typescript
const { results } = await c.env.DB.prepare(
  `SELECT p.*,
    COALESCE(
      (SELECT json_group_array(url) FROM product_images WHERE product_id = p.id ORDER BY sort_order),
      '[]'
    ) AS images_json
   FROM products p ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
).bind(...params, limit, offset).all<Product & { images_json: string }>()
```

**Step 2:** Run the worker dev server mentally / verify TypeScript compiles:
```bash
cd worker && npx tsc --noEmit
```
Expected: No errors.

**Step 3:** Commit
```bash
git add worker/src/routes/products.ts
git commit -m "feat: add category and exclude filter params to public products API"
```

---

### Task 2: Add Header, Footer, and cart wiring to ProductPage

**Files:**
- Modify: `frontend/src/pages/ProductPage.tsx`

**Step 1:** At the top of `ProductPage`, import the cart open/close state (same as HomePage does):

```typescript
const cartOpen = useCartStore((s) => s.isCartOpen)
const openCart = useCartStore((s) => s.openCart)
const closeCart = useCartStore((s) => s.closeCart)
const updateQuantity = useCartStore((s) => s.updateQuantity)
const items = useCartStore((s) => s.items)
const totalItems = useCartStore((s) => s.totalItems)
```

Also fetch `navItems` and `footerData` from `useTheme()`:
```typescript
const { theme, navItems, footerData } = useTheme()
```

**Step 2:** Remove the `void theme` suppression line (line ~198):
```typescript
// DELETE: void theme
```

**Step 3:** In the JSX, destructure `CartDrawer` from `theme.components` in addition to the other components that are already used. Also destructure `Header` and `Footer`:

```typescript
// In the loading guard area (after the isLoading and error checks), add:
if (!theme) return <div className="min-h-screen flex items-center justify-center"><p className="text-sm opacity-50">Loading...</p></div>

const { Header, Footer, CartDrawer } = theme.components
```

Place this block right before `return (`.

**Step 4:** Wrap the returned JSX with Header, Footer, and CartDrawer. The outer div changes from:

```typescript
return (
  <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
```

to:

```typescript
return (
  <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
    <Header
      storeName={settings?.store_name ?? 'EdgeShop'}
      cartCount={totalItems()}
      onCartOpen={openCart}
      navItems={navItems}
    />
    <CartDrawer
      isOpen={cartOpen}
      items={items}
      currency={currency}
      onClose={closeCart}
      onUpdateQuantity={updateQuantity}
      onCheckout={() => { closeCart(); window.location.href = '/checkout' }}
    />
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
```

And before the closing `</div>` of the outer div, add:

```typescript
    <Footer storeName={settings?.store_name ?? 'EdgeShop'} footerData={footerData} />
  </div>
```

**Step 5:** TypeScript check:
```bash
cd frontend && npx tsc --noEmit
```

**Step 6:** Commit
```bash
git add frontend/src/pages/ProductPage.tsx
git commit -m "feat: add theme Header, Footer, and CartDrawer to product page"
```

---

### Task 3: Gallery image strip on ProductPage

**Files:**
- Modify: `frontend/src/pages/ProductPage.tsx`

The API already returns `product.images: string[]` from the `product_images` table.

**Step 1:** Add a `mainImageUrl` state that can be overridden by gallery clicks:

```typescript
const [manualImage, setManualImage] = useState<string | null>(null)
```

**Step 2:** The displayed image should prefer: `manualImage` → `selectedVariant.image_url` → `product.image_url`. Update the existing `displayImage` line:

```typescript
// Replace the existing displayImage line:
const displayImage = manualImage ?? (selectedVariant?.image_url || product?.image_url) ?? ''
```

Reset `manualImage` when variant changes:
```typescript
// Add inside the selectedVariant/optionGroups computation area:
// (or add a useEffect that clears manualImage when selectedOptions changes)
useEffect(() => {
  setManualImage(null)
}, [selectedOptions])
```

**Step 3:** After the main `<div className="aspect-square ...">` image block, add the gallery strip:

```typescript
{/* Gallery thumbnails */}
{(product.images ?? []).length > 0 && (
  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
    {/* Primary image thumbnail */}
    <button
      onClick={() => setManualImage(null)}
      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
        manualImage === null ? 'border-[var(--color-primary)]' : 'border-transparent'
      }`}
    >
      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
    </button>
    {(product.images ?? []).map((url, idx) => (
      <button
        key={idx}
        onClick={() => setManualImage(url)}
        className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
          manualImage === url ? 'border-[var(--color-primary)]' : 'border-transparent'
        }`}
      >
        <img src={url} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
      </button>
    ))}
  </div>
)}
```

**Step 4:** TypeScript check, then commit:
```bash
git add frontend/src/pages/ProductPage.tsx
git commit -m "feat: gallery image strip on product page"
```

---

### Task 4: "You May Also Like" recommended products section

**Files:**
- Modify: `frontend/src/pages/ProductPage.tsx`

**Step 1:** Add a query for recommended products. After the reviews query, add:

```typescript
const { data: recommendedData } = useQuery<{ products: Array<{ id: number; name: string; price: number; image_url: string; category: string }> }>({
  queryKey: ['recommended', product?.category, id],
  queryFn: () =>
    fetch(`/api/products?category=${encodeURIComponent(product!.category)}&exclude=${id}&limit=4`)
      .then(r => r.json()),
  enabled: !!product?.category && !!id,
  staleTime: 60 * 1000,
})
const recommendedProducts = recommendedData?.products ?? []
```

**Step 2:** Destructure `ProductCard` from `theme.components` (add it to the destructure):
```typescript
const { Header, Footer, CartDrawer, ProductCard } = theme.components
```

**Step 3:** After the reviews section `</div>`, before the closing `</div>` of the `max-w-5xl` wrapper, add:

```typescript
{/* Recommended Products */}
{recommendedProducts.length > 0 && (
  <div className="mt-16 mb-8">
    <h2
      className="text-lg font-semibold mb-6"
      style={{ color: 'var(--color-primary)' }}
    >
      You May Also Like
    </h2>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {recommendedProducts.map(p => (
        <ProductCard
          key={p.id}
          id={p.id}
          name={p.name}
          price={p.price}
          image_url={p.image_url}
          currency={currency}
          onAddToCart={() => addItem({
            product_id: p.id,
            name: p.name,
            price: p.price,
            quantity: 1,
            image_url: p.image_url,
          })}
        />
      ))}
    </div>
  </div>
)}
```

**Step 4:** TypeScript check and commit:
```bash
cd frontend && npx tsc --noEmit
git add frontend/src/pages/ProductPage.tsx
git commit -m "feat: recommended products section on product page"
```

---

## Phase 2: Staff Auth System

### Task 5: Migration 0008 — add role and permissions to customers

**Files:**
- Create: `worker/migrations/0008_staff_roles.sql`

**Step 1:** Create the migration file:

```sql
-- Add role and permissions to customers for staff management

ALTER TABLE customers ADD COLUMN role TEXT NOT NULL DEFAULT 'customer';
-- values: 'customer' | 'staff' | 'super_admin'

ALTER TABLE customers ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '{}';
-- e.g. {"products":true,"orders":true,"customers":false,...}
```

**Step 2:** Apply locally:
```bash
cd worker && npx wrangler d1 execute edgeshop-db --local --file=migrations/0008_staff_roles.sql
```
Expected: `2 commands executed successfully`

**Step 3:** Commit:
```bash
git add worker/migrations/0008_staff_roles.sql
git commit -m "feat: add role and permissions_json columns to customers (migration 0008)"
```

---

### Task 6: Update register and login to include role + permissions in JWT

**Files:**
- Modify: `worker/src/routes/auth.ts`

**Step 1:** In `auth.post('/register', ...)`:

After inserting the customer, add a check: if this is the first customer (count was 0 before insert), set their role to `super_admin`. Add this block after `const result = await c.env.DB.prepare(...).run()`:

```typescript
// Check if this was the first customer → auto super_admin
const countBefore = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM customers WHERE id != ?')
  .bind(result.meta.last_row_id).first<{ cnt: number }>()
const isFirst = (countBefore?.cnt ?? 0) === 0
const role = isFirst ? 'super_admin' : 'customer'
const permissions = isFirst ? allPermissions() : {}

if (isFirst) {
  await c.env.DB.prepare("UPDATE customers SET role = 'super_admin' WHERE id = ?")
    .bind(result.meta.last_row_id).run()
}
```

Add a helper function at the top of the file (after imports):
```typescript
function allPermissions(): Record<string, boolean> {
  const keys = ['products','orders','customers','discounts','reviews','analytics','content','appearance','shipping','settings']
  return Object.fromEntries(keys.map(k => [k, true]))
}
```

Update the JWT creation to include role and permissions:
```typescript
const token = await createJWT({
  sub: result.meta.last_row_id,
  email: email.toLowerCase(),
  role,
  permissions,
}, secret)

return c.json({ token, customer_id: result.meta.last_row_id, name: (name as string) ?? '', role, permissions }, 201)
```

**Step 2:** In `auth.post('/login', ...)`:

Update the SELECT to fetch `role` and `permissions_json`:
```typescript
const customer = await c.env.DB.prepare(
  'SELECT id, email, password_hash, name, role, permissions_json FROM customers WHERE email = ?'
).bind(email.toLowerCase()).first<{ id: number; email: string; password_hash: string; name: string; role: string; permissions_json: string }>()
```

Parse permissions and build JWT with role:
```typescript
let permissions: Record<string, boolean> = {}
try { permissions = JSON.parse(customer.permissions_json || '{}') } catch {}
// super_admin always has all permissions
if (customer.role === 'super_admin') permissions = allPermissions()

const secret = await getOrCreateJwtSecret(c.env.DB)
const token = await createJWT({
  sub: customer.id,
  email: customer.email,
  role: customer.role,
  permissions,
}, secret)

return c.json({ token, customer_id: customer.id, name: customer.name, role: customer.role, permissions })
```

**Step 3:** TypeScript check:
```bash
cd worker && npx tsc --noEmit
```

**Step 4:** Commit:
```bash
git add worker/src/routes/auth.ts
git commit -m "feat: include role and permissions in JWT; first customer becomes super_admin"
```

---

### Task 7: Worker admin middleware

**Files:**
- Create: `worker/src/middleware/requireAdmin.ts`

**Step 1:** Create the file:

```typescript
import type { Context, Next } from 'hono'
import type { Env } from '../index'
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'

export async function requireAdmin(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = await getOrCreateJwtSecret(c.env.DB)
    const payload = await verifyJWT(token, secret)
    if (!payload || (payload.role !== 'staff' && payload.role !== 'super_admin')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export async function requireSuperAdmin(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  try {
    const secret = await getOrCreateJwtSecret(c.env.DB)
    const payload = await verifyJWT(token, secret)
    if (!payload || payload.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}
```

**Step 2:** Apply middleware in `worker/src/index.ts`. Add these imports near the top:
```typescript
import { requireAdmin } from './middleware/requireAdmin'
```

Add the middleware application line BEFORE all `app.route('/api/admin/...')` calls:
```typescript
// Protect all admin routes with JWT staff check
app.use('/api/admin/*', requireAdmin)
```

**Step 3:** TypeScript check:
```bash
cd worker && npx tsc --noEmit
```

**Step 4:** Commit:
```bash
git add worker/src/middleware/requireAdmin.ts worker/src/index.ts
git commit -m "feat: requireAdmin middleware protecting all /api/admin/* routes"
```

---

### Task 8: Staff management API

**Files:**
- Create: `worker/src/routes/admin/staff.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Create `worker/src/routes/admin/staff.ts`:

```typescript
import { Hono } from 'hono'
import type { Env } from '../../index'
import { verifyJWT, getOrCreateJwtSecret } from '../../lib/auth'

const staff = new Hono<{ Bindings: Env }>()

const PERMISSION_KEYS = ['products','orders','customers','discounts','reviews','analytics','content','appearance','shipping','settings']

function allPermissions(): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_KEYS.map(k => [k, true]))
}

async function getCallerRole(c: { req: { header: (k: string) => string | undefined }; env: Env }): Promise<string | null> {
  const auth = c.req.header('Authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  const secret = await getOrCreateJwtSecret(c.env.DB)
  const payload = await verifyJWT(token, secret)
  return payload ? (payload.role as string) : null
}

// List all staff and super_admin accounts
staff.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, phone, role, permissions_json, created_at FROM customers WHERE role IN ('staff','super_admin') ORDER BY role DESC, created_at ASC"
  ).all<{ id: number; name: string; email: string; phone: string; role: string; permissions_json: string; created_at: string }>()

  const members = results.map(r => ({
    ...r,
    permissions: (() => {
      if (r.role === 'super_admin') return allPermissions()
      try { return JSON.parse(r.permissions_json || '{}') } catch { return {} }
    })(),
  }))

  return c.json({ staff: members })
})

// Search customers (for adding new staff)
staff.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (!q) return c.json({ customers: [] })
  const like = `%${q}%`
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, email, role FROM customers WHERE (name LIKE ? OR email LIKE ?) AND role = 'customer' LIMIT 10"
  ).bind(like, like).all<{ id: number; name: string; email: string; role: string }>()
  return c.json({ customers: results })
})

// Update a customer's role and permissions (super_admin only)
staff.put('/:id', async (c) => {
  const callerRole = await getCallerRole(c)
  if (callerRole !== 'super_admin') return c.json({ error: 'Forbidden' }, 403)

  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  // Prevent modifying super_admin accounts
  const target = await c.env.DB.prepare('SELECT role FROM customers WHERE id = ?').bind(id).first<{ role: string }>()
  if (!target) return c.json({ error: 'Not found' }, 404)
  if (target.role === 'super_admin') return c.json({ error: 'Cannot modify super_admin' }, 403)

  const { role, permissions } = await c.req.json<{ role: 'staff' | 'customer'; permissions?: Record<string, boolean> }>()
  if (!['staff', 'customer'].includes(role)) return c.json({ error: 'Invalid role' }, 400)

  const permissionsJson = role === 'staff'
    ? JSON.stringify(Object.fromEntries(PERMISSION_KEYS.map(k => [k, !!(permissions?.[k])])))
    : '{}'

  await c.env.DB.prepare(
    'UPDATE customers SET role = ?, permissions_json = ? WHERE id = ?'
  ).bind(role, permissionsJson, id).run()

  return c.json({ ok: true })
})

export default staff
```

**Step 2:** Mount in `worker/src/index.ts`:
```typescript
import adminStaff from './routes/admin/staff'
// (add after other admin imports)
app.route('/api/admin/staff', adminStaff)
```

**Step 3:** TypeScript check + commit:
```bash
cd worker && npx tsc --noEmit
git add worker/src/routes/admin/staff.ts worker/src/index.ts
git commit -m "feat: staff management API (list, search, update role/permissions)"
```

---

## Phase 3: Admin Frontend Auth

### Task 9: adminAuthStore

**Files:**
- Create: `frontend/src/store/adminAuthStore.ts`

**Step 1:** Create the store:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminAuthState {
  adminToken: string | null
  adminId: number | null
  adminName: string
  adminRole: string  // 'staff' | 'super_admin'
  adminPermissions: Record<string, boolean>
  setAdminAuth: (token: string, id: number, name: string, role: string, permissions: Record<string, boolean>) => void
  adminLogout: () => void
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      adminToken: null,
      adminId: null,
      adminName: '',
      adminRole: '',
      adminPermissions: {},
      setAdminAuth: (adminToken, adminId, adminName, adminRole, adminPermissions) =>
        set({ adminToken, adminId, adminName, adminRole, adminPermissions }),
      adminLogout: () => set({ adminToken: null, adminId: null, adminName: '', adminRole: '', adminPermissions: {} }),
    }),
    { name: 'admin-auth' }
  )
)
```

**Step 2:** Commit:
```bash
git add frontend/src/store/adminAuthStore.ts
git commit -m "feat: adminAuthStore for admin panel session"
```

---

### Task 10: adminFetch utility

**Files:**
- Create: `frontend/src/admin/lib/adminFetch.ts`

**Step 1:** Create the utility:

```typescript
/**
 * Wrapper around fetch that automatically injects the admin auth token.
 * Reads directly from localStorage to avoid circular imports with Zustand.
 */
export function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let token: string | null = null
  try {
    const raw = localStorage.getItem('admin-auth')
    if (raw) token = JSON.parse(raw).state?.adminToken ?? null
  } catch {}

  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> | undefined ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
```

**Step 2:** Update every admin page to import and use `adminFetch` instead of the bare `fetch` for all `/api/` calls. The files to update are all pages in `frontend/src/admin/pages/`. In each file:

- Add import: `import { adminFetch } from '../lib/adminFetch'`
- Replace every `fetch('/api/admin/` → `adminFetch('/api/admin/`
- Replace every `fetch('/api/settings` → `adminFetch('/api/settings`
- Replace every `fetch('/api/collections` → `adminFetch('/api/collections`
- Replace every `fetch('/api/products` → `adminFetch('/api/products`
- Any other `/api/` call in admin pages → `adminFetch`

Files to update (search for `fetch('` in each):
- `AdminProducts.tsx` — uses fetch in mutations and queries
- `AdminOrders.tsx`
- `AdminOrderDetail.tsx`
- `AdminSettings.tsx`
- `AdminAppearance.tsx`
- `AdminThemeCustomizer.tsx`
- `AdminCollections.tsx`
- `AdminPages.tsx`
- `AdminNavigation.tsx`
- `AdminFooter.tsx`
- `AdminDiscounts.tsx`
- `AdminAnalytics.tsx`
- `AdminBlog.tsx`
- `AdminShipping.tsx`
- `AdminReviews.tsx`
- `AdminImport.tsx`
- `AdminCustomers.tsx`
- `AdminDashboard.tsx`

**Important:** In each file, `fetch` inside `useQuery`'s `queryFn` and inside `useMutation`'s `mutationFn` must both be updated. Example pattern (do NOT change any other logic):

```typescript
// Before
queryFn: () => fetch('/api/admin/orders?...').then(r => r.json()),

// After
queryFn: () => adminFetch('/api/admin/orders?...').then(r => r.json()),
```

**Step 3:** TypeScript check + commit:
```bash
cd frontend && npx tsc --noEmit
git add frontend/src/admin/lib/adminFetch.ts frontend/src/admin/pages/
git commit -m "feat: adminFetch utility; all admin pages use auth headers"
```

---

### Task 11: Admin Login page

**Files:**
- Create: `frontend/src/admin/pages/AdminLogin.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1:** Create `frontend/src/admin/pages/AdminLogin.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../../store/adminAuthStore'

export default function AdminLogin() {
  const navigate = useNavigate()
  const adminToken = useAdminAuthStore(s => s.adminToken)
  const setAdminAuth = useAdminAuthStore(s => s.setAdminAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (adminToken) navigate('/admin/dashboard', { replace: true })
  }, [adminToken, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json() as {
        token?: string
        customer_id?: number
        name?: string
        role?: string
        permissions?: Record<string, boolean>
        error?: string
      }
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Login failed')
        return
      }
      if (data.role !== 'staff' && data.role !== 'super_admin') {
        setError('Access denied. This account does not have admin access.')
        return
      }
      setAdminAuth(data.token, data.customer_id!, data.name ?? '', data.role!, data.permissions ?? {})
      navigate('/admin/dashboard', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-8">Sign in to access the admin panel</p>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 2:** In `frontend/src/App.tsx`, add the import and a route OUTSIDE the `AdminLayout` wrapper:

```typescript
import AdminLogin from './admin/pages/AdminLogin'
```

Add the route before the `/admin` layout route:
```typescript
<Route path="/admin/login" element={<AdminLogin />} />
<Route path="/admin" element={<AdminLayout />}>
  ...existing admin routes...
</Route>
```

**Step 3:** TypeScript check + commit:
```bash
cd frontend && npx tsc --noEmit
git add frontend/src/admin/pages/AdminLogin.tsx frontend/src/App.tsx
git commit -m "feat: admin login page at /admin/login"
```

---

### Task 12: AdminLayout — auth guard + permission-filtered nav + user info

**Files:**
- Modify: `frontend/src/admin/AdminLayout.tsx`

**Step 1:** Import `useAdminAuthStore` and `useNavigate`:
```typescript
import { useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../store/adminAuthStore'
```

**Step 2:** At the top of the `AdminLayout` component, add the auth guard:
```typescript
const adminToken = useAdminAuthStore(s => s.adminToken)
const adminName = useAdminAuthStore(s => s.adminName)
const adminRole = useAdminAuthStore(s => s.adminRole)
const adminPermissions = useAdminAuthStore(s => s.adminPermissions)
const adminLogout = useAdminAuthStore(s => s.adminLogout)
const navigate = useNavigate()

useEffect(() => {
  if (!adminToken) navigate('/admin/login', { replace: true })
}, [adminToken, navigate])

if (!adminToken) return null
```

**Step 3:** Add a `permission` field to the `NavSection` item interface and update the sections array:

```typescript
interface NavSection {
  title: string
  items: { to: string; label: string; icon: React.ReactNode; permission?: string }[]
}

const sections: NavSection[] = [
  {
    title: 'Catalog',
    items: [
      { to: '/admin/products', label: 'Products', icon: <IconBox />, permission: 'products' },
      { to: '/admin/collections', label: 'Collections', icon: <IconFolder />, permission: 'products' },
      { to: '/admin/blog', label: 'Blog', icon: <IconPencil />, permission: 'content' },
      { to: '/admin/import', label: 'Import', icon: <IconUpload />, permission: 'products' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { to: '/admin/orders', label: 'Orders', icon: <IconCart />, permission: 'orders' },
      { to: '/admin/customers', label: 'Customers', icon: <IconUsers />, permission: 'customers' },
      { to: '/admin/discounts', label: 'Discounts', icon: <IconTag />, permission: 'discounts' },
      { to: '/admin/reviews', label: 'Reviews', icon: <IconStar />, permission: 'reviews' },
      { to: '/admin/analytics', label: 'Analytics', icon: <IconChart />, permission: 'analytics' },
    ],
  },
  {
    title: 'Content',
    items: [
      { to: '/admin/pages', label: 'Pages', icon: <IconDocument />, permission: 'content' },
      { to: '/admin/navigation', label: 'Navigation', icon: <IconMenu />, permission: 'content' },
      { to: '/admin/footer', label: 'Footer', icon: <IconLayout />, permission: 'content' },
    ],
  },
  {
    title: 'Store',
    items: [
      { to: '/admin/appearance', label: 'Appearance', icon: <IconSwatch />, permission: 'appearance' },
      { to: '/admin/shipping', label: 'Shipping', icon: <IconTruck />, permission: 'shipping' },
      { to: '/admin/settings', label: 'Settings', icon: <IconCog />, permission: 'settings' },
      { to: '/admin/staff', label: 'Staff', icon: <IconUsers />, permission: '__super_admin__' },
    ],
  },
]
```

**Step 4:** Add a permission check helper and update `SidebarSection` to filter items:

Add helper before `SidebarSection`:
```typescript
function canAccess(permission: string | undefined, role: string, perms: Record<string, boolean>): boolean {
  if (!permission) return true
  if (permission === '__super_admin__') return role === 'super_admin'
  if (role === 'super_admin') return true
  return !!perms[permission]
}
```

In `SidebarSection`, pass role and permissions and filter items:
```typescript
function SidebarSection({
  section,
  defaultOpen = false,
  role,
  permissions,
}: {
  section: NavSection
  defaultOpen?: boolean
  role: string
  permissions: Record<string, boolean>
}) {
  const visibleItems = section.items.filter(item => canAccess(item.permission, role, permissions))
  if (visibleItems.length === 0) return null
  // ... rest of component, use visibleItems instead of section.items
```

Update both `SidebarSection` usages (desktop + mobile):
```typescript
{sections.map(section => (
  <SidebarSection key={section.title} section={section} role={adminRole} permissions={adminPermissions} />
))}
```

**Step 5:** Add user info + logout button to the bottom of the sidebar (both desktop and mobile). In the `<aside>` at the bottom before `</aside>`:
```typescript
<div className="p-3 border-t border-gray-100">
  <p className="text-xs font-medium text-gray-700 truncate">{adminName}</p>
  <p className="text-xs text-gray-400 capitalize mb-2">{adminRole.replace('_', ' ')}</p>
  <button
    onClick={() => { adminLogout(); navigate('/admin/login') }}
    className="w-full text-left text-xs text-red-500 hover:text-red-700 transition-colors"
  >
    Sign out
  </button>
</div>
```

**Step 6:** TypeScript check + commit:
```bash
cd frontend && npx tsc --noEmit
git add frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin auth guard, permission-filtered nav, user info + logout"
```

---

### Task 13: Admin Staff Management page

**Files:**
- Create: `frontend/src/admin/pages/AdminStaff.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1:** Create `frontend/src/admin/pages/AdminStaff.tsx`:

```typescript
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { useAdminAuthStore } from '../../store/adminAuthStore'

const PERMISSION_KEYS = [
  { key: 'products', label: 'Products & Collections' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'content', label: 'Content (Pages/Blog/Nav)' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'settings', label: 'Settings' },
]

interface StaffMember {
  id: number
  name: string
  email: string
  role: 'staff' | 'super_admin'
  permissions: Record<string, boolean>
}

interface Customer {
  id: number
  name: string
  email: string
}

export default function AdminStaff() {
  const qc = useQueryClient()
  const adminRole = useAdminAuthStore(s => s.adminRole)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ['admin-staff'],
    queryFn: () => adminFetch('/api/admin/staff').then(r => r.json()),
  })

  const { data: searchData } = useQuery<{ customers: Customer[] }>({
    queryKey: ['staff-search', search],
    queryFn: () => adminFetch(`/api/admin/staff/search?q=${encodeURIComponent(search)}`).then(r => r.json()),
    enabled: search.length >= 2,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, role, permissions }: { id: number; role: 'staff' | 'customer'; permissions?: Record<string, boolean> }) =>
      adminFetch(`/api/admin/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] })
      setEditingId(null)
    },
  })

  const staffList = data?.staff ?? []
  const searchResults = searchData?.customers ?? []

  function startEdit(member: StaffMember) {
    setEditingId(member.id)
    setEditPerms({ ...member.permissions })
  }

  if (adminRole !== 'super_admin') {
    return <div className="text-sm text-gray-500 py-10 text-center">Access denied.</div>
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Staff Management</h1>

      {/* Add staff by searching customers */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Staff Member</h2>
        <input
          type="search"
          placeholder="Search customers by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 mb-3"
        />
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded divide-y divide-gray-100">
            {searchResults.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm text-gray-800">{c.name || '(no name)'}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </div>
                <button
                  onClick={() => updateMutation.mutate({ id: c.id, role: 'staff', permissions: Object.fromEntries(PERMISSION_KEYS.map(k => [k.key, false])) })}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  Add as Staff
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current staff list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Permissions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : staffList.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No staff members yet</td></tr>
            ) : staffList.map(member => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{member.name || '(no name)'}</p>
                  <p className="text-xs text-gray-400">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${member.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                    {member.role === 'super_admin' ? 'Super Admin' : 'Staff'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {member.role === 'super_admin' ? (
                    <span className="text-xs text-gray-400">All access</span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {PERMISSION_KEYS.filter(k => member.permissions[k.key]).map(k => k.label).join(', ') || 'No access'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {member.role !== 'super_admin' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(member)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm('Remove staff access?')) updateMutation.mutate({ id: member.id, role: 'customer' }) }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit permissions modal */}
      {editingId !== null && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditingId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="font-semibold text-gray-900 mb-4">Edit Permissions</h3>
              <div className="space-y-2 mb-6">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editPerms[key]}
                      onChange={e => setEditPerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingId(null)} className="flex-1 py-2 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: editingId, role: 'staff', permissions: editPerms })}
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2:** In `App.tsx`, import and add the route:
```typescript
import AdminStaff from './admin/pages/AdminStaff'
// Inside the /admin layout:
<Route path="staff" element={<AdminStaff />} />
```

**Step 3:** TypeScript check + commit:
```bash
cd frontend && npx tsc --noEmit
git add frontend/src/admin/pages/AdminStaff.tsx frontend/src/App.tsx
git commit -m "feat: admin staff management page with permission toggles"
```

---

### Task 14: Update plan.md and apply migration to remote

**Step 1:** Apply migration to remote D1 (when ready to deploy):
```bash
cd worker && npx wrangler d1 execute edgeshop-db --remote --file=migrations/0008_staff_roles.sql
```

**Step 2:** Update `plan.md` with decisions:

Append to Key Decisions Log:
```
| 2026-02-21 | Product page wraps in theme Header/Footer/CartDrawer — same pattern as HomePage | Consistent UX; single source of theme config |
| 2026-02-21 | Gallery state is local `manualImage` (null = auto) cleared on variant change | Prevents stale gallery selection when user switches size/color |
| 2026-02-21 | Recommended products fetch /api/products?category=X&exclude=ID | Reuses existing public endpoint; no new endpoint needed |
| 2026-02-21 | First registered customer auto-becomes super_admin (checked by COUNT != 0) | Zero config for merchant; doesn't require manual DB seeding |
| 2026-02-21 | permissions_json stored as JSON blob in customers row; JWT includes permissions | Simple; no extra table; stale JWTs accepted (staff re-login picks up changes) |
| 2026-02-21 | adminFetch reads admin-auth from localStorage directly to avoid Zustand circular import | Lets any admin page file call adminFetch without importing the store |
| 2026-02-21 | Staff page: /admin/staff only visible to super_admin via __super_admin__ permission sentinel | No separate role check needed in nav — permission system handles it |
```

**Step 3:** Final commit:
```bash
git add plan.md
git commit -m "chore: update plan.md with staff auth decisions"
```
