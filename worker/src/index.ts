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

export default app
