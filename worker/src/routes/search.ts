import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product } from '../types'

const search = new Hono<{ Bindings: Env }>()

search.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length > 200) return c.json({ error: 'Query too long' }, 400)
  const collection = c.req.query('collection') ?? ''
  const minPrice = Math.max(0, Number(c.req.query('min_price') ?? 0))
  const rawMax = Number(c.req.query('max_price') ?? 999999)
  const maxPrice = Number.isFinite(rawMax) && rawMax >= 0 ? rawMax : 999999
  const sortBy = c.req.query('sort') ?? 'newest' // newest | price_asc | price_desc

  const rawPage = Number(c.req.query('page') ?? 1)
  const rawLimit = Number(c.req.query('limit') ?? 12)
  const page = isNaN(rawPage) ? 1 : Math.max(1, rawPage)
  const limit = isNaN(rawLimit) ? 12 : Math.min(48, Math.max(1, rawLimit))
  const offset = (page - 1) * limit

  const orderMap: Record<string, string> = {
    newest: 'p.created_at DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
  }
  const orderClause = orderMap[sortBy] ?? 'p.created_at DESC'

  let products: Product[]
  let total = 0

  if (q) {
    // FTS5 full-text search — use wildcard suffix match for partial queries
    const sanitiseToken = (w: string) => w.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '').trim()
    const tokens = q.split(/\s+/).map(sanitiseToken).filter(Boolean)
    if (!tokens.length) {
      // No valid tokens after sanitisation, fall through to browse mode
      return c.json({ products: [], total: 0, page, limit, pages: 0, query: q })
    }
    const ftsQuery = tokens.map(w => `${w}*`).join(' ')

    // Build the shared WHERE fragment and params (used for both COUNT and SELECT)
    let whereClause = `
      JOIN products_fts ON products_fts.rowid = p.id
      WHERE products_fts MATCH ?
        AND p.status = 'active'
        AND p.price BETWEEN ? AND ?
    `
    const whereParams: (string | number)[] = [ftsQuery, minPrice, maxPrice]

    if (collection) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM product_collections pc
        JOIN collections col ON col.id = pc.collection_id
        WHERE pc.product_id = p.id AND col.slug = ?
      )`
      whereParams.push(collection)
    }

    try {
      // COUNT query — same WHERE, no LIMIT/OFFSET
      const countSql = `SELECT COUNT(*) as total FROM products p ${whereClause}`
      const countRow = await c.env.DB.prepare(countSql).bind(...whereParams).first<{ total: number }>()
      total = countRow?.total ?? 0

      // Note: sortBy is intentionally ignored in FTS mode; results are ordered by relevance (rank)
      const selectSql = `SELECT p.* FROM products p ${whereClause} ORDER BY rank LIMIT ? OFFSET ?`
      const { results } = await c.env.DB.prepare(selectSql).bind(...whereParams, limit, offset).all<Product>()
      products = results
    } catch (err) {
      // FTS parse error — return empty results rather than 500
      console.error('FTS search error:', err)
      products = []
      total = 0
    }
  } else {
    // Browse mode — filter + sort without FTS
    let joinClause = ''
    let whereClause = ` WHERE p.status = 'active' AND p.price BETWEEN ? AND ?`
    const whereParams: (string | number)[] = [minPrice, maxPrice]

    if (collection) {
      joinClause = `
        JOIN product_collections pc ON pc.product_id = p.id
        JOIN collections col ON col.id = pc.collection_id`
      whereClause += ` AND col.slug = ?`
      whereParams.push(collection)
    }

    // COUNT query — same WHERE, no LIMIT/OFFSET
    const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM products p ${joinClause} ${whereClause}`
    const countRow = await c.env.DB.prepare(countSql).bind(...whereParams).first<{ total: number }>()
    total = countRow?.total ?? 0

    const selectSql = `SELECT DISTINCT p.* FROM products p ${joinClause} ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
    const { results } = await c.env.DB.prepare(selectSql).bind(...whereParams, limit, offset).all<Product>()
    products = results
  }

  return c.json({ products, total, page, limit, pages: Math.ceil(total / limit), query: q })
})

export default search
