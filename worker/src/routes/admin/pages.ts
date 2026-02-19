import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Page } from '../../types'

const adminPages = new Hono<{ Bindings: Env }>()

// List all pages
adminPages.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, slug, title, meta_title, is_visible, created_at FROM pages ORDER BY slug ASC'
  ).all<Partial<Page>>()
  return c.json({ pages: results })
})

// Get single page for editing (includes content_html)
adminPages.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const page = await c.env.DB.prepare('SELECT * FROM pages WHERE id = ?').bind(id).first<Page>()
  if (!page) return c.json({ error: 'Not found' }, 404)
  return c.json(page)
})

// Create a page
adminPages.post('/', async (c) => {
  const body = await c.req.json<{
    slug: string; title: string; content_html?: string
    meta_title?: string; meta_description?: string; is_visible?: number
  }>()
  if (!body.slug || !body.title) return c.json({ error: 'slug and title are required' }, 400)
  const result = await c.env.DB.prepare(`
    INSERT INTO pages (slug, title, content_html, meta_title, meta_description, is_visible)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    body.slug, body.title,
    body.content_html ?? '', body.meta_title ?? '', body.meta_description ?? '',
    body.is_visible ?? 1
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// Update a page
adminPages.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['slug', 'title', 'content_html', 'meta_title', 'meta_description', 'is_visible']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const result = await c.env.DB.prepare(`UPDATE pages SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Page not found' }, 404)
  return c.json({ ok: true })
})

// Delete a page
adminPages.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const result = await c.env.DB.prepare('DELETE FROM pages WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Page not found' }, 404)
  return c.json({ ok: true })
})

export default adminPages
