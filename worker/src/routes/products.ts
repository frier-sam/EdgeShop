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

  try {
    const countRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM products WHERE status = ?'
    ).bind('active').first<{ total: number }>()
    const total = countRow?.total ?? 0

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM products WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind('active', limit, offset).all<Product>()

    return c.json({ products: results, total, page, limit, pages: limit > 0 ? Math.ceil(total / limit) : 0 })
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
