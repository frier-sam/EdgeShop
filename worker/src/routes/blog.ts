import { Hono } from 'hono'
import type { Env } from '../index'
import type { BlogPost } from '../types'

const blog = new Hono<{ Bindings: Env }>()

// GET /api/blog — list published posts (published_at IS NOT NULL AND published_at <= now())
blog.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, slug, title, cover_image, author, tags, published_at, seo_title, seo_description, created_at FROM blog_posts WHERE published_at IS NOT NULL AND published_at <= datetime('now') ORDER BY published_at DESC"
  ).all<Omit<BlogPost, 'content_html'>>()
  return c.json({ posts: results })
})

// GET /api/blog/:slug — get a single published post by slug
blog.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const post = await c.env.DB.prepare(
    "SELECT * FROM blog_posts WHERE slug = ? AND published_at IS NOT NULL AND published_at <= datetime('now')"
  ).bind(slug).first<BlogPost>()
  if (!post) return c.json({ error: 'Not found' }, 404)
  return c.json(post)
})

export default blog
