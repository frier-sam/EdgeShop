import { describe, it, expect } from 'vitest'
import {
  computeDesiredMultiplier,
  clampMultiplierForCanvasSize,
  computePrintDims,
  MAX_CANVAS_DIMENSION_PX,
  MAX_CANVAS_AREA_PX,
} from '../printMath'

describe('computeDesiredMultiplier', () => {
  it('reproduces POD.md §5.1: printPx = print_width_in * print_dpi, multiplier = printPx / canvasWidth', () => {
    // 12in x 300dpi = 3600px target; canvas (bleed rect at reference scale) is 400px wide.
    const m = computeDesiredMultiplier(400, 12, 300)
    expect(m).toBeCloseTo(9, 10)
    expect(400 * m).toBeCloseTo(3600, 6)
  })

  it('is 0 for degenerate input (zero canvas width, print width, or dpi) rather than Infinity/NaN', () => {
    expect(computeDesiredMultiplier(0, 12, 300)).toBe(0)
    expect(computeDesiredMultiplier(400, 0, 300)).toBe(0)
    expect(computeDesiredMultiplier(400, 12, 0)).toBe(0)
    expect(computeDesiredMultiplier(-10, 12, 300)).toBe(0)
  })
})

describe('clampMultiplierForCanvasSize', () => {
  it('does not clamp a realistic garment print size', () => {
    // 400px canvas -> 3600px output (12in @ 300dpi) — well under both caps.
    const { multiplier, clamped } = clampMultiplierForCanvasSize(400, 500, 9)
    expect(clamped).toBe(false)
    expect(multiplier).toBeCloseTo(9, 10)
  })

  it('clamps on the per-dimension cap for an elongated canvas whose AREA stays under the area cap', () => {
    // 1000x50 (20:1 strip) at desired multiplier 20 -> raw 20000x1000.
    // Width alone exceeds MAX_CANVAS_DIMENSION_PX, but the resulting area
    // (16384 x 819.2 ≈ 13.4M) stays comfortably under MAX_CANVAS_AREA_PX —
    // isolates the per-dimension branch from the area branch.
    const canvasW = 1000
    const canvasH = 50
    const { multiplier, clamped } = clampMultiplierForCanvasSize(canvasW, canvasH, 20)
    expect(clamped).toBe(true)
    const outW = canvasW * multiplier
    const outH = canvasH * multiplier
    // Clamps exactly to the boundary — not some smaller fixed fallback.
    expect(outW).toBeCloseTo(MAX_CANVAS_DIMENSION_PX, 3)
    expect(outW * outH).toBeLessThan(MAX_CANVAS_AREA_PX)
  })

  it('clamps on total area even when neither dimension alone exceeds the per-dimension cap', () => {
    // A 3000x3000 square at desired multiplier 3 -> raw 9000x9000 = 81M px:
    // under the 16384 dimension cap on each axis, but over the 40M area cap.
    const canvasW = 3000
    const canvasH = 3000
    const desired = 3
    const { multiplier, clamped } = clampMultiplierForCanvasSize(canvasW, canvasH, desired)
    expect(clamped).toBe(true)
    const outW = canvasW * multiplier
    const outH = canvasH * multiplier
    expect(outW).toBeLessThan(MAX_CANVAS_DIMENSION_PX)
    // Clamps exactly to the area boundary — not some smaller fixed fallback.
    expect(outW * outH).toBeCloseTo(MAX_CANVAS_AREA_PX, 0)
  })

  it('is a no-op for degenerate input', () => {
    expect(clampMultiplierForCanvasSize(0, 400, 5)).toEqual({ multiplier: 5, clamped: false })
    expect(clampMultiplierForCanvasSize(400, 0, 5)).toEqual({ multiplier: 5, clamped: false })
    expect(clampMultiplierForCanvasSize(400, 400, 0)).toEqual({ multiplier: 0, clamped: false })
  })
})

describe('computePrintDims', () => {
  it('matches print_width_in * print_dpi exactly when unclamped', () => {
    const dims = computePrintDims(400, 500, 12, 300)
    expect(dims.clamped).toBe(false)
    expect(dims.pixelWidth).toBe(Math.round(12 * 300))
    expect(dims.effectiveDpi).toBeCloseTo(300, 6)
    // height derives from the canvas's own aspect ratio, not a second stored value
    expect(dims.heightIn).toBeCloseTo(12 * (500 / 400), 6)
    expect(dims.pixelHeight).toBe(Math.round(dims.heightIn * 300))
  })

  it('reports a reduced effective DPI, not the requested print_dpi, when clamped', () => {
    // canvas 400x400, print_width_in huge enough to force a clamp at 300dpi
    const dims = computePrintDims(400, 400, 200, 300) // desired = 60000px per side
    expect(dims.clamped).toBe(true)
    expect(dims.effectiveDpi).toBeLessThan(300)
    expect(dims.effectiveDpi).toBeGreaterThan(0)
    // the reported pixel dims must be the ACTUAL (clamped) output size, not the ideal one
    expect(Math.max(dims.pixelWidth, dims.pixelHeight)).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX)
  })

  it('a taller-than-wide canvas clamps on height, not just width', () => {
    const dims = computePrintDims(400, 4000, 12, 300) // aspect 1:10 — height dominates
    expect(dims.clamped).toBe(true)
    expect(dims.pixelHeight).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX)
    expect(dims.pixelHeight).toBeGreaterThan(MAX_CANVAS_DIMENSION_PX - 2) // clamps snugly to the boundary
  })
})
