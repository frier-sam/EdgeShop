// POD-UI4.md §4.6 — each readiness chip's green/pending boundary, pinned
// directly against the pure derivation functions (same rationale as
// ProductPriceBreaksEditor.test.tsx's isTierBelowPrintFees suite: this is
// the bit that must never silently drift from real product rows).
import { describe, it, expect } from 'vitest'
import { mockupsReady, printAreasReady, pricingReady, countConfiguredOptions } from '../lib/readiness'
import type { ProductSide } from '../../lib/types'

function side(partial: Partial<ProductSide>): ProductSide {
  return {
    id: 1, product_id: 1, side: 'front', label: '', image_url: '', image_w: 0, image_h: 0,
    customizable: 1, print_x: 0, print_y: 0, print_w: 0, print_h: 0, print_width_in: 0,
    print_fee: 0, sort_order: 0, ...partial,
  }
}

describe('mockupsReady', () => {
  it('is true when every side has a non-empty image_url', () => {
    expect(mockupsReady([side({ image_url: '/img/front.webp' }), side({ image_url: '/img/back.webp' })])).toBe(true)
  })

  it('is false when any side is missing its mockup', () => {
    expect(mockupsReady([side({ image_url: '/img/front.webp' }), side({ image_url: '' })])).toBe(false)
  })

  it('treats a whitespace-only image_url as missing', () => {
    expect(mockupsReady([side({ image_url: '   ' })])).toBe(false)
  })

  it('is NOT ready for a product with no sides at all, despite `every` being vacuously true', () => {
    // The regression this pins: a product with zero side rows has no mockup
    // whatsoever, which is the least-ready state possible — it must never
    // light the chip green just because `[].every(...)` returns true.
    expect(mockupsReady([])).toBe(false)
  })
})

describe('printAreasReady', () => {
  it('is true when every customizable side has a real print rect', () => {
    expect(
      printAreasReady([
        side({ customizable: 1, print_w: 0.4, print_h: 0.4 }),
        side({ customizable: 1, print_w: 0.5, print_h: 0.3 }),
      ]),
    ).toBe(true)
  })

  it('is false when a customizable side has a zero-sized print rect', () => {
    expect(printAreasReady([side({ customizable: 1, print_w: 0, print_h: 0.4 })])).toBe(false)
  })

  it('ignores a mockup-only (non-customizable) side entirely', () => {
    expect(printAreasReady([side({ customizable: 0, print_w: 0, print_h: 0 })])).toBe(true)
  })

  it('is vacuously true when the product has no customizable sides', () => {
    expect(printAreasReady([])).toBe(true)
  })
})

describe('pricingReady', () => {
  it('is true for a positive base price', () => {
    expect(pricingReady(499)).toBe(true)
  })

  it('is false at exactly zero', () => {
    expect(pricingReady(0)).toBe(false)
  })

  it('is false for a negative or non-finite base price', () => {
    expect(pricingReady(-1)).toBe(false)
    expect(pricingReady(NaN)).toBe(false)
  })
})

describe('countConfiguredOptions', () => {
  it('counts zero when every block is off', () => {
    expect(countConfiguredOptions({ axis1: false, axis2: false, bulk: false, customization: false })).toBe(0)
  })

  it('counts every enabled block, order-independent', () => {
    expect(countConfiguredOptions({ axis1: true, axis2: false, bulk: true, customization: false })).toBe(2)
  })

  it('counts all four when every block is on', () => {
    expect(countConfiguredOptions({ axis1: true, axis2: true, bulk: true, customization: true })).toBe(4)
  })
})
