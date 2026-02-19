import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Review } from '../../types'

const adminReviews = new Hono<{ Bindings: Env }>()

// GET / — list all pending (unapproved) reviews
adminReviews.get('/', async (c) => {
  const status = c.req.query('status') ?? 'pending'
  const isApproved = status === 'approved' ? 1 : 0
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM reviews WHERE is_approved = ? ORDER BY created_at DESC'
  ).bind(isApproved).all<Review>()
  return c.json({ reviews: results })
})

// PATCH /:id — approve or reject
adminReviews.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  let body: { is_approved: boolean }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body.is_approved !== 'boolean') {
    return c.json({ error: 'is_approved must be a boolean' }, 400)
  }

  const result = await c.env.DB.prepare(
    'UPDATE reviews SET is_approved = ? WHERE id = ?'
  ).bind(body.is_approved ? 1 : 0, id).run()

  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

// DELETE /:id — delete a review
adminReviews.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  const result = await c.env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

export default adminReviews
