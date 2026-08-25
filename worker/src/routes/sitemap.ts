import { Hono } from 'hono'
import type { Env } from '../index'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const sitemap = new Hono<{ Bindings: Env }>()

sitemap.get('/', async (c) => {
  const frontendUrl = new URL(c.req.url).origin
  const safeBase = escapeXml(frontendUrl)

  try {
    const products = await c.env.DB.prepare('SELECT id FROM products WHERE status = ?').bind('active').all<{ id: number }>()

    const urls: string[] = [
      `<url><loc>${safeBase}/</loc></url>`,
      `<url><loc>${safeBase}/shop</loc></url>`,
      ...products.results.map(p => `<url><loc>${safeBase}/product/${escapeXml(String(p.id))}</loc></url>`),
    ]

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
  } catch (err) {
    console.error('[sitemap] failed to generate:', err)
    const errorXml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`
    return new Response(errorXml, { status: 503, headers: { 'Content-Type': 'application/xml' } })
  }
})

export default sitemap
