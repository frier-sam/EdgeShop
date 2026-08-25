// frontend/src/editor/fabric/__tests__/selection.test.ts
//
// scanImageDpi drives the live-canvas "may look blurry" badge (POD.md
// §5.1 / §6.5, wired into PropertiesPanel's DpiBadge). It used to compare
// `obj.type !== 'Image'` (PascalCase), which never matched Fabric v6's
// real lowercase runtime type — so this function silently returned `[]`
// for every canvas that ever existed. A mock canvas with the real
// lowercase `type: 'image'` fixture below is what that bug looked like in
// practice; these tests fail against the pre-fix comparison.
import { describe, it, expect } from 'vitest'
import { scanImageDpi } from '../selection'
import type { FabricCanvas } from '../loadFabric'

function mockCanvas(objects: Array<Record<string, unknown>>): FabricCanvas {
  const fabricObjects = objects.map((o) => ({
    ...o,
    getScaledWidth: () => (o.width as number) * ((o.scaleX as number) ?? 1),
  }))
  return { getObjects: () => fabricObjects } as unknown as FabricCanvas
}

describe('scanImageDpi', () => {
  it('flags a tiny (150x150) raster image dropped onto a 12in print area', () => {
    const canvas = mockCanvas([{ type: 'image', assetNaturalWidth: 150, width: 400, scaleX: 1 }])
    const issues = scanImageDpi(canvas, 400, 12)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('block')
  })

  it('does not flag a large, high-resolution image', () => {
    const canvas = mockCanvas([{ type: 'image', assetNaturalWidth: 4000, width: 400, scaleX: 1 }])
    const issues = scanImageDpi(canvas, 400, 12)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('ok')
  })

  it('ignores non-image objects (text, shapes)', () => {
    const canvas = mockCanvas([
      { type: 'i-text', assetNaturalWidth: 10, width: 400, scaleX: 1 },
      { type: 'rect', assetNaturalWidth: 10, width: 400, scaleX: 1 },
    ])
    expect(scanImageDpi(canvas, 400, 12)).toHaveLength(0)
  })

  it('ignores vector (SVG) assets regardless of natural size', () => {
    const canvas = mockCanvas([{ type: 'image', isVectorAsset: true, assetNaturalWidth: 10, width: 400, scaleX: 1 }])
    expect(scanImageDpi(canvas, 400, 12)).toHaveLength(0)
  })

  it('returns nothing for an empty canvas', () => {
    expect(scanImageDpi(mockCanvas([]), 400, 12)).toHaveLength(0)
  })
})
