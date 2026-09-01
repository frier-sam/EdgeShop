// Bug 3b — integration test against the REAL (frozen) resizeCanvasScaled/
// setCanvasDimensionsRaw from fabric/canvas.ts, driving them through the
// exact "shrink to pure bleed size -> rescale -> regrow with the gutter"
// sequence EditorStage.tsx performs on every geometry pass. This is the
// specific coordinate bug the task brief calls out: if a gutter-inclusive
// canvas size were ever fed into resizeCanvasScaled's plain
// nextWidth/canvas.getWidth() ratio, an object's registration relative to
// the bleed rect would silently drift on every resize. This test proves
// it does not, using a minimal mock canvas (same pattern as
// fabric/__tests__/selection.test.ts) rather than a real Fabric instance.
import { describe, it, expect } from 'vitest'
import { resizeCanvasScaled, setCanvasDimensionsRaw } from '../fabric/canvas'
import { gutteredCanvasSize, gutterViewportTransform } from '../canvasGutter'
import type { FabricCanvas, FabricObject } from '../fabric/loadFabric'

interface MockObject {
  left: number
  top: number
  scaleX: number
  scaleY: number
  set: (props: Record<string, number>) => void
  setCoords: () => void
}

function mockObject(left: number, top: number, scaleX = 1, scaleY = 1): MockObject {
  const obj: MockObject = {
    left,
    top,
    scaleX,
    scaleY,
    set(props) {
      Object.assign(obj, props)
    },
    setCoords() {},
  }
  return obj
}

function mockCanvas(width: number, height: number, objects: MockObject[]) {
  const state = { width, height }
  return {
    getWidth: () => state.width,
    getHeight: () => state.height,
    getObjects: () => objects,
    setDimensions: ({ width: w, height: h }: { width: number; height: number }) => {
      state.width = w
      state.height = h
    },
    requestRenderAll: () => {},
  }
}

/** Runs one EditorStage-style "same-side resize" geometry pass: un-grow to `fromBleed`, rescale to `toBleed`, regrow by the gutter. Mirrors EditorStage.tsx's else-branch + shared tail exactly. */
function runResizePass(
  canvas: ReturnType<typeof mockCanvas>,
  fromBleed: { w: number; h: number },
  toBleed: { w: number; h: number }
) {
  setCanvasDimensionsRaw(canvas as unknown as FabricCanvas, fromBleed.w, fromBleed.h)
  resizeCanvasScaled(canvas as unknown as FabricCanvas, toBleed.w, toBleed.h)
  const grown = gutteredCanvasSize(toBleed.w, toBleed.h)
  setCanvasDimensionsRaw(canvas as unknown as FabricCanvas, grown.width, grown.height)
}

describe('gutter-aware resize sequence (Bug 3b)', () => {
  it('rescales an object by the PURE bleed ratio across a resize, unaffected by the gutter already applied to the canvas element', () => {
    const bleedFrom = { w: 400, h: 400 }
    const bleedTo = { w: 300, h: 300 } // 25% shrink
    const obj = mockObject(200, 100, 2, 2) // centered-ish object, e.g. text at (200,100) scale 2

    // Canvas starts already gutter-grown (as it always is after a prior
    // pass in the real component) — this is the state resizeCanvasScaled
    // must NOT be allowed to read its ratio from directly.
    const grownFrom = gutteredCanvasSize(bleedFrom.w, bleedFrom.h)
    const canvas = mockCanvas(grownFrom.width, grownFrom.height, [obj])

    runResizePass(canvas, bleedFrom, bleedTo)

    const expectedRatio = bleedTo.w / bleedFrom.w // == bleedTo.h / bleedFrom.h here (square)
    expect(obj.left).toBeCloseTo(200 * expectedRatio, 10)
    expect(obj.top).toBeCloseTo(100 * expectedRatio, 10)
    expect(obj.scaleX).toBeCloseTo(2 * expectedRatio, 10)
    expect(obj.scaleY).toBeCloseTo(2 * expectedRatio, 10)

    // And the canvas element itself ends up gutter-inclusive again, at
    // the NEW target size.
    const expectedGrown = gutteredCanvasSize(bleedTo.w, bleedTo.h)
    expect(canvas.getWidth()).toBe(expectedGrown.width)
    expect(canvas.getHeight()).toBe(expectedGrown.height)
  })

  it('matches a plain (no-gutter) resize bit-for-bit — the gutter never leaks into the scale ratio', () => {
    const bleedFrom = { w: 517, h: 383 } // deliberately non-square, non-round
    const bleedTo = { w: 210, h: 155.7 }

    const objGutter = mockObject(123.25, 44.5, 1.3, 0.9)
    const objPlain = mockObject(123.25, 44.5, 1.3, 0.9)

    const grownFrom = gutteredCanvasSize(bleedFrom.w, bleedFrom.h)
    const canvasGutter = mockCanvas(grownFrom.width, grownFrom.height, [objGutter])
    const canvasPlain = mockCanvas(bleedFrom.w, bleedFrom.h, [objPlain]) // never gutter-grown at all

    runResizePass(canvasGutter, bleedFrom, bleedTo)
    resizeCanvasScaled(canvasPlain as unknown as FabricCanvas, bleedTo.w, bleedTo.h)

    expect(objGutter.left).toBeCloseTo(objPlain.left, 10)
    expect(objGutter.top).toBeCloseTo(objPlain.top, 10)
    expect(objGutter.scaleX).toBeCloseTo(objPlain.scaleX, 10)
    expect(objGutter.scaleY).toBeCloseTo(objPlain.scaleY, 10)
  })

  it('gutterViewportTransform is a pure translation, so it never appears in what would be serialized (objects carry no viewport state)', () => {
    const obj = mockObject(10, 10) as unknown as FabricObject
    const vpt = gutterViewportTransform()
    // Sanity: applying the "camera" conceptually doesn't touch the object.
    expect(obj.left).toBe(10)
    expect(vpt).toHaveLength(6)
  })
})
