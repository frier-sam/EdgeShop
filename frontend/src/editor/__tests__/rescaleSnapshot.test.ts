import { describe, it, expect } from 'vitest'
import { rescaleFabricSnapshot, snapshotHasArt } from '../fabric/rescaleSnapshot'

describe('rescaleFabricSnapshot', () => {
  it('scales left/top/scaleX/scaleY uniformly', () => {
    const snapshot = {
      version: '6.9.1',
      background: null,
      objects: [{ type: 'IText', left: 100, top: 50, scaleX: 1, scaleY: 1 }],
    }
    const out = rescaleFabricSnapshot(snapshot, 400, 200, 800, 400)
    expect(out.objects![0]).toMatchObject({ left: 200, top: 100, scaleX: 2, scaleY: 2 })
  })

  it('is a no-op scale (1x) when from/to sizes match', () => {
    const snapshot = { objects: [{ left: 10, top: 20, scaleX: 1.5, scaleY: 1.5 }] }
    const out = rescaleFabricSnapshot(snapshot, 500, 500, 500, 500)
    expect(out.objects![0]).toMatchObject({ left: 10, top: 20, scaleX: 1.5, scaleY: 1.5 })
  })

  it('preserves every other object property untouched', () => {
    const snapshot = { objects: [{ left: 0, top: 0, fill: '#ff0000', fontFamily: 'Poppins', assetNaturalWidth: 2000 }] }
    const out = rescaleFabricSnapshot(snapshot, 100, 100, 200, 200)
    expect(out.objects![0]).toMatchObject({ fill: '#ff0000', fontFamily: 'Poppins', assetNaturalWidth: 2000 })
  })

  it('defaults missing left/top/scaleX/scaleY to Fabric defaults (0/0/1/1) before scaling', () => {
    const snapshot = { objects: [{ type: 'Rect' }] }
    const out = rescaleFabricSnapshot(snapshot, 100, 100, 300, 300)
    expect(out.objects![0]).toMatchObject({ left: 0, top: 0, scaleX: 3, scaleY: 3 })
  })

  it('passes through a snapshot with no objects array unchanged', () => {
    const snapshot = { background: null }
    expect(rescaleFabricSnapshot(snapshot, 100, 100, 200, 200)).toEqual(snapshot)
  })

  it('handles a zero fromWidth/fromHeight without dividing by zero', () => {
    const snapshot = { objects: [{ left: 10, top: 10, scaleX: 1, scaleY: 1 }] }
    const out = rescaleFabricSnapshot(snapshot, 0, 0, 200, 200)
    // falls back to a 1x scale factor rather than NaN/Infinity
    expect(out.objects![0]).toMatchObject({ left: 10, top: 10, scaleX: 1, scaleY: 1 })
  })
})

describe('snapshotHasArt', () => {
  it('is false for null/undefined/empty-objects snapshots', () => {
    expect(snapshotHasArt(null)).toBe(false)
    expect(snapshotHasArt(undefined)).toBe(false)
    expect(snapshotHasArt({ objects: [] })).toBe(false)
  })

  it('is true when there is at least one object', () => {
    expect(snapshotHasArt({ objects: [{ type: 'Rect' }] })).toBe(true)
  })
})
