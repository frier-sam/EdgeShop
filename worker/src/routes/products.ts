import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product, ProductSide, ProductSize } from '../types'

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
      `SELECT
         p.id, p.name, p.slug, p.base_price, p.compare_price, p.category, p.is_customizable,
         ps.image_url AS front_image
       FROM products p
       LEFT JOIN product_sides ps ON ps.product_id = p.id AND ps.side = 'front'
       ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all<Product>()

    return c.json({ products: results, total, page, limit, pages: limit > 0 ? Math.ceil(total / limit) : 0 })
  } catch (err) {
    console.error('Products list error:', err)
    return c.json({ error: 'Failed to load products' }, 500)
  }
})

products.get('/:id', async (c) => {
  const idParam = c.req.param('id')
  const numericId = Number(idParam)
  const isNumeric = !isNaN(numericId) && /^\d+$/.test(idParam)

  try {
    const product = isNumeric
      ? await c.env.DB.prepare(
          "SELECT * FROM products WHERE id = ? AND status = 'active'"
        ).bind(numericId).first<Product>()
      : await c.env.DB.prepare(
          "SELECT * FROM products WHERE slug = ? AND status = 'active'"
        ).bind(idParam).first<Product>()

    if (!product) return c.json({ error: 'Not found' }, 404)

    const { results: sides } = await c.env.DB.prepare(
      'SELECT * FROM product_sides WHERE product_id = ? ORDER BY sort_order ASC'
    ).bind(product.id).all<ProductSide>()

    const { results: sizes } = await c.env.DB.prepare(
      'SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC'
    ).bind(product.id).all<ProductSize>()

    return c.json({ ...product, sides, sizes })
  } catch (err) {
    console.error('Product detail error:', err)
    return c.json({ error: 'Failed to load product' }, 500)
  }
})

export default products
