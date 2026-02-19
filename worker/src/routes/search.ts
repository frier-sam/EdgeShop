import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product } from '../types'

const search = new Hono<{ Bindings: Env }>()

search.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const collection = c.req.query('collection') ?? ''
  const minPrice = Math.max(0, Number(c.req.query('min_price') ?? 0))
  const maxPrice = Number(c.req.query('max_price') ?? 999999)
  const sortBy = c.req.query('sort') ?? 'newest' // newest | price_asc | price_desc

  const orderMap: Record<string, string> = {
    newest: 'p.created_at DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
  }
  const orderClause = orderMap[sortBy] ?? 'p.created_at DESC'

  let products: Product[]

  if (q) {
    // FTS5 full-text search — use wildcard suffix match for partial queries
    const ftsQuery = q.split(/\s+/).map(w => `${w}*`).join(' ')

    let sql = `
      SELECT p.* FROM products p
      JOIN products_fts ON products_fts.rowid = p.id
      WHERE products_fts MATCH ?
        AND p.status = 'active'
        AND p.price BETWEEN ? AND ?
    `
    const params: (string | number)[] = [ftsQuery, minPrice, maxPrice]

    if (collection) {
      sql += ` AND EXISTS (
        SELECT 1 FROM product_collections pc
        JOIN collections col ON col.id = pc.collection_id
        WHERE pc.product_id = p.id AND col.slug = ?
      )`
      params.push(collection)
    }

    sql += ` ORDER BY rank LIMIT 100`
    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Product>()
    products = results
  } else {
    // Browse mode — filter + sort without FTS
    let sql = `SELECT DISTINCT p.* FROM products p`
    const params: (string | number)[] = []

    if (collection) {
      sql += `
        JOIN product_collections pc ON pc.product_id = p.id
        JOIN collections col ON col.id = pc.collection_id`
    }

    sql += ` WHERE p.status = 'active' AND p.price BETWEEN ? AND ?`
    params.push(minPrice, maxPrice)

    if (collection) {
      sql += ` AND col.slug = ?`
      params.push(collection)
    }

    sql += ` ORDER BY ${orderClause} LIMIT 100`
    const { results } = await c.env.DB.prepare(sql).bind(...params).all<Product>()
    products = results
  }

  return c.json({ products, total: products.length, query: q })
})

export default search
