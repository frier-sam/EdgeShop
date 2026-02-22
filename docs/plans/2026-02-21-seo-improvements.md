# SEO Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical SEO gaps — bot-detection dynamic rendering for social/search crawlers, robots.txt, missing meta tags, noindex on private pages, blog posts in sitemap, OG tags, canonical tags, and og:url.

**Architecture:** Seven self-contained tasks. Tasks 1–5 are pure file edits (no infrastructure). Task 6 adds a Cloudflare Pages Functions middleware (`frontend/functions/_middleware.ts`) that intercepts bot requests, fetches data from the Worker API, and returns pre-rendered HTML with proper meta tags. Task 7 updates deploy.sh to set the WORKER_URL env var in Pages. No SSR refactor needed. No new external services.

**Tech Stack:** Cloudflare Pages Functions (TypeScript), Hono Worker (TypeScript), React 18, Vite.

---

## Status Legend
- [ ] Pending
- [x] Done

---

## Task 1: Add robots.txt

**Files:**
- Create: `frontend/public/robots.txt`

robots.txt is served as a static file from the Pages CDN at `yourdomain.com/robots.txt`. It prevents crawlers indexing admin, checkout, account and search pages, and points to the sitemap.

**Step 1: Create the file**

```
# frontend/public/robots.txt
User-agent: *
Disallow: /admin/
Disallow: /admin
Disallow: /checkout
Disallow: /order-success
Disallow: /account/
Disallow: /search

Sitemap: https://YOUR-WORKER-URL/sitemap.xml
```

> Replace `YOUR-WORKER-URL` with the actual Worker URL (e.g. `https://edgeshop-worker.yourname.workers.dev`) after first deploy.

**Step 2: Verify the file exists at the right path**

```bash
ls frontend/public/robots.txt
```
Expected: file listed.

**Step 3: Commit**

```bash
git add frontend/public/robots.txt
git commit -m "seo: add robots.txt blocking admin/checkout/account/search"
```

---

## Task 2: Add Blog Posts to Sitemap

**Files:**
- Modify: `worker/src/routes/sitemap.ts`

Currently the sitemap query only fetches products, collections and static pages. Blog posts at `/blog/:slug` are completely missing. Fix: add a D1 query for published blog posts.

**Step 1: Read the current file**

File: `worker/src/routes/sitemap.ts` (already read — 51 lines)

**Step 2: Replace the Promise.all block to include blog posts**

In `worker/src/routes/sitemap.ts`, replace:

```typescript
    const [products, collections, pages] = await Promise.all([
      c.env.DB.prepare('SELECT id FROM products WHERE status = ?').bind('active').all<{ id: number }>(),
      c.env.DB.prepare('SELECT slug FROM collections').all<{ slug: string }>(),
      c.env.DB.prepare('SELECT slug FROM pages WHERE is_visible = 1').all<{ slug: string }>(),
    ])

    const urls: string[] = [
      `<url><loc>${safeBase}/</loc></url>`,
      ...products.results.map(p => `<url><loc>${safeBase}/product/${escapeXml(String(p.id))}</loc></url>`),
      ...collections.results
        .filter(col => col.slug && col.slug.trim().length > 0)
        .map(col => `<url><loc>${safeBase}/collections/${escapeXml(col.slug)}</loc></url>`),
      ...pages.results
        .filter(p => p.slug && p.slug.trim().length > 0)
        .map(p => `<url><loc>${safeBase}/pages/${escapeXml(p.slug)}</loc></url>`),
    ]
```

With:

```typescript
    const [products, collections, pages, blogPosts] = await Promise.all([
      c.env.DB.prepare('SELECT id FROM products WHERE status = ?').bind('active').all<{ id: number }>(),
      c.env.DB.prepare('SELECT slug FROM collections').all<{ slug: string }>(),
      c.env.DB.prepare('SELECT slug FROM pages WHERE is_visible = 1').all<{ slug: string }>(),
      c.env.DB.prepare("SELECT slug FROM blog_posts WHERE status = 'published'").all<{ slug: string }>(),
    ])

    const urls: string[] = [
      `<url><loc>${safeBase}/</loc></url>`,
      `<url><loc>${safeBase}/blog</loc></url>`,
      ...products.results.map(p => `<url><loc>${safeBase}/product/${escapeXml(String(p.id))}</loc></url>`),
      ...collections.results
        .filter(col => col.slug && col.slug.trim().length > 0)
        .map(col => `<url><loc>${safeBase}/collections/${escapeXml(col.slug)}</loc></url>`),
      ...pages.results
        .filter(p => p.slug && p.slug.trim().length > 0)
        .map(p => `<url><loc>${safeBase}/pages/${escapeXml(p.slug)}</loc></url>`),
      ...blogPosts.results
        .filter(p => p.slug && p.slug.trim().length > 0)
        .map(p => `<url><loc>${safeBase}/blog/${escapeXml(p.slug)}</loc></url>`),
    ]
```

**Step 3: Verify TypeScript compiles**

```bash
cd worker && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add worker/src/routes/sitemap.ts
git commit -m "seo: add blog posts and /blog index to sitemap.xml"
```

---

## Task 3: noindex Meta Tags on Private Pages

**Files:**
- Modify: `frontend/src/pages/SearchPage.tsx`
- Modify: `frontend/src/pages/CheckoutPage.tsx`
- Modify: `frontend/src/pages/OrderSuccessPage.tsx`

Search result pages are thin/duplicate content. Checkout and order-success are transactional pages that should never appear in Google.

**Step 1: Add noindex helper function**

This tiny helper will be copy-pasted into the three files (no shared utility needed — YAGNI):

```typescript
function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', 'noindex, nofollow')
  return () => el!.setAttribute('content', '')
}
```

**Step 2: Add to SearchPage.tsx**

In `frontend/src/pages/SearchPage.tsx`, after the existing imports, add the helper function. Then add a `useEffect` call inside the `SearchPage` component (before the theme loading check):

```typescript
// Add helper above the component:
function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', 'noindex, nofollow')
  return () => el!.setAttribute('content', '')
}

// Add inside SearchPage component, after existing useEffect:
useEffect(() => setNoIndex(), [])
```

**Step 3: Add to CheckoutPage.tsx**

Same pattern — add the `setNoIndex` helper above the component and call `useEffect(() => setNoIndex(), [])` inside the component.

**Step 4: Add to OrderSuccessPage.tsx**

Same pattern.

**Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

**Step 6: Commit**

```bash
git add frontend/src/pages/SearchPage.tsx frontend/src/pages/CheckoutPage.tsx frontend/src/pages/OrderSuccessPage.tsx
git commit -m "seo: add noindex to search, checkout, and order-success pages"
```

---

## Task 4: Fix Missing and Incomplete Meta Tags

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/pages/BlogPostPage.tsx`
- Modify: `frontend/src/pages/StaticPage.tsx`
- Modify: `frontend/src/pages/ProductPage.tsx`
- Modify: `frontend/src/pages/CollectionPage.tsx`
- Modify: `frontend/src/pages/ContactPage.tsx`

**What's missing per page:**
- `HomePage` — has zero meta tags
- `BlogPostPage` — missing all OG tags and og:url
- `StaticPage` — missing OG tags and og:url
- `ProductPage` — missing og:url and og:type="product"
- `CollectionPage` — missing og:url
- `ContactPage` — missing title, description, OG tags

**Step 1: Add `setMetaName` helper to ProductPage (already has `setMetaProperty`)**

`ProductPage.tsx` already has `setMetaProperty` (line 49-53). This file only needs `og:url` and `og:type` added to its existing `useEffect`.

In `ProductPage.tsx` find the `useEffect` that sets meta tags (lines 163-179) and add `og:url` and `og:type`:

```typescript
  useEffect(() => {
    if (!product) return
    document.title = product.seo_title || product.name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', product.seo_description || product.description.slice(0, 160))
    setMetaProperty('og:title', product.seo_title || product.name)
    setMetaProperty('og:description', product.seo_description || product.description.slice(0, 160))
    setMetaProperty('og:image', product.image_url)
    setMetaProperty('og:url', window.location.href)
    setMetaProperty('og:type', 'product')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:image', '')
      setMetaProperty('og:url', '')
      setMetaProperty('og:type', 'website')
    }
  }, [product])
```

**Step 2: Add og:url to CollectionPage.tsx**

`CollectionPage.tsx` already has `setMetaProperty` and a `useEffect`. Add `og:url` to the existing block:

```typescript
    setMetaProperty('og:title', col.seo_title || col.name)
    setMetaProperty('og:description', col.seo_description || col.description?.slice(0, 160) || '')
    setMetaProperty('og:image', col.image_url || '')
    setMetaProperty('og:url', window.location.pathname ? window.location.origin + window.location.pathname : window.location.href)
```

And in the cleanup:
```typescript
      setMetaProperty('og:url', '')
```

**Step 3: Fix BlogPostPage.tsx — add OG tags and og:url**

`BlogPostPage.tsx` has `setMetaProperty` import? No — it doesn't have it yet. Add the helper function and extend the existing `useEffect`:

```typescript
// Add helper above the component (copy from ProductPage pattern):
function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

// Replace the existing useEffect:
  useEffect(() => {
    if (!post) return
    document.title = post.seo_title || post.title
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', post.seo_description || '')
    setMetaProperty('og:title', post.seo_title || post.title)
    setMetaProperty('og:description', post.seo_description || '')
    setMetaProperty('og:image', post.cover_image || '')
    setMetaProperty('og:url', window.location.href)
    setMetaProperty('og:type', 'article')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:image', '')
      setMetaProperty('og:url', '')
      setMetaProperty('og:type', 'website')
    }
  }, [post])
```

**Step 4: Fix StaticPage.tsx — add OG tags**

```typescript
// Add helper above the component:
function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

// Replace the existing useEffect:
  useEffect(() => {
    if (!page) return
    document.title = page.meta_title || page.title
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', page.meta_description || '')
    setMetaProperty('og:title', page.meta_title || page.title)
    setMetaProperty('og:description', page.meta_description || '')
    setMetaProperty('og:url', window.location.href)
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:url', '')
    }
  }, [page])
```

**Step 5: Fix HomePage.tsx — add all meta tags**

`HomePage.tsx` currently has zero meta tags. The settings query already runs on this page (`settings?.store_name`). Add a `useEffect` that sets meta tags when settings load.

Add the `setMetaProperty` helper above the component, then add this `useEffect` inside `HomePage`:

```typescript
// Add above component:
function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

// Add inside HomePage (after the existing queries):
  useEffect(() => {
    const name = settings?.store_name ?? 'EdgeShop'
    const desc = `Shop ${name} — discover our handpicked collection.`
    document.title = name
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', desc)
    setMetaProperty('og:title', name)
    setMetaProperty('og:description', desc)
    setMetaProperty('og:url', window.location.origin + '/')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:url', '')
    }
  }, [settings?.store_name])
```

**Step 6: Fix ContactPage.tsx — add basic meta tags**

Read the file first (`frontend/src/pages/ContactPage.tsx`), then add:

```typescript
// Add helper above component:
function setMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) { el = document.createElement('meta'); el.setAttribute('property', property); document.head.appendChild(el) }
  el.setAttribute('content', content)
}

// Add useEffect inside component using store name from useTheme():
  useEffect(() => {
    document.title = `Contact — ${storeName}`
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', `Get in touch with ${storeName}`)
    setMetaProperty('og:title', `Contact — ${storeName}`)
    setMetaProperty('og:description', `Get in touch with ${storeName}`)
    setMetaProperty('og:url', window.location.href)
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
      setMetaProperty('og:title', '')
      setMetaProperty('og:description', '')
      setMetaProperty('og:url', '')
    }
  }, [storeName])
```

**Step 7: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

**Step 8: Commit**

```bash
git add frontend/src/pages/HomePage.tsx frontend/src/pages/BlogPostPage.tsx \
        frontend/src/pages/StaticPage.tsx frontend/src/pages/ProductPage.tsx \
        frontend/src/pages/CollectionPage.tsx frontend/src/pages/ContactPage.tsx
git commit -m "seo: complete og:url, og:type, og tags on all storefront pages"
```

---

## Task 5: Canonical Tag on Collection Page (Sort Params)

**Files:**
- Modify: `frontend/src/pages/CollectionPage.tsx`

`/collections/rings?sort=price_asc` and `/collections/rings` are treated as separate URLs by Google — duplicate content. A canonical tag on the sort-param version pointing to the base URL fixes this.

**Step 1: Add canonical helper above the component in CollectionPage.tsx**

```typescript
function setCanonical(url: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link') as HTMLLinkElement
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', url)
  return () => el!.setAttribute('href', '')
}
```

**Step 2: Add canonical call inside the existing `useEffect` in CollectionPage.tsx**

Find the existing `useEffect` that sets `document.title` (around line 49). Add the canonical call at the end:

```typescript
    // at the end of the useEffect body, before return:
    setCanonical(`${window.location.origin}/collections/${slug}`)
    return () => {
      document.title = ''
      // ... existing cleanup ...
      setCanonical('')
    }
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

**Step 4: Commit**

```bash
git add frontend/src/pages/CollectionPage.tsx
git commit -m "seo: add canonical tag to collection pages (prevents sort-param duplicate URLs)"
```

---

## Task 6: Bot Detection Middleware (Cloudflare Pages Functions)

**Files:**
- Create: `frontend/functions/_middleware.ts`

This is the main task. Cloudflare Pages Functions run as a Worker in front of every Pages request. The middleware checks the `User-Agent` header. For known bots, it fetches content from the Worker API and returns a complete HTML page with proper title, description, and OG meta tags — visible content that bots can read without executing JavaScript. For all other users, it calls `context.next()` to serve the normal React SPA.

**Architecture notes:**
- Bot HTML response includes visible `<h1>` and `<p>` content. This is Google-approved "dynamic rendering" — not cloaking.
- `env.WORKER_URL` is an optional Pages env var. If not set, falls back to the request origin (works on custom domains where Worker and Pages share a domain).
- All values XML/HTML-escaped before inserting into HTML.
- If the API fetch fails (product not found, Worker down), middleware falls through to `next()` — the SPA loads normally.

**Step 1: Create `frontend/functions/_middleware.ts`**

```typescript
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
```

**Step 2: Create `frontend/.dev.vars` for local Pages dev (gitignored)**

```bash
cat > frontend/.dev.vars << 'EOF'
WORKER_URL=http://localhost:8787
EOF
```

**Step 3: Verify the `frontend/.gitignore` includes `.dev.vars`**

```bash
grep '.dev.vars' frontend/.gitignore || echo "MISSING — add it"
```

If missing, add it:
```bash
echo '.dev.vars' >> frontend/.gitignore
```

**Step 4: Test locally with wrangler pages dev**

First build the frontend, then run Pages dev mode (which runs Functions):
```bash
cd frontend && npm run build && npx wrangler pages dev dist --binding WORKER_URL=http://localhost:8787
```
In a separate terminal: `cd worker && npx wrangler dev`

Then test with a bot user agent:
```bash
curl -A "Googlebot/2.1 (+http://www.google.com/bot.html)" http://localhost:8788/product/1
```
Expected: HTML response with `<title>`, OG meta tags, and `<h1>`.

For non-bot:
```bash
curl http://localhost:8788/product/1
```
Expected: The `index.html` SPA shell (no product-specific meta tags, just the React app).

**Step 5: Verify the functions TypeScript is valid**

Wrangler compiles functions automatically. Just check the file exists:
```bash
ls frontend/functions/_middleware.ts
```

**Step 6: Commit**

```bash
git add frontend/functions/_middleware.ts frontend/.dev.vars frontend/.gitignore
git commit -m "seo: add bot detection middleware (dynamic rendering for crawlers)"
```

---

## Task 7: Update deploy.sh — Set WORKER_URL in Pages

**Files:**
- Modify: `deploy.sh`

After the frontend deploys to Pages, the `WORKER_URL` env var needs to be set so the middleware knows where to call the API. Cloudflare provides `wrangler pages env put` for this.

**Step 1: Find the deploy_frontend function in deploy.sh (around line 285)**

After the line `success "Worker redeployed with CORS for $PAGES_URL"` at the end of `deploy_frontend()`, add:

```bash
  # Set WORKER_URL env var for Pages Functions (bot detection middleware)
  log "Setting WORKER_URL in Pages environment..."
  cd "$WORKER_DIR"
  echo "$WORKER_URL" | wrangler pages secret put WORKER_URL \
    --project-name "${PROJECT_NAME}" 2>/dev/null || \
    warn "Could not auto-set WORKER_URL. Set it manually in Cloudflare Pages dashboard:"$'\n'"  Settings → Environment variables → Add: WORKER_URL = $WORKER_URL"
  success "WORKER_URL set to $WORKER_URL"
```

> Note: `wrangler pages secret put` works for setting production env vars. If it fails (older wrangler), the script warns and the user can set it manually in the dashboard.

**Step 2: Also add WORKER_URL to the print_summary section**

In `print_summary()`, after the existing `echo "  Worker API :  $WORKER_URL"` line, add:

```bash
  echo ""
  echo -e "  ${BOLD}SEO note:${NC}   Bot detection middleware active."
  echo "             If WORKER_URL was not auto-set, add it in:"
  echo "             Cloudflare Pages → ${PROJECT_NAME} → Settings → Env Vars"
  echo "             Key: WORKER_URL   Value: $WORKER_URL"
```

**Step 3: Verify deploy.sh is still valid bash**

```bash
bash -n deploy.sh
```
Expected: no errors.

**Step 4: Commit**

```bash
git add deploy.sh
git commit -m "seo: set WORKER_URL in Pages env during deploy for bot middleware"
```

---

## Key Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-21 | Dynamic rendering via Pages Functions (not full SSR) | No architectural refactor needed; Google officially supports dynamic rendering as a workaround for JS-heavy sites; fits Cloudflare free tier |
| 2026-02-21 | `WORKER_URL` env var with same-origin fallback | Works zero-config on custom domains; env var only needed when Pages and Worker are on different `.dev` subdomains |
| 2026-02-21 | Bot HTML includes visible `<h1>` and `<p>` body content | Prevents Google flagging it as cloaking; same information users see just pre-rendered |
| 2026-02-21 | Error in middleware silently falls through to `next()` | Bot middleware must never break the site; if Worker is down or product not found, SPA still loads |
| 2026-02-21 | `setMetaProperty` / `setNoIndex` helpers copy-pasted per file (not shared) | YAGNI — no abstraction for 3-5 files; shared utility would add import complexity for marginal gain |
| 2026-02-21 | Canonical only on collection pages (not all pages) | Sort params (`?sort=price_asc`) are the only duplicate-URL risk in this codebase; other pages have no query-param variants |
