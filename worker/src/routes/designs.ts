import { Hono } from 'hono'
import type { Env } from '../index'
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'
import { validateSidesUsed, checkSidesAreCustomizable, validateDesignJsonPayload } from '../lib/designValidation'

// POD.md §7.1 / §8 — public design + art-upload endpoints. Mounted at
// `/api` in index.ts (NOT under /api/admin/*): every route here is defined
// with its own leading segment (`/uploads/art`, `/designs`, …) so this one
// file covers both the `/api/uploads/art` and `/api/designs*` surface.
const designs = new Hono<{ Bindings: Env }>()

// ── Art upload ────────────────────────────────────────────────────────────

const ALLOWED_ART_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}
const DEFAULT_MAX_ART_MB = 15
const DESIGN_JSON_MAX_BYTES = 512 * 1024 // POD.md §7.1 — "a sane size cap (e.g. 512KB)"
const PREVIEW_MAX_BYTES = 2 * 1024 * 1024 // POD.md §7.1 — "previews are ~150KB; anything larger is abuse"

// SVG is sanitized client-side before it's ever appended to the upload
// (frontend/src/editor/sanitizeSvg.ts) — but POD.md §5.9 is explicit that
// the server must not trust that. Same-origin `/img/*` means a malicious
// SVG served back to a browser is stored XSS, so this is a hard reject,
// not a strip-and-continue.
const SVG_DANGER_PATTERN = /<script|onload=|onerror=|<foreignobject|javascript:/i

// Per-IP sliding-window counter, in-memory PER ISOLATE. Trade-off, spelled
// out rather than pretended away: this resets on every cold start and is
// NOT shared across the many isolates/regions a Worker can be running in
// simultaneously, so a distributed or persistent attacker can exceed the
// nominal limit. A D1-backed counter would make every upload attempt
// (including rejected ones) cost a write on the hot path; KV would need a
// new binding for a v1-scale abuse deterrent. This stops a casual script
// from using the bucket as free storage, which is the actual v1 threat
// model — not a hardened defense against a determined distributed client.
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_MAP_CAP = 5_000 // guard against unbounded growth within one isolate's lifetime
const rateLimitState = new Map<string, number[]>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  if (rateLimitState.size > RATE_LIMIT_MAP_CAP) rateLimitState.clear()
  const existing = rateLimitState.get(ip) ?? []
  const recent = existing.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitState.set(ip, recent)
    return false
  }
  recent.push(now)
  rateLimitState.set(ip, recent)
  return true
}

/**
 * Reads `request`'s body as FormData while defensively capping the actual
 * streamed byte count at `maxBytes` — a client can lie about
 * Content-Length, so the check that matters is on the bytes as they
 * arrive, not the header. Aborts the stream (and therefore the eventual
 * `formData()` parse) the instant the cap is exceeded, rather than
 * buffering an oversized body first.
 */
async function readCappedFormData(request: Request, maxBytes: number): Promise<FormData> {
  const body = request.body
  if (!body) throw new Error('empty_body')
  let received = 0
  const capped = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength
      if (received > maxBytes) {
        controller.error(new Error('upload_too_large'))
        return
      }
      controller.enqueue(chunk)
    },
  })
  const cappedRequest = new Response(body.pipeThrough(capped), { headers: request.headers })
  return cappedRequest.formData()
}

/** Reads a ReadableStream into one Uint8Array, aborting as soon as more than `maxBytes` has arrived — never buffers past that cap regardless of what Content-Length claimed. */
async function readCappedBytes(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new Error('body_too_large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

async function getMaxArtUploadBytes(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT value FROM settings WHERE key = 'max_art_upload_mb'").first<{ value: string }>()
  const mb = Number(row?.value)
  const safe = Number.isFinite(mb) && mb >= 1 ? mb : DEFAULT_MAX_ART_MB
  return safe * 1024 * 1024
}

function looksLikeMaliciousSvg(text: string): boolean {
  return SVG_DANGER_PATTERN.test(text)
}

designs.post('/uploads/art', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Too many uploads. Please wait a minute and try again.' }, 429)
  }

  const maxBytes = await getMaxArtUploadBytes(c.env.DB)

  const contentLength = Number(c.req.header('content-length') ?? 0)
  if (contentLength > 0 && contentLength > maxBytes) {
    return c.json({ error: `File is larger than ${Math.round(maxBytes / (1024 * 1024))}MB.` }, 413)
  }

  let form: FormData
  try {
    form = await readCappedFormData(c.req.raw, maxBytes)
  } catch {
    return c.json({ error: `File is larger than ${Math.round(maxBytes / (1024 * 1024))}MB.` }, 413)
  }

  // @cloudflare/workers-types' FormData.get() is typed as `string | null`
  // only (it predates the File union landing in the DOM lib), even though
  // the actual Workers runtime returns a real File for a binary field —
  // cast to the minimal shape this route actually uses rather than fight
  // the stale typings with `instanceof`.
  const file = form.get('file') as unknown as { size: number; type: string; arrayBuffer(): Promise<ArrayBuffer> } | string | null
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400)
  }
  if (file.size > maxBytes) {
    return c.json({ error: `File is larger than ${Math.round(maxBytes / (1024 * 1024))}MB.` }, 413)
  }

  const mime = file.type.toLowerCase()
  if (!ALLOWED_ART_MIME.has(mime)) {
    return c.json({ error: 'Only PNG, JPG, WebP or SVG files are allowed.' }, 400)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())

  if (mime === 'image/svg+xml') {
    const text = new TextDecoder().decode(bytes).toLowerCase()
    if (looksLikeMaliciousSvg(text)) {
      return c.json({ error: 'That SVG could not be accepted.' }, 400)
    }
  }

  const ext = EXT_BY_MIME[mime]
  const key = `uploads/${crypto.randomUUID()}.${ext}`
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } })

  return c.json({ url: `/img/${key}` }, 201)
})

// ── Designs ───────────────────────────────────────────────────────────────

async function getCustomerIdFromRequest(c: { req: { header: (name: string) => string | undefined }; env: Env }): Promise<number | null> {
  const authHeader = c.req.header('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null
  try {
    const secret = await getOrCreateJwtSecret(c.env.DB)
    const payload = await verifyJWT(token, secret)
    if (!payload || typeof payload.sub !== 'number') return null
    return payload.sub
  } catch {
    return null
  }
}

interface CreateDesignBody {
  product_id: number
  design_json: string
  sides_used: string[]
}

designs.post('/designs', async (c) => {
  let body: Partial<CreateDesignBody>
  try {
    body = await c.req.json<Partial<CreateDesignBody>>()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const productId = Number(body.product_id)
  if (!Number.isFinite(productId) || productId <= 0) {
    return c.json({ error: 'product_id is required' }, 400)
  }

  const designJsonCheck = validateDesignJsonPayload(body.design_json, DESIGN_JSON_MAX_BYTES)
  if (!designJsonCheck.ok) {
    return c.json({ error: designJsonCheck.error }, 400)
  }

  const sidesCheck = validateSidesUsed(body.sides_used)
  if (!sidesCheck.ok) {
    return c.json({ error: sidesCheck.error }, 400)
  }
  const sidesUsed = sidesCheck.sides

  const product = await c.env.DB.prepare(
    "SELECT id, is_customizable FROM products WHERE id = ? AND status = 'active'"
  ).bind(productId).first<{ id: number; is_customizable: number }>()
  if (!product) return c.json({ error: 'Product not found' }, 404)
  if (!product.is_customizable) return c.json({ error: 'Product is not customizable' }, 400)

  const { results: sideRows } = await c.env.DB.prepare(
    'SELECT side, customizable FROM product_sides WHERE product_id = ?'
  ).bind(productId).all<{ side: string; customizable: number }>()

  const sidesCustomizableCheck = checkSidesAreCustomizable(sidesUsed, sideRows)
  if (!sidesCustomizableCheck.ok) {
    return c.json({ error: sidesCustomizableCheck.error }, 400)
  }

  const customerId = await getCustomerIdFromRequest(c)
  const designId = `dsn_${crypto.randomUUID()}`

  await c.env.DB.prepare(
    `INSERT INTO designs (id, product_id, customer_id, design_json, preview_json, sides_used)
     VALUES (?, ?, ?, ?, '{}', ?)`
  ).bind(designId, productId, customerId, body.design_json, sidesUsed.join(',')).run()

  return c.json({ design_id: designId }, 201)
})

designs.get('/designs/:id', async (c) => {
  const id = c.req.param('id')
  const row = await c.env.DB.prepare(
    'SELECT id, product_id, design_json, preview_json, sides_used FROM designs WHERE id = ?'
  ).bind(id).first<{ id: string; product_id: number; design_json: string; preview_json: string; sides_used: string }>()
  if (!row) return c.json({ error: 'Not found' }, 404)

  let designJson: unknown = {}
  let previewJson: unknown = {}
  try { designJson = JSON.parse(row.design_json) } catch { /* leave as {} — corrupt row, don't 500 the customer */ }
  try { previewJson = JSON.parse(row.preview_json) } catch { /* same */ }

  return c.json({
    id: row.id,
    product_id: row.product_id,
    design_json: designJson,
    preview_json: previewJson,
    sides_used: row.sides_used.split(',').map((s) => s.trim()).filter(Boolean),
  })
})

designs.put('/designs/:id/preview', async (c) => {
  const id = c.req.param('id')
  const side = c.req.query('side')
  if (side !== 'front' && side !== 'back') {
    return c.json({ error: 'side must be "front" or "back"' }, 400)
  }

  const row = await c.env.DB.prepare(
    'SELECT id, preview_json, sides_used FROM designs WHERE id = ?'
  ).bind(id).first<{ id: string; preview_json: string; sides_used: string }>()
  if (!row) return c.json({ error: 'Not found' }, 404)

  const sidesUsed = row.sides_used.split(',').map((s) => s.trim())
  if (!sidesUsed.includes(side)) {
    return c.json({ error: `This design has no "${side}" side` }, 400)
  }

  const contentType = (c.req.header('content-type') ?? '').toLowerCase()
  if (!contentType.startsWith('image/webp')) {
    return c.json({ error: 'Preview body must be image/webp' }, 400)
  }

  const contentLength = Number(c.req.header('content-length') ?? 0)
  if (contentLength > 0 && contentLength > PREVIEW_MAX_BYTES) {
    return c.json({ error: `Preview is larger than ${PREVIEW_MAX_BYTES / (1024 * 1024)}MB` }, 413)
  }

  const body = c.req.raw.body
  if (!body) return c.json({ error: 'No body' }, 400)

  // R2Bucket.put() requires a stream with a KNOWN length — one straight
  // from a Request/Response body, or a FixedLengthStream — and rejects a
  // stream piped through a plain TransformStream (which loses that
  // property) with "Provided readable stream must have a known length".
  // So the streaming cap here works by reading chunks ourselves and
  // handing R2 an already-materialized Uint8Array (which does have a
  // known length) — we still never buffer more than maxBytes+1 chunk
  // before rejecting, so a lying Content-Length still can't force
  // unbounded memory use.
  let bytes: Uint8Array
  try {
    bytes = await readCappedBytes(body, PREVIEW_MAX_BYTES)
  } catch {
    return c.json({ error: `Preview is larger than ${PREVIEW_MAX_BYTES / (1024 * 1024)}MB` }, 413)
  }

  const key = `designs/${id}/${side}.webp`
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/webp' } })

  let previewJson: Record<string, string> = {}
  try { previewJson = JSON.parse(row.preview_json) } catch { /* start fresh on a corrupt row */ }
  previewJson[side] = `/img/${key}`

  await c.env.DB.prepare('UPDATE designs SET preview_json = ? WHERE id = ?')
    .bind(JSON.stringify(previewJson), id).run()

  return c.json({ url: `/img/${key}` })
})

export default designs
