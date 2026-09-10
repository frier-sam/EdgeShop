// worker/src/routes/admin/products.test.ts
//
// POD-V2.md §3.1/§5, §11 Phase 1.7 — validation for the two new full-
// replace admin endpoints, PUT /:id/variants and PUT /:id/price_breaks.
// Following the same split as ../orders.ts's buildPreviewLines and
// ../../lib/gc.ts's isOrphanDesignExpired: the DB-touching route handlers
// stay thin, and the actual validation rules live in plain, D1-free
// functions that are exercised directly here — there is no D1/SQLite test
// harness in this repo (see migrate.test.ts's header), so route handlers
// themselves are not integration-tested.
import { describe, it, expect } from 'vitest'
import {
  validateVariantsPayload,
  validatePriceBreaksPayload,
  normalizeAxisLabel,
  normalizeHighlights,
  MAX_HIGHLIGHTS_LENGTH,
  HEX_COLOR_RE,
} from './products'

describe('validateVariantsPayload', () => {
  it('accepts a normal set of variants, trimming labels and defaulting swatch_hex to null', () => {
    const result = validateVariantsPayload([
      { label: '  Navy  ' },
      { label: 'Matte', swatch_hex: null },
      { label: 'Steel', swatch_hex: '#1A2B3C' },
    ])
    expect(result).toEqual({
      clean: [
        { label: 'Navy', swatch_hex: null, sort_order: 0 },
        { label: 'Matte', swatch_hex: null, sort_order: 1 },
        { label: 'Steel', swatch_hex: '#1A2B3C', sort_order: 2 },
      ],
    })
  })

  it('rejects an empty or whitespace-only label', () => {
    expect(validateVariantsPayload([{ label: '' }])).toEqual({
      error: 'Every variant must have a non-empty label',
    })
    expect(validateVariantsPayload([{ label: '   ' }])).toEqual({
      error: 'Every variant must have a non-empty label',
    })
    expect(validateVariantsPayload([{}])).toEqual({
      error: 'Every variant must have a non-empty label',
    })
  })

  it('rejects duplicate labels case-insensitively, mirroring the sizes endpoint', () => {
    const result = validateVariantsPayload([{ label: 'Navy' }, { label: 'navy' }])
    expect(result).toEqual({ error: 'Duplicate variant label: navy' })
  })

  it('accepts two genuinely different labels (only a case-insensitive match is a duplicate)', () => {
    const result = validateVariantsPayload([{ label: 'Navy' }, { label: 'Matte' }])
    expect('error' in result).toBe(false)
  })

  it('rejects a swatch_hex missing the leading #, too short/long, or non-hex characters', () => {
    for (const bad of ['1A2B3C', '#1A2B3', '#1A2B3CC', '#GGGGGG', 'red', '']) {
      const result = validateVariantsPayload([{ label: 'Navy', swatch_hex: bad }])
      expect('error' in result, `expected "${bad}" to be rejected`).toBe(true)
    }
  })

  it('accepts a swatch_hex with any valid hex digit case', () => {
    expect(validateVariantsPayload([{ label: 'Navy', swatch_hex: '#abcdef' }])).toEqual({
      clean: [{ label: 'Navy', swatch_hex: '#abcdef', sort_order: 0 }],
    })
    expect(validateVariantsPayload([{ label: 'Steel', swatch_hex: '#ABCDEF' }])).toEqual({
      clean: [{ label: 'Steel', swatch_hex: '#ABCDEF', sort_order: 0 }],
    })
  })

  it('treats an absent swatch_hex the same as an explicit null (matte/glossy has no colour — §3.1)', () => {
    const withUndefined = validateVariantsPayload([{ label: 'Matte' }])
    const withNull = validateVariantsPayload([{ label: 'Matte', swatch_hex: null }])
    expect(withUndefined).toEqual(withNull)
    expect(withUndefined).toEqual({ clean: [{ label: 'Matte', swatch_hex: null, sort_order: 0 }] })
  })

  it('honors an explicit sort_order when given, falling back to array index otherwise', () => {
    const result = validateVariantsPayload([
      { label: 'B', sort_order: 5 },
      { label: 'A' }, // no sort_order — falls back to its index (1)
    ])
    expect(result).toEqual({
      clean: [
        { label: 'B', swatch_hex: null, sort_order: 5 },
        { label: 'A', swatch_hex: null, sort_order: 1 },
      ],
    })
  })

  it('an empty array is valid (unticking/clearing axis 2 entirely)', () => {
    expect(validateVariantsPayload([])).toEqual({ clean: [] })
  })
})

describe('validatePriceBreaksPayload', () => {
  it('accepts a normal ascending set of tiers', () => {
    const result = validatePriceBreaksPayload([
      { min_qty: 100, unit_price: 10 },
      { min_qty: 250, unit_price: 8 },
      { min_qty: 500, unit_price: 6.5 },
    ])
    expect(result).toEqual({
      clean: [
        { min_qty: 100, unit_price: 10 },
        { min_qty: 250, unit_price: 8 },
        { min_qty: 500, unit_price: 6.5 },
      ],
    })
  })

  it('rejects a non-integer, zero, or negative min_qty', () => {
    for (const bad of [0, -5, 1.5, '100', undefined, null]) {
      const result = validatePriceBreaksPayload([{ min_qty: bad as unknown as number, unit_price: 10 }])
      expect(result).toEqual({ error: 'min_qty must be an integer >= 1' })
    }
  })

  it('accepts min_qty of exactly 1 (the boundary)', () => {
    const result = validatePriceBreaksPayload([{ min_qty: 1, unit_price: 10 }])
    expect('error' in result).toBe(false)
  })

  it('rejects duplicate min_qty values within one product', () => {
    const result = validatePriceBreaksPayload([
      { min_qty: 100, unit_price: 10 },
      { min_qty: 100, unit_price: 9 },
    ])
    expect(result).toEqual({ error: 'Duplicate min_qty: 100' })
  })

  it('rejects a negative, NaN, infinite, or non-numeric unit_price', () => {
    for (const bad of [-1, NaN, Infinity, '10', undefined, null]) {
      const result = validatePriceBreaksPayload([{ min_qty: 100, unit_price: bad as unknown as number }])
      expect(result).toEqual({ error: 'unit_price for min_qty 100 must be a non-negative number' })
    }
  })

  it('accepts a unit_price of exactly 0 — §9.1 explicitly allows a tier that costs the merchant money', () => {
    const result = validatePriceBreaksPayload([{ min_qty: 100, unit_price: 0 }])
    expect(result).toEqual({ clean: [{ min_qty: 100, unit_price: 0 }] })
  })

  it('an empty array is valid (no bulk pricing configured)', () => {
    expect(validatePriceBreaksPayload([])).toEqual({ clean: [] })
  })
})

describe('normalizeAxisLabel', () => {
  it('trims and returns a provided non-empty label', () => {
    expect(normalizeAxisLabel('  Volume  ', 'Size')).toBe('Volume')
  })

  it('falls back to the default for undefined, empty, or whitespace-only input', () => {
    expect(normalizeAxisLabel(undefined, 'Size')).toBe('Size')
    expect(normalizeAxisLabel('', 'Colour')).toBe('Colour')
    expect(normalizeAxisLabel('   ', 'Colour')).toBe('Colour')
  })

  it('falls back to the default for a non-string value', () => {
    expect(normalizeAxisLabel(42, 'Size')).toBe('Size')
    expect(normalizeAxisLabel(null, 'Size')).toBe('Size')
  })
})

// POD-UI4.md §4.1 / P2, §11 (E.3) — the admin product PUT's server-side
// validation for the "Key Features" box.
describe('normalizeHighlights', () => {
  it('trims surrounding whitespace but preserves internal newlines', () => {
    expect(normalizeHighlights('  Waterproof\nBPA-free\n  ')).toEqual({
      value: 'Waterproof\nBPA-free',
    })
  })

  it('defaults to an empty string when omitted or null', () => {
    expect(normalizeHighlights(undefined)).toEqual({ value: '' })
    expect(normalizeHighlights(null)).toEqual({ value: '' })
  })

  it('rejects a non-string value', () => {
    expect(normalizeHighlights(42)).toEqual({ error: 'highlights must be a string' })
  })

  it(`accepts exactly ${MAX_HIGHLIGHTS_LENGTH} characters (the boundary)`, () => {
    const atLimit = 'a'.repeat(MAX_HIGHLIGHTS_LENGTH)
    expect(normalizeHighlights(atLimit)).toEqual({ value: atLimit })
  })

  it(`rejects anything over ${MAX_HIGHLIGHTS_LENGTH} characters with a 400-shaped error`, () => {
    const tooLong = 'a'.repeat(MAX_HIGHLIGHTS_LENGTH + 1)
    const result = normalizeHighlights(tooLong)
    expect('error' in result).toBe(true)
  })
})

describe('HEX_COLOR_RE', () => {
  it('matches exactly a #RRGGBB 6-digit hex color', () => {
    expect(HEX_COLOR_RE.test('#000000')).toBe(true)
    expect(HEX_COLOR_RE.test('#FfFfFf')).toBe(true)
  })

  it('rejects shorthand (#RGB), missing #, and out-of-range characters', () => {
    expect(HEX_COLOR_RE.test('#FFF')).toBe(false)
    expect(HEX_COLOR_RE.test('FFFFFF')).toBe(false)
    expect(HEX_COLOR_RE.test('#GGGGGG')).toBe(false)
  })
})
