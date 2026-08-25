import { describe, it, expect } from 'vitest'
import {
  validateSidesUsed,
  checkSidesAreCustomizable,
  validateDesignJsonPayload,
  type DesignSideRow,
} from './designValidation'

describe('validateSidesUsed', () => {
  it('accepts a single valid side', () => {
    const result = validateSidesUsed(['front'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sides).toEqual(['front'])
  })

  it('accepts both valid sides', () => {
    const result = validateSidesUsed(['front', 'back'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sides).toEqual(['front', 'back'])
  })

  it('rejects a missing (undefined) sides_used', () => {
    const result = validateSidesUsed(undefined)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/non-empty array/)
  })

  it('rejects an empty array', () => {
    const result = validateSidesUsed([])
    expect(result.ok).toBe(false)
  })

  it('rejects a non-array value', () => {
    expect(validateSidesUsed('front').ok).toBe(false)
    expect(validateSidesUsed({ front: true }).ok).toBe(false)
    expect(validateSidesUsed(null).ok).toBe(false)
  })

  it('rejects a side that is neither "front" nor "back"', () => {
    const result = validateSidesUsed(['front', 'sleeve'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/only contain/)
  })

  it('rejects an attempt to smuggle a non-string value through as a side', () => {
    // e.g. a crafted body posting sides_used: [{}] or [123] — String()
    // coercion must not accidentally produce 'front'/'back'.
    const result = validateSidesUsed([123, {}])
    expect(result.ok).toBe(false)
  })
})

describe('checkSidesAreCustomizable', () => {
  const TEE_SIDES: DesignSideRow[] = [
    { side: 'front', customizable: 1 },
    { side: 'back', customizable: 0 }, // configured, but merchant turned customization off
  ]

  it('accepts a side that exists and is customizable', () => {
    const result = checkSidesAreCustomizable(['front'], TEE_SIDES)
    expect(result.ok).toBe(true)
  })

  it('accepts multiple sides that are all customizable', () => {
    const bothOn: DesignSideRow[] = [
      { side: 'front', customizable: 1 },
      { side: 'back', customizable: 1 },
    ]
    expect(checkSidesAreCustomizable(['front', 'back'], bothOn).ok).toBe(true)
  })

  it('rejects a side that exists on the product but is not customizable', () => {
    const result = checkSidesAreCustomizable(['back'], TEE_SIDES)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/"back"/)
  })

  it('rejects a side the product has no row for at all', () => {
    // e.g. a mug with only a 'front' side row — claiming 'back' must fail,
    // not silently pass because the side name itself is well-formed.
    const mugSides: DesignSideRow[] = [{ side: 'front', customizable: 1 }]
    const result = checkSidesAreCustomizable(['back'], mugSides)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/"back"/)
  })

  it('rejects when the product has zero side rows configured', () => {
    const result = checkSidesAreCustomizable(['front'], [])
    expect(result.ok).toBe(false)
  })

  it('fails on the first offending side without needing every side to be invalid', () => {
    const result = checkSidesAreCustomizable(['front', 'back'], TEE_SIDES)
    // front is fine, back is customizable:0 — the whole design must be rejected
    expect(result.ok).toBe(false)
  })
})

describe('validateDesignJsonPayload', () => {
  const MAX = 512 * 1024

  it('accepts a well-formed design_json object', () => {
    const raw = JSON.stringify({ version: 1, front: { objects: [] } })
    const result = validateDesignJsonPayload(raw, MAX)
    expect(result.ok).toBe(true)
    expect(result.parsed).toEqual({ version: 1, front: { objects: [] } })
  })

  it('rejects a missing design_json', () => {
    expect(validateDesignJsonPayload(undefined, MAX).ok).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(validateDesignJsonPayload('', MAX).ok).toBe(false)
  })

  it('rejects a non-string value', () => {
    expect(validateDesignJsonPayload({ version: 1 }, MAX).ok).toBe(false)
  })

  it('rejects invalid JSON', () => {
    const result = validateDesignJsonPayload('{not valid json', MAX)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/)
  })

  it('rejects JSON that parses to an array rather than an object', () => {
    expect(validateDesignJsonPayload('[1,2,3]', MAX).ok).toBe(false)
  })

  it('rejects JSON that parses to null (the classic typeof-null footgun)', () => {
    const result = validateDesignJsonPayload('null', MAX)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/must be an object/)
  })

  it('rejects JSON that parses to a primitive (string/number)', () => {
    expect(validateDesignJsonPayload('"just a string"', MAX).ok).toBe(false)
    expect(validateDesignJsonPayload('42', MAX).ok).toBe(false)
  })

  it('rejects a payload over the byte cap', () => {
    const big = JSON.stringify({ front: { objects: [], padding: 'x'.repeat(100) } })
    const result = validateDesignJsonPayload(big, 50) // cap far smaller than the payload
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/too large/)
  })

  it('measures the cap in real UTF-8 bytes, not UTF-16 code units', () => {
    // Each 🎨 is 1 UTF-16 code unit pair (2 code units) but 4 UTF-8 bytes.
    // A cap of 30 bytes must reject ~10 emoji even though .length (code
    // units) would report a much smaller number.
    const emojiHeavy = JSON.stringify({ note: '🎨'.repeat(10) })
    const result = validateDesignJsonPayload(emojiHeavy, 30)
    expect(result.ok).toBe(false)
  })

  it('accepts a payload right at the byte cap boundary', () => {
    const raw = '{}' // 2 bytes
    expect(validateDesignJsonPayload(raw, 2).ok).toBe(true)
    expect(validateDesignJsonPayload(raw, 1).ok).toBe(false)
  })
})
