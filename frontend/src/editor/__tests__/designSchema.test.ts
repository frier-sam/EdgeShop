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
    // 'i-text' is the real Fabric v6 runtime type (see fabric/objectTypes.ts)
    // — used here instead of the PascalCase 'IText' the pre-fix code
    // (wrongly) expected, so this fixture matches what the app actually
    // persists.
    const design: DesignJson = { version: 1, front: { objects: [{ type: 'i-text' }], canvasWidth: 400, canvasHeight: 500 } }
    expect(sideHasArt(design, 'front')).toBe(true)
    expect(sideHasArt(design, 'back')).toBe(false)
    expect(sidesUsedFrom(design, ['front', 'back'])).toEqual(['front'])
  })

  it('a side present but with zero objects does not count as used', () => {
    const design: DesignJson = { version: 1, front: { objects: [], canvasWidth: 400, canvasHeight: 500 } }
    expect(sideHasArt(design, 'front')).toBe(false)
  })
})

// Every fixture below uses the REAL Fabric v6 runtime `.type` strings
// ('image', 'rect' — lowercase, verified against fabric/objectTypes.ts's
// header) rather than the PascalCase class names ('Image', 'Rect') the
// pre-fix designSchema.ts code compared against. Before the fix, `o.type
// !== 'Image'` was true for every one of these lowercase fixtures, so
// scanCanonicalDpiIssues silently skipped every image and this whole
// describe block would fail — that's the regression these tests guard
// against (POD.md §5.1 / §7's add-to-cart DPI block).
describe('scanCanonicalDpiIssues', () => {
  it('flags a raster image well below the block threshold (150x150 upload onto a 12in print area)', () => {
    const design: DesignJson = {
      version: 1,
      front: {
        objects: [{ type: 'image', assetNaturalWidth: 150, width: 400, scaleX: 1 }],
        canvasWidth: 400,
        canvasHeight: 400,
      },
    }
    const issues = scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }])
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('block')
    expect(issues[0].dpi).toBeLessThan(100)
  })

  it('does not flag a vector (SVG) asset even at a tiny natural size', () => {
    const design: DesignJson = {
      version: 1,
      front: {
        objects: [{ type: 'image', isVectorAsset: true, assetNaturalWidth: 24, width: 400, scaleX: 1 }],
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
        objects: [{ type: 'image', assetNaturalWidth: 4000, width: 400, scaleX: 1 }],
        canvasWidth: 400,
        canvasHeight: 400,
      },
    }
    const issues = scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }])
    expect(issues[0].severity).toBe('ok')
    expect(issues[0].dpi).toBeGreaterThanOrEqual(150)
  })

  it('skips non-image objects and sides with no snapshot', () => {
    const design: DesignJson = {
      version: 1,
      front: { objects: [{ type: 'rect' }], canvasWidth: 400, canvasHeight: 400 },
    }
    expect(scanCanonicalDpiIssues(design, [{ side: 'front', print_width_in: 12 }, { side: 'back', print_width_in: 12 }])).toHaveLength(0)
  })
})
