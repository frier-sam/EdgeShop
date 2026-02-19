import { Hono } from 'hono'
import type { Env } from '../../index'

const gallery = new Hono<{ Bindings: Env }>()

// List all images for a product
gallery.get('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  if (isNaN(productId)) return c.json({ error: 'Invalid productId' }, 400)
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC'
  ).bind(productId).all<{ id: number; product_id: number; url: string; sort_order: number }>()
  return c.json({ images: results })
})

// Add an image to a product's gallery
gallery.post('/', async (c) => {
  const productId = Number(c.req.param('productId'))
  if (isNaN(productId)) return c.json({ error: 'Invalid productId' }, 400)
  const { url, sort_order } = await c.req.json<{ url: string; sort_order?: number }>()
  if (!url) return c.json({ error: 'url is required' }, 400)

  // Check product exists
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const result = await c.env.DB.prepare(
    'INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)'
  ).bind(productId, url, sort_order ?? 0).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// Delete an image from a product's gallery
gallery.delete('/:imageId', async (c) => {
  const productId = Number(c.req.param('productId'))
  const imageId = Number(c.req.param('imageId'))
  if (isNaN(productId) || isNaN(imageId)) return c.json({ error: 'Invalid id' }, 400)
  await c.env.DB.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?')
    .bind(imageId, productId).run()
  return c.json({ ok: true })
})

// Reorder images: PUT /reorder with body [{ id, sort_order }]
gallery.put('/reorder', async (c) => {
  const productId = Number(c.req.param('productId'))
  if (isNaN(productId)) return c.json({ error: 'Invalid productId' }, 400)
  const { order } = await c.req.json<{ order: Array<{ id: number; sort_order: number }> }>()
  if (!Array.isArray(order) || order.length === 0) return c.json({ error: 'order array is required' }, 400)
  const stmts = order.map(({ id, sort_order }) =>
    c.env.DB.prepare('UPDATE product_images SET sort_order = ? WHERE id = ? AND product_id = ?')
      .bind(sort_order, id, productId)
  )
  await c.env.DB.batch(stmts)
  return c.json({ ok: true })
})

export default gallery
