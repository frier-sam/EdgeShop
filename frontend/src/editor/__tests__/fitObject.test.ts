// Bug 3a — fitObject.ts's pure fit-on-insert maths.
import { describe, it, expect } from 'vitest'
import { computeInsertFitScale, INSERT_FIT_MARGIN } from '../fitObject'

describe('computeInsertFitScale', () => {
  it('does not scale an object that already fits comfortably', () => {
    expect(computeInsertFitScale(100, 80, 400, 400)).toBe(1)
  })

  it('shrinks a too-wide object so its larger extent fits the margin of the bleed rect', () => {
    // bleed 400x400 -> max side = 320 (0.8 margin). Object is 500 wide.
    const factor = computeInsertFitScale(500, 100, 400, 400)
    expect(factor).toBeCloseTo(320 / 500, 10)
  })

  it('catches an oversized HEIGHT even when width alone would look fine — the case a width-only cap misses', () => {
    // A tall, narrow image: 150 wide (well under any reasonable width cap)
    // but 3000 tall against a 400x400 bleed rect.
    const factor = computeInsertFitScale(150, 3000, 400, 400)
    const maxSide = Math.min(400, 400) * INSERT_FIT_MARGIN
    expect(factor).toBeCloseTo(maxSide / 3000, 10)
    // The shrunk object's height must land exactly at the margin.
    expect(3000 * factor).toBeCloseTo(maxSide, 10)
  })

  it('uses the SMALLER of the two bound dimensions for a non-square print area', () => {
    // 200x600 bleed rect -> smaller side is 200 -> max side = 160.
    const factor = computeInsertFitScale(500, 500, 200, 600)
    expect(factor).toBeCloseTo(160 / 500, 10)
  })

  it('never scales an object UP', () => {
    expect(computeInsertFitScale(10, 10, 1000, 1000)).toBe(1)
  })

  it('is a no-op for degenerate input (never NaN/Infinity)', () => {
    expect(computeInsertFitScale(0, 0, 400, 400)).toBe(1)
    expect(computeInsertFitScale(500, 500, 0, 0)).toBe(1)
    expect(computeInsertFitScale(-10, 50, 400, 400)).toBe(1)
  })

  it('honours a custom margin', () => {
    const factor = computeInsertFitScale(1000, 1000, 400, 400, 0.5)
    expect(factor).toBeCloseTo(200 / 1000, 10)
  })
})
