// POD-V2.md §6.2 / §11 Phase 4 task 4.1 — fitSnapshotToCanvas's required
// unit tests, verbatim from the spec: a square-into-wide fit stays square
// and centred, every object's own aspect ratio survives, a same-shape fit
// is equivalent to rescaleFabricSnapshot, and degenerate dimensions never
// produce NaN.
import { describe, it, expect } from 'vitest'
import { fitSnapshotToCanvas } from '../fabric/fitSnapshot'
import { rescaleFabricSnapshot } from '../fabric/rescaleSnapshot'

describe('fitSnapshotToCanvas', () => {
  it('fits a square template into a wide area, staying square and centred', () => {
    // A 100x100 template with one full-bleed square object (centre at 50,50).
    const snapshot = { objects: [{ left: 50, top: 50, scaleX: 1, scaleY: 1 }] }
    const out = fitSnapshotToCanvas(snapshot, 100, 100, 200, 100)
    // scale = min(200/100, 100/100) = 1; offsetX = (200-100)/2 = 50, offsetY = 0.
    expect(out.objects![0]).toMatchObject({ left: 100, top: 50, scaleX: 1, scaleY: 1 })
    // Object's own aspect ratio (scaleX/scaleY) is preserved — it's still square.
    const o = out.objects![0] as { scaleX: number; scaleY: number }
    expect(o.scaleX / o.scaleY).toBeCloseTo(1)
  })

  it('fits a wide template into a tall area, staying centred (letterboxed vertically)', () => {
    const snapshot = { objects: [{ left: 100, top: 50, scaleX: 1, scaleY: 1 }] }
    const out = fitSnapshotToCanvas(snapshot, 200, 100, 100, 200)
    // scale = min(100/200, 200/100) = min(0.5, 2) = 0.5; offsetX = (100-100)/2 = 0, offsetY = (200-50)/2 = 75.
    expect(out.objects![0]).toMatchObject({ left: 50, top: 100, scaleX: 0.5, scaleY: 0.5 })
  })

  it('preserves every object\'s own aspect ratio even under a non-uniform-looking fit', () => {
    // A 2:1 rectangle (scaleX=4, scaleY=2) authored on a 100x50 template.
    const snapshot = { objects: [{ left: 50, top: 25, scaleX: 4, scaleY: 2 }] }
    const out = fitSnapshotToCanvas(snapshot, 100, 50, 50, 50)
    const o = out.objects![0] as { scaleX: number; scaleY: number }
    // scale = min(50/100, 50/50) = 0.5 — both axes multiplied by the SAME factor.
    expect(o.scaleX).toBeCloseTo(2)
    expect(o.scaleY).toBeCloseTo(1)
    expect(o.scaleX / o.scaleY).toBeCloseTo(4 / 2) // ratio unchanged
  })

  it('is equivalent to rescaleFabricSnapshot for a same-shape (non-letterboxed) fit', () => {
    const snapshot = {
      version: '6.9.1',
      objects: [
        { type: 'IText', left: 120, top: 40, scaleX: 1.5, scaleY: 1.5 },
        { type: 'Rect', left: 300, top: 150, scaleX: 0.5, scaleY: 2 },
      ],
    }
    // fromW/fromH and toW/toH share the same aspect ratio (2:1), so there is
    // nothing to letterbox and the uniform scale factor equals both of
    // rescaleFabricSnapshot's independent per-axis factors.
    const rescaled = rescaleFabricSnapshot(snapshot, 400, 200, 800, 400)
    const fitted = fitSnapshotToCanvas(snapshot, 400, 200, 800, 400)
    expect(fitted).toEqual(rescaled)
  })

  it('handles zero/negative dimensions without producing NaN — returns the snapshot unchanged', () => {
    const snapshot = { objects: [{ left: 10, top: 10, scaleX: 1, scaleY: 1 }] }
    const cases: [number, number, number, number][] = [
      [0, 100, 200, 200],
      [100, 0, 200, 200],
      [100, 100, 0, 200],
      [100, 100, 200, 0],
      [-50, 100, 200, 200],
      [100, 100, -50, 200],
    ]
    for (const [fromW, fromH, toW, toH] of cases) {
      const out = fitSnapshotToCanvas(snapshot, fromW, fromH, toW, toH)
      expect(out).toEqual(snapshot)
      for (const key of ['left', 'top', 'scaleX', 'scaleY'] as const) {
        expect(Number.isNaN((out.objects![0] as Record<string, number>)[key])).toBe(false)
      }
    }
  })

  it('defaults missing left/top/scaleX/scaleY to Fabric defaults (0/0/1/1) before scaling', () => {
    const snapshot = { objects: [{ type: 'Rect' }] }
    const out = fitSnapshotToCanvas(snapshot, 100, 100, 300, 300)
    expect(out.objects![0]).toMatchObject({ left: 0, top: 0, scaleX: 3, scaleY: 3 })
  })

  it('preserves every other object property untouched', () => {
    const snapshot = { objects: [{ left: 0, top: 0, fill: '#ff0000', fontFamily: 'Poppins', assetNaturalWidth: 2000 }] }
    const out = fitSnapshotToCanvas(snapshot, 100, 100, 200, 200)
    expect(out.objects![0]).toMatchObject({ fill: '#ff0000', fontFamily: 'Poppins', assetNaturalWidth: 2000 })
  })

  it('passes through a snapshot with no objects array unchanged', () => {
    const snapshot = { background: null }
    expect(fitSnapshotToCanvas(snapshot, 100, 100, 200, 200)).toEqual(snapshot)
  })
})
