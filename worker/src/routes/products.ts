import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product } from '../types'

const products = new Hono<{ Bindings: Env }>()

products.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM products ORDER BY created_at DESC'
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
  return c.json(product)
})

export default products
