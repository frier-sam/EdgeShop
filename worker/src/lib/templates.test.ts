import { describe, it, expect } from 'vitest'
import {
  ASPECT_TOLERANCE,
  aspectMatches,
  filterTemplatesByAspect,
  collectionMatchesCategory,
  shapeTemplateCollections,
  type RawTemplateCollectionRow,
  type RawTemplateRow,
} from './templates'

describe('aspectMatches', () => {
  it('matches a template authored at exactly the target aspect', () => {
    expect(aspectMatches(100, 100, 1)).toBe(true) // square vs square
    expect(aspectMatches(200, 100, 2)).toBe(true) // 2:1 vs 2:1
  })

  it('matches within the default tolerance', () => {
    // canvas aspect = 1.15, target = 1.0 -> ratio = 1.15 <= 1.2
    expect(aspectMatches(115, 100, 1)).toBe(true)
  })

  it('rejects just outside the default tolerance', () => {
    // canvas aspect = 1.25, target = 1.0 -> ratio = 1.25 > 1.2
    expect(aspectMatches(125, 100, 1)).toBe(false)
  })

  it('rejects a landscape template against a tall target (the motivating §6.2 case)', () => {
    // a 2:1 landscape card design against a 1:3 tall bottle wrap
    expect(aspectMatches(200, 100, 1 / 3)).toBe(false)
  })

  it('is symmetric: swapping which side is "the template" and which is "the target" gives the same verdict', () => {
    // POD-V2.md §6.2 decision #8 — a 2:1 template against a 1:2 area must
    // be exactly as wrong as a 1:2 template against a 2:1 area.
    const cases: Array<[number, number, number]> = [
      [200, 100, 0.5], // 2:1 template vs 0.5 target
      [100, 100, 3], // square template vs a very elongated target
      [90, 50, 16 / 9],
    ]
    for (const [w, h, target] of cases) {
      const templateAspect = w / h
      // aspectMatches(w, h, target) compares templateAspect against target;
      // the mirrored call compares target's own "canvas" (as a 1x-by-target
      // rect) against the original templateAspect. Both must agree.
      const forward = aspectMatches(w, h, target)
      const mirrored = aspectMatches(target, 1, templateAspect)
      expect(mirrored).toBe(forward)
    }
  })

  it('respects a custom tolerance narrower than the default', () => {
    // aspect 1.1 vs target 1.0 -> ratio 1.1, passes default 0.2 tolerance
    // but fails a tight 0.05 tolerance.
    expect(aspectMatches(110, 100, 1, 0.2)).toBe(true)
    expect(aspectMatches(110, 100, 1, 0.05)).toBe(false)
  })

  it('falls back to the default tolerance when given a non-finite/negative one', () => {
    expect(aspectMatches(115, 100, 1, NaN)).toBe(true)
    expect(aspectMatches(115, 100, 1, -1)).toBe(true)
  })

  it('guards zero/negative/non-finite template dimensions by returning false, not throwing', () => {
    expect(aspectMatches(0, 100, 1)).toBe(false)
    expect(aspectMatches(100, 0, 1)).toBe(false)
    expect(aspectMatches(-100, 100, 1)).toBe(false)
    expect(aspectMatches(NaN, 100, 1)).toBe(false)
    expect(aspectMatches(Infinity, 100, 1)).toBe(false)
  })

  it('guards a zero/negative/non-finite target aspect by returning false', () => {
    expect(aspectMatches(100, 100, 0)).toBe(false)
    expect(aspectMatches(100, 100, -1)).toBe(false)
    expect(aspectMatches(100, 100, NaN)).toBe(false)
  })
})

describe('filterTemplatesByAspect', () => {
  const square = { id: 1, canvas_w: 100, canvas_h: 100 }
  const landscape = { id: 2, canvas_w: 300, canvas_h: 100 } // 3:1
  const portrait = { id: 3, canvas_w: 100, canvas_h: 300 } // 1:3

  it('keeps only aspect-compatible templates for a square target', () => {
    const result = filterTemplatesByAspect([square, landscape, portrait], 1)
    expect(result.map((t) => t.id)).toEqual([1])
  })

  it('keeps the matching landscape template for a wide target', () => {
    const result = filterTemplatesByAspect([square, landscape, portrait], 3)
    expect(result.map((t) => t.id)).toEqual([2])
  })

  it('a null target filters nothing — the shopper gets everything rather than an empty drawer', () => {
    const all = [square, landscape, portrait]
    expect(filterTemplatesByAspect(all, null)).toEqual(all)
  })

  it('an undefined target also filters nothing', () => {
    const all = [square, landscape, portrait]
    expect(filterTemplatesByAspect(all, undefined)).toEqual(all)
  })

  it('a non-finite or non-positive target filters nothing', () => {
    const all = [square, landscape, portrait]
    expect(filterTemplatesByAspect(all, NaN)).toEqual(all)
    expect(filterTemplatesByAspect(all, 0)).toEqual(all)
    expect(filterTemplatesByAspect(all, -2)).toEqual(all)
  })

  it('returns an empty array when nothing in the set is aspect-compatible', () => {
    // A very extreme target (1:100) that nothing here is within tolerance of.
    expect(filterTemplatesByAspect([square, landscape, portrait], 100)).toEqual([])
  })

  it('accepts an explicit tolerance override', () => {
    // landscape is 3:1; a target of 2:1 with default tolerance (0.2) fails
    // (ratio 1.5), but a generous 1.0 tolerance lets it through.
    expect(filterTemplatesByAspect([landscape], 2)).toEqual([])
    expect(filterTemplatesByAspect([landscape], 2, 1.0)).toEqual([landscape])
  })
})

describe('ASPECT_TOLERANCE', () => {
  it('is 0.2, per POD-V2.md §6.2', () => {
    expect(ASPECT_TOLERANCE).toBe(0.2)
  })
})

describe('collectionMatchesCategory', () => {
  it('matches an exact, case-insensitive category', () => {
    expect(collectionMatchesCategory('Birthday', 'birthday')).toBe(true)
    expect(collectionMatchesCategory('BIRTHDAY', 'Birthday')).toBe(true)
  })

  it('rejects a genuinely different category', () => {
    expect(collectionMatchesCategory('Birthday', 'Corporate')).toBe(false)
  })

  it('the "" wildcard collection matches every requested category', () => {
    expect(collectionMatchesCategory('', 'T-Shirts')).toBe(true)
    expect(collectionMatchesCategory('', 'Anything At All')).toBe(true)
  })

  it('a missing/blank browsing category matches every collection (no filter requested)', () => {
    expect(collectionMatchesCategory('Birthday', null)).toBe(true)
    expect(collectionMatchesCategory('Birthday', undefined)).toBe(true)
    expect(collectionMatchesCategory('Birthday', '')).toBe(true)
    expect(collectionMatchesCategory('Birthday', '   ')).toBe(true)
  })

  it('trims surrounding whitespace before comparing', () => {
    expect(collectionMatchesCategory('  Corporate  ', 'corporate')).toBe(true)
  })
})

describe('shapeTemplateCollections', () => {
  const collections: RawTemplateCollectionRow[] = [
    { id: 1, name: 'Birthday', category: 'Party' },
    { id: 2, name: 'Corporate', category: '' },
    { id: 3, name: 'Empty Collection', category: 'Party' },
  ]

  const templates: RawTemplateRow[] = [
    { id: 10, collection_id: 1, name: 'Balloons', design_json: '{"a":1}', canvas_w: 100, canvas_h: 100, preview_url: '/img/templates/10/preview.webp', tags: 'fun,party' },
    { id: 11, collection_id: 2, name: 'Letterhead', design_json: '{"b":2}', canvas_w: 200, canvas_h: 100, preview_url: '/img/templates/11/preview.webp', tags: '' },
  ]

  it('groups templates under their own collection, in collection order', () => {
    const result = shapeTemplateCollections(collections, templates)
    expect(result.map((c) => c.name)).toEqual(['Birthday', 'Corporate'])
    expect(result[0].templates.map((t) => t.id)).toEqual([10])
    expect(result[1].templates.map((t) => t.id)).toEqual([11])
  })

  it('omits a collection left with zero templates after filtering', () => {
    const result = shapeTemplateCollections(collections, templates)
    expect(result.some((c) => c.name === 'Empty Collection')).toBe(false)
  })

  it('parses each template\'s design_json for direct loadFromJSON use', () => {
    const result = shapeTemplateCollections(collections, templates)
    expect(result[0].templates[0].design_json).toEqual({ a: 1 })
  })

  it('degrades a corrupt design_json row to {} rather than throwing', () => {
    const corrupt: RawTemplateRow[] = [
      { id: 99, collection_id: 1, name: 'Broken', design_json: 'not json', canvas_w: 100, canvas_h: 100, preview_url: '', tags: '' },
    ]
    const result = shapeTemplateCollections(collections, corrupt)
    expect(result[0].templates[0].design_json).toEqual({})
  })

  it('returns an empty array when no collections have any templates', () => {
    expect(shapeTemplateCollections(collections, [])).toEqual([])
  })

  it('returns an empty array for no collections at all', () => {
    expect(shapeTemplateCollections([], templates)).toEqual([])
  })
})
