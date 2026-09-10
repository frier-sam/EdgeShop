import { Hono } from 'hono'
import type { Env } from '../../index'
import { validateDesignJsonPayload } from '../../lib/designValidation'

// Admin CRUD for template_collections + design_templates — POD-V2.md §6.1,
// §11 Phase 4.2/4.3. Two resources, one file (they're tightly coupled: a
// template always belongs to a collection, and admin's authoring flow
// touches both), mounted at the shared `/api/admin` base in index.ts so the
// URLs land at `/api/admin/template-collections*` and `/api/admin/templates*`
// — sibling top-level paths, not one nested under the other. Protected by
// the same `requireAdmin` wildcard every other `routes/admin/*` file relies
// on (registered once in index.ts before any /api/admin/* route is mounted).
const adminTemplates = new Hono<{ Bindings: Env }>()

const COLLECTION_STATUSES = ['active', 'draft'] as const
const TEMPLATE_STATUSES = ['active', 'draft'] as const

// Mirrors routes/designs.ts's DESIGN_JSON_MAX_BYTES exactly (POD.md §7.1's
// "a sane size cap (e.g. 512KB)") — same shape of payload (one side's
// Fabric JSON), same abuse concern, but that constant isn't exported from
// an unrelated route file, so it's duplicated here rather than imported
// across module boundaries that have nothing else to do with each other.
const TEMPLATE_DESIGN_JSON_MAX_BYTES = 512 * 1024

// Mirrors routes/designs.ts's PREVIEW_MAX_BYTES exactly — task spec: "same
// size guard" for PUT /api/admin/templates/:id/preview as PUT
// /api/designs/:id/preview.
const TEMPLATE_PREVIEW_MAX_BYTES = 2 * 1024 * 1024

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0
}

// ── Pure validation (POST create bodies) ────────────────────────────────
//
// Same split as ../admin/products.ts's validateVariantsPayload /
// validatePriceBreaksPayload: pulled out of the route handler so the rules
// are unit-testable without a D1 database — see templates.test.ts. PATCH's
// per-field validation stays inline in the route below (same as
// admin/products.ts's own PATCH /:id), since there's no D1-free harness in
// this repo to exercise a route handler directly (see
// routes/admin/products.test.ts's header) and the create-time rules below
// already cover every field's actual validation logic once each.

export interface CleanCollectionCreate {
  name: string
  category: string
  status: 'active' | 'draft'
  sort_order: number
}

export function validateCollectionCreatePayload(body: {
  name?: unknown
  category?: unknown
  status?: unknown
  sort_order?: unknown
}): { error: string } | { clean: CleanCollectionCreate } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { error: 'name is required' }

  const status = (COLLECTION_STATUSES as readonly string[]).includes(body.status as string)
    ? (body.status as 'active' | 'draft')
    : 'active'
  // '' is a real, meaningful value here (the wildcard collection — schema.sql
  // §6.1), not "unset" — only a non-string input falls back to it.
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const sortOrder = Number.isInteger(body.sort_order) ? (body.sort_order as number) : 0

  return { clean: { name, category, status, sort_order: sortOrder } }
}

export interface CleanTemplateCreate {
  collection_id: number
  name: string
  design_json: string
  canvas_w: number
  canvas_h: number
  tags: string
  status: 'active' | 'draft'
  sort_order: number
}

/**
 * `collection_id` existence (does the row it points at actually exist?) is
 * deliberately NOT checked here — that's a D1 lookup, done in the route
 * handler after this passes, exactly like admin/products.ts's `/:id/variants`
 * 404-ing on a missing parent product. This function only validates shape.
 */
export function validateTemplateCreatePayload(body: {
  collection_id?: unknown
  name?: unknown
  design_json?: unknown
  canvas_w?: unknown
  canvas_h?: unknown
  tags?: unknown
  status?: unknown
  sort_order?: unknown
}): { error: string } | { clean: CleanTemplateCreate } {
  if (!isPositiveInt(body.collection_id)) {
    return { error: 'collection_id is required' }
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { error: 'name is required' }

  // POD-V2.md §6.1 — same discipline as POST /api/designs (routes/designs.ts):
  // design_json must be a size-capped, well-formed JSON object. Reusing the
  // exact validator the shopper-facing endpoint already relies on, rather
  // than a second copy of the same rule.
  const designJsonCheck = validateDesignJsonPayload(body.design_json, TEMPLATE_DESIGN_JSON_MAX_BYTES)
  if (!designJsonCheck.ok) return { error: designJsonCheck.error ?? 'design_json is invalid' }

  if (!isFiniteNumber(body.canvas_w) || body.canvas_w <= 0) {
    return { error: 'canvas_w must be a positive number' }
  }
  if (!isFiniteNumber(body.canvas_h) || body.canvas_h <= 0) {
    return { error: 'canvas_h must be a positive number' }
  }

  const tags = typeof body.tags === 'string' ? body.tags.trim() : ''
  const status = (TEMPLATE_STATUSES as readonly string[]).includes(body.status as string)
    ? (body.status as 'active' | 'draft')
    : 'active'
  const sortOrder = Number.isInteger(body.sort_order) ? (body.sort_order as number) : 0

  return {
    clean: {
      collection_id: body.collection_id,
      name,
      design_json: body.design_json as string,
      canvas_w: body.canvas_w,
      canvas_h: body.canvas_h,
      tags,
      status,
      sort_order: sortOrder,
    },
  }
}

// ── Shaping helpers ──────────────────────────────────────────────────────

/** Parses `design_json` for the admin response — same "never 500 over a corrupt row" rule as routes/templates.ts's parseDesignJsonSafe. */
function shapeAdminTemplateRow(row: Record<string, unknown>): Record<string, unknown> {
  let designJson: unknown = {}
  if (typeof row.design_json === 'string') {
    try { designJson = JSON.parse(row.design_json) } catch { /* corrupt row — surface as {} rather than 500 the admin */ }
  }
  return { ...row, design_json: designJson }
}

async function fetchTemplateShaped(db: D1Database, id: number): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT * FROM design_templates WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return row ? shapeAdminTemplateRow(row) : null
}

/**
 * Reads a ReadableStream into one Uint8Array, aborting once more than
 * `maxBytes` has arrived. Duplicated from routes/designs.ts's
 * readCappedBytes (not exported there) — task spec: "mirror ... exactly".
 * See that file's comment for why R2Bucket.put() needs an already-
 * materialized Uint8Array rather than a stream piped through a plain
 * TransformStream.
 */
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

// ── Collections ───────────────────────────────────────────────────────

adminTemplates.get('/template-collections', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM template_collections ORDER BY sort_order ASC, id ASC'
  ).all()
  return c.json({ collections: results })
})

adminTemplates.post('/template-collections', async (c) => {
  const body = await c.req.json<{ name?: unknown; category?: unknown; status?: unknown; sort_order?: unknown }>()
  const validated = validateCollectionCreatePayload(body)
  if ('error' in validated) return c.json({ error: validated.error }, 400)
  const { clean } = validated

  const result = await c.env.DB.prepare(
    'INSERT INTO template_collections (name, category, status, sort_order) VALUES (?, ?, ?, ?)'
  ).bind(clean.name, clean.category, clean.status, clean.sort_order).run()

  const collection = await c.env.DB.prepare('SELECT * FROM template_collections WHERE id = ?')
    .bind(result.meta.last_row_id).first()

  return c.json({ collection }, 201)
})

adminTemplates.patch('/template-collections/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM template_collections WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<Record<string, unknown>>()
  const allowedFields = ['name', 'category', 'status', 'sort_order']
  const entries: [string, unknown][] = []

  for (const [k, v] of Object.entries(body)) {
    if (!allowedFields.includes(k)) continue
    if (k === 'name') {
      if (typeof v !== 'string' || !v.trim()) return c.json({ error: 'name cannot be empty' }, 400)
      entries.push([k, v.trim()])
    } else if (k === 'category') {
      entries.push([k, typeof v === 'string' ? v.trim() : ''])
    } else if (k === 'status') {
      if (!(COLLECTION_STATUSES as readonly string[]).includes(v as string)) {
        return c.json({ error: `status must be one of: ${COLLECTION_STATUSES.join(', ')}` }, 400)
      }
      entries.push([k, v])
    } else if (k === 'sort_order') {
      if (!Number.isInteger(v)) return c.json({ error: 'sort_order must be an integer' }, 400)
      entries.push([k, v])
    }
  }

  if (entries.length === 0) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  await c.env.DB.prepare(`UPDATE template_collections SET ${fields} WHERE id = ?`).bind(...values, id).run()

  const collection = await c.env.DB.prepare('SELECT * FROM template_collections WHERE id = ?').bind(id).first()
  return c.json({ collection })
})

adminTemplates.delete('/template-collections/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  // D1/SQLite does not enforce the schema's ON DELETE CASCADE (see
  // schema.sql's FK comment on design_templates.collection_id) — delete
  // children explicitly, same discipline as routes/admin/products.ts's
  // DELETE /:id (POD-V2.md §11 Phase 4 endpoint spec names that handler as
  // the pattern to follow).
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM design_templates WHERE collection_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM template_collections WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})

// ── Templates ────────────────────────────────────────────────────────

adminTemplates.get('/templates', async (c) => {
  const collectionIdRaw = c.req.query('collection_id')
  if (collectionIdRaw !== undefined) {
    const collectionId = Number(collectionIdRaw)
    if (!Number.isFinite(collectionId)) return c.json({ error: 'collection_id must be a number' }, 400)
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM design_templates WHERE collection_id = ? ORDER BY sort_order ASC, id ASC'
    ).bind(collectionId).all()
    return c.json({ templates: results })
  }
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM design_templates ORDER BY collection_id ASC, sort_order ASC, id ASC'
  ).all()
  return c.json({ templates: results })
})

adminTemplates.post('/templates', async (c) => {
  const body = await c.req.json<{
    collection_id?: unknown
    name?: unknown
    design_json?: unknown
    canvas_w?: unknown
    canvas_h?: unknown
    tags?: unknown
    status?: unknown
    sort_order?: unknown
  }>()
  const validated = validateTemplateCreatePayload(body)
  if ('error' in validated) return c.json({ error: validated.error }, 400)
  const { clean } = validated

  const collection = await c.env.DB.prepare('SELECT id FROM template_collections WHERE id = ?')
    .bind(clean.collection_id).first()
  if (!collection) return c.json({ error: 'Collection not found' }, 404)

  const result = await c.env.DB.prepare(
    `INSERT INTO design_templates (collection_id, name, design_json, canvas_w, canvas_h, tags, status, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    clean.collection_id, clean.name, clean.design_json, clean.canvas_w, clean.canvas_h, clean.tags, clean.status, clean.sort_order
  ).run()

  const template = await fetchTemplateShaped(c.env.DB, result.meta.last_row_id as number)
  return c.json({ template }, 201)
})

adminTemplates.patch('/templates/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM design_templates WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<Record<string, unknown>>()
  const allowedFields = ['collection_id', 'name', 'design_json', 'canvas_w', 'canvas_h', 'tags', 'status', 'sort_order']
  const entries: [string, unknown][] = []

  for (const [k, v] of Object.entries(body)) {
    if (!allowedFields.includes(k)) continue
    if (k === 'collection_id') {
      if (!isPositiveInt(v)) return c.json({ error: 'collection_id must be a positive integer' }, 400)
      const collection = await c.env.DB.prepare('SELECT id FROM template_collections WHERE id = ?').bind(v).first()
      if (!collection) return c.json({ error: 'Collection not found' }, 404)
      entries.push([k, v])
    } else if (k === 'name') {
      if (typeof v !== 'string' || !v.trim()) return c.json({ error: 'name cannot be empty' }, 400)
      entries.push([k, v.trim()])
    } else if (k === 'design_json') {
      const check = validateDesignJsonPayload(v, TEMPLATE_DESIGN_JSON_MAX_BYTES)
      if (!check.ok) return c.json({ error: check.error }, 400)
      entries.push([k, v])
    } else if (k === 'canvas_w' || k === 'canvas_h') {
      if (!isFiniteNumber(v) || v <= 0) return c.json({ error: `${k} must be a positive number` }, 400)
      entries.push([k, v])
    } else if (k === 'tags') {
      entries.push([k, typeof v === 'string' ? v.trim() : ''])
    } else if (k === 'status') {
      if (!(TEMPLATE_STATUSES as readonly string[]).includes(v as string)) {
        return c.json({ error: `status must be one of: ${TEMPLATE_STATUSES.join(', ')}` }, 400)
      }
      entries.push([k, v])
    } else if (k === 'sort_order') {
      if (!Number.isInteger(v)) return c.json({ error: 'sort_order must be an integer' }, 400)
      entries.push([k, v])
    }
  }

  if (entries.length === 0) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  await c.env.DB.prepare(`UPDATE design_templates SET ${fields} WHERE id = ?`).bind(...values, id).run()

  const template = await fetchTemplateShaped(c.env.DB, id)
  return c.json({ template })
})

adminTemplates.delete('/templates/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  await c.env.DB.prepare('DELETE FROM design_templates WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// PUT /api/admin/templates/:id/preview — POD-V2.md §11 Phase 4.4. Mirrors
// PUT /api/designs/:id/preview in routes/designs.ts exactly (same R2 key
// discipline — a materialized Uint8Array so R2 sees a known-length stream,
// same image/webp content-type gate, same size guard), just under a
// `templates/` key prefix instead of `designs/<id>/`, and with no `side`
// query param (a template is single-side by definition — POD-V2.md §6.3 —
// so there's exactly one preview per template, not one per side).
adminTemplates.put('/templates/:id/preview', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const row = await c.env.DB.prepare('SELECT id FROM design_templates WHERE id = ?').bind(id).first()
  if (!row) return c.json({ error: 'Not found' }, 404)

  const contentType = (c.req.header('content-type') ?? '').toLowerCase()
  if (!contentType.startsWith('image/webp')) {
    return c.json({ error: 'Preview body must be image/webp' }, 400)
  }

  const contentLength = Number(c.req.header('content-length') ?? 0)
  if (contentLength > 0 && contentLength > TEMPLATE_PREVIEW_MAX_BYTES) {
    return c.json({ error: `Preview is larger than ${TEMPLATE_PREVIEW_MAX_BYTES / (1024 * 1024)}MB` }, 413)
  }

  const body = c.req.raw.body
  if (!body) return c.json({ error: 'No body' }, 400)

  let bytes: Uint8Array
  try {
    bytes = await readCappedBytes(body, TEMPLATE_PREVIEW_MAX_BYTES)
  } catch {
    return c.json({ error: `Preview is larger than ${TEMPLATE_PREVIEW_MAX_BYTES / (1024 * 1024)}MB` }, 413)
  }

  const key = `templates/${id}/preview.webp`
  await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/webp' } })

  const previewUrl = `/img/${key}`
  await c.env.DB.prepare('UPDATE design_templates SET preview_url = ? WHERE id = ?').bind(previewUrl, id).run()

  return c.json({ preview_url: previewUrl })
})

export default adminTemplates
