// worker/src/lib/templates.ts
//
// POD-V2.md §6 ("browse designs") — pure, dependency-free logic behind the
// public GET /api/templates browse endpoint (routes/templates.ts). Same
// split as lib/pricing.ts / lib/categories.ts / lib/imgGuard.ts: SQL does
// the WHERE-clause-shaped filtering (status='active', collection_id IN
// (...)), and this module carries the piece SQL can't express cleanly (the
// aspect-ratio comparison) plus the response-shaping layer, all
// unit-testable with plain fixtures — no D1, no Hono.

export const ASPECT_TOLERANCE = 0.2

/**
 * True when a template authored at `canvasW x canvasH` suits a print area
 * whose own width/height ratio is `targetAspect` (POD-V2.md §6.2 — the
 * "hard technical problem": a template is keyed to a *category*, and a
 * landscape card design fitted into a tall bottle wrap is technically
 * fittable but visually useless, so aspect is filtered, not just
 * letterboxed).
 *
 * Compares RATIOS, not differences: `max(a, b) / min(a, b) <= 1 + tolerance`,
 * where `a` is the template's own aspect (`canvasW / canvasH`) and `b` is
 * the target. That's symmetric by construction — a 2:1 template judged
 * against a 1:2 area is exactly as wrong as a 1:2 template judged against a
 * 2:1 area (decision #8) — a plain subtraction (`|a - b| <= tolerance`)
 * would not capture that, since the same absolute gap means wildly
 * different things depending which side of 1.0 the ratio sits on.
 *
 * Guards zero/negative/non-finite dimensions on either side by returning
 * `false` rather than dividing by zero or comparing against NaN/Infinity —
 * a malformed row should read as "doesn't match", never crash the filter
 * or, worse, silently match everything.
 */
export function aspectMatches(
  canvasW: number,
  canvasH: number,
  targetAspect: number,
  tolerance: number = ASPECT_TOLERANCE
): boolean {
  if (!Number.isFinite(canvasW) || !Number.isFinite(canvasH) || canvasW <= 0 || canvasH <= 0) return false
  if (!Number.isFinite(targetAspect) || targetAspect <= 0) return false
  const tol = Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : ASPECT_TOLERANCE

  const a = canvasW / canvasH
  const b = targetAspect
  const ratio = Math.max(a, b) / Math.min(a, b)
  return ratio <= 1 + tol
}

/**
 * Filters a template list against a target print area's aspect ratio.
 * `targetAspect` is nullable by design — POD-V2.md §11 Phase 4.5 ships this
 * alongside `?all=1`, an escape hatch so a shopper can always see every
 * shape ("show all shapes" toggle), and the exact same "don't hide
 * everything on missing/bad input" rule applies whenever the caller simply
 * has no target aspect yet (no reference print area resolved client-side):
 * null, undefined, non-finite, or non-positive all fall through to "no
 * filtering" — the shopper gets everything rather than an empty drawer,
 * per spec.
 */
export function filterTemplatesByAspect<T extends { canvas_w: number; canvas_h: number }>(
  templates: T[],
  targetAspect: number | null | undefined,
  tolerance: number = ASPECT_TOLERANCE
): T[] {
  if (targetAspect === null || targetAspect === undefined || !Number.isFinite(targetAspect) || targetAspect <= 0) {
    return templates
  }
  return templates.filter((t) => aspectMatches(t.canvas_w, t.canvas_h, targetAspect, tolerance))
}

/**
 * A collection's own `category` column applies to a shopper browsing under
 * `browsingCategory` when it matches case-insensitively, OR the collection
 * is the `''` wildcard meaning "every category" (schema.sql's comment
 * above `template_collections`, POD-V2.md §6.1's `category TEXT NOT NULL
 * DEFAULT ''  -- '' = every category`). An absent/blank `browsingCategory`
 * means the request itself isn't filtering by category at all (no
 * `?category=`) — every active collection applies then, the same "no
 * filter = everything" rule routes/products.ts already uses for its own
 * `?category=`.
 */
export function collectionMatchesCategory(collectionCategory: string, browsingCategory: string | null | undefined): boolean {
  const requested = (browsingCategory ?? '').trim()
  if (!requested) return true
  if (collectionCategory === '') return true
  return collectionCategory.trim().toLowerCase() === requested.toLowerCase()
}

// ── Storefront response shaping ─────────────────────────────────────────

export interface RawTemplateCollectionRow {
  id: number
  name: string
  category: string
}

export interface RawTemplateRow {
  id: number
  collection_id: number
  name: string
  design_json: string
  canvas_w: number
  canvas_h: number
  preview_url: string
  tags: string
}

export interface StorefrontTemplate {
  id: number
  name: string
  design_json: unknown
  canvas_w: number
  canvas_h: number
  preview_url: string
  tags: string
}

export interface StorefrontTemplateCollection {
  id: number
  name: string
  templates: StorefrontTemplate[]
}

/**
 * Groups already-filtered `design_templates` rows under their
 * `template_collections` rows and parses each row's `design_json` — so the
 * customizer can `loadFromJSON` straight off this response (POD-V2.md §6.5)
 * with no second round trip, since no separate per-template detail
 * endpoint is part of this phase's contract. OMITS any collection left
 * with zero templates after aspect filtering (POD-V2.md §11 Phase 4.5) —
 * an empty "Corporate" drawer row is worse than not showing "Corporate" at
 * all.
 *
 * Both inputs are assumed pre-filtered (status='active' on both tables,
 * `collections` already category-matched via `collectionMatchesCategory`,
 * `templates` already aspect-matched via `filterTemplatesByAspect`) — this
 * function only groups and shapes, it never re-applies either filter
 * itself.
 */
export function shapeTemplateCollections(
  collections: RawTemplateCollectionRow[],
  templates: RawTemplateRow[]
): StorefrontTemplateCollection[] {
  const out: StorefrontTemplateCollection[] = []
  for (const col of collections) {
    const inCollection = templates.filter((t) => t.collection_id === col.id)
    if (inCollection.length === 0) continue
    out.push({
      id: col.id,
      name: col.name,
      templates: inCollection.map((t) => ({
        id: t.id,
        name: t.name,
        design_json: parseDesignJsonSafe(t.design_json),
        canvas_w: t.canvas_w,
        canvas_h: t.canvas_h,
        preview_url: t.preview_url,
        tags: t.tags,
      })),
    })
  }
  return out
}

function parseDesignJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return {} // corrupt row: never 500 the shopper's browse request over it
  }
}
