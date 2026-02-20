import { Hono } from 'hono'
import type { Env } from '../../index'
import type { Collection } from '../../types'

interface CollectionRow extends Collection {
  depth: number
}

const adminCollections = new Hono<{ Bindings: Env }>()

// List all collections as a tree (recursive CTE returns flat array with depth)
adminCollections.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    WITH RECURSIVE tree AS (
      SELECT *, 0 AS depth,
             CAST(sort_order AS TEXT) || '__' || name AS sort_path
      FROM collections WHERE parent_id IS NULL
      UNION ALL
      SELECT col.*, tree.depth + 1,
             tree.sort_path || '/' || CAST(col.sort_order AS TEXT) || '__' || col.name
      FROM collections col
      JOIN tree ON col.parent_id = tree.id
    )
    SELECT * FROM tree ORDER BY sort_path ASC
  `).all<CollectionRow>()
  return c.json({ collections: results })
})

// Create a collection
adminCollections.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    slug: string
    description?: string
    image_url?: string
    sort_order?: number
    seo_title?: string
    seo_description?: string
    parent_id?: number | null
  }>()
  if (!body.name || !body.slug) return c.json({ error: 'name and slug are required' }, 400)
  const result = await c.env.DB.prepare(`
    INSERT INTO collections (name, slug, description, image_url, sort_order, seo_title, seo_description, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name, body.slug,
    body.description ?? '', body.image_url ?? '',
    body.sort_order ?? 0,
    body.seo_title ?? '', body.seo_description ?? '',
    body.parent_id ?? null
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// Update a collection
adminCollections.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['name', 'slug', 'description', 'image_url', 'sort_order', 'seo_title', 'seo_description', 'parent_id']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  // Guard: prevent self-reference
  const parentEntry = entries.find(([k]) => k === 'parent_id')
  if (parentEntry && Number(parentEntry[1]) === id) {
    return c.json({ error: 'A collection cannot be its own parent' }, 400)
  }
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const result = await c.env.DB.prepare(`UPDATE collections SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Collection not found' }, 404)
  return c.json({ ok: true })
})

// Delete a collection
adminCollections.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const result = await c.env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Collection not found' }, 404)
  return c.json({ ok: true })
})

// Assign products to collection
adminCollections.put('/:id/products', async (c) => {
  const collectionId = Number(c.req.param('id'))
  if (isNaN(collectionId)) return c.json({ error: 'Invalid id' }, 400)
  const { product_ids } = await c.req.json<{ product_ids: number[] }>()
  if (!Array.isArray(product_ids)) return c.json({ error: 'product_ids array is required' }, 400)
  await c.env.DB.prepare('DELETE FROM product_collections WHERE collection_id = ?')
    .bind(collectionId).run()
  if (product_ids.length > 0) {
    const stmts = product_ids.map(pid =>
      c.env.DB.prepare('INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)')
        .bind(pid, collectionId)
    )
    await c.env.DB.batch(stmts)
  }
  return c.json({ ok: true })
})

export default adminCollections
