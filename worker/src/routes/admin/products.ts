import { Hono } from 'hono'
import type { Env } from '../../index'

const adminProducts = new Hono<{ Bindings: Env }>()

const VALID_STATUSES = ['active', 'draft'] as const
const VALID_SIDES = ['front', 'back'] as const

function slugify(name: string): string {
  const s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return s || 'product'
}

async function uniqueSlug(db: D1Database, base: string, excludeId?: number): Promise<string> {
  let candidate = base
  let n = 2
  for (;;) {
    const row = excludeId != null
      ? await db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').bind(candidate, excludeId).first()
      : await db.prepare('SELECT id FROM products WHERE slug = ?').bind(candidate).first()
    if (!row) return candidate
    candidate = `${base}-${n}`
    n++
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

// POD-V2.md §3.1 — axis 2's swatch is optional even when present: a
// finish like matte/glossy has no colour at all, so `swatch_hex` is
// nullable at the schema level. This only validates the non-null case.
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

// POD-V2.md §11 Phase 1.1 — axis labels are free text but must never end
// up empty in the DB (NOT NULL, no unit/format validation per §1's "opaque
// strings" rule) — falls back to the given default rather than rejecting,
// since "leave it blank" reads as "use the default" everywhere else a
// label is optional in this form.
export function normalizeAxisLabel(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

// POD-UI4.md §4.1 / P2 — the product page's "Key Features" box.
// Newline-separated bullet lines, opaque merchant copy (never parsed
// beyond splitting on newlines client-side). The 8-line guidance mentioned
// in the spec is a client-side courtesy only; this 2000-char cap is the
// actual server-side boundary an API caller can't bypass.
export const MAX_HIGHLIGHTS_LENGTH = 2000

export function normalizeHighlights(v: unknown): { error: string } | { value: string } {
  if (v === undefined || v === null) return { value: '' }
  if (typeof v !== 'string') return { error: 'highlights must be a string' }
  const trimmed = v.trim()
  if (trimmed.length > MAX_HIGHLIGHTS_LENGTH) {
    return { error: `highlights must be ${MAX_HIGHLIGHTS_LENGTH} characters or fewer` }
  }
  return { value: trimmed }
}

export interface CleanVariant {
  label: string
  swatch_hex: string | null
  sort_order: number
}

export interface CleanPriceBreak {
  min_qty: number
  unit_price: number
}

// POD-V2.md §3.1, §11 Phase 1.7 — pure validation for the PUT /:id/variants
// full-replace body, split out from the route handler (same "pure
// selection/validation, separately unit-tested" split as buildPreviewLines
// in ../orders.ts and lib/gc.ts's isOrphanDesignExpired) so the rules —
// non-empty label, case-insensitive per-product uniqueness, and the
// swatch_hex format — are testable without a D1 database.
export function validateVariantsPayload(
  variants: Array<{ label?: unknown; swatch_hex?: unknown; sort_order?: unknown }>
): { error: string } | { clean: CleanVariant[] } {
  const seen = new Set<string>()
  const clean: CleanVariant[] = []
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    const label = typeof v.label === 'string' ? v.label.trim() : ''
    if (!label) return { error: 'Every variant must have a non-empty label' }
    const key = label.toLowerCase()
    if (seen.has(key)) return { error: `Duplicate variant label: ${label}` }
    seen.add(key)

    let swatchHex: string | null = null
    if (v.swatch_hex !== undefined && v.swatch_hex !== null) {
      if (typeof v.swatch_hex !== 'string' || !HEX_COLOR_RE.test(v.swatch_hex)) {
        return { error: `swatch_hex for "${label}" must be a hex color like #1A2B3C, or null` }
      }
      swatchHex = v.swatch_hex
    }

    const sortOrder = Number.isInteger(v.sort_order) ? (v.sort_order as number) : i
    clean.push({ label, swatch_hex: swatchHex, sort_order: sortOrder })
  }
  return { clean }
}

// POD-V2.md §5, §11 Phase 1.7 — pure validation for the PUT
// /:id/price_breaks full-replace body: integer min_qty >= 1, unique per
// product, and a finite non-negative unit_price.
export function validatePriceBreaksPayload(
  priceBreaks: Array<{ min_qty?: unknown; unit_price?: unknown }>
): { error: string } | { clean: CleanPriceBreak[] } {
  const seen = new Set<number>()
  const clean: CleanPriceBreak[] = []
  for (const p of priceBreaks) {
    if (!Number.isInteger(p.min_qty) || (p.min_qty as number) < 1) {
      return { error: 'min_qty must be an integer >= 1' }
    }
    const minQty = p.min_qty as number
    if (seen.has(minQty)) return { error: `Duplicate min_qty: ${minQty}` }
    seen.add(minQty)
    if (!isFiniteNumber(p.unit_price) || p.unit_price < 0) {
      return { error: `unit_price for min_qty ${minQty} must be a non-negative number` }
    }
    clean.push({ min_qty: minQty, unit_price: p.unit_price })
  }
  return { clean }
}

function validatePrintRect(x: number, y: number, w: number, h: number): string | null {
  const fields: Array<[string, number]> = [['print_x', x], ['print_y', y], ['print_w', w], ['print_h', h]]
  for (const [k, v] of fields) {
    if (!isFiniteNumber(v) || v < 0 || v > 1) return `${k} must be a finite number between 0 and 1`
  }
  if (x + w > 1) return 'print_x + print_w must be <= 1'
  if (y + h > 1) return 'print_y + print_h must be <= 1'
  return null
}

// ── List ──────────────────────────────────────────────────────
adminProducts.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const rawStatus = (c.req.query('status') ?? '').trim()
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : ''
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1)
  const limit = 20
  const offset = (page - 1) * limit

  let where = 'WHERE 1=1'
  const params: (string | number)[] = []
  if (q) { where += ' AND (p.name LIKE ? OR p.category LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  if (status) { where += ' AND p.status = ?'; params.push(status) }

  try {
    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM products p ${where}`
    ).bind(...params).first<{ total: number }>()
    const total = countRow?.total ?? 0

    const { results } = await c.env.DB.prepare(
      // `has_print_area` — POD-V2.md §6.4. `is_customizable` alone is not
      // enough to know a product can be DRAWN on: a side can be flagged
      // customizable while its normalized print rect is still the 0x0
      // default, which yields a degenerate (zero-sized) editor stage. The
      // template-authoring product picker needs to exclude those up front
      // rather than offer a card that can only fail when clicked, and it
      // has no `sides` on this list payload to work it out for itself.
      // An EXISTS subquery keeps this one query and one row per product.
      `SELECT p.id, p.name, p.slug, p.base_price, p.compare_price, p.category, p.status, p.is_customizable, p.stock_count,
              ps.image_url AS front_image,
              EXISTS (
                SELECT 1 FROM product_sides s
                WHERE s.product_id = p.id AND s.customizable = 1 AND s.print_w > 0 AND s.print_h > 0
              ) AS has_print_area
       FROM products p
       LEFT JOIN product_sides ps ON ps.product_id = p.id AND ps.side = 'front'
       ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all()

    return c.json({ products: results, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Admin products list error:', err)
    return c.json({ error: 'Failed to load products' }, 500)
  }
})

// ── Create ────────────────────────────────────────────────────
adminProducts.post('/', async (c) => {
  const body = await c.req.json<{
    name?: string
    slug?: string
    description?: string
    base_price?: number
    compare_price?: number | null
    category?: string
    status?: string
    is_customizable?: boolean | number
    stock_count?: number
    axis1_label?: string
    axis2_label?: string
    min_order_qty?: number
    highlights?: string
    seo_title?: string
    seo_description?: string
  }>()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ error: 'name is required' }, 400)
  }
  if (!isFiniteNumber(body.base_price) || body.base_price < 0) {
    return c.json({ error: 'base_price is required and must be a non-negative number' }, 400)
  }
  if (body.min_order_qty !== undefined && (!Number.isInteger(body.min_order_qty) || body.min_order_qty < 1)) {
    return c.json({ error: 'min_order_qty must be an integer >= 1' }, 400)
  }
  const highlightsResult = normalizeHighlights(body.highlights)
  if ('error' in highlightsResult) return c.json({ error: highlightsResult.error }, 400)
  const status = (VALID_STATUSES as readonly string[]).includes(body.status ?? 'active') ? (body.status ?? 'active') : 'active'
  const slugBase = body.slug && body.slug.trim() ? slugify(body.slug) : slugify(body.name)
  const slug = await uniqueSlug(c.env.DB, slugBase)
  const axis1Label = normalizeAxisLabel(body.axis1_label, 'Size')
  const axis2Label = normalizeAxisLabel(body.axis2_label, 'Colour')

  const result = await c.env.DB.prepare(
    `INSERT INTO products
       (name, slug, description, base_price, compare_price, category, status, is_customizable, stock_count, axis1_label, axis2_label, min_order_qty, highlights, seo_title, seo_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.name.trim(),
    slug,
    body.description ?? '',
    body.base_price,
    body.compare_price ?? null,
    body.category ?? '',
    status,
    body.is_customizable ? 1 : 0,
    body.stock_count ?? 0,
    axis1Label,
    axis2Label,
    body.min_order_qty ?? 1,
    highlightsResult.value,
    body.seo_title ?? '',
    body.seo_description ?? ''
  ).run()

  return c.json({ id: result.meta.last_row_id, slug }, 201)
})

// ── Detail ────────────────────────────────────────────────────
adminProducts.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Not found' }, 404)

  const { results: sides } = await c.env.DB.prepare(
    'SELECT * FROM product_sides WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all()
  const { results: sizes } = await c.env.DB.prepare(
    'SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all()
  const { results: variants } = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all()
  const { results: price_breaks } = await c.env.DB.prepare(
    'SELECT * FROM product_price_breaks WHERE product_id = ? ORDER BY min_qty ASC'
  ).bind(id).all()

  return c.json({ ...product, sides, sizes, variants, price_breaks })
})

// ── Update basics (partial) ─────────────────────────────────────
adminProducts.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const existing = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<Record<string, unknown>>()
  const allowedFields = [
    'name', 'slug', 'description', 'base_price', 'compare_price',
    'category', 'status', 'is_customizable', 'stock_count',
    'axis1_label', 'axis2_label', 'min_order_qty', 'highlights',
    'seo_title', 'seo_description',
  ]

  const entries: [string, unknown][] = []
  for (const [k, v] of Object.entries(body)) {
    if (!allowedFields.includes(k)) continue
    if (k === 'status') {
      if (!(VALID_STATUSES as readonly string[]).includes(v as string)) {
        return c.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400)
      }
      entries.push([k, v])
    } else if (k === 'base_price') {
      if (!isFiniteNumber(v) || v < 0) return c.json({ error: 'base_price must be a non-negative number' }, 400)
      entries.push([k, v])
    } else if (k === 'compare_price') {
      if (v !== null && (!isFiniteNumber(v) || v < 0)) return c.json({ error: 'compare_price must be a non-negative number or null' }, 400)
      entries.push([k, v])
    } else if (k === 'is_customizable') {
      entries.push([k, v ? 1 : 0])
    } else if (k === 'stock_count') {
      if (!isFiniteNumber(v) || v < 0) return c.json({ error: 'stock_count must be a non-negative number' }, 400)
      entries.push([k, v])
    } else if (k === 'slug') {
      const raw = typeof v === 'string' ? v.trim() : ''
      if (!raw) continue // blank slug in the payload — leave the existing one alone
      const deduped = await uniqueSlug(c.env.DB, slugify(raw), id)
      entries.push([k, deduped])
    } else if (k === 'name') {
      if (typeof v !== 'string' || !v.trim()) return c.json({ error: 'name cannot be empty' }, 400)
      entries.push([k, v.trim()])
    } else if (k === 'axis1_label') {
      entries.push([k, normalizeAxisLabel(v, 'Size')])
    } else if (k === 'axis2_label') {
      entries.push([k, normalizeAxisLabel(v, 'Colour')])
    } else if (k === 'min_order_qty') {
      if (!Number.isInteger(v) || (v as number) < 1) return c.json({ error: 'min_order_qty must be an integer >= 1' }, 400)
      entries.push([k, v])
    } else if (k === 'highlights') {
      const result = normalizeHighlights(v)
      if ('error' in result) return c.json({ error: result.error }, 400)
      entries.push([k, result.value])
    } else {
      entries.push([k, v])
    }
  }

  if (entries.length === 0) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  await c.env.DB.prepare(`UPDATE products SET ${fields} WHERE id = ?`).bind(...values, id).run()
  return c.json({ ok: true })
})

// ── Delete ────────────────────────────────────────────────────
adminProducts.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  // D1/SQLite does not enforce FK cascades by default — delete children
  // explicitly. product_side_images has no product_id column of its own
  // (POD-V2.md §3.2 — it keys off side_id/variant_id), so it's cleared via
  // a subquery on product_sides, run before that table is itself cleared.
  await c.env.DB.batch([
    c.env.DB.prepare(
      'DELETE FROM product_side_images WHERE side_id IN (SELECT id FROM product_sides WHERE product_id = ?)'
    ).bind(id),
    c.env.DB.prepare('DELETE FROM product_sides WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM product_sizes WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM product_price_breaks WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id),
  ])
  return c.json({ ok: true })
})

// ── Sides ─────────────────────────────────────────────────────
adminProducts.put('/:id/sides/:side', async (c) => {
  const id = Number(c.req.param('id'))
  const side = c.req.param('side')
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  if (!(VALID_SIDES as readonly string[]).includes(side)) {
    return c.json({ error: `side must be one of: ${VALID_SIDES.join(', ')}` }, 400)
  }

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const body = await c.req.json<{
    label?: string
    image_url?: string
    image_w?: number
    image_h?: number
    customizable?: boolean | number
    print_x?: number
    print_y?: number
    print_w?: number
    print_h?: number
    print_width_in?: number
    print_fee?: number
    sort_order?: number
  }>()

  if (!body.image_url || typeof body.image_url !== 'string') {
    return c.json({ error: 'image_url is required' }, 400)
  }
  if (!Number.isInteger(body.image_w) || (body.image_w as number) <= 0) {
    return c.json({ error: 'image_w must be a positive integer' }, 400)
  }
  if (!Number.isInteger(body.image_h) || (body.image_h as number) <= 0) {
    return c.json({ error: 'image_h must be a positive integer' }, 400)
  }

  const printX = body.print_x ?? 0
  const printY = body.print_y ?? 0
  const printW = body.print_w ?? 0
  const printH = body.print_h ?? 0
  const rectError = validatePrintRect(printX, printY, printW, printH)
  if (rectError) return c.json({ error: rectError }, 400)

  const printWidthIn = body.print_width_in ?? 12
  if (!isFiniteNumber(printWidthIn) || printWidthIn <= 0) {
    return c.json({ error: 'print_width_in must be a positive number' }, 400)
  }

  const printFee = body.print_fee ?? 0
  if (!isFiniteNumber(printFee) || printFee < 0) {
    return c.json({ error: 'print_fee must be a non-negative number' }, 400)
  }

  const sortOrder = Number.isInteger(body.sort_order) ? (body.sort_order as number) : (side === 'front' ? 0 : 1)
  const customizable = body.customizable === undefined ? 1 : (body.customizable ? 1 : 0)
  // POD-V2.md §8 — '' means "fall back to the side name"; never store
  // anything but a trimmed string so the storefront's fallback check
  // (`label || side`) behaves predictably.
  const label = typeof body.label === 'string' ? body.label.trim() : ''

  await c.env.DB.prepare(
    `INSERT INTO product_sides
       (product_id, side, label, image_url, image_w, image_h, customizable, print_x, print_y, print_w, print_h, print_width_in, print_fee, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (product_id, side) DO UPDATE SET
       label = excluded.label,
       image_url = excluded.image_url,
       image_w = excluded.image_w,
       image_h = excluded.image_h,
       customizable = excluded.customizable,
       print_x = excluded.print_x,
       print_y = excluded.print_y,
       print_w = excluded.print_w,
       print_h = excluded.print_h,
       print_width_in = excluded.print_width_in,
       print_fee = excluded.print_fee,
       sort_order = excluded.sort_order`
  ).bind(
    id, side, label, body.image_url, body.image_w, body.image_h, customizable,
    printX, printY, printW, printH, printWidthIn, printFee, sortOrder
  ).run()

  const savedSide = await c.env.DB.prepare(
    'SELECT * FROM product_sides WHERE product_id = ? AND side = ?'
  ).bind(id, side).first()

  return c.json(savedSide)
})

adminProducts.delete('/:id/sides/:side', async (c) => {
  const id = Number(c.req.param('id'))
  const side = c.req.param('side')
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  if (!(VALID_SIDES as readonly string[]).includes(side)) {
    return c.json({ error: `side must be one of: ${VALID_SIDES.join(', ')}` }, 400)
  }
  await c.env.DB.prepare('DELETE FROM product_sides WHERE product_id = ? AND side = ?').bind(id, side).run()
  return c.json({ ok: true })
})

// ── Sizes (bulk replace) ─────────────────────────────────────────
adminProducts.put('/:id/sizes', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const body = await c.req.json<{ sizes?: Array<{ label?: string; price_delta?: number; stock_count?: number }> }>()
  const sizes = Array.isArray(body.sizes) ? body.sizes : null
  if (!sizes) return c.json({ error: 'sizes array is required' }, 400)

  const seen = new Set<string>()
  const clean: Array<{ label: string; price_delta: number; stock_count: number }> = []
  for (const s of sizes) {
    const label = typeof s.label === 'string' ? s.label.trim() : ''
    if (!label) return c.json({ error: 'Every size must have a non-empty label' }, 400)
    const key = label.toLowerCase()
    if (seen.has(key)) return c.json({ error: `Duplicate size label: ${label}` }, 400)
    seen.add(key)
    const priceDelta = s.price_delta ?? 0
    if (!isFiniteNumber(priceDelta)) return c.json({ error: `price_delta for "${label}" must be a number` }, 400)
    const stockCount = s.stock_count ?? 0
    if (!isFiniteNumber(stockCount) || stockCount < 0) return c.json({ error: `stock_count for "${label}" must be a non-negative number` }, 400)
    clean.push({ label, price_delta: priceDelta, stock_count: stockCount })
  }

  const stmts = [
    c.env.DB.prepare('DELETE FROM product_sizes WHERE product_id = ?').bind(id),
    ...clean.map((s, i) =>
      c.env.DB.prepare(
        'INSERT INTO product_sizes (product_id, label, price_delta, stock_count, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, s.label, s.price_delta, s.stock_count, i)
    ),
  ]
  await c.env.DB.batch(stmts)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all()

  return c.json({ sizes: results })
})

// ── Variants / axis 2 (bulk replace) ──────────────────────────────
// POD-V2.md §3.1, §11 Phase 1.7 — same validate-then-DELETE-then-re-INSERT
// shape as /:id/sizes above, so an admin "Save" always leaves exactly the
// rows just submitted (unticking the axis-2 checkbox in the admin form
// sends an empty array here rather than skipping the call, which is how
// "unticking hides but never deletes" (§11 1.3) stays true for sizes but
// is a deliberate, explicit clear for variants/price breaks — there is no
// separate "hidden" flag on either table).
adminProducts.put('/:id/variants', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const body = await c.req.json<{
    variants?: Array<{ label?: string; swatch_hex?: string | null; sort_order?: number }>
  }>()
  const variants = Array.isArray(body.variants) ? body.variants : null
  if (!variants) return c.json({ error: 'variants array is required' }, 400)

  const validated = validateVariantsPayload(variants)
  if ('error' in validated) return c.json({ error: validated.error }, 400)
  const { clean } = validated

  const stmts = [
    c.env.DB.prepare('DELETE FROM product_variants WHERE product_id = ?').bind(id),
    ...clean.map((v) =>
      c.env.DB.prepare(
        'INSERT INTO product_variants (product_id, label, swatch_hex, sort_order) VALUES (?, ?, ?, ?)'
      ).bind(id, v.label, v.swatch_hex, v.sort_order)
    ),
  ]
  await c.env.DB.batch(stmts)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all()

  return c.json({ variants: results })
})

// ── Bulk price breaks (bulk replace) ──────────────────────────────
// POD-V2.md §5, §11 Phase 1.7. Same full-replace shape as sizes/variants.
// Pricing itself (resolving a tier against a real order) is Phase 3 —
// this only stores and validates the tiers.
adminProducts.put('/:id/price_breaks', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const body = await c.req.json<{
    price_breaks?: Array<{ min_qty?: number; unit_price?: number }>
  }>()
  const priceBreaks = Array.isArray(body.price_breaks) ? body.price_breaks : null
  if (!priceBreaks) return c.json({ error: 'price_breaks array is required' }, 400)

  const validated = validatePriceBreaksPayload(priceBreaks)
  if ('error' in validated) return c.json({ error: validated.error }, 400)
  const { clean } = validated

  const stmts = [
    c.env.DB.prepare('DELETE FROM product_price_breaks WHERE product_id = ?').bind(id),
    ...clean.map((p) =>
      c.env.DB.prepare(
        'INSERT INTO product_price_breaks (product_id, min_qty, unit_price) VALUES (?, ?, ?)'
      ).bind(id, p.min_qty, p.unit_price)
    ),
  ]
  await c.env.DB.batch(stmts)

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_price_breaks WHERE product_id = ? ORDER BY min_qty ASC'
  ).bind(id).all()

  return c.json({ price_breaks: results })
})

export default adminProducts
