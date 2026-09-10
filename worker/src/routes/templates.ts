import { Hono } from 'hono'
import type { Env } from '../index'
import {
  filterTemplatesByAspect,
  collectionMatchesCategory,
  shapeTemplateCollections,
  type RawTemplateCollectionRow,
  type RawTemplateRow,
} from '../lib/templates'

// GET /api/templates — POD-V2.md §6.6 / §11 Phase 4.5. Public (mounted
// outside /api/admin/*, alongside routes/products.ts and
// routes/categories.ts), backing the customizer's "Designs" drawer: browse
// ready-made templates, grouped by collection, filtered to the shopper's
// product category and the current print area's aspect ratio.
const templates = new Hono<{ Bindings: Env }>()

templates.get('/', async (c) => {
  const category = c.req.query('category') ?? null
  const aspectRaw = c.req.query('aspect')
  const aspect = aspectRaw === undefined ? null : Number(aspectRaw)
  // '?all=1' is the "show all shapes" escape hatch (POD-V2.md §6.2/§11
  // Phase 4.5, decision #8) — bypasses the aspect filter entirely so
  // nothing is ever permanently unreachable from the drawer. Anything
  // other than the literal '1' (absent, '0', garbage) leaves the filter on.
  const showAll = c.req.query('all') === '1'

  try {
    const { results: collectionRows } = await c.env.DB.prepare(
      "SELECT id, name, category FROM template_collections WHERE status = 'active' ORDER BY sort_order ASC, id ASC"
    ).all<RawTemplateCollectionRow>()

    // Category match happens in JS, not SQL — collectionMatchesCategory's
    // '' wildcard rule ("this collection applies to every category") isn't
    // a plain equality a WHERE clause expresses cleanly without an OR that
    // still needs the same case-insensitive comparison, and this list is
    // small (merchant-curated collections, not shopper-generated rows).
    const matchingCollections = collectionRows.filter((col) => collectionMatchesCategory(col.category, category))
    if (matchingCollections.length === 0) return c.json({ collections: [] })

    const ids = matchingCollections.map((col) => col.id)
    const placeholders = ids.map(() => '?').join(',')
    const { results: templateRows } = await c.env.DB.prepare(
      `SELECT id, collection_id, name, design_json, canvas_w, canvas_h, preview_url, tags
       FROM design_templates
       WHERE status = 'active' AND collection_id IN (${placeholders})
       ORDER BY sort_order ASC, id ASC`
    ).bind(...ids).all<RawTemplateRow>()

    const targetAspect = showAll ? null : aspect
    const filtered = filterTemplatesByAspect(templateRows, targetAspect)

    return c.json({ collections: shapeTemplateCollections(matchingCollections, filtered) })
  } catch (err) {
    console.error('Templates list error:', err)
    return c.json({ error: 'Failed to load templates' }, 500)
  }
})

export default templates
