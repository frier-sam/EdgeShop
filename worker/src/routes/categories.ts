import { Hono } from 'hono'
import type { Env } from '../index'
import { shapeCategoryRows, type RawCategoryRow } from '../lib/categories'

// GET /api/categories — POD-UI2.md §7.1. Public (mounted outside
// /api/admin/*, alongside routes/products.ts) — the header's Categories
// menu and the homepage's "Shop by category" tiles both read this.
//
// One query, one round trip: `products` LEFT JOIN `product_sides` (on
// the `side = 'front'` row), grouped by the raw `category` column. The
// LEFT JOIN is what keeps this a single GROUP BY instead of an N+1 —
// `product_sides` has a UNIQUE(product_id, side) constraint, so each
// product contributes at most one joined row, and `COUNT(*)` after the
// join still counts one row per active product in that category
// (products with no front side just join to a NULL image_url, not a
// dropped row). `MAX(...)` over that per-category group deterministically
// picks one product's front image as the "representative image" the spec
// asks for — any one product in the category satisfies that, and MAX is
// a real SQL aggregate rather than a second query per group.
//
// `p.category` is selected and grouped verbatim (no LOWER()/TRIM() on the
// value itself, only on the WHERE guard) so `name` round-trips exactly
// into `GET /api/products?category=<name>`, which does a case-sensitive
// `p.category = ?` (routes/products.ts) — see categories.test.ts for the
// exact-round-trip case in the shaping layer.
const CATEGORIES_QUERY = `
  SELECT p.category AS name,
         COUNT(*) AS count,
         MAX(CASE WHEN ps.side = 'front' THEN ps.image_url END) AS image
  FROM products p
  LEFT JOIN product_sides ps ON ps.product_id = p.id AND ps.side = 'front'
  WHERE p.status = 'active' AND p.category IS NOT NULL AND TRIM(p.category) != ''
  GROUP BY p.category
  ORDER BY count DESC, p.category ASC
`

const categories = new Hono<{ Bindings: Env }>()

categories.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(CATEGORIES_QUERY).all<RawCategoryRow>()
    return c.json({ categories: shapeCategoryRows(results) })
  } catch (err) {
    console.error('Categories list error:', err)
    return c.json({ error: 'Failed to load categories' }, 500)
  }
})

export default categories
