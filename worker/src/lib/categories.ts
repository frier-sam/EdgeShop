// worker/src/lib/categories.ts
//
// GET /api/categories (routes/categories.ts) — POD-UI2.md §7.1. The
// distinct `category` values across active products, each with a count
// and a representative image, derived straight from `products` (no new
// table — the catalogue already holds the truth).
//
// `shapeCategoryRows` is the pure, dependency-free piece pulled out for
// unit testing without a D1 database, mirroring lib/pricing.ts and
// lib/imgGuard.ts. The SQL query itself (a single GROUP BY over
// `products` LEFT JOIN `product_sides`, restricted to status='active'
// with a non-empty category, ordered by count DESC / name ASC) already
// produces rows in the right shape and order — this function is the
// defensive re-check that guarantees the public contract (no empty/blank
// names, no zero-count rows, deterministic ordering) holds even if that
// SQL ever drifts, and gives the shaping logic a test that doesn't
// depend on wrangler/D1 being up.

export interface RawCategoryRow {
  name: string | null
  count: number | null
  image: string | null
}

export interface StorefrontCategory {
  name: string
  count: number
  image: string | null
}

export function shapeCategoryRows(rows: RawCategoryRow[]): StorefrontCategory[] {
  return rows
    .filter(
      (r): r is { name: string; count: number; image: string | null } =>
        typeof r.name === 'string' && r.name.trim() !== '' && typeof r.count === 'number' && r.count > 0,
    )
    .map((r) => ({ name: r.name, count: r.count, image: r.image ?? null }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
