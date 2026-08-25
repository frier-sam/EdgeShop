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
      `SELECT p.id, p.name, p.slug, p.base_price, p.compare_price, p.category, p.status, p.is_customizable, p.stock_count,
              ps.image_url AS front_image
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
    seo_title?: string
    seo_description?: string
  }>()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ error: 'name is required' }, 400)
  }
  if (!isFiniteNumber(body.base_price) || body.base_price < 0) {
    return c.json({ error: 'base_price is required and must be a non-negative number' }, 400)
  }
  const status = (VALID_STATUSES as readonly string[]).includes(body.status ?? 'active') ? (body.status ?? 'active') : 'active'
  const slugBase = body.slug && body.slug.trim() ? slugify(body.slug) : slugify(body.name)
  const slug = await uniqueSlug(c.env.DB, slugBase)

  const result = await c.env.DB.prepare(
    `INSERT INTO products
       (name, slug, description, base_price, compare_price, category, status, is_customizable, stock_count, seo_title, seo_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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

  return c.json({ ...product, sides, sizes })
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
  // D1/SQLite does not enforce FK cascades by default — delete children explicitly.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM product_sides WHERE product_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM product_sizes WHERE product_id = ?').bind(id),
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

  await c.env.DB.prepare(
    `INSERT INTO product_sides
       (product_id, side, image_url, image_w, image_h, customizable, print_x, print_y, print_w, print_h, print_width_in, print_fee, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (product_id, side) DO UPDATE SET
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
    id, side, body.image_url, body.image_w, body.image_h, customizable,
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

export default adminProducts
