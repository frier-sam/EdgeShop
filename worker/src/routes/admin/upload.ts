import { Hono } from 'hono'
import type { Env } from '../../index'

const upload = new Hono<{ Bindings: Env }>()

// Step 1: Client requests upload slot, gets back a unique key
upload.post('/presign', async (c) => {
  const { filename } = await c.req.json<{ filename: string }>()
  const ext = (filename.split('.').pop() ?? 'webp').toLowerCase()
  const key = `products/${crypto.randomUUID()}.${ext}`
  return c.json({ key, uploadUrl: `/api/admin/upload/put` })
})

// Step 2: Client PUTs the binary; Worker streams it to R2
upload.put('/put', async (c) => {
  const key = c.req.query('key')
  if (!key || !key.startsWith('products/')) {
    return c.json({ error: 'Invalid key' }, 400)
  }
  const body = c.req.raw.body
  if (!body) return c.json({ error: 'No body' }, 400)
  await c.env.BUCKET.put(key, body, {
    httpMetadata: { contentType: 'image/webp' },
  })
  const publicBase = c.env.R2_PUBLIC_URL
  return c.json({ url: `${publicBase}/${key}` })
})

export default upload
