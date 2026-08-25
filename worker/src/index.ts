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
  R2_PUBLIC_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*' }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

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
    const response = await env.ASSETS.fetch(request)
    if (response.status === 404) {
      // Fetch '/' from ASSETS (not '/index.html' — ASSETS redirects that to '/')
      return env.ASSETS.fetch(new Request(new URL('/', request.url).toString()))
    }
    return response
  },
}
