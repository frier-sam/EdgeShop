import { Hono } from 'hono'
import type { Env } from '../index'
import type { Page } from '../types'

const pages = new Hono<{ Bindings: Env }>()

pages.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const page = await c.env.DB.prepare(
    'SELECT * FROM pages WHERE slug = ? AND is_visible = 1'
  ).bind(slug).first<Page>()
  if (!page) return c.json({ error: 'Not found' }, 404)
  return c.json(page)
})

export default pages
