import { Hono } from 'hono'
import type { Env } from '../../index'

const adminProducts = new Hono<{ Bindings: Env }>()

adminProducts.get('/', async (c) => {
  const VALID_PRODUCT_STATUSES = ['active', 'draft', 'archived']
  const q = (c.req.query('q') ?? '').trim()
  const rawStatus = (c.req.query('status') ?? '').trim()
  const status = VALID_PRODUCT_STATUSES.includes(rawStatus) ? rawStatus : ''
  let sql = 'SELECT * FROM products WHERE 1=1'
  const params: (string | number)[] = []
  if (q) { sql += ' AND (name LIKE ? OR category LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  if (status) { sql += ' AND status = ?'; params.push(status) }
  sql += ' ORDER BY created_at DESC LIMIT 200'
  try {
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()
    return c.json({ products: results })
  } catch (err) {
    console.error('Admin products list error:', err)
    return c.json({ error: 'Failed to load products' }, 500)
  }
})

adminProducts.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    description?: string
    price: number
    compare_price?: number | null
    image_url?: string
    stock_count?: number
    category?: string
    tags?: string
    status?: string
    product_type?: string
    seo_title?: string
    seo_description?: string
  }>()
  if (!body.name || body.price == null) {
    return c.json({ error: 'name and price are required' }, 400)
  }
  const VALID_STATUSES = ['active', 'draft', 'archived']
  const VALID_TYPES = ['physical', 'digital']
  const result = await c.env.DB.prepare(
    `INSERT INTO products
       (name, description, price, compare_price, image_url, stock_count, category, tags, status, product_type, seo_title, seo_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    body.name,
    body.description ?? '',
    body.price,
    body.compare_price ?? null,
    body.image_url ?? '',
    body.stock_count ?? 0,
    body.category ?? '',
    body.tags ?? '',
    VALID_STATUSES.includes(body.status ?? '') ? body.status : 'active',
    VALID_TYPES.includes(body.product_type ?? '') ? body.product_type : 'physical',
    body.seo_title ?? '',
    body.seo_description ?? ''
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminProducts.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<Record<string, unknown>>()
  const allowedFields = [
    'name', 'description', 'price', 'compare_price', 'image_url',
    'stock_count', 'category', 'tags', 'status', 'product_type',
    'seo_title', 'seo_description',
  ]
  const VALID_STATUSES = ['active', 'draft', 'archived']
  const VALID_TYPES = ['physical', 'digital']
  const entries = Object.entries(body)
    .filter(([k]) => allowedFields.includes(k))
    .map(([k, v]) => {
      if (k === 'status' && !VALID_STATUSES.includes(v as string)) return [k, 'active'] as [string, unknown]
      if (k === 'product_type' && !VALID_TYPES.includes(v as string)) return [k, 'physical'] as [string, unknown]
      return [k, v] as [string, unknown]
    })
  if (entries.length === 0) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  await c.env.DB.prepare(`UPDATE products SET ${fields} WHERE id = ?`)
    .bind(...values, id)
    .run()
  return c.json({ ok: true })
})

// Get collections a product belongs to
adminProducts.get('/:id/collections', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const { results } = await c.env.DB.prepare(
    'SELECT collection_id FROM product_collections WHERE product_id = ?'
  ).bind(id).all<{ collection_id: number }>()
  return c.json({ collection_ids: results.map(r => r.collection_id) })
})

// Set collections a product belongs to (replaces all)
adminProducts.put('/:id/collections', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const { collection_ids } = await c.req.json<{ collection_ids: number[] }>()
  if (!Array.isArray(collection_ids)) return c.json({ error: 'collection_ids array required' }, 400)
  await c.env.DB.prepare('DELETE FROM product_collections WHERE product_id = ?').bind(id).run()
  if (collection_ids.length > 0) {
    const stmts = collection_ids.map(cid =>
      c.env.DB.prepare('INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)')
        .bind(id, cid)
    )
    await c.env.DB.batch(stmts)
  }
  return c.json({ ok: true })
})

adminProducts.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default adminProducts
