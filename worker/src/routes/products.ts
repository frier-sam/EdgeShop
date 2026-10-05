import { Hono } from 'hono'
import type { Env } from '../index'
import type { Product, ProductSide, ProductSize, ProductVariant, ProductPriceBreak } from '../types'

const products = new Hono<{ Bindings: Env }>()

// POD-UI4.md §4.1 E.1 — trims and caps the free-text `?q=` search value.
// Empty/whitespace-only input means "no search" (null, so the caller can
// `if (q)` it away entirely rather than filtering on an empty string,
// which SQLite's LIKE would happily treat as "matches everything").
export function normalizeSearchQuery(raw: string | undefined | null): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  return trimmed.slice(0, 100)
}

// POD-UI4.md §4.1 E.1 — escapes a LIKE pattern's own special characters
// (`%`, `_`) AND the escape character itself, so a shopper's literal
// search text can never be misread as a wildcard. Without this, typing
// "%" would build the pattern `%%%` and match the entire catalogue —
// pair with `LIKE ? ESCAPE '\'` at the call site.
export function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export interface ProductListFilters {
  category?: string
  excludeId?: number
  q?: string | null
}

// Pure builder for GET /api/products' WHERE clause, shared verbatim
// between the COUNT query and the row-fetching query below so `total` /
// `pages` can never drift out of sync with the actual filtered rows
// (POD-UI4.md §4.1 E.1 — "must apply to the COUNT query too").
export function buildProductListWhere(filters: ProductListFilters): { where: string; params: (string | number)[] } {
  let where = "WHERE p.status = 'active'"
  const params: (string | number)[] = []
  if (filters.category) { where += ' AND p.category = ?'; params.push(filters.category) }
  if (filters.excludeId) { where += ' AND p.id != ?'; params.push(filters.excludeId) }
  if (filters.q) {
    // SQLite's LIKE is already case-insensitive for ASCII text, which is
    // all product names in this catalogue use — no redundant LOWER()/
    // UPPER() needed on either side.
    where += " AND p.name LIKE ? ESCAPE '\\'"
    params.push(`%${escapeLikePattern(filters.q)}%`)
  }
  return { where, params }
}

// Flat shape D1 actually returns for one row of the list query below —
// `lowest_break_min_qty` / `lowest_break_unit_price` come from the grouped
// LEFT JOIN's two columns and are null together whenever the product has
// no price_breaks rows at all.
export interface ProductListRow {
  id: number
  name: string
  slug: string | null
  base_price: number
  compare_price: number | null
  category: string
  is_customizable: number
  min_order_qty: number
  front_image: string | null
  back_image: string | null
  lowest_break_min_qty: number | null
  lowest_break_unit_price: number | null
}

export interface ProductListItem {
  id: number
  name: string
  slug: string | null
  base_price: number
  compare_price: number | null
  category: string
  is_customizable: number
  min_order_qty: number
  front_image: string | null
  back_image: string | null
  lowest_break: { min_qty: number; unit_price: number } | null
}

// POD-UI4.md §4.1 E.2 — D1 returns one flat row per product (no nested
// objects), so the `lowest_break` object the frontend's ProductSummary
// type expects is assembled here, in exactly one place, rather than at
// every call site. `min_qty`/`unit_price` are LEFT JOIN columns, so they
// are null together for a product with zero product_price_breaks rows —
// that's the "no tiers" case, and it must render as `null`, never a
// fabricated `{ min_qty: 0, unit_price: 0 }`.
export function mapProductListRow(row: ProductListRow): ProductListItem {
  const { lowest_break_min_qty, lowest_break_unit_price, ...rest } = row
  return {
    ...rest,
    lowest_break:
      lowest_break_min_qty != null && lowest_break_unit_price != null
        ? { min_qty: lowest_break_min_qty, unit_price: lowest_break_unit_price }
        : null,
  }
}

products.get('/', async (c) => {
  const rawPage = Number(c.req.query('page') ?? 1)
  const rawLimit = Number(c.req.query('limit') ?? 12)
  const page = isNaN(rawPage) ? 1 : Math.max(1, Math.floor(rawPage))
  const limit = isNaN(rawLimit) ? 12 : Math.min(48, Math.max(1, Math.floor(rawLimit)))
  const offset = (page - 1) * limit

  const category = (c.req.query('category') ?? '').trim()
  const excludeId = Number(c.req.query('exclude') ?? 0)
  const q = normalizeSearchQuery(c.req.query('q'))

  const { where, params } = buildProductListWhere({ category: category || undefined, excludeId: excludeId || undefined, q })

  try {
    const countRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM products p ${where}`
    ).bind(...params).first<{ total: number }>()
    const total = countRow?.total ?? 0

    const { results } = await c.env.DB.prepare(
      // POD-UI4.md §4.1 E.2 — `back_image` is a second LEFT JOIN onto
      // product_sides, mirroring the existing front_image one. `lowest_break`
      // is a single grouped subquery (`lb_min`), not a per-product query:
      // it computes the smallest min_qty per product ONCE for the whole
      // page, then joins back to product_price_breaks once more to pick up
      // that tier's unit_price — the join runs exactly once regardless of
      // how many products the page returns.
      `SELECT
         p.id, p.name, p.slug, p.base_price, p.compare_price, p.category, p.is_customizable,
         p.min_order_qty,
         COALESCE(
           (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1),
           psf.image_url
         ) AS front_image,
         COALESCE(
           (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1 OFFSET 1),
           CASE WHEN EXISTS (SELECT 1 FROM product_images x WHERE x.product_id = p.id) THEN NULL ELSE psb.image_url END
         ) AS back_image,
         lb.min_qty AS lowest_break_min_qty,
         lb.unit_price AS lowest_break_unit_price
       FROM products p
       LEFT JOIN product_sides psf ON psf.product_id = p.id AND psf.side = 'front'
       LEFT JOIN product_sides psb ON psb.product_id = p.id AND psb.side = 'back'
       LEFT JOIN (
         SELECT pb.product_id, pb.min_qty, pb.unit_price
         FROM product_price_breaks pb
         INNER JOIN (
           SELECT product_id, MIN(min_qty) AS min_qty
           FROM product_price_breaks
           GROUP BY product_id
         ) lb_min ON lb_min.product_id = pb.product_id AND lb_min.min_qty = pb.min_qty
       ) lb ON lb.product_id = p.id
       ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all<ProductListRow>()

    return c.json({ products: results.map(mapProductListRow), total, page, limit, pages: limit > 0 ? Math.ceil(total / limit) : 0 })
  } catch (err) {
    console.error('Products list error:', err)
    return c.json({ error: 'Failed to load products' }, 500)
  }
})

products.get('/:id', async (c) => {
  const idParam = c.req.param('id')
  const numericId = Number(idParam)
  const isNumeric = !isNaN(numericId) && /^\d+$/.test(idParam)

  try {
    const product = isNumeric
      ? await c.env.DB.prepare(
          "SELECT * FROM products WHERE id = ? AND status = 'active'"
        ).bind(numericId).first<Product>()
      : await c.env.DB.prepare(
          "SELECT * FROM products WHERE slug = ? AND status = 'active'"
        ).bind(idParam).first<Product>()

    if (!product) return c.json({ error: 'Not found' }, 404)

    const { results: sides } = await c.env.DB.prepare(
      'SELECT * FROM product_sides WHERE product_id = ? ORDER BY sort_order ASC'
    ).bind(product.id).all<ProductSide>()

    const { results: images } = await c.env.DB.prepare(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC'
    ).bind(product.id).all()

    const { results: sizes } = await c.env.DB.prepare(
      'SELECT * FROM product_sizes WHERE product_id = ? ORDER BY sort_order ASC'
    ).bind(product.id).all<ProductSize>()

    // POD-V2.md §3/§5, §11 Phase 1.1 — axis 2 and bulk tiers. Ordered the
    // same way sizes are (sort_order for the admin-curated axis, min_qty
    // ascending so the storefront's "add N more to save" logic can walk
    // tiers in order without re-sorting).
    const { results: variants } = await c.env.DB.prepare(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY sort_order ASC'
    ).bind(product.id).all<ProductVariant>()

    const { results: price_breaks } = await c.env.DB.prepare(
      'SELECT * FROM product_price_breaks WHERE product_id = ? ORDER BY min_qty ASC'
    ).bind(product.id).all<ProductPriceBreak>()

    // `product` is a `SELECT *`, so it already carries `highlights` — see
    // POD-UI4.md §4.1's ProductDetail contract — no separate query needed.
    return c.json({ ...product, sides, images, sizes, variants, price_breaks })
  } catch (err) {
    console.error('Product detail error:', err)
    return c.json({ error: 'Failed to load product' }, 500)
  }
})

export default products
