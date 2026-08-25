import { describe, it, expect } from 'vitest'
import {
  computeContainBox,
  normalizedToPixelRect,
  pixelToNormalizedRect,
  computeStageGeometry,
  deriveBleedRect,
  deriveSafeRect,
  marginAmountPx,
  computeEffectiveDpi,
  dpiSeverity,
  DPI_WARN_THRESHOLD,
  DPI_BLOCK_THRESHOLD,
  starPoints,
} from '../geometry'

describe('computeContainBox', () => {
  it('centers a wider-than-stage image with letterboxing top/bottom', () => {
    // stage is a 400x400 square, image is 1200x1500 (portrait, taller than wide)
    const box = computeContainBox(400, 400, 1200, 1500)
    // image aspect (0.8) < stage aspect (1) -> height-constrained
    expect(box.height).toBe(400)
    expect(box.width).toBeCloseTo(320, 5)
    expect(box.top).toBe(0)
    expect(box.left).toBeCloseTo(40, 5)
  })

  it('centers a portrait image inside a landscape stage with letterboxing left/right', () => {
    // stage is 400x200 (landscape, aspect 2), image is 1200x1500 (portrait, aspect 0.8)
    // -> image aspect < stage aspect -> height-constrained
    const box = computeContainBox(400, 200, 1200, 1500)
    expect(box.height).toBe(200)
    expect(box.width).toBeCloseTo(160, 5)
    expect(box.top).toBe(0)
    expect(box.left).toBeCloseTo(120, 5)
  })

  it('returns a zeroed box for degenerate input rather than NaN/Infinity', () => {
    expect(computeContainBox(0, 400, 100, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 })
    expect(computeContainBox(400, 400, 0, 100)).toEqual({ left: 0, top: 0, width: 0, height: 0 })
  })
})

describe('normalized <-> pixel round-trip', () => {
  it('recovers the original normalized rect after a forward+inverse pass', () => {
    const box = computeContainBox(800, 600, 1200, 1500)
    const norm = { x: 0.3, y: 0.28, w: 0.4, h: 0.34 }
    const px = normalizedToPixelRect(norm, box)
    const back = pixelToNormalizedRect(px, box)
    expect(back.x).toBeCloseTo(norm.x, 10)
    expect(back.y).toBeCloseTo(norm.y, 10)
    expect(back.w).toBeCloseTo(norm.w, 10)
    expect(back.h).toBeCloseTo(norm.h, 10)
  })

  it('is stable across an arbitrary set of stage sizes (simulating window resize)', () => {
    const norm = { x: 0.1, y: 0.15, w: 0.5, h: 0.6 }
    for (const [sw, sh] of [[300, 300], [1920, 1080], [500, 1200], [768, 1024]] as const) {
      const box = computeContainBox(sw, sh, 1200, 1500)
      const px = normalizedToPixelRect(norm, box)
      const back = pixelToNormalizedRect(px, box)
      expect(back.x).toBeCloseTo(norm.x, 8)
      expect(back.y).toBeCloseTo(norm.y, 8)
      expect(back.w).toBeCloseTo(norm.w, 8)
      expect(back.h).toBeCloseTo(norm.h, 8)
    }
  })
})

describe('bleed / safe derivation (POD.md §5.3)', () => {
  const printRectPx = { x: 100, y: 100, w: 200, h: 300 } // shorter side = 200

  it('grows the bleed rect outward by percent-of-shorter-side on every edge', () => {
    const amount = marginAmountPx(printRectPx, 4) // 4% of 200 = 8
    expect(amount).toBe(8)
    const bleed = deriveBleedRect(printRectPx, 4)
    expect(bleed).toEqual({ x: 92, y: 92, w: 216, h: 316 })
  })

  it('shrinks the safe rect inward by percent-of-shorter-side on every edge', () => {
    const safe = deriveSafeRect(printRectPx, 4)
    expect(safe).toEqual({ x: 108, y: 108, w: 184, h: 284 })
  })

  it('bleed always contains print, and print always contains safe', () => {
    const bleed = deriveBleedRect(printRectPx, 4)
    const safe = deriveSafeRect(printRectPx, 4)
    expect(bleed.x).toBeLessThanOrEqual(printRectPx.x)
    expect(bleed.y).toBeLessThanOrEqual(printRectPx.y)
    expect(bleed.x + bleed.w).toBeGreaterThanOrEqual(printRectPx.x + printRectPx.w)
    expect(bleed.y + bleed.h).toBeGreaterThanOrEqual(printRectPx.y + printRectPx.h)

    expect(safe.x).toBeGreaterThanOrEqual(printRectPx.x)
    expect(safe.y).toBeGreaterThanOrEqual(printRectPx.y)
    expect(safe.x + safe.w).toBeLessThanOrEqual(printRectPx.x + printRectPx.w)
    expect(safe.y + safe.h).toBeLessThanOrEqual(printRectPx.y + printRectPx.h)
  })

  it('a zero percent leaves the rect unchanged', () => {
    expect(deriveBleedRect(printRectPx, 0)).toEqual(printRectPx)
    expect(deriveSafeRect(printRectPx, 0)).toEqual(printRectPx)
  })
})

describe('computeStageGeometry (aggregate)', () => {
  it('wires containBox -> printRectPx -> bleed/safe consistently', () => {
    const geo = computeStageGeometry({
      stageW: 800,
      stageH: 800,
      imageNaturalW: 1200,
      imageNaturalH: 1500,
      printRect: { x: 0.3, y: 0.28, w: 0.4, h: 0.34 },
      bleedPercent: 4,
      safePercent: 4,
    })
    // sanity: print rect sits fully inside the contain box
    expect(geo.printRectPx.x).toBeGreaterThanOrEqual(geo.containBox.left)
    expect(geo.printRectPx.y).toBeGreaterThanOrEqual(geo.containBox.top)
    expect(geo.printRectPx.x + geo.printRectPx.w).toBeLessThanOrEqual(geo.containBox.left + geo.containBox.width + 1e-6)
    // bleed grows outward, safe shrinks inward, relative to print
    expect(geo.bleedRectPx.w).toBeGreaterThan(geo.printRectPx.w)
    expect(geo.safeRectPx.w).toBeLessThan(geo.printRectPx.w)
  })

  it('keeps the design proportional to the print area across a resize (no drift)', () => {
    const args = {
      imageNaturalW: 1200,
      imageNaturalH: 1500,
      printRect: { x: 0.3, y: 0.28, w: 0.4, h: 0.34 },
      bleedPercent: 4,
      safePercent: 4,
    }
    const small = computeStageGeometry({ ...args, stageW: 400, stageH: 400 })
    const large = computeStageGeometry({ ...args, stageW: 1200, stageH: 1200 })
    // bleed rect width should scale by the same factor as the contain box width
    const boxScale = large.containBox.width / small.containBox.width
    const bleedScale = large.bleedRectPx.w / small.bleedRectPx.w
    expect(bleedScale).toBeCloseTo(boxScale, 6)
  })
})

describe('computeEffectiveDpi (POD.md §5.1 / §6.5)', () => {
  it('matches a hand-computed example', () => {
    // A 3000px-wide asset placed at 1/4 the canvas width, canvas is 800px CSS-wide,
    // representing a 12in-wide print area.
    const dpi = computeEffectiveDpi({
      assetNaturalWidth: 3000,
      objectWidthPx: 200, // 1/4 of 800
      canvasCssWidth: 800,
      printWidthIn: 12,
    })
    // inches occupied = (200/800)*12 = 3in -> dpi = 3000/3 = 1000
    expect(dpi).toBeCloseTo(1000, 5)
  })

  it('flags low-DPI art correctly against the warn/block thresholds', () => {
    // A small 400px asset stretched to fill a 12in-wide canvas entirely.
    const dpi = computeEffectiveDpi({
      assetNaturalWidth: 400,
      objectWidthPx: 800,
      canvasCssWidth: 800,
      printWidthIn: 12,
    })
    expect(dpi).toBeCloseTo(400 / 12, 5) // ~33.3 dpi
    expect(dpi).toBeLessThan(DPI_BLOCK_THRESHOLD)
    expect(dpiSeverity(dpi)).toBe('block')
  })

  it('is "ok" comfortably above 150dpi and "warn" between 100 and 150', () => {
    expect(dpiSeverity(300)).toBe('ok')
    expect(dpiSeverity(149)).toBe('warn')
    expect(dpiSeverity(DPI_WARN_THRESHOLD)).toBe('ok') // boundary is exclusive on the low side
    expect(dpiSeverity(120)).toBe('warn')
    expect(dpiSeverity(99)).toBe('block')
    expect(dpiSeverity(DPI_BLOCK_THRESHOLD)).toBe('warn') // boundary is exclusive on the low side
  })

  it('degrades gracefully instead of dividing by zero', () => {
    expect(computeEffectiveDpi({ assetNaturalWidth: 100, objectWidthPx: 0, canvasCssWidth: 800, printWidthIn: 12 })).toBe(Infinity)
    expect(computeEffectiveDpi({ assetNaturalWidth: 100, objectWidthPx: 100, canvasCssWidth: 0, printWidthIn: 12 })).toBe(Infinity)
  })
})

describe('starPoints', () => {
  it('produces 2*spikes points alternating outer/inner radius', () => {
    const points = starPoints(0, 0, 5, 10, 4)
    expect(points).toHaveLength(10)
    // distance from center alternates ~10, ~4
    const dist = (p: { x: number; y: number }) => Math.sqrt(p.x * p.x + p.y * p.y)
    points.forEach((p, i) => {
      expect(dist(p)).toBeCloseTo(i % 2 === 0 ? 10 : 4, 5)
    })
  })
})
