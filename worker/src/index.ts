import { Hono } from 'hono'
import { cors } from 'hono/cors'
import settings from './routes/settings'
import products from './routes/products'
import adminProducts from './routes/admin/products'
import upload from './routes/admin/upload'
import checkout from './routes/checkout'
import webhook from './routes/webhook'
import adminOrders from './routes/admin/orders'
import variants from './routes/admin/variants'
import gallery from './routes/admin/gallery'
import collections from './routes/collections'
import adminCollections from './routes/admin/collections'
import search from './routes/search'
import pages from './routes/pages'
import adminPages from './routes/admin/pages'
import dashboard from './routes/admin/dashboard'
import validateDiscount from './routes/validateDiscount'
import adminDiscounts from './routes/admin/discounts'
import auth from './routes/auth'
import account from './routes/account'
import download from './routes/download'
import sitemap from './routes/sitemap'
import shippingRates from './routes/shippingRates'
import adminShipping from './routes/admin/shipping'
import reviews from './routes/reviews'
import adminReviews from './routes/admin/reviews'
import blog from './routes/blog'
import adminBlog from './routes/admin/blog'
import analytics from './routes/admin/analytics'
import abandonedCart from './routes/abandonedCart'
import contact from './routes/contact'
import { sendEmail } from './lib/email'
import { abandonedCartHtml } from './lib/emailTemplates'

export type Env = {
  DB: D1Database
  BUCKET: R2Bucket
  RAZORPAY_WEBHOOK_SECRET: string
  R2_PUBLIC_URL: string
  FRONTEND_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors({ origin: '*' }))

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/api/settings', settings)
app.route('/api/products', products)
app.route('/api/admin/dashboard', dashboard)
app.route('/api/admin/products', adminProducts)
app.route('/api/admin/upload', upload)
app.route('/api/checkout', checkout)
app.route('/api/webhook', webhook)
app.route('/api/admin/orders', adminOrders)
app.route('/api/admin/products/:productId/variants', variants)
app.route('/api/admin/products/:productId/images', gallery)
app.route('/api/collections', collections)
app.route('/api/admin/collections', adminCollections)
app.route('/api/search', search)
app.route('/api/pages', pages)
app.route('/api/admin/pages', adminPages)
app.route('/api/discount/validate', validateDiscount)
app.route('/api/admin/discounts', adminDiscounts)
app.route('/api/auth', auth)
app.route('/api/account', account)
app.route('/api/download', download)
app.route('/sitemap.xml', sitemap)
app.route('/api/shipping', shippingRates)
app.route('/api/admin/shipping', adminShipping)
app.route('/api/products', reviews)
app.route('/api/admin/reviews', adminReviews)
app.route('/api/blog', blog)
app.route('/api/admin/blog', adminBlog)
app.route('/api/admin/analytics', analytics)
app.route('/api/cart', abandonedCart)
app.route('/api/contact', contact)

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx)
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    try {
      const { results } = await env.DB.prepare(`
        SELECT * FROM abandoned_carts
        WHERE recovery_sent = 0
          AND datetime(created_at, '+2 hours') <= datetime('now')
      `).all<{ id: number; email: string; cart_json: string }>()

      if (results.length === 0) return

      // Fetch email settings
      const emailRows = await env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','frontend_url')"
      ).all<{ key: string; value: string }>()
      const eCfg: Record<string, string> = {}
      for (const row of emailRows.results) eCfg[row.key] = row.value

      const frontendUrl = eCfg.frontend_url || env.FRONTEND_URL || ''

      for (const cart of results) {
        // Atomic claim: skip if another cron invocation already marked this row
        const claimed = await env.DB.prepare(
          'UPDATE abandoned_carts SET recovery_sent = 1 WHERE id = ? AND recovery_sent = 0'
        ).bind(cart.id).run()
        if (claimed.meta.changes === 0) continue

        let items: Array<{ name: string; price: number; quantity: number; image_url?: string }> = []
        try { items = JSON.parse(cart.cart_json) } catch { /* skip malformed */ }

        await sendEmail(
          {
            to: cart.email,
            subject: 'You left something behind!',
            html: abandonedCartHtml({ email: cart.email, items, frontendUrl }),
          },
          {
            email_api_key: eCfg.email_api_key ?? '',
            email_from_name: eCfg.email_from_name ?? '',
            email_from_address: eCfg.email_from_address ?? '',
          }
        )
      }
    } catch (err) {
      console.error('Abandoned cart cron failed:', err)
    }
  },
}
