import { Hono } from 'hono'
import type { Env } from '../../index'
import type { BlogPost } from '../../types'

const adminBlog = new Hono<{ Bindings: Env }>()

// GET / — list all posts (including drafts)
adminBlog.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, slug, title, author, published_at, created_at FROM blog_posts ORDER BY created_at DESC'
  ).all<Pick<BlogPost, 'id' | 'slug' | 'title' | 'author' | 'published_at' | 'created_at'>>()
  return c.json({ posts: results })
})

// GET /:id — get full post for editing
adminBlog.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const post = await c.env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogPost>()
  if (!post) return c.json({ error: 'Not found' }, 404)
  return c.json(post)
})

// POST / — create a new post
adminBlog.post('/', async (c) => {
  let body: {
    slug: string; title: string; content_html: string;
    cover_image?: string; author?: string; tags?: string;
    published_at?: string | null; seo_title?: string; seo_description?: string
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body.slug !== 'string' || !body.slug.trim()) return c.json({ error: 'slug is required' }, 400)
  if (typeof body.title !== 'string' || !body.title.trim()) return c.json({ error: 'title is required' }, 400)
  if (typeof body.content_html !== 'string') return c.json({ error: 'content_html is required' }, 400)

  // Validate slug format: only lowercase letters, numbers, hyphens
  if (!/^[a-z0-9-]+$/.test(body.slug.trim())) {
    return c.json({ error: 'slug must contain only lowercase letters, numbers, and hyphens' }, 400)
  }

  // Validate published_at if provided
  if (body.published_at !== undefined && body.published_at !== null) {
    if (typeof body.published_at !== 'string' || isNaN(new Date(body.published_at).getTime())) {
      return c.json({ error: 'published_at must be a valid date string or null' }, 400)
    }
  }

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO blog_posts (slug, title, content_html, cover_image, author, tags, published_at, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.slug.trim(),
      body.title.trim(),
      body.content_html,
      body.cover_image ?? '',
      body.author ?? '',
      body.tags ?? '',
      body.published_at ?? null,
      body.seo_title ?? '',
      body.seo_description ?? ''
    ).run()
    return c.json({ id: result.meta.last_row_id }, 201)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE constraint failed')) return c.json({ error: 'slug already exists' }, 409)
    throw err
  }
})

// PUT /:id — update a post
adminBlog.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const allowed = ['slug', 'title', 'content_html', 'cover_image', 'author', 'tags', 'published_at', 'seo_title', 'seo_description']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)

  // Validate specific fields
  for (const [k, v] of entries) {
    if (k === 'slug') {
      if (typeof v !== 'string' || !v.trim()) return c.json({ error: 'slug must be a non-empty string' }, 400)
      if (!/^[a-z0-9-]+$/.test(v.trim())) return c.json({ error: 'slug must contain only lowercase letters, numbers, and hyphens' }, 400)
    }
    if (k === 'title' && (typeof v !== 'string' || !(v as string).trim())) {
      return c.json({ error: 'title must be a non-empty string' }, 400)
    }
    if (k === 'published_at' && v !== null) {
      if (typeof v !== 'string' || isNaN(new Date(v as string).getTime())) {
        return c.json({ error: 'published_at must be a valid date string or null' }, 400)
      }
    }
  }

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)

  try {
    const result = await c.env.DB.prepare(
      `UPDATE blog_posts SET ${setClauses} WHERE id = ?`
    ).bind(...values, id).run()
    if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
    return c.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('UNIQUE constraint failed')) return c.json({ error: 'slug already exists' }, 409)
    throw err
  }
})

// DELETE /:id
adminBlog.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const result = await c.env.DB.prepare('DELETE FROM blog_posts WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

export default adminBlog
