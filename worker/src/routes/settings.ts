import { Hono } from 'hono'
import type { Env } from '../index'

const settings = new Hono<{ Bindings: Env }>()

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

// TODO: This endpoint returns sensitive keys (razorpay_key_secret, email_api_key, jwt_secret).
// It MUST be protected by Cloudflare Access or admin auth middleware (V2-18) before production use.
settings.get('/admin', async (c) => {
  const rows = await c.env.DB.prepare('SELECT key, value FROM settings').all()
  const result: Record<string, string> = {}
  for (const row of rows.results as { key: string; value: string }[]) {
    result[row.key] = row.value
  }
  return c.json(result)
})

settings.put('/', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const allowed = [
    // v1 keys
    'store_name', 'active_theme', 'cod_enabled',
    'razorpay_key_id', 'razorpay_key_secret', 'currency',
    // v2 email keys
    'email_provider', 'email_api_key', 'email_from_name',
    'email_from_address', 'merchant_email',
    // v2 navigation + announcement bar
    'navigation_json',
    'announcement_bar_text', 'announcement_bar_enabled', 'announcement_bar_color',
    // v2 theme customizer
    'theme_overrides_json',
    // v2 footer + review settings
    'footer_json',
    'reviews_visibility',
    // v2 email notification
    'admin_email_notifications',
  ]
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
