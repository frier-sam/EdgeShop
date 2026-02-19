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
