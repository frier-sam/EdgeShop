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
  computeReferenceGeometry,
  PREVIEW_REFERENCE_WIDTH,
  computeFlatStageGeometry,
  type FlatStageGeometryInput,
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

// POD.md §5.6/§7.2 — the canonical reference geometry both the preview
// compositor and the design_json persistence rescale use.
describe('computeReferenceGeometry', () => {
  it('renders the mockup at exactly PREVIEW_REFERENCE_WIDTH wide with no letterboxing', () => {
    // stageH is derived from the mockup's own aspect ratio, so contain-fit is always exact.
    const geo = computeReferenceGeometry(1200, 1500, { x: 0.3, y: 0.28, w: 0.4, h: 0.34 }, 4, 4)
    expect(geo.containBox.left).toBe(0)
    expect(geo.containBox.top).toBe(0)
    expect(geo.containBox.width).toBe(PREVIEW_REFERENCE_WIDTH)
    expect(geo.containBox.height).toBeCloseTo(PREVIEW_REFERENCE_WIDTH * (1500 / 1200), 5)
  })

  it('is independent of viewport — same print rect always yields the same bleed rect', () => {
    const printRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
    const a = computeReferenceGeometry(1200, 1200, printRect, 4, 4)
    const b = computeReferenceGeometry(1200, 1200, printRect, 4, 4)
    expect(a.bleedRectPx).toEqual(b.bleedRectPx)
  })

  it('scales proportionally with a custom reference width', () => {
    const printRect = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }
    const at1000 = computeReferenceGeometry(1200, 1200, printRect, 4, 4, 1000)
    const at2000 = computeReferenceGeometry(1200, 1200, printRect, 4, 4, 2000)
    expect(at2000.bleedRectPx.w).toBeCloseTo(at1000.bleedRectPx.w * 2, 5)
    expect(at2000.bleedRectPx.h).toBeCloseTo(at1000.bleedRectPx.h * 2, 5)
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

// POD-UI3.md §4.1 — the flat design surface. Guarantee 3 (aspect fidelity
// against computeReferenceGeometry) is the print-safety one: a mismatch
// there stretches every design a shopper ever saves, because
// rescaleFabricSnapshot scales each axis independently.
describe('computeFlatStageGeometry (POD-UI3.md §4.1)', () => {
  /** A deliberately varied matrix: a portrait tee, a very wide mockup with an
   *  off-centre print area, a tall-narrow print area, and a square mockup. */
  const MOCKUPS = [
    { name: 'portrait tee 1200x1500', w: 1200, h: 1500 },
    { name: 'very wide 2000x800', w: 2000, h: 800 },
    { name: 'square 1500x1500', w: 1500, h: 1500 },
    { name: 'very tall 700x2100', w: 700, h: 2100 },
  ] as const

  const PRINT_RECTS = [
    { name: 'centred chest', rect: { x: 0.3, y: 0.28, w: 0.4, h: 0.34 } },
    { name: 'off-centre right-sleeve', rect: { x: 0.62, y: 0.1, w: 0.2, h: 0.55 } },
    { name: 'tall-narrow strip', rect: { x: 0.45, y: 0.05, w: 0.08, h: 0.85 } },
    { name: 'wide-short band', rect: { x: 0.05, y: 0.6, w: 0.9, h: 0.12 } },
  ] as const

  const STAGES = [
    { w: 390, h: 520 }, // mobile
    { w: 1280, h: 720 }, // desktop landscape
    { w: 500, h: 1200 }, // absurdly tall
  ] as const

  const input = (over: Partial<FlatStageGeometryInput> = {}): FlatStageGeometryInput => ({
    stageW: 800,
    stageH: 600,
    imageNaturalW: 1200,
    imageNaturalH: 1500,
    printRect: { x: 0.3, y: 0.28, w: 0.4, h: 0.34 },
    bleedPercent: 4,
    safePercent: 4,
    padding: 64,
    ...over,
  })

  // ── Guarantee 1 ────────────────────────────────────────────────────────
  it('centres the bleed rect in the stage, for every mockup/print/stage combination', () => {
    for (const m of MOCKUPS) {
      for (const p of PRINT_RECTS) {
        for (const s of STAGES) {
          const geo = computeFlatStageGeometry(
            input({ stageW: s.w, stageH: s.h, imageNaturalW: m.w, imageNaturalH: m.h, printRect: p.rect })
          )
          const label = `${m.name} / ${p.name} / ${s.w}x${s.h}`
          expect(geo.bleedRectPx.x + geo.bleedRectPx.w / 2, label).toBeCloseTo(s.w / 2, 6)
          expect(geo.bleedRectPx.y + geo.bleedRectPx.h / 2, label).toBeCloseTo(s.h / 2, 6)
        }
      }
    }
  })

  // ── Guarantee 2 ────────────────────────────────────────────────────────
  it('fits the padded stage and touches it on at least one axis (a fit, not a shrink)', () => {
    for (const m of MOCKUPS) {
      for (const p of PRINT_RECTS) {
        for (const s of STAGES) {
          for (const padding of [0, 12, 64]) {
            const geo = computeFlatStageGeometry(
              input({ stageW: s.w, stageH: s.h, imageNaturalW: m.w, imageNaturalH: m.h, printRect: p.rect, padding })
            )
            const label = `${m.name} / ${p.name} / ${s.w}x${s.h} / pad ${padding}`
            const availW = s.w - 2 * padding
            const availH = s.h - 2 * padding
            expect(geo.bleedRectPx.w, label).toBeLessThanOrEqual(availW + 1e-9)
            expect(geo.bleedRectPx.h, label).toBeLessThanOrEqual(availH + 1e-9)
            // The binding axis is exactly flush: min slack is zero.
            const slack = Math.min(availW - geo.bleedRectPx.w, availH - geo.bleedRectPx.h)
            expect(slack, label).toBeCloseTo(0, 6)
          }
        }
      }
    }
  })

  it('touches EXACTLY one axis when the plane and the padded stage differ in aspect', () => {
    // A tall-narrow print area on a 1280x720 stage can only be height-bound;
    // a wide-short one on a 500x1200 stage can only be width-bound. In both
    // cases the other axis must have real slack, not a knife-edge tie.
    const heightBound = computeFlatStageGeometry(
      input({ stageW: 1280, stageH: 720, printRect: { x: 0.45, y: 0.05, w: 0.08, h: 0.85 } })
    )
    expect(720 - 2 * 64 - heightBound.bleedRectPx.h).toBeCloseTo(0, 6)
    expect(1280 - 2 * 64 - heightBound.bleedRectPx.w).toBeGreaterThan(100)

    const widthBound = computeFlatStageGeometry(
      input({ stageW: 500, stageH: 1200, printRect: { x: 0.05, y: 0.6, w: 0.9, h: 0.12 } })
    )
    expect(500 - 2 * 64 - widthBound.bleedRectPx.w).toBeCloseTo(0, 6)
    expect(1200 - 2 * 64 - widthBound.bleedRectPx.h).toBeGreaterThan(100)
  })

  // ── Guarantee 3 — the print-safety invariant ───────────────────────────
  it('matches computeReferenceGeometry’s bleed aspect ratio exactly (print-safety invariant)', () => {
    for (const m of MOCKUPS) {
      for (const p of PRINT_RECTS) {
        for (const s of STAGES) {
          const flat = computeFlatStageGeometry(
            input({ stageW: s.w, stageH: s.h, imageNaturalW: m.w, imageNaturalH: m.h, printRect: p.rect })
          )
          const ref = computeReferenceGeometry(m.w, m.h, p.rect, 4, 4)
          const label = `${m.name} / ${p.name} / ${s.w}x${s.h}`
          expect(flat.bleedRectPx.w / flat.bleedRectPx.h, label).toBeCloseTo(ref.bleedRectPx.w / ref.bleedRectPx.h, 10)
          // Same for the print and safe rects, since the whole chain is shared.
          expect(flat.printRectPx.w / flat.printRectPx.h, label).toBeCloseTo(ref.printRectPx.w / ref.printRectPx.h, 10)
          expect(flat.safeRectPx.w / flat.safeRectPx.h, label).toBeCloseTo(ref.safeRectPx.w / ref.safeRectPx.h, 10)
        }
      }
    }
  })

  it('holds the aspect invariant for two very different mockups and a tall-narrow off-centre print rect', () => {
    // The two cases most likely to expose an axis mix-up: a very wide mockup
    // (ar = 0.4) with an off-centre print area, and a very tall one (ar = 3)
    // with a tall-narrow print area.
    const cases = [
      { w: 2000, h: 800, rect: { x: 0.62, y: 0.1, w: 0.2, h: 0.55 } },
      { w: 700, h: 2100, rect: { x: 0.45, y: 0.05, w: 0.08, h: 0.85 } },
    ]
    for (const c of cases) {
      const flat = computeFlatStageGeometry(
        input({ stageW: 390, stageH: 520, imageNaturalW: c.w, imageNaturalH: c.h, printRect: c.rect })
      )
      const ref = computeReferenceGeometry(c.w, c.h, c.rect, 4, 4)
      // Uniform scale on BOTH axes — not just a matching ratio.
      const scale = flat.bleedRectPx.w / ref.bleedRectPx.w
      expect(flat.bleedRectPx.h / ref.bleedRectPx.h).toBeCloseTo(scale, 9)
      expect(flat.printRectPx.w / ref.printRectPx.w).toBeCloseTo(scale, 9)
      expect(flat.printRectPx.h / ref.printRectPx.h).toBeCloseTo(scale, 9)
    }
  })

  // ── Guarantee 4 ────────────────────────────────────────────────────────
  it('returns a containBox that really does produce the three rects under the frozen maths', () => {
    for (const m of MOCKUPS) {
      for (const p of PRINT_RECTS) {
        for (const s of STAGES) {
          const geo = computeFlatStageGeometry(
            input({ stageW: s.w, stageH: s.h, imageNaturalW: m.w, imageNaturalH: m.h, printRect: p.rect })
          )
          const label = `${m.name} / ${p.name} / ${s.w}x${s.h}`
          const print = normalizedToPixelRect(p.rect, geo.containBox)
          expect(print.x, label).toBeCloseTo(geo.printRectPx.x, 9)
          expect(print.y, label).toBeCloseTo(geo.printRectPx.y, 9)
          expect(print.w, label).toBeCloseTo(geo.printRectPx.w, 9)
          expect(print.h, label).toBeCloseTo(geo.printRectPx.h, 9)

          const bleed = deriveBleedRect(print, 4)
          expect(bleed.x, label).toBeCloseTo(geo.bleedRectPx.x, 9)
          expect(bleed.y, label).toBeCloseTo(geo.bleedRectPx.y, 9)
          expect(bleed.w, label).toBeCloseTo(geo.bleedRectPx.w, 9)
          expect(bleed.h, label).toBeCloseTo(geo.bleedRectPx.h, 9)

          const safe = deriveSafeRect(print, 4)
          expect(safe.x, label).toBeCloseTo(geo.safeRectPx.x, 9)
          expect(safe.y, label).toBeCloseTo(geo.safeRectPx.y, 9)
          expect(safe.w, label).toBeCloseTo(geo.safeRectPx.w, 9)
          expect(safe.h, label).toBeCloseTo(geo.safeRectPx.h, 9)
        }
      }
    }
  })

  it('keeps the containBox a true mockup box — its aspect is the mockup’s, and normalized coords round-trip', () => {
    const geo = computeFlatStageGeometry(input({ imageNaturalW: 2000, imageNaturalH: 800 }))
    expect(geo.containBox.height / geo.containBox.width).toBeCloseTo(800 / 2000, 9)
    const back = pixelToNormalizedRect(geo.printRectPx, geo.containBox)
    expect(back.x).toBeCloseTo(0.3, 9)
    expect(back.y).toBeCloseTo(0.28, 9)
    expect(back.w).toBeCloseTo(0.4, 9)
    expect(back.h).toBeCloseTo(0.34, 9)
  })

  // ── Guarantee 5 ────────────────────────────────────────────────────────
  it('falls back to computeStageGeometry on every degenerate input rather than dividing by zero', () => {
    const degenerate: Partial<FlatStageGeometryInput>[] = [
      { stageW: 0 },
      { stageW: -10 },
      { stageH: 0 },
      { imageNaturalW: 0 },
      { imageNaturalH: 0 },
      { printRect: { x: 0.3, y: 0.28, w: 0, h: 0.34 } },
      { printRect: { x: 0.3, y: 0.28, w: 0.4, h: 0 } },
    ]
    for (const over of degenerate) {
      const args = input(over)
      const flat = computeFlatStageGeometry(args)
      expect(flat, JSON.stringify(over)).toEqual(computeStageGeometry(args))
      for (const rect of [flat.printRectPx, flat.bleedRectPx, flat.safeRectPx]) {
        expect(Number.isFinite(rect.x)).toBe(true)
        expect(Number.isFinite(rect.y)).toBe(true)
        expect(Number.isFinite(rect.w)).toBe(true)
        expect(Number.isFinite(rect.h)).toBe(true)
      }
    }
  })

  it('falls back when the padding leaves no positive plane to fit (stage narrower than 2*padding)', () => {
    const args = input({ stageW: 100, stageH: 400, padding: 64 })
    expect(computeFlatStageGeometry(args)).toEqual(computeStageGeometry(args))
    const exact = input({ stageW: 128, stageH: 400, padding: 64 })
    expect(computeFlatStageGeometry(exact)).toEqual(computeStageGeometry(exact))
  })

  // ── Behaviour the whole change exists for (POD-UI3.md §3.1) ────────────
  it('makes the plane far larger than the mockup-relative print area it replaces', () => {
    const args = input({ stageW: 390, stageH: 520, padding: 64 })
    const flat = computeFlatStageGeometry(args)
    const mockupRelative = computeStageGeometry(args)
    expect(flat.bleedRectPx.w).toBeGreaterThan(mockupRelative.bleedRectPx.w * 1.5)
  })

  it('collapses bleed onto print at bleedPercent 0 and still fits the padded stage', () => {
    const geo = computeFlatStageGeometry(input({ bleedPercent: 0 }))
    expect(geo.bleedRectPx).toEqual(geo.printRectPx)
    expect(geo.bleedRectPx.w).toBeLessThanOrEqual(800 - 128 + 1e-9)
    expect(geo.bleedRectPx.h).toBeLessThanOrEqual(600 - 128 + 1e-9)
  })
})
