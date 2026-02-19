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
    image_url?: string
    stock_count?: number
    category?: string
  }>()
  if (!body.name || body.price == null) {
    return c.json({ error: 'name and price are required' }, 400)
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO products (name, description, price, image_url, stock_count, category)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    body.name,
    body.description ?? '',
    body.price,
    body.image_url ?? '',
    body.stock_count ?? 0,
    body.category ?? ''
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

adminProducts.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<Partial<{
    name: string
    description: string
    price: number
    image_url: string
    stock_count: number
    category: string
  }>>()
  const allowedFields = ['name', 'description', 'price', 'image_url', 'stock_count', 'category']
  const entries = Object.entries(body).filter(([k]) => allowedFields.includes(k))
  if (entries.length === 0) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  await c.env.DB.prepare(`UPDATE products SET ${fields} WHERE id = ?`)
    .bind(...values, id)
    .run()
  return c.json({ ok: true })
})

adminProducts.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default adminProducts
