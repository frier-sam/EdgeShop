import { describe, it, expect } from 'vitest'
import { shapeCategoryRows, type RawCategoryRow } from './categories'

describe('shapeCategoryRows', () => {
  it('passes through well-formed rows, already-correct order preserved', () => {
    const rows: RawCategoryRow[] = [
      { name: 'T-Shirts', count: 5, image: '/img/mockups/tee.webp' },
      { name: 'Mugs', count: 2, image: '/img/mockups/mug.webp' },
    ]
    expect(shapeCategoryRows(rows)).toEqual([
      { name: 'T-Shirts', count: 5, image: '/img/mockups/tee.webp' },
      { name: 'Mugs', count: 2, image: '/img/mockups/mug.webp' },
    ])
  })

  it('orders by count descending, then name ascending for ties', () => {
    const rows: RawCategoryRow[] = [
      { name: 'Polos', count: 3, image: null },
      { name: 'Mugs', count: 3, image: null },
      { name: 'T-Shirts', count: 5, image: null },
    ]
    expect(shapeCategoryRows(rows).map((c) => c.name)).toEqual(['T-Shirts', 'Mugs', 'Polos'])
  })

  it('drops a category with a zero count', () => {
    const rows: RawCategoryRow[] = [
      { name: 'T-Shirts', count: 5, image: null },
      { name: 'Discontinued', count: 0, image: null },
    ]
    expect(shapeCategoryRows(rows).map((c) => c.name)).toEqual(['T-Shirts'])
  })

  it('drops a row with a null/blank/whitespace-only name', () => {
    const rows: RawCategoryRow[] = [
      { name: null, count: 4, image: null },
      { name: '', count: 4, image: null },
      { name: '   ', count: 4, image: null },
      { name: 'Mugs', count: 4, image: null },
    ]
    expect(shapeCategoryRows(rows)).toEqual([{ name: 'Mugs', count: 4, image: null }])
  })

  it('drops a row with a null/non-numeric count', () => {
    const rows = [
      { name: 'T-Shirts', count: null, image: null },
      { name: 'Mugs', count: 4, image: null },
    ] as RawCategoryRow[]
    expect(shapeCategoryRows(rows)).toEqual([{ name: 'Mugs', count: 4, image: null }])
  })

  it('preserves the raw name exactly — round-trips byte-for-byte for the exact-match category filter', () => {
    const rows: RawCategoryRow[] = [{ name: 'T-Shirts', count: 1, image: null }]
    expect(shapeCategoryRows(rows)[0].name).toBe('T-Shirts')
  })

  it('maps a missing representative image to null rather than dropping the category', () => {
    const rows: RawCategoryRow[] = [{ name: 'Stickers', count: 1, image: null }]
    expect(shapeCategoryRows(rows)).toEqual([{ name: 'Stickers', count: 1, image: null }])
  })

  it('returns an empty array for no rows', () => {
    expect(shapeCategoryRows([])).toEqual([])
  })
})
