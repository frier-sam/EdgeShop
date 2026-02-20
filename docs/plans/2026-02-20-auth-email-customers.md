# Auth, Email & Customer Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-configure JWT secret from D1 on first use, add forgot-password flow with graceful email no-op, and add admin customer management.

**Architecture:** JWT secret is generated once at first login/register and persisted in D1 settings — survives app updates, resets only if DB is wiped. Email calls are fire-and-forget (already wrapped in try/catch); the forgot-password flow emails a plain UUID reset token stored in the customers table. Admin customers page queries D1 with aggregated order stats via a single JOIN.

**Tech Stack:** Hono v4, D1 (SQLite), Web Crypto API, React 18, TanStack Query v5, Tailwind CSS v4, React Router v6.

---

## Task 1: Auto-generate jwt_secret in D1 on first use

**Files:**
- Modify: `worker/src/lib/auth.ts`
- Modify: `worker/src/routes/auth.ts`
- Modify: `worker/src/routes/account.ts`

**Step 1:** Add `getOrCreateJwtSecret` helper to `worker/src/lib/auth.ts` (add at the bottom of the file, before the last line):

```typescript
export async function getOrCreateJwtSecret(db: D1Database): Promise<string> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  if (row?.value) return row.value

  // Generate a high-entropy secret: two UUIDs joined
  const secret = `${crypto.randomUUID()}-${crypto.randomUUID()}`
  await db.prepare("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?)").bind(secret).run()
  return secret
}
```

The `D1Database` type is already available via `@cloudflare/workers-types`. No import needed in the lib file — the caller passes `c.env.DB`.

**Step 2:** In `worker/src/routes/auth.ts`, replace BOTH `secretRow` lookups with the new helper.

Find and replace the block in `/register` (around line 39):
```typescript
  // BEFORE:
  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  if (!secretRow?.value) {
    return c.json({ error: 'Auth service not configured' }, 500)
  }
  const secret = secretRow.value

  // AFTER:
  const secret = await getOrCreateJwtSecret(c.env.DB)
```

Do the same replacement in `/login` (around line 71). Add the import at the top:
```typescript
import { hashPassword, verifyPassword, createJWT, getOrCreateJwtSecret } from '../lib/auth'
```

**Step 3:** In `worker/src/routes/account.ts`, replace the secretRow lookup:
```typescript
  // BEFORE:
  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  if (!secretRow?.value) return c.json({ error: 'Auth service not configured' }, 500)
  const payload = await verifyJWT(token, secretRow.value)

  // AFTER:
  const secret = await getOrCreateJwtSecret(c.env.DB)
  const payload = await verifyJWT(token, secret)
```

Add the import:
```typescript
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'
```

**Step 4:** Verify TypeScript compiles:
```bash
cd /Users/sam/Documents/per/edgeshop/worker && npx tsc --noEmit
```
Expected: No errors.

**Step 5:** Commit:
```bash
cd /Users/sam/Documents/per/edgeshop
git add worker/src/lib/auth.ts worker/src/routes/auth.ts worker/src/routes/account.ts
git commit -m "feat: auto-generate jwt_secret in D1 on first auth request"
```

---

## Task 2: D1 migration — add reset token columns to customers

**Files:**
- Create: `worker/migrations/0005_password_reset.sql`

**Step 1:** Create the migration file:
```sql
-- worker/migrations/0005_password_reset.sql
ALTER TABLE customers ADD COLUMN reset_token TEXT DEFAULT NULL;
ALTER TABLE customers ADD COLUMN reset_token_expires_at INTEGER DEFAULT NULL;
```

**Step 2:** Apply locally:
```bash
cd /Users/sam/Documents/per/edgeshop/worker
npx wrangler d1 execute edgeshop-db --local --file=migrations/0005_password_reset.sql
```
Expected: `Successfully executed` (or no error).

**Step 3:** Commit:
```bash
git add worker/migrations/0005_password_reset.sql
git commit -m "feat: add reset_token columns to customers table"
```

---

## Task 3: Password reset email template

**Files:**
- Modify: `worker/src/lib/emailTemplates.ts`

**Step 1:** Add `passwordResetHtml` function at the end of `emailTemplates.ts` (before the closing, after `contactFormHtml`):
```typescript
export function passwordResetHtml(data: {
  customer_name: string
  reset_url: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2>Reset Your Password</h2>
      <p>Hi ${escapeHtml(data.customer_name)},</p>
      <p>We received a request to reset your password. Click the link below — it expires in 1 hour.</p>
      <a href="${escapeHtml(data.reset_url)}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1A1A1A;color:white;text-decoration:none;border-radius:4px">
        Reset Password
      </a>
      <p style="font-size:12px;color:#888">If you didn't request this, ignore this email. Your password won't change.</p>
    </body>
    </html>
  `
}
```

**Step 2:** Commit:
```bash
git add worker/src/lib/emailTemplates.ts
git commit -m "feat: add password reset email template"
```

---

## Task 4: Forgot-password and reset-password API endpoints

**Files:**
- Modify: `worker/src/routes/auth.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Add `POST /forgot-password` to `worker/src/routes/auth.ts`.

Add this import at the top:
```typescript
import { passwordResetHtml } from '../lib/emailTemplates'
import { sendEmail } from '../lib/email'
```

Add the route after the `/login` route (before `export default auth`):
```typescript
auth.post('/forgot-password', async (c) => {
  let body: { email?: string }
  try { body = await c.req.json() } catch { return c.json({ ok: true }) }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  if (!email) return c.json({ ok: true }) // always 200 — don't leak whether email exists

  const customer = await c.env.DB.prepare(
    'SELECT id, name FROM customers WHERE email = ?'
  ).bind(email).first<{ id: number; name: string }>()

  if (!customer) return c.json({ ok: true }) // silent — don't leak existence

  const token = crypto.randomUUID()
  const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour

  await c.env.DB.prepare(
    'UPDATE customers SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?'
  ).bind(token, expiresAt, customer.id).run()

  // Fire-and-forget email — silently skips if email not configured
  try {
    const emailRows = await c.env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','frontend_url')"
    ).all<{ key: string; value: string }>()
    const eCfg: Record<string, string> = {}
    for (const row of emailRows.results) eCfg[row.key] = row.value

    const frontendUrl = c.env.FRONTEND_URL ?? eCfg.frontend_url ?? ''
    const resetUrl = `${frontendUrl}/account/reset-password?token=${token}`

    await sendEmail(
      {
        to: email,
        subject: 'Reset your password',
        html: passwordResetHtml({ customer_name: customer.name || 'there', reset_url: resetUrl }),
      },
      { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
    )
  } catch {
    // Email not configured or failed — that's fine, token is still saved
  }

  return c.json({ ok: true })
})
```

**Step 2:** Add `POST /reset-password` route (after forgot-password, before `export default`):
```typescript
auth.post('/reset-password', async (c) => {
  let body: { token?: string; password?: string }
  try { body = await c.req.json() } catch { return c.json({ error: 'Invalid request' }, 400) }

  const { token, password } = body

  if (typeof token !== 'string' || !token) return c.json({ error: 'Invalid token' }, 400)
  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400)
  }

  const now = Math.floor(Date.now() / 1000)
  const customer = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE reset_token = ? AND reset_token_expires_at > ?'
  ).bind(token, now).first<{ id: number }>()

  if (!customer) return c.json({ error: 'Token invalid or expired' }, 400)

  const password_hash = await hashPassword(password)
  await c.env.DB.prepare(
    'UPDATE customers SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?'
  ).bind(password_hash, customer.id).run()

  return c.json({ ok: true })
})
```

**Step 3:** Verify TypeScript:
```bash
cd /Users/sam/Documents/per/edgeshop/worker && npx tsc --noEmit
```
Expected: No errors.

**Step 4:** Commit:
```bash
git add worker/src/routes/auth.ts
git commit -m "feat: forgot-password and reset-password API endpoints"
```

---

## Task 5: Forgot-password and reset-password frontend pages

**Files:**
- Create: `frontend/src/pages/account/ForgotPasswordPage.tsx`
- Create: `frontend/src/pages/account/ResetPasswordPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/account/LoginPage.tsx`

**Step 1:** Create `frontend/src/pages/account/ForgotPasswordPage.tsx`:
```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setLoading(false)
      setSubmitted(true) // always show success — don't leak email existence
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Forgot password?</h1>
        <p className="text-sm text-gray-500 mb-8">Enter your email and we'll send a reset link.</p>

        {submitted ? (
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            If that email exists in our system, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-sm text-gray-500 mt-6 text-center">
          <Link to="/account/login" className="text-gray-900 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  )
}
```

**Step 2:** Create `frontend/src/pages/account/ResetPasswordPage.tsx`:
```tsx
import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Reset failed. The link may have expired.')
        return
      }
      navigate('/account/login?reset=1')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-red-600">Invalid reset link. <Link to="/account/forgot-password" className="underline">Request a new one.</Link></p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Set new password</h1>
        <p className="text-sm text-gray-500 mb-8">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-sm text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 3:** Add routes to `frontend/src/App.tsx`. Find the account routes block and add two new routes:
```tsx
// Add these after the existing account routes:
<Route path="/account/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/account/reset-password" element={<ResetPasswordPage />} />
```

Add imports at the top of App.tsx:
```tsx
import ForgotPasswordPage from './pages/account/ForgotPasswordPage'
import ResetPasswordPage from './pages/account/ResetPasswordPage'
```

**Step 4:** Add "Forgot password?" link to `frontend/src/pages/account/LoginPage.tsx`.

Find the password field section and add a link below it. The exact location will be near the password `<input>` — add after it:
```tsx
<div className="text-right mt-1">
  <Link to="/account/forgot-password" className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
    Forgot password?
  </Link>
</div>
```

Also handle the `?reset=1` query param to show a success message. At the top of LoginPage add:
```tsx
const [searchParams] = useSearchParams()
const resetSuccess = searchParams.get('reset') === '1'
```

And above the form:
```tsx
{resetSuccess && (
  <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
    Password updated successfully. Please log in.
  </div>
)}
```

Add `useSearchParams` to the `react-router-dom` import.

**Step 5:** Verify TypeScript:
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit
```
Expected: No errors.

**Step 6:** Commit:
```bash
git add frontend/src/pages/account/ frontend/src/App.tsx
git commit -m "feat: forgot-password and reset-password frontend pages"
```

---

## Task 6: Admin Customers API

**Files:**
- Create: `worker/src/routes/admin/customers.ts`
- Modify: `worker/src/index.ts`

**Step 1:** Create `worker/src/routes/admin/customers.ts`:
```typescript
import { Hono } from 'hono'
import type { Env } from '../../index'

const adminCustomers = new Hono<{ Bindings: Env }>()

// List customers with order stats
adminCustomers.get('/', async (c) => {
  const search = c.req.query('search') ?? ''
  const page = Math.max(1, Number(c.req.query('page') ?? '1'))
  const limit = 20
  const offset = (page - 1) * limit

  let rows
  if (search) {
    const like = `%${search}%`
    rows = await c.env.DB.prepare(`
      SELECT
        c.id, c.name, c.email, c.phone, c.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.name LIKE ? OR c.email LIKE ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(like, like, limit, offset).all()
  } else {
    rows = await c.env.DB.prepare(`
      SELECT
        c.id, c.name, c.email, c.phone, c.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all()
  }

  const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>()
  const total = totalRow?.count ?? 0

  return c.json({
    customers: rows.results,
    total,
    pages: Math.ceil(total / limit),
    page,
  })
})

// Single customer + their orders
adminCustomers.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const customer = await c.env.DB.prepare(
    'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?'
  ).bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)

  const { results: orders } = await c.env.DB.prepare(
    'SELECT id, total_amount, order_status, payment_status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(id).all()

  return c.json({ customer, orders })
})

// Delete customer (nullify customer_id on their orders to preserve order history)
adminCustomers.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id),
  ])

  return c.json({ ok: true })
})

export default adminCustomers
```

**Step 2:** Mount in `worker/src/index.ts`. Add import and route:
```typescript
import adminCustomers from './routes/admin/customers'
// ...
app.route('/api/admin/customers', adminCustomers)
```

**Step 3:** Verify TypeScript:
```bash
cd /Users/sam/Documents/per/edgeshop/worker && npx tsc --noEmit
```
Expected: No errors.

**Step 4:** Commit:
```bash
git add worker/src/routes/admin/customers.ts worker/src/index.ts
git commit -m "feat: admin customers API (list with order stats, detail, delete)"
```

---

## Task 7: Admin Customers frontend page

**Files:**
- Create: `frontend/src/admin/pages/AdminCustomers.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/admin/AdminLayout.tsx`

**Step 1:** Create `frontend/src/admin/pages/AdminCustomers.tsx`:
```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

interface Customer {
  id: number
  name: string
  email: string
  phone: string
  created_at: string
  order_count: number
  total_spent: number
}

interface CustomerDetail {
  customer: Omit<Customer, 'order_count' | 'total_spent'>
  orders: Array<{
    id: string
    total_amount: number
    order_status: string
    payment_status: string
    created_at: string
  }>
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

export default function AdminCustomers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: settingsData } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const currency = CURRENCY_SYMBOLS[settingsData?.currency ?? 'INR'] ?? '₹'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      return fetch(`/api/admin/customers?${params}`).then(r => r.json()) as Promise<{
        customers: Customer[]; total: number; pages: number; page: number
      }>
    },
  })

  const { data: detail } = useQuery<CustomerDetail>({
    queryKey: ['admin-customer', expandedId],
    queryFn: () => fetch(`/api/admin/customers/${expandedId}`).then(r => r.json()),
    enabled: expandedId !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/customers/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      setExpandedId(null)
    },
  })

  const customers = data?.customers ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Customers</h1>
        <span className="text-sm text-gray-500">{data?.total ?? 0} total</span>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

      {!isLoading && customers.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">No customers found.</p>
      )}

      {customers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Registered</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(customer => (
                <>
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{customer.name || '—'}</p>
                      <p className="text-xs text-gray-500">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{customer.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{customer.order_count}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {currency}{Number(customer.total_spent).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (window.confirm(`Delete ${customer.email}? Their order history will be preserved.`)) {
                            deleteMutation.mutate(customer.id)
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {/* Expanded order history */}
                  {expandedId === customer.id && detail && (
                    <tr key={`${customer.id}-detail`}>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order History</p>
                        {detail.orders.length === 0 ? (
                          <p className="text-xs text-gray-400">No orders yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {detail.orders.map(order => (
                              <div key={order.id} className="flex items-center justify-between text-xs text-gray-700">
                                <Link
                                  to={`/admin/orders/${order.id}`}
                                  className="text-indigo-600 hover:underline font-mono"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {order.id}
                                </Link>
                                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                <span className="capitalize px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{order.order_status}</span>
                                <span className="font-medium">{currency}{order.total_amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {(data?.pages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-100">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {data?.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))}
                disabled={page === data?.pages}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2:** Add route to `frontend/src/App.tsx`. Inside the `/admin` route block, add:
```tsx
<Route path="customers" element={<AdminCustomers />} />
```

Add import:
```tsx
import AdminCustomers from './admin/pages/AdminCustomers'
```

**Step 3:** Add "Customers" link to `frontend/src/admin/AdminLayout.tsx`.

Find the nav section where admin links like "products", "orders" etc. are listed. Add `customers` to the appropriate group. Search for the section that lists admin links and add a `customers` entry. The exact location depends on the current grouping — it belongs in the same group as "orders" (Sales section).

**Step 4:** Verify TypeScript:
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit
```
Expected: No errors.

**Step 5:** Commit:
```bash
git add frontend/src/admin/pages/AdminCustomers.tsx frontend/src/App.tsx frontend/src/admin/AdminLayout.tsx
git commit -m "feat: admin customers page (list, order history, delete)"
```

---

## Task 8: Update plan.md

**Files:**
- Modify: `plan.md`

**Step 1:** Add the new tasks to `plan.md` under a new section "Phase 7: Auth, Email & Customer Management" with `[x]` markers after implementation. Also add key decisions.

Key decisions to log:
- `jwt_secret auto-generated in D1 on first auth request — no manual config needed, persists through app updates until DB is wiped`
- `Password reset uses plain UUID token stored in customers table — single-use + 1-hour expiry is sufficient; no separate tokens table needed`
- `Email calls are always fire-and-forget (try/catch) — missing email config silently skips, never breaks user-facing flows`
- `Customer delete nullifies customer_id on orders instead of cascading delete — preserves order history for merchant analytics`

**Step 2:** Commit:
```bash
git add plan.md
git commit -m "docs: update plan.md with auth/email/customers tasks"
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| jwt_secret auto-generated in D1 on first auth request | Zero config for merchant — works out of the box, secret persists as long as DB lives |
| Password reset token is a raw UUID in customers table | Simple, no extra table; UUID entropy (122 bits) + 1h expiry = sufficient security for this scale |
| Email is always fire-and-forget (try/catch around all sends) | Email provider is pluggable — missing config should never break checkout, login, or password reset |
| Customer delete nullifies orders.customer_id instead of cascade | Merchant analytics stay intact; GDPR-style anonymisation without losing revenue data |
| Admin customers page aggregates order count + spend via LEFT JOIN | Single query, no N+1; D1 handles this fine at small-merchant scale |
