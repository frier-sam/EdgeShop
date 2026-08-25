import { Hono } from 'hono'
import { cors } from 'hono/cors'
import settings from './routes/settings'
import products from './routes/products'
import adminProducts from './routes/admin/products'
import upload from './routes/admin/upload'
import checkout from './routes/checkout'
import webhook from './routes/webhook'
import adminOrders from './routes/admin/orders'
import dashboard from './routes/admin/dashboard'
import auth from './routes/auth'
import account from './routes/account'
import { requireAdmin } from './middleware/requireAdmin'
import sitemap from './routes/sitemap'
import adminCustomers from './routes/admin/customers'
import { runMigrations } from './lib/migrate'

export type Env = {
  DB: D1Database
  BUCKET: R2Bucket
  ASSETS: Fetcher
  RAZORPAY_WEBHOOK_SECRET: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*' }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Same-origin R2 proxy — see POD.md §5.8. Serving mockups/uploads/design
// previews from the site's own origin is what lets the customizer draw
// them into a <canvas> without tainting it (cross-origin images block
// every toDataURL() call with a SecurityError).
const IMG_ALLOWED_PREFIXES = ['mockups/', 'uploads/', 'designs/']

app.get('/img/*', async (c) => {
  const key = c.req.path.slice('/img/'.length)

  if (!key || key.includes('..') || !IMG_ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
    return c.notFound()
  }

  const cache = caches.default
  const cached = await cache.match(c.req.raw)
  if (cached) return cached

  const obj = await c.env.BUCKET.get(key)
  if (!obj) return c.notFound()

  const res = new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': obj.httpEtag,
    },
  })
  c.executionCtx.waitUntil(cache.put(c.req.raw, res.clone()))
  return res
})

app.route('/api/settings', settings)
app.route('/api/products', products)

// Protect all admin routes with JWT staff check
app.use('/api/admin/*', requireAdmin)

app.route('/api/admin/dashboard', dashboard)
app.route('/api/admin/products', adminProducts)
app.route('/api/admin/upload', upload)
app.route('/api/checkout', checkout)
app.route('/api/webhook', webhook)
app.route('/api/admin/orders', adminOrders)
app.route('/api/auth', auth)
app.route('/api/account', account)
app.route('/sitemap.xml', sitemap)
app.route('/api/admin/customers', adminCustomers)

// Runs once per worker instance (cold start). Subsequent requests skip
// the migration check because migrationsDone stays true in memory.
let migrationsDone = false

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/api/') || pathname === '/sitemap.xml') {
      if (!migrationsDone) {
        await runMigrations(env.DB)
        migrationsDone = true
      }
      return app.fetch(request, env, ctx)
    }
    if (pathname.startsWith('/img/')) {
      // No DB access on this path — skip the migration check entirely for speed.
      return app.fetch(request, env, ctx)
    }
    const response = await env.ASSETS.fetch(request)
    if (response.status === 404) {
      // Fetch '/' from ASSETS (not '/index.html' — ASSETS redirects that to '/')
      return env.ASSETS.fetch(new Request(new URL('/', request.url).toString()))
    }
    return response
  },
}
