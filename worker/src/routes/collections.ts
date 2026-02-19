import { Hono } from 'hono'
import type { Env } from '../index'
import type { Collection, Product } from '../types'

const collections = new Hono<{ Bindings: Env }>()

// List all collections
collections.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM collections ORDER BY sort_order ASC, name ASC'
  ).all<Collection>()
  return c.json({ collections: results })
})

// Get a collection with its products
collections.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const collection = await c.env.DB.prepare(
    'SELECT * FROM collections WHERE slug = ?'
  ).bind(slug).first<Collection>()
  if (!collection) return c.json({ error: 'Not found' }, 404)

  const { results: products } = await c.env.DB.prepare(`
    SELECT p.* FROM products p
    JOIN product_collections pc ON pc.product_id = p.id
    WHERE pc.collection_id = ? AND p.status = 'active'
    ORDER BY p.created_at DESC
  `).bind(collection.id).all<Product>()

  return c.json({ collection, products })
})

export default collections
