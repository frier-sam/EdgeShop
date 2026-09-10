// worker/src/routes/products.test.ts
//
// POD-UI4.md §4.1 E.1/E.2 — pure, D1-free logic behind GET /api/products'
// new `?q=` search and its new `back_image`/`min_order_qty`/`lowest_break`
// fields. Same split as lib/pricing.ts / lib/categories.ts / lib/templates.ts:
// SQL does the actual fetching/joining, and the WHERE-clause assembly plus
// the flat-row-to-response shaping are pulled out into plain functions that
// are unit-tested here — there is no D1/SQLite test harness in this repo
// (see migrate.test.ts's header / admin/products.test.ts's header), so the
// SQL text itself is reviewed rather than executed in a test.
import { describe, it, expect } from 'vitest'
import {
  normalizeSearchQuery,
  escapeLikePattern,
  buildProductListWhere,
  mapProductListRow,
  type ProductListRow,
} from './products'

describe('normalizeSearchQuery', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeSearchQuery('  mug  ')).toBe('mug')
  })

  it('treats empty or whitespace-only input as "no search" (null)', () => {
    expect(normalizeSearchQuery('')).toBeNull()
    expect(normalizeSearchQuery('   ')).toBeNull()
    expect(normalizeSearchQuery(undefined)).toBeNull()
    expect(normalizeSearchQuery(null)).toBeNull()
  })

  it('caps at 100 characters', () => {
    const long = 'a'.repeat(150)
    const result = normalizeSearchQuery(long)
    expect(result).toHaveLength(100)
    expect(result).toBe('a'.repeat(100))
  })
})

describe('escapeLikePattern', () => {
  it('escapes %, _ and the backslash escape character itself', () => {
    expect(escapeLikePattern('100% cotton')).toBe('100\\% cotton')
    expect(escapeLikePattern('a_b')).toBe('a\\_b')
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b')
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeLikePattern('classic tee')).toBe('classic tee')
  })

  // The exact scenario POD-UI4.md §4.1 calls out: a shopper typing a bare
  // "%" must search for a literal percent sign, never match everything.
  it('a literal "%" search term escapes to a pattern matching only names containing "%"', () => {
    const escaped = escapeLikePattern('%')
    expect(escaped).toBe('\\%')
    // sanity: the escaped form is no longer a live wildcard
    expect(escaped).not.toBe('%')
  })
})

describe('buildProductListWhere', () => {
  it('always scopes to active products with no filters given', () => {
    const { where, params } = buildProductListWhere({})
    expect(where).toBe("WHERE p.status = 'active'")
    expect(params).toEqual([])
  })

  it('combines category, exclude and q with AND', () => {
    const { where, params } = buildProductListWhere({ category: 'Mugs', excludeId: 7, q: 'ceramic' })
    expect(where).toBe(
      "WHERE p.status = 'active' AND p.category = ? AND p.id != ? AND p.name LIKE ? ESCAPE '\\'"
    )
    expect(params).toEqual(['Mugs', 7, '%ceramic%'])
  })

  it('wraps q in % wildcards and escapes it before binding', () => {
    const { params } = buildProductListWhere({ q: '100%' })
    expect(params).toEqual(['%100\\%%'])
  })

  it('omits the q clause entirely when q is null/undefined', () => {
    const { where, params } = buildProductListWhere({ category: 'Mugs', q: null })
    expect(where).not.toContain('LIKE')
    expect(params).toEqual(['Mugs'])
  })

  it('a falsy excludeId (0) is treated as "no exclusion"', () => {
    const { where, params } = buildProductListWhere({ excludeId: 0 })
    expect(where).toBe("WHERE p.status = 'active'")
    expect(params).toEqual([])
  })
})

describe('mapProductListRow', () => {
  const BASE: ProductListRow = {
    id: 1,
    name: 'Classic Mug',
    slug: 'classic-mug',
    base_price: 299,
    compare_price: null,
    category: 'Mugs',
    is_customizable: 1,
    min_order_qty: 1,
    front_image: '/img/mockups/mug-front.webp',
    back_image: '/img/mockups/mug-back.webp',
    lowest_break_min_qty: null,
    lowest_break_unit_price: null,
  }

  it('a product with no price_breaks rows returns lowest_break: null, never a fabricated object', () => {
    const result = mapProductListRow(BASE)
    expect(result.lowest_break).toBeNull()
  })

  it('assembles the nested lowest_break object from the flat SQL columns', () => {
    // Represents the row shape the grouped LEFT JOIN produces for a
    // product with several tiers — the JOIN itself already picked the
    // smallest min_qty (see the query's comment in products.ts); this
    // fixture pins the JS-side assembly of that already-resolved row.
    const result = mapProductListRow({ ...BASE, lowest_break_min_qty: 100, lowest_break_unit_price: 4.5 })
    expect(result.lowest_break).toEqual({ min_qty: 100, unit_price: 4.5 })
  })

  it('carries back_image and min_order_qty straight through', () => {
    const result = mapProductListRow(BASE)
    expect(result.back_image).toBe('/img/mockups/mug-back.webp')
    expect(result.min_order_qty).toBe(1)
  })

  it('a product with a null back_image (no back side configured) stays null, not undefined or ""', () => {
    const result = mapProductListRow({ ...BASE, back_image: null })
    expect(result.back_image).toBeNull()
  })

  it('does not leak the flat lowest_break_min_qty/lowest_break_unit_price keys onto the response shape', () => {
    const result = mapProductListRow({ ...BASE, lowest_break_min_qty: 100, lowest_break_unit_price: 4.5 })
    expect(Object.keys(result)).not.toContain('lowest_break_min_qty')
    expect(Object.keys(result)).not.toContain('lowest_break_unit_price')
  })
})
