// frontend/functions/_middleware.ts
// Cloudflare Pages Functions middleware for bot detection / dynamic rendering.
// Docs: https://developers.cloudflare.com/pages/functions/middleware/

interface Env {
  WORKER_URL?: string
}

interface EventContext<E, P extends string, D> {
  request: Request
  env: E
  params: Record<P, string>
  data: D
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>
  waitUntil: (promise: Promise<unknown>) => void
}

type PagesFunction<E = Record<string, unknown>> = (
  context: EventContext<E, string, Record<string, unknown>>
) => Response | Promise<Response>

// Bots that benefit from pre-rendered HTML.
const BOT_UA =
  /googlebot|bingbot|baiduspider|yandex|duckduckbot|slurp|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegram|applebot/i

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHtml(opts: {
  title: string
  description: string
  image?: string
  url: string
  type?: string
  bodyHtml?: string
}): string {
  const { title, description, image = '', url, type = 'website', bodyHtml = '' } = opts
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${esc(type)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
</head>
<body>
${bodyHtml}
</body>
</html>`
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context
  const ua = request.headers.get('user-agent') ?? ''
  if (!BOT_UA.test(ua)) return next()

  const url = new URL(request.url)
  const path = url.pathname
  // Use WORKER_URL env var if set (needed when Worker and Pages are on different domains).
  // Falls back to same origin (works when both are on the same custom domain).
  const apiBase = (env.WORKER_URL ?? url.origin).replace(/\/$/, '')

  try {
    // ── /product/:id ─────────────────────────────────────────────
    const productMatch = path.match(/^\/product\/(\d+)$/)
    if (productMatch) {
      const [productRes, settingsRes] = await Promise.all([
        fetch(`${apiBase}/api/products/${productMatch[1]}`),
        fetch(`${apiBase}/api/settings`),
      ])
      if (productRes.ok) {
        const p = await productRes.json() as {
          name: string
          description: string
          price: number
          image_url: string
          seo_title?: string | null
          seo_description?: string | null
        }
        const settings = settingsRes.ok
          ? await settingsRes.json() as Record<string, string>
          : {}
        const currency = settings.currency === 'INR' ? '₹' : (settings.currency ?? '₹')
        const title = p.seo_title || p.name
        const desc =
          p.seo_description ||
          `${p.description.slice(0, 130)} — ${currency}${p.price.toFixed(2)}`
        return new Response(
          buildHtml({
            title,
            description: desc,
            image: p.image_url,
            url: url.href,
            type: 'product',
            bodyHtml: `<h1>${esc(p.name)}</h1><p>${esc(desc)}</p>`,
          }),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    }

    // ── /collections/:slug ───────────────────────────────────────
    const collectionMatch = path.match(/^\/collections\/([^/]+)$/)
    if (collectionMatch) {
      const res = await fetch(`${apiBase}/api/collections/${collectionMatch[1]}`)
      if (res.ok) {
        const data = await res.json() as {
          collection: {
            name: string
            description?: string
            image_url?: string
            seo_title?: string
            seo_description?: string
          }
        }
        const col = data.collection
        const title = col.seo_title || col.name
        const desc = col.seo_description || col.description?.slice(0, 160) || col.name
        return new Response(
          buildHtml({
            title,
            description: desc,
            image: col.image_url,
            url: url.href,
            bodyHtml: `<h1>${esc(col.name)}</h1><p>${esc(desc)}</p>`,
          }),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    }

    // ── /blog/:slug ──────────────────────────────────────────────
    const blogMatch = path.match(/^\/blog\/([^/]+)$/)
    if (blogMatch) {
      const res = await fetch(`${apiBase}/api/blog/${blogMatch[1]}`)
      if (res.ok) {
        const post = await res.json() as {
          title: string
          seo_title?: string
          seo_description?: string
          cover_image?: string
        }
        const title = post.seo_title || post.title
        const desc = post.seo_description || post.title
        return new Response(
          buildHtml({
            title,
            description: desc,
            image: post.cover_image,
            url: url.href,
            type: 'article',
            bodyHtml: `<h1>${esc(post.title)}</h1>`,
          }),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    }

    // ── /pages/:slug ─────────────────────────────────────────────
    const pageMatch = path.match(/^\/pages\/([^/]+)$/)
    if (pageMatch) {
      const res = await fetch(`${apiBase}/api/pages/${pageMatch[1]}`)
      if (res.ok) {
        const pg = await res.json() as {
          title: string
          meta_title?: string
          meta_description?: string
        }
        const title = pg.meta_title || pg.title
        const desc = pg.meta_description || pg.title
        return new Response(
          buildHtml({
            title,
            description: desc,
            url: url.href,
            bodyHtml: `<h1>${esc(pg.title)}</h1>`,
          }),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    }

    // ── / (homepage) ─────────────────────────────────────────────
    if (path === '/') {
      const res = await fetch(`${apiBase}/api/settings`)
      if (res.ok) {
        const settings = await res.json() as Record<string, string>
        const name = settings.store_name || 'EdgeShop'
        const desc = `Shop ${name} — discover our handpicked collection.`
        return new Response(
          buildHtml({
            title: name,
            description: desc,
            url: url.href,
            bodyHtml: `<h1>${esc(name)}</h1><p>${esc(desc)}</p>`,
          }),
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )
      }
    }
  } catch {
    // Any error: fall through to the SPA
  }

  return next()
}
