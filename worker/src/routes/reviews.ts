import { Hono } from 'hono'
import type { Env } from '../index'
import type { Review } from '../types'

const reviews = new Hono<{ Bindings: Env }>()

// GET /api/products/:id/reviews — get approved reviews for a product
reviews.get('/:id/reviews', async (c) => {
  const productId = Number(c.req.param('id'))
  if (isNaN(productId)) return c.json({ error: 'Invalid product id' }, 400)

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, product_id, customer_name, rating, body, created_at FROM reviews WHERE product_id = ? AND is_approved = 1 ORDER BY created_at DESC'
    ).bind(productId).all<Omit<Review, 'is_approved'>>()
    return c.json({ reviews: results })
  } catch (err) {
    console.error('Reviews fetch error:', err)
    return c.json({ reviews: [] })
  }
})

// POST /api/products/:id/reviews — submit a new review (pending moderation)
reviews.post('/:id/reviews', async (c) => {
  const productId = Number(c.req.param('id'))
  if (isNaN(productId)) return c.json({ error: 'Invalid product id' }, 400)

  let body: { customer_name: string; rating: number; body: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { customer_name, rating, body: reviewBody } = body

  if (typeof customer_name !== 'string' || !customer_name.trim()) {
    return c.json({ error: 'customer_name is required' }, 400)
  }
  if (customer_name.trim().length > 100) {
    return c.json({ error: 'customer_name must be 100 characters or fewer' }, 400)
  }
  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return c.json({ error: 'rating must be an integer between 1 and 5' }, 400)
  }
  if (typeof reviewBody !== 'string' || !reviewBody.trim()) {
    return c.json({ error: 'body is required' }, 400)
  }
  if (reviewBody.trim().length > 2000) {
    return c.json({ error: 'body must be 2000 characters or fewer' }, 400)
  }

  // Verify product exists
  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  await c.env.DB.prepare(
    'INSERT INTO reviews (product_id, customer_name, rating, body, is_approved) VALUES (?, ?, ?, ?, 0)'
  ).bind(productId, customer_name.trim(), rating, reviewBody.trim()).run()

  return c.json({ message: 'Review submitted and pending moderation' }, 201)
})

export default reviews
