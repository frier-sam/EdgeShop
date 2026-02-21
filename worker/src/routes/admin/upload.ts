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

// POST /put-from-url — fetches an external image URL and uploads it to R2
upload.post('/put-from-url', async (c) => {
  const { url } = await c.req.json<{ url: string }>()
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return c.json({ error: 'Invalid URL' }, 400)
  }
  if (parsedUrl.protocol !== 'https:') {
    return c.json({ error: 'Only HTTPS URLs are allowed' }, 400)
  }
  const hostname = parsedUrl.hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return c.json({ error: 'URL points to a private address' }, 400)
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

  const contentLength = res.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    return c.json({ error: 'Image too large (max 10 MB)' }, 400)
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
  if (!res.body) {
    return c.json({ error: 'Remote returned empty body' }, 400)
  }
  await c.env.BUCKET.put(key, res.body, {
    httpMetadata: { contentType: contentType.split(';')[0].trim() },
  })

  return c.json({ url: `${c.env.R2_PUBLIC_URL}/${key}` })
})

export default upload
