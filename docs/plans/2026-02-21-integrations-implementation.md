# Integrations Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated `/admin/integrations` page with tabbed UI for configuring Payment (Razorpay + COD), Shipping (ShipRocket), and Email (Resend, SendGrid, Brevo) integrations.

**Architecture:** Backend adds a D1 migration, expands the settings whitelist, adds multi-provider email routing, and two test-connection endpoints. Frontend adds a single tabbed page component and adds it to the admin nav. Razorpay and COD configuration moves from AdminSettings to Integrations.

**Tech Stack:** Hono v4 (worker), React 18 + TanStack Query v5 + Tailwind CSS v4 (frontend), Cloudflare D1 (settings storage).

---

## Status Legend
- [ ] Pending
- [~] In progress
- [x] Done

---

## Task 1: D1 migration — seed ShipRocket settings keys

**Files:**
- Create: `worker/migrations/0011_integrations.sql`

**Step 1:** Create the migration file:
```sql
-- worker/migrations/0011_integrations.sql
-- Seed integration settings keys

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shiprocket_email', ''),
  ('shiprocket_password', ''),
  ('shiprocket_pickup_location', 'Primary'),
  ('shiprocket_enabled', 'false'),
  ('shiprocket_token', ''),
  ('shiprocket_token_expires_at', '');
```

**Step 2:** Apply migration locally:
```bash
cd worker
npx wrangler d1 execute DB --local --file=migrations/0011_integrations.sql
```
Expected: `Successfully executed` (no errors)

**Step 3:** Commit:
```bash
git add worker/migrations/0011_integrations.sql
git commit -m "feat: add D1 migration for ShipRocket integration settings"
```

---

## Task 2: Expand settings.ts whitelist and sensitive keys

**Files:**
- Modify: `worker/src/routes/settings.ts`

**Step 1:** Open `worker/src/routes/settings.ts`. Find the `SENSITIVE_KEYS` set (line ~6) and add `shiprocket_password`:

Old:
```typescript
const SENSITIVE_KEYS = new Set(['razorpay_key_secret', 'email_api_key', 'jwt_secret'])
```
New:
```typescript
const SENSITIVE_KEYS = new Set(['razorpay_key_secret', 'email_api_key', 'jwt_secret', 'shiprocket_password', 'shiprocket_token'])
```

**Step 2:** Find the `allowed` array in the `settings.put('/')` handler. Append the new ShipRocket keys at the end of the array:

Old (last line of allowed array):
```typescript
    'default_country_code',
  ]
```
New:
```typescript
    'default_country_code',
    // ShipRocket integration
    'shiprocket_email', 'shiprocket_password', 'shiprocket_pickup_location',
    'shiprocket_enabled', 'shiprocket_token', 'shiprocket_token_expires_at',
  ]
```

**Step 3:** Commit:
```bash
git add worker/src/routes/settings.ts
git commit -m "feat: expand settings whitelist with ShipRocket integration keys"
```

---

## Task 3: Update email.ts for multi-provider support

**Files:**
- Modify: `worker/src/lib/email.ts`

The current `sendEmail()` only calls Resend. We need to route to SendGrid or Brevo based on a `provider` parameter.

**Step 1:** Replace the entire contents of `worker/src/lib/email.ts` with:

```typescript
// worker/src/lib/email.ts

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

export type EmailProvider = 'resend' | 'sendgrid' | 'brevo'

export interface EmailSettings {
  email_provider?: string
  email_api_key: string
  email_from_name: string
  email_from_address: string
}

async function sendViaResend(options: EmailOptions, settings: EmailSettings): Promise<void> {
  const fromName = settings.email_from_name || settings.email_from_address
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.email_api_key}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${settings.email_from_address}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  })
  if (!res.ok) {
    const error = await res.text()
    console.error('Resend API error:', res.status, error)
  }
}

async function sendViaSendGrid(options: EmailOptions, settings: EmailSettings): Promise<void> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.email_api_key}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: options.to }] }],
      from: {
        email: settings.email_from_address,
        name: settings.email_from_name || settings.email_from_address,
      },
      subject: options.subject,
      content: [{ type: 'text/html', value: options.html }],
    }),
  })
  if (!res.ok) {
    const error = await res.text()
    console.error('SendGrid API error:', res.status, error)
  }
}

async function sendViaBrevo(options: EmailOptions, settings: EmailSettings): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.email_api_key,
    },
    body: JSON.stringify({
      sender: {
        name: settings.email_from_name || settings.email_from_address,
        email: settings.email_from_address,
      },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    }),
  })
  if (!res.ok) {
    const error = await res.text()
    console.error('Brevo API error:', res.status, error)
  }
}

export async function sendEmail(
  options: EmailOptions,
  settings: EmailSettings
): Promise<void> {
  if (!settings.email_api_key || !settings.email_from_address) {
    console.warn('Email not configured — skipping send')
    return
  }

  try {
    const provider = (settings.email_provider ?? 'resend') as EmailProvider
    if (provider === 'sendgrid') {
      await sendViaSendGrid(options, settings)
    } else if (provider === 'brevo') {
      await sendViaBrevo(options, settings)
    } else {
      await sendViaResend(options, settings)
    }
  } catch (err) {
    console.error('Email send failed:', err)
  }
}
```

**Step 2:** Check that all existing callers of `sendEmail()` still compile. The new signature is backward-compatible: old callers pass an object without `email_provider` which defaults to `resend`. The only change is the settings type now also accepts an optional `email_provider` field.

Find all callers:
```bash
grep -rn "sendEmail(" worker/src/ --include="*.ts"
```
Each call should pass a settings object with `email_api_key`, `email_from_name`, `email_from_address`. None need to change — the provider field is optional.

**Step 3:** Commit:
```bash
git add worker/src/lib/email.ts
git commit -m "feat: add SendGrid and Brevo email provider support"
```

---

## Task 4: Create admin/integrations.ts route

**Files:**
- Create: `worker/src/routes/admin/integrations.ts`

This file contains two endpoints:
- `POST /test-shiprocket` — authenticates against ShipRocket API, stores token in D1
- `POST /test-email` — sends a test email using the submitted provider credentials

```typescript
// worker/src/routes/admin/integrations.ts
import { Hono } from 'hono'
import type { Env } from '../../index'
import { sendEmail } from '../../lib/email'

const integrations = new Hono<{ Bindings: Env }>()

// Test ShipRocket credentials
integrations.post('/test-shiprocket', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()

  if (!email || !password) {
    return c.json({ ok: false, error: 'Email and password are required' }, 400)
  }

  try {
    const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const body = await res.text()
      return c.json({ ok: false, error: `ShipRocket rejected credentials: ${res.status} ${body}` })
    }

    const data = await res.json() as {
      token: string
      company: string
      company_id: number
      expires_in?: number
    }

    if (!data.token) {
      return c.json({ ok: false, error: 'ShipRocket returned no token' })
    }

    // Cache token in D1 — expires in 10 days (ShipRocket default)
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('shiprocket_token', ?)").bind(data.token),
      c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('shiprocket_token_expires_at', ?)").bind(expiresAt),
    ])

    return c.json({ ok: true, company: data.company ?? 'Unknown' })
  } catch (err) {
    return c.json({ ok: false, error: `Connection failed: ${String(err)}` })
  }
})

// Send a test email using submitted credentials (doesn't require saved settings)
integrations.post('/test-email', async (c) => {
  const { provider, api_key, from_name, from_address, test_to } = await c.req.json<{
    provider: string
    api_key: string
    from_name: string
    from_address: string
    test_to: string
  }>()

  if (!api_key || !from_address || !test_to) {
    return c.json({ ok: false, error: 'api_key, from_address, and test_to are required' }, 400)
  }

  try {
    await sendEmail(
      {
        to: test_to,
        subject: 'EdgeShop: Test Email',
        html: '<p>This is a test email from your EdgeShop store. If you received this, your email integration is working correctly!</p>',
      },
      {
        email_provider: provider,
        email_api_key: api_key,
        email_from_name: from_name,
        email_from_address: from_address,
      }
    )
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ ok: false, error: String(err) })
  }
})

export default integrations
```

**Step 2:** Commit:
```bash
git add worker/src/routes/admin/integrations.ts
git commit -m "feat: add admin integrations test endpoints (ShipRocket + email)"
```

---

## Task 5: Mount integrations route in index.ts

**Files:**
- Modify: `worker/src/index.ts`

**Step 1:** Add the import near the other admin route imports (after `adminStaff`):
```typescript
import integrations from './routes/admin/integrations'
```

**Step 2:** Add the route mount after the other admin routes (e.g. after the `adminStaff` line):
```typescript
app.route('/api/admin/integrations', integrations)
```

**Step 3:** Commit:
```bash
git add worker/src/index.ts
git commit -m "feat: mount /api/admin/integrations route"
```

---

## Task 6: Remove Razorpay section from AdminSettings.tsx

The Razorpay and COD config will now live in the Integrations page. Remove them from Settings.

**Files:**
- Modify: `frontend/src/admin/pages/AdminSettings.tsx`

**Step 1:** In the `Settings` interface (top of file), remove `razorpay_key_id` and `razorpay_key_secret`. Keep `cod_enabled` in the interface because other parts may reference it, but we'll remove it from the form.

Actually, `cod_enabled` also moves to Integrations. Remove both from the interface:

Old interface:
```typescript
interface Settings {
  store_name: string
  currency: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
  [key: string]: string
}
```

New interface:
```typescript
interface Settings {
  store_name: string
  currency: string
  [key: string]: string
}
```

**Step 2:** In the `useState<Settings>` initial value, remove `cod_enabled`, `razorpay_key_id`, `razorpay_key_secret`:

Old:
```typescript
  const [form, setForm] = useState<Settings>({
    store_name: '',
    currency: 'INR',
    cod_enabled: 'true',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    announcement_bar_enabled: 'false',
    ...
  })
```

New:
```typescript
  const [form, setForm] = useState<Settings>({
    store_name: '',
    currency: 'INR',
    announcement_bar_enabled: 'false',
    announcement_bar_text: '',
    announcement_bar_color: '#1A1A1A',
    reviews_visibility: 'all',
    admin_email_notifications: 'false',
    default_country_code: '+91',
  })
```

**Step 3:** Remove the entire Razorpay JSX block from the return. It's the `<div>` with `<h2>Razorpay</h2>` (~lines 128–151). Delete that entire block.

**Step 4:** Remove the COD toggle from the Store Information section. Delete:
```tsx
          <ToggleField
            label="Enable Cash on Delivery"
            description="Allow customers to pay on delivery at checkout."
            checked={form.cod_enabled === 'true'}
            onChange={(checked) => setForm({ ...form, cod_enabled: checked ? 'true' : 'false' })}
          />
```

**Step 5:** Commit:
```bash
git add frontend/src/admin/pages/AdminSettings.tsx
git commit -m "refactor: remove Razorpay/COD from Settings (moved to Integrations)"
```

---

## Task 7: Add Integrations to AdminLayout nav and App.tsx route

**Files:**
- Modify: `frontend/src/admin/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`

### AdminLayout.tsx

**Step 1:** Add a new SVG icon for integrations (plug/link). Add it after `IconCog` (~line 98):
```tsx
function IconPlug() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" />
      <path d="M18 8a4 4 0 00-4-4H10a4 4 0 00-4 4v4a4 4 0 004 4h4a4 4 0 004-4V8z" />
    </svg>
  )
}
```

**Step 2:** In the `sections` array, find the `Store` section. Insert Integrations between Shipping and Settings:

Old Store items array:
```typescript
    items: [
      { to: '/admin/appearance', label: 'Appearance', icon: <IconSwatch />, permission: 'appearance' },
      { to: '/admin/shipping', label: 'Shipping', icon: <IconTruck />, permission: 'shipping' },
      { to: '/admin/settings', label: 'Settings', icon: <IconCog />, permission: 'settings' },
      { to: '/admin/staff', label: 'Staff', icon: <IconUsers />, permission: '__super_admin__' },
    ],
```

New:
```typescript
    items: [
      { to: '/admin/appearance', label: 'Appearance', icon: <IconSwatch />, permission: 'appearance' },
      { to: '/admin/shipping', label: 'Shipping', icon: <IconTruck />, permission: 'shipping' },
      { to: '/admin/integrations', label: 'Integrations', icon: <IconPlug />, permission: 'settings' },
      { to: '/admin/settings', label: 'Settings', icon: <IconCog />, permission: 'settings' },
      { to: '/admin/staff', label: 'Staff', icon: <IconUsers />, permission: '__super_admin__' },
    ],
```

### App.tsx

**Step 1:** Add the import near the other admin page imports:
```typescript
import AdminIntegrations from './admin/pages/AdminIntegrations'
```

**Step 2:** Add the route inside the `/admin` Route, after the `staff` route:
```tsx
              <Route path="integrations" element={<PageTransition><AdminIntegrations /></PageTransition>} />
```

**Step 3:** Commit:
```bash
git add frontend/src/admin/AdminLayout.tsx frontend/src/App.tsx
git commit -m "feat: add Integrations nav item and route"
```

---

## Task 8: Create AdminIntegrations.tsx

This is the main deliverable — the tabbed integrations page.

**Files:**
- Create: `frontend/src/admin/pages/AdminIntegrations.tsx`

```tsx
// frontend/src/admin/pages/AdminIntegrations.tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import { Skeleton } from '../../components/Skeleton'
import ToggleField from '../../components/ToggleField'

type Tab = 'payment' | 'shipping' | 'email'
type EmailProvider = 'resend' | 'sendgrid' | 'brevo'

interface AdminSettings {
  // payment
  razorpay_key_id: string
  razorpay_key_secret: string
  cod_enabled: string
  // shipping
  shiprocket_email: string
  shiprocket_password: string
  shiprocket_pickup_location: string
  shiprocket_enabled: string
  shiprocket_token: string
  // email
  email_provider: string
  email_api_key: string
  email_from_name: string
  email_from_address: string
  merchant_email: string
  [key: string]: string
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        connected
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-gray-100 text-gray-500 border border-gray-200'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
      {connected ? 'Connected' : 'Not configured'}
    </span>
  )
}

// ─── Payment Tab ─────────────────────────────────────────────────────────────

function PaymentTab({
  settings,
  onSave,
  isPending,
}: {
  settings: AdminSettings
  onSave: (data: Partial<AdminSettings>) => void
  isPending: boolean
}) {
  const [form, setForm] = useState({
    razorpay_key_id: settings.razorpay_key_id ?? '',
    razorpay_key_secret: settings.razorpay_key_secret ?? '',
    cod_enabled: settings.cod_enabled ?? 'false',
  })

  useEffect(() => {
    setForm({
      razorpay_key_id: settings.razorpay_key_id ?? '',
      razorpay_key_secret: settings.razorpay_key_secret ?? '',
      cod_enabled: settings.cod_enabled ?? 'false',
    })
  }, [settings.razorpay_key_id, settings.razorpay_key_secret, settings.cod_enabled])

  const rzpConnected = !!form.razorpay_key_id

  return (
    <div className="space-y-6">
      {/* Razorpay */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#072654] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">R</span>
            </div>
            <div>
              <h2 className="font-medium text-gray-800 text-sm">Razorpay</h2>
              <p className="text-xs text-gray-400">Accept UPI, cards, net banking & wallets</p>
            </div>
          </div>
          <StatusBadge connected={rzpConnected} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Key ID</label>
            <input
              value={form.razorpay_key_id}
              onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
              placeholder="rzp_live_..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Key Secret</label>
            <input
              type="password"
              value={form.razorpay_key_secret}
              onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          <strong>Webhook secret:</strong> Set the <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_WEBHOOK_SECRET</code> environment variable in your Cloudflare Worker settings. This secret is used to verify incoming payment webhooks at <code className="font-mono bg-amber-100 px-1 rounded">/api/webhook/razorpay</code>.
        </div>

        <button
          onClick={() => onSave({ razorpay_key_id: form.razorpay_key_id, razorpay_key_secret: form.razorpay_key_secret })}
          disabled={isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : 'Save Razorpay'}
        </button>
      </div>

      {/* Cash on Delivery */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01M18 12h.01" />
            </svg>
          </div>
          <div>
            <h2 className="font-medium text-gray-800 text-sm">Cash on Delivery</h2>
            <p className="text-xs text-gray-400">Allow customers to pay at the doorstep</p>
          </div>
        </div>
        <ToggleField
          label="Enable Cash on Delivery"
          description="When enabled, customers can choose to pay on delivery at checkout."
          checked={form.cod_enabled === 'true'}
          onChange={(checked) => setForm({ ...form, cod_enabled: checked ? 'true' : 'false' })}
        />
        <button
          onClick={() => onSave({ cod_enabled: form.cod_enabled })}
          disabled={isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Shipping Tab ─────────────────────────────────────────────────────────────

function ShippingTab({
  settings,
  onSave,
  isPending,
}: {
  settings: AdminSettings
  onSave: (data: Partial<AdminSettings>) => void
  isPending: boolean
}) {
  const [form, setForm] = useState({
    shiprocket_email: settings.shiprocket_email ?? '',
    shiprocket_password: settings.shiprocket_password ?? '',
    shiprocket_pickup_location: settings.shiprocket_pickup_location ?? 'Primary',
    shiprocket_enabled: settings.shiprocket_enabled ?? 'false',
  })

  useEffect(() => {
    setForm({
      shiprocket_email: settings.shiprocket_email ?? '',
      shiprocket_password: settings.shiprocket_password ?? '',
      shiprocket_pickup_location: settings.shiprocket_pickup_location ?? 'Primary',
      shiprocket_enabled: settings.shiprocket_enabled ?? 'false',
    })
  }, [settings.shiprocket_email, settings.shiprocket_password, settings.shiprocket_pickup_location, settings.shiprocket_enabled])

  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await adminFetch('/api/admin/integrations/test-shiprocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.shiprocket_email,
          password: form.shiprocket_password,
        }),
      })
      const data = await res.json() as { ok: boolean; company?: string; error?: string }
      if (data.ok) {
        setTestResult({ ok: true, message: `Connected successfully! Company: ${data.company ?? 'Unknown'}` })
      } else {
        setTestResult({ ok: false, message: data.error ?? 'Connection failed' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Request failed — check worker is running' })
    } finally {
      setTesting(false)
    }
  }

  const isConnected = form.shiprocket_enabled === 'true' && !!settings.shiprocket_token

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 5v4h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-gray-800 text-sm">ShipRocket</h2>
              <p className="text-xs text-gray-400">Automated shipping & order fulfillment</p>
            </div>
          </div>
          <StatusBadge connected={isConnected} />
        </div>

        <ToggleField
          label="Enable ShipRocket"
          description="When enabled, you can create shipments directly from order detail pages."
          checked={form.shiprocket_enabled === 'true'}
          onChange={(checked) => setForm({ ...form, shiprocket_enabled: checked ? 'true' : 'false' })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">ShipRocket Account Email</label>
            <input
              type="email"
              value={form.shiprocket_email}
              onChange={(e) => setForm({ ...form, shiprocket_email: e.target.value })}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={form.shiprocket_password}
              onChange={(e) => setForm({ ...form, shiprocket_password: e.target.value })}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Pickup Location Name</label>
          <input
            value={form.shiprocket_pickup_location}
            onChange={(e) => setForm({ ...form, shiprocket_pickup_location: e.target.value })}
            placeholder="Primary"
            className="w-full sm:max-w-xs border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">Must match the pickup location name in your ShipRocket dashboard (default: "Primary").</p>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`p-3 rounded text-sm border ${testResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTest}
            disabled={testing || !form.shiprocket_email || !form.shiprocket_password}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={() => onSave({
              shiprocket_email: form.shiprocket_email,
              shiprocket_password: form.shiprocket_password,
              shiprocket_pickup_location: form.shiprocket_pickup_location,
              shiprocket_enabled: form.shiprocket_enabled,
            })}
            disabled={isPending}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving...' : 'Save ShipRocket'}
          </button>
        </div>

        <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 space-y-1">
          <p className="font-medium text-gray-600">How to get ShipRocket credentials:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Sign up at <a href="https://app.shiprocket.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">app.shiprocket.in</a></li>
            <li>Use your ShipRocket login email and password above</li>
            <li>Click "Test Connection" to verify — a token will be cached automatically</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── Email Tab ────────────────────────────────────────────────────────────────

const EMAIL_PROVIDERS: { id: EmailProvider; name: string; description: string }[] = [
  { id: 'resend', name: 'Resend', description: 'Simple transactional email with great deliverability' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Industry standard — 100 free emails/day' },
  { id: 'brevo', name: 'Brevo', description: 'Free tier: 300 emails/day' },
]

function EmailTab({
  settings,
  onSave,
  isPending,
}: {
  settings: AdminSettings
  onSave: (data: Partial<AdminSettings>) => void
  isPending: boolean
}) {
  const [form, setForm] = useState({
    email_provider: (settings.email_provider ?? 'resend') as EmailProvider,
    email_api_key: settings.email_api_key ?? '',
    email_from_name: settings.email_from_name ?? '',
    email_from_address: settings.email_from_address ?? '',
  })

  useEffect(() => {
    setForm({
      email_provider: (settings.email_provider ?? 'resend') as EmailProvider,
      email_api_key: settings.email_api_key ?? '',
      email_from_name: settings.email_from_name ?? '',
      email_from_address: settings.email_from_address ?? '',
    })
  }, [settings.email_provider, settings.email_api_key, settings.email_from_name, settings.email_from_address])

  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleTestEmail() {
    setTesting(true)
    setTestResult(null)
    const testTo = settings.merchant_email || form.email_from_address
    try {
      const res = await adminFetch('/api/admin/integrations/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: form.email_provider,
          api_key: form.email_api_key,
          from_name: form.email_from_name,
          from_address: form.email_from_address,
          test_to: testTo,
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) {
        setTestResult({ ok: true, message: `Test email sent to ${testTo}` })
      } else {
        setTestResult({ ok: false, message: data.error ?? 'Send failed' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Request failed — check worker is running' })
    } finally {
      setTesting(false)
    }
  }

  const isConfigured = !!form.email_api_key && !!form.email_from_address

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-gray-800 text-sm">Email Provider</h2>
              <p className="text-xs text-gray-400">Send order confirmations, password resets & notifications</p>
            </div>
          </div>
          <StatusBadge connected={isConfigured} />
        </div>

        {/* Provider selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Provider</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {EMAIL_PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`cursor-pointer border-2 rounded-lg p-3 transition-colors ${
                  form.email_provider === p.id
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="email_provider"
                  value={p.id}
                  checked={form.email_provider === p.id}
                  onChange={() => setForm({ ...form, email_provider: p.id })}
                  className="sr-only"
                />
                <p className="font-medium text-sm text-gray-800">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">API Key</label>
          <input
            type="password"
            value={form.email_api_key}
            onChange={(e) => setForm({ ...form, email_api_key: e.target.value })}
            placeholder="••••••••••••••••"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Name</label>
            <input
              value={form.email_from_name}
              onChange={(e) => setForm({ ...form, email_from_name: e.target.value })}
              placeholder="My Store"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">From Email</label>
            <input
              type="email"
              value={form.email_from_address}
              onChange={(e) => setForm({ ...form, email_from_address: e.target.value })}
              placeholder="hello@mystore.com"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">Must be a verified sender in your email provider dashboard.</p>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`p-3 rounded text-sm border ${testResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {testResult.message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTestEmail}
            disabled={testing || !isConfigured}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testing ? 'Sending...' : 'Send test email'}
          </button>
          <button
            onClick={() => onSave({
              email_provider: form.email_provider,
              email_api_key: form.email_api_key,
              email_from_name: form.email_from_name,
              email_from_address: form.email_from_address,
            })}
            disabled={isPending}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving...' : 'Save Email Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminIntegrations() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('payment')

  const { data: settings, isLoading } = useQuery<AdminSettings>({
    queryKey: ['admin-settings'],
    queryFn: () => adminFetch('/api/settings/admin').then((r) => r.json()),
  })

  const saveMutation = useMutation({
    mutationFn: (body: Partial<AdminSettings>) =>
      adminFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      showToast('Saved', 'success')
    },
    onError: () => showToast('Save failed', 'error'),
  })

  const TABS: { id: Tab; label: string }[] = [
    { id: 'payment', label: 'Payment' },
    { id: 'shipping', label: 'Shipping' },
    { id: 'email', label: 'Email' },
  ]

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-1 border-b border-gray-200 pb-1">
          {TABS.map((t) => <Skeleton key={t.id} className="h-8 w-24" />)}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </div>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Integrations</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'payment' && (
        <PaymentTab settings={settings} onSave={saveMutation.mutate} isPending={saveMutation.isPending} />
      )}
      {activeTab === 'shipping' && (
        <ShippingTab settings={settings} onSave={saveMutation.mutate} isPending={saveMutation.isPending} />
      )}
      {activeTab === 'email' && (
        <EmailTab settings={settings} onSave={saveMutation.mutate} isPending={saveMutation.isPending} />
      )}
    </div>
  )
}
```

**Step 2:** Commit:
```bash
git add frontend/src/admin/pages/AdminIntegrations.tsx
git commit -m "feat: add AdminIntegrations page (Payment/Shipping/Email tabs)"
```

---

## Key Decisions Log

| Decision | Rationale |
|----------|-----------|
| Tabbed single page (not cards) | User explicitly chose tabbed layout |
| `GET /api/settings/admin` for integrations page | Sensitive keys (razorpay_key_secret, email_api_key, shiprocket_password) are masked from public GET; admin endpoint returns them for pre-filling masked inputs |
| Test endpoints accept credentials in request body | Allows testing before saving; avoids reading stale D1 values for a "test current form state" UX |
| ShipRocket token stored in D1 settings | Workers have no in-memory cache across invocations; D1 is the correct persistence layer |
| Razorpay + COD moved from AdminSettings | Cleaner separation: Settings = store config, Integrations = third-party connections |
| `onSave` accepts `Partial<AdminSettings>` | Each sub-card saves only its own keys; prevents accidental overwrites of unrelated settings |
| Email provider selection persisted as `email_provider` D1 key | All three providers (Resend, SendGrid, Brevo) share the same 4 settings keys; only the routing logic differs |
