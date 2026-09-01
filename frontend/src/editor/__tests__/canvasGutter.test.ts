// Bug 3b — canvasGutter.ts's pure maths. These are exactly the coordinate
// bugs the task brief warns about: a fixed additive gutter interacting
// with fabric/canvas.ts's frozen resizeCanvasScaled (which rescales by a
// PLAIN nextWidth/prevWidth ratio) can silently drift object registration
// if the gutter is baked into that ratio. EditorStage.tsx handles this by
// always un-growing back to the PURE bleed size before rescaling (see its
// header comment) — these tests pin the primitives that make that
// possible, independent of any live Fabric canvas.
import { describe, it, expect } from 'vitest'
import { HANDLE_GUTTER_PX, gutteredCanvasSize, gutteredWrapperOrigin, gutterViewportTransform } from '../canvasGutter'

describe('gutteredCanvasSize', () => {
  it('adds the gutter to every side (2x the gutter per axis)', () => {
    const size = gutteredCanvasSize(400, 300)
    expect(size.width).toBe(400 + HANDLE_GUTTER_PX * 2)
    expect(size.height).toBe(300 + HANDLE_GUTTER_PX * 2)
  })

  it('accepts a custom gutter', () => {
    expect(gutteredCanvasSize(100, 100, 10)).toEqual({ width: 120, height: 120 })
  })

  it('rounds the pure bleed size before adding the gutter', () => {
    expect(gutteredCanvasSize(99.6, 0, 10)).toEqual({ width: 120, height: 20 })
  })

  it('never returns a dimension below 1px even for degenerate/negative input', () => {
    expect(gutteredCanvasSize(-5, -5, 0)).toEqual({ width: 1, height: 1 })
  })
})

describe('gutteredWrapperOrigin', () => {
  it('shifts the wrapper outward by exactly the gutter on both axes', () => {
    expect(gutteredWrapperOrigin(50, 80)).toEqual({ x: 50 - HANDLE_GUTTER_PX, y: 80 - HANDLE_GUTTER_PX })
  })

  it('composes with gutteredCanvasSize so the bleed rect lands back at the original origin', () => {
    // If you grow the canvas by G and move its origin back by G, the
    // BLEED RECT's own top-left (origin + G, since the vpt shifts
    // rendering by G) must equal the original (pre-gutter) origin.
    const bleedX = 123.4
    const bleedY = 56.7
    const origin = gutteredWrapperOrigin(bleedX, bleedY)
    const [, , , , vptX, vptY] = gutterViewportTransform()
    expect(origin.x + vptX).toBeCloseTo(bleedX, 10)
    expect(origin.y + vptY).toBeCloseTo(bleedY, 10)
  })
})

describe('gutterViewportTransform', () => {
  it('is a pure translation by the gutter — identity scale/skew', () => {
    expect(gutterViewportTransform()).toEqual([1, 0, 0, 1, HANDLE_GUTTER_PX, HANDLE_GUTTER_PX])
  })

  it('honours a custom gutter', () => {
    expect(gutterViewportTransform(5)).toEqual([1, 0, 0, 1, 5, 5])
  })
})
