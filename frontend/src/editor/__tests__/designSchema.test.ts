import { describe, it, expect } from 'vitest'
import { sideHasArt, sidesUsedFrom, scanCanonicalDpiIssues, emptyDesignJson, type DesignJson } from '../designSchema'

describe('sideHasArt / sidesUsedFrom', () => {
  it('emptyDesignJson has no art on either side', () => {
    const design = emptyDesignJson()
    expect(sideHasArt(design, 'front')).toBe(false)
    expect(sideHasArt(design, 'back')).toBe(false)
    expect(sidesUsedFrom(design, ['front', 'back'])).toEqual([])
  })

  it('detects a side with at least one object', () => {
    const design: DesignJson = { version: 1, front: { objects: [{ type: 'IText' }], canvasWidth: 400, canvasHeight: 500 } }
    expect(sideHasArt(design, 'front')).toBe(true)
    expect(sideHasArt(design, 'back')).toBe(false)
    expect(sidesUsedFrom(design, ['front', 'back'])).toEqual(['front'])
  })

  it('a side present but with zero objects does not count as used', () => {
    const design: DesignJson = { version: 1, front: { objects: [], canvasWidth: 400, canvasHeight: 500 } }
    expect(sideHasArt(design, 'front')).toBe(false)
  })
})

describe('scanCanonicalDpiIssues', () => {
  it('flags a raster image well below the block threshold', () => {
    const design: DesignJson = {
      version: 1,
      front: {
        objects: [{ type: 'Image', assetNaturalWidth: 100, width: 400, scaleX: 1 }],
        canvasWidth: 400,
        canvasHeight: 400,
      },
    }
    const issues = scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }])
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('block')
  })

  it('does not flag a vector (SVG) asset even at a tiny natural size', () => {
    const design: DesignJson = {
      version: 1,
      front: {
        objects: [{ type: 'Image', isVectorAsset: true, assetNaturalWidth: 24, width: 400, scaleX: 1 }],
        canvasWidth: 400,
        canvasHeight: 400,
      },
    }
    expect(scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }])).toHaveLength(0)
  })

  it('is clean for a high-resolution image', () => {
    const design: DesignJson = {
      version: 1,
      front: {
        objects: [{ type: 'Image', assetNaturalWidth: 4000, width: 400, scaleX: 1 }],
        canvasWidth: 400,
        canvasHeight: 400,
      },
    }
    const issues = scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }])
    expect(issues[0].severity).toBe('ok')
  })

  it('skips non-image objects and sides with no snapshot', () => {
    const design: DesignJson = {
      version: 1,
      front: { objects: [{ type: 'Rect' }], canvasWidth: 400, canvasHeight: 400 },
    }
    expect(scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }, { side: 'back', print_width_in: 12 }])).toHaveLength(0)
  })
})
