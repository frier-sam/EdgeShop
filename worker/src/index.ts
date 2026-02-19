import { Hono } from 'hono'
import { cors } from 'hono/cors'
import settings from './routes/settings'
import products from './routes/products'
import adminProducts from './routes/admin/products'
import upload from './routes/admin/upload'

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
app.route('/api/admin/products', adminProducts)
app.route('/api/admin/upload', upload)

export default app
