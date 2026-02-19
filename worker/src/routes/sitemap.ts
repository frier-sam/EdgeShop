import { Hono } from 'hono'
import type { Env } from '../index'

const sitemap = new Hono<{ Bindings: Env }>()

sitemap.get('/', async (c) => {
  const frontendUrl = (c.env.FRONTEND_URL ?? 'https://edgeshop.pages.dev').replace(/\/$/, '')

  const [products, collections, pages] = await Promise.all([
    c.env.DB.prepare('SELECT id FROM products WHERE status = ?').bind('active').all<{ id: number }>(),
    c.env.DB.prepare('SELECT slug FROM collections').all<{ slug: string }>(),
    c.env.DB.prepare('SELECT slug FROM pages WHERE is_visible = 1').all<{ slug: string }>(),
  ])

  const urls: string[] = [
    `<url><loc>${frontendUrl}/</loc></url>`,
    ...products.results.map(p => `<url><loc>${frontendUrl}/product/${p.id}</loc></url>`),
    ...collections.results.map(col => `<url><loc>${frontendUrl}/collections/${col.slug}</loc></url>`),
    ...pages.results.map(p => `<url><loc>${frontendUrl}/pages/${p.slug}</loc></url>`),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
})

export default sitemap
