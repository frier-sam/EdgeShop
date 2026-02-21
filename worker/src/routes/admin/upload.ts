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

// Step 3 (alternative): Worker fetches an external URL and uploads to R2
upload.post('/put-from-url', async (c) => {
  const { url } = await c.req.json<{ url: string }>()
  if (!url || !url.startsWith('http')) {
    return c.json({ error: 'Invalid URL' }, 400)
  }

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return c.json({ error: 'Failed to fetch image' }, 400)
  }
  if (!res.ok) {
    return c.json({ error: `Remote returned ${res.status}` }, 400)
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  }
  const urlExt = url.split('?')[0].split('.').pop()?.toLowerCase()
  const ext = extMap[contentType.split(';')[0].trim()] ?? (urlExt && ['jpg','jpeg','png','webp','gif','svg'].includes(urlExt) ? urlExt : 'jpg')

  const key = `products/${crypto.randomUUID()}.${ext}`
  await c.env.BUCKET.put(key, res.body!, {
    httpMetadata: { contentType: contentType.split(';')[0].trim() },
  })

  return c.json({ url: `${c.env.R2_PUBLIC_URL}/${key}` })
})

export default upload
