import { Hono } from 'hono'
import type { Env } from '../index'

const download = new Hono<{ Bindings: Env }>()

download.get('/', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'Missing token' }, 400)

  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return c.json({ error: 'Invalid token format' }, 400)

  const data = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)

  // Verify HMAC sig
  const secretRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").first<{ value: string }>()
  if (!secretRow?.value) return c.json({ error: 'Service not configured' }, 500)

  const secret = secretRow.value
  const enc = new TextEncoder()

  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const sigBytes = new Uint8Array(sig.match(/.{2}/g)?.map(b => parseInt(b, 16)) ?? [])
    if (sigBytes.length === 0) return c.json({ error: 'Invalid token' }, 401)
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
    if (!valid) return c.json({ error: 'Invalid token' }, 401)
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }

  let payload: { orderId: string; productId: number; exp: number }
  try {
    payload = JSON.parse(atob(data)) as { orderId: string; productId: number; exp: number }
  } catch {
    return c.json({ error: 'Invalid token' }, 401)
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) return c.json({ error: 'Token expired' }, 401)

  // Get the digital file key from product
  const product = await c.env.DB.prepare('SELECT digital_file_key FROM products WHERE id = ?')
    .bind(payload.productId).first<{ digital_file_key: string }>()
  if (!product?.digital_file_key) return c.json({ error: 'No digital file associated with this product' }, 404)

  const object = await c.env.BUCKET.get(product.digital_file_key)
  if (!object) return c.json({ error: 'File not found in storage' }, 404)

  const filename = product.digital_file_key.split('/').pop() ?? 'download'

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

export default download
