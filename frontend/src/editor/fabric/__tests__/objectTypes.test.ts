// frontend/src/editor/fabric/__tests__/objectTypes.test.ts
//
// Asserts the predicates against the ACTUAL strings Fabric v6 emits from
// its `.type` getter at runtime (verified against
// node_modules/fabric/dist/index.node.mjs — see objectTypes.ts's header).
// This is the regression test for the bug where selection.ts and
// designSchema.ts compared against the PascalCase class name 'Image' with
// a raw `!==`, which silently never matched the real lowercase runtime
// value and killed the low-DPI warning and the sub-100-DPI add-to-cart
// block (POD.md §5.1). The predicates here normalise case (so they also
// tolerate a PascalCase input defensively — the whole point of not just
// swapping the string literal for another exact-match one), which is
// covered explicitly below.
import { describe, it, expect } from 'vitest'
import { isImageObject, isLineObject, isRectObject, isShapeObject, isTextObject } from '../objectTypes'

describe('isImageObject', () => {
  it('matches the real runtime type', () => {
    expect(isImageObject({ type: 'image' })).toBe(true)
  })
  it('is case-normalising, unlike the raw `=== "Image"` check it replaces', () => {
    expect(isImageObject({ type: 'Image' })).toBe(true)
    expect(isImageObject({ type: 'IMAGE' })).toBe(true)
  })
  it('rejects other object types', () => {
    for (const type of ['rect', 'circle', 'triangle', 'line', 'polygon', 'i-text']) {
      expect(isImageObject({ type })).toBe(false)
    }
  })
  it('handles null/undefined objects and missing type', () => {
    expect(isImageObject(null)).toBe(false)
    expect(isImageObject(undefined)).toBe(false)
    expect(isImageObject({})).toBe(false)
  })
})

describe('isTextObject', () => {
  it('matches the real runtime type, including the i-text hyphenation quirk', () => {
    expect(isTextObject({ type: 'i-text' })).toBe(true)
  })
  it('is case-normalising', () => {
    expect(isTextObject({ type: 'IText' })).toBe(true)
    expect(isTextObject({ type: 'I-TEXT' })).toBe(true)
  })
  it('accepts the unhyphenated alias and other real Fabric text types defensively', () => {
    expect(isTextObject({ type: 'itext' })).toBe(true)
    expect(isTextObject({ type: 'textbox' })).toBe(true)
    expect(isTextObject({ type: 'text' })).toBe(true)
  })
  it('rejects non-text types', () => {
    for (const type of ['image', 'rect', 'circle', 'triangle', 'line', 'polygon']) {
      expect(isTextObject({ type })).toBe(false)
    }
  })
})

describe('isShapeObject', () => {
  it('matches every real runtime shape type', () => {
    for (const type of ['rect', 'circle', 'triangle', 'line', 'polygon']) {
      expect(isShapeObject({ type })).toBe(true)
    }
  })
  it('is case-normalising', () => {
    for (const type of ['Rect', 'Circle', 'Triangle', 'Line', 'Polygon']) {
      expect(isShapeObject({ type })).toBe(true)
    }
  })
  it('rejects image and text', () => {
    expect(isShapeObject({ type: 'image' })).toBe(false)
    expect(isShapeObject({ type: 'i-text' })).toBe(false)
  })
})

describe('isLineObject / isRectObject', () => {
  it('isLineObject matches only line', () => {
    expect(isLineObject({ type: 'line' })).toBe(true)
    expect(isLineObject({ type: 'rect' })).toBe(false)
    expect(isLineObject({ type: 'Line' })).toBe(true) // case-normalising
  })
  it('isRectObject matches only rect', () => {
    expect(isRectObject({ type: 'rect' })).toBe(true)
    expect(isRectObject({ type: 'line' })).toBe(false)
    expect(isRectObject({ type: 'Rect' })).toBe(true) // case-normalising
  })
})
