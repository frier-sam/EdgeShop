import { Hono } from 'hono'
import { requireAdmin } from '../middleware/requireAdmin'
import type { Env } from '../index'

const settings = new Hono<{ Bindings: Env }>()

// Keys that must never be exposed on the public (unauthenticated) GET /.
// Every secret in the POD key set belongs here.
const SENSITIVE_KEYS = new Set(['razorpay_key_secret', 'email_api_key', 'jwt_secret'])

settings.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const result: Record<string, string> = {}
  for (const row of rows.results as { key: string; value: string }[]) {
    if (!SENSITIVE_KEYS.has(row.key)) {
      result[row.key] = row.value
    }
  }
  return c.json(result)
})

// Admin-only: returns every key, including secrets. Used by the admin
// settings screen so staff can see/edit razorpay_key_secret, email_api_key, etc.
settings.get('/admin', requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const result: Record<string, string> = {}
  for (const row of rows.results as { key: string; value: string }[]) {
    result[row.key] = row.value
  }
  return c.json(result)
})

// Plain string keys — no numeric validation, just an allow-list membership check.
const STRING_KEYS = [
  'store_name', 'currency', 'cod_enabled',
  'razorpay_key_id', 'razorpay_key_secret',
  'email_provider', 'email_api_key', 'email_from_name',
  'email_from_address', 'merchant_email',
  'default_country_code',
]

// Numeric keys (POD.md §6.3) — each validated to be finite, >= min, and <= max when set.
const NUMERIC_KEYS: Record<string, { min: number; max?: number }> = {
  flat_shipping_amount: { min: 0 },
  free_shipping_over: { min: 0 },
  default_print_fee: { min: 0 },
  // Floored well above 0: a 0-DPI export multiplier collapses the print
  // canvas to zero pixels and the fulfilment render silently fails. 72 is
  // the lowest DPI anyone would plausibly print at (screen resolution).
  print_dpi: { min: 72 },
  print_bleed_percent: { min: 0, max: 25 },
  print_safe_percent: { min: 0, max: 25 },
  // A 0MB cap would reject every upload outright.
  max_art_upload_mb: { min: 1 },
  // POD.md §9.1 — the orphan-design GC's retention window (worker's
  // scheduled() handler, lib/gc.ts). Floored at 1 day: a 0-or-negative
  // value would let the daily cron delete a design the same day it was
  // created, plausibly wiping out a customer who is mid-"My Designs"
  // re-edit or just hasn't finished checkout yet.
  design_retention_days: { min: 1 },
}

const ALLOWED_KEYS = new Set<string>([...STRING_KEYS, ...Object.keys(NUMERIC_KEYS)])

settings.put('/', requireAdmin, async (c) => {
  const body = await c.req.json<Record<string, unknown>>()

  for (const [key, bounds] of Object.entries(NUMERIC_KEYS)) {
    if (!(key in body)) continue
    const raw = body[key]
    const n = typeof raw === 'string' ? Number(raw.trim()) : Number(raw)
    const outOfRange = !Number.isFinite(n) || n < bounds.min || (bounds.max != null && n > bounds.max)
    if (raw === '' || outOfRange) {
      const range = bounds.max != null ? `a number between ${bounds.min} and ${bounds.max}` : `a number >= ${bounds.min}`
      return c.json({ error: `${key} must be ${range}`, field: key }, 400)
    }
  }

  const entries = Object.entries(body).filter(([key]) => ALLOWED_KEYS.has(key))
  if (entries.length === 0) return c.json({ error: 'No valid keys' }, 400)

  const stmts = entries.map(([key, value]) =>
    c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .bind(key, String(value))
  )
  await c.env.DB.batch(stmts)
  return c.json({ ok: true })
})

export default settings
