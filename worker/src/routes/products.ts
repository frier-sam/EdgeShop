import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product, ProductVariant, ProductImage } from '../types'

const products = new Hono<{ Bindings: Env }>()

products.get('/', async (c) => {
  const rawPage = Number(c.req.query('page') ?? 1)
  const rawLimit = Number(c.req.query('limit') ?? 12)
  const page = isNaN(rawPage) ? 1 : Math.max(1, Math.floor(rawPage))
  const limit = isNaN(rawLimit) ? 12 : Math.min(48, Math.max(1, Math.floor(rawLimit)))
  const offset = (page - 1) * limit

  const category = (c.req.query('category') ?? '').trim()
  const excludeId = Number(c.req.query('exclude') ?? 0)

  // Build WHERE clause
  let where = "WHERE p.status = 'active'"
  const params: (string | number)[] = []
  if (category) { where += ' AND p.category = ?'; params.push(category) }
  if (excludeId) { where += ' AND p.id != ?'; params.push(excludeId) }

  try {
    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM products p ${where}`
    ).bind(...params).first<{ total: number }>()
    const total = countRow?.total ?? 0

    const { results } = await c.env.DB.prepare(
      `SELECT p.*,
        COALESCE(
          (SELECT json_group_array(url) FROM product_images WHERE product_id = p.id ORDER BY sort_order),
          '[]'
        ) AS images_json
       FROM products p ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all<Product & { images_json: string }>()

    const products = results.map(({ images_json, ...p }) => ({
      ...p,
      images: (() => { try { return JSON.parse(images_json) as string[] } catch { return [] } })(),
    }))

    return c.json({ products, total, page, limit, pages: limit > 0 ? Math.ceil(total / limit) : 0 })
  } catch (err) {
    console.error('Products list error:', err)
    return c.json({ error: 'Failed to load products' }, 500)
  }
})

products.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const product = await c.env.DB.prepare(
    "SELECT * FROM products WHERE id = ? AND status = 'active'"
  ).bind(id).first<Product>()
  if (!product) return c.json({ error: 'Not found' }, 404)

  const { results: variants } = await c.env.DB.prepare(
    'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC'
  ).bind(id).all<ProductVariant>()

  const { results: images } = await c.env.DB.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(id).all<ProductImage>()

  return c.json({ ...product, variants, images })
})

export default products
