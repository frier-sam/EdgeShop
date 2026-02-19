import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product, ProductVariant, ProductImage } from '../types'

const products = new Hono<{ Bindings: Env }>()

products.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM products WHERE status = 'active' ORDER BY created_at DESC"
  ).all<Product>()
  return c.json({ products: results })
})

products.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const product = await c.env.DB.prepare(
    'SELECT * FROM products WHERE id = ?'
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
