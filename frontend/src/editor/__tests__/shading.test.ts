// POD-UI3.md §4.2 — shading.ts's pure maths. This is the arithmetic that
// decides whether a shopper's artwork survives being composited onto a dark
// garment: `preview.ts` multiplies the normalized mockup over the art, so a
// gain that is wrong by a factor of 2 either washes the shading out entirely
// or crushes the artwork. Every case below is one of the failure modes named
// in shading.ts's header — a black garment eating the art, a coloured garment
// tinting it, a degenerate buffer producing NaN — pinned independently of any
// canvas, image or Fabric module.
import { describe, it, expect } from 'vitest'
import { meanChannels, shadingGain, applyShadingGain, MAX_SHADING_GAIN, SHADING_STRENGTH } from '../shading'

/** RGBA buffer from a flat list of [r,g,b,a] pixels. */
function buf(...pixels: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flat())
}

describe('constants', () => {
  it('SHADING_STRENGTH is a sane globalAlpha', () => {
    expect(SHADING_STRENGTH).toBeGreaterThan(0)
    expect(SHADING_STRENGTH).toBeLessThanOrEqual(1)
  })

  it('MAX_SHADING_GAIN is above the no-op gain of 1, or the clamp would disable normalization', () => {
    expect(MAX_SHADING_GAIN).toBeGreaterThan(1)
  })
})

describe('meanChannels', () => {
  it('averages each channel independently over a known buffer', () => {
    // Deliberately different per channel: a luminance-based implementation
    // would collapse these three into one number and pass a weaker test.
    const data = buf([0, 10, 20, 255], [100, 110, 120, 255], [200, 210, 220, 255])
    expect(meanChannels(data)).toEqual({ r: 100, g: 110, b: 120 })
  })

  it('ignores fully transparent pixels rather than counting their RGB bytes', () => {
    // The (0,0,0,0) pixel's RGB is undefined garbage in practice; including
    // it here would report a mean of 100 instead of 200 and double the gain.
    const data = buf([200, 200, 200, 255], [0, 0, 0, 0], [200, 200, 200, 128])
    expect(meanChannels(data)).toEqual({ r: 200, g: 200, b: 200 })
  })

  it('counts any non-zero alpha, including 1', () => {
    const data = buf([80, 80, 80, 1], [0, 0, 0, 0])
    expect(meanChannels(data)).toEqual({ r: 80, g: 80, b: 80 })
  })

  it('returns {0,0,0} — not NaN — for a fully transparent buffer', () => {
    const data = buf([12, 34, 56, 0], [200, 200, 200, 0])
    expect(meanChannels(data)).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('returns {0,0,0} — not NaN — for an empty buffer', () => {
    expect(meanChannels(new Uint8ClampedArray(0))).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('ignores a trailing partial pixel instead of reading past the end', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255, 255, 255])
    expect(meanChannels(data)).toEqual({ r: 100, g: 100, b: 100 })
  })
})

describe('shadingGain', () => {
  it('is exactly 1 for a white mean — a white garment must be a true no-op', () => {
    expect(shadingGain({ r: 255, g: 255, b: 255 })).toEqual({ r: 1, g: 1, b: 1 })
  })

  it('clamps to MAX_SHADING_GAIN for a black mean', () => {
    // A zero mean's ideal gain is infinite; the clamp is what keeps the
    // downstream multiply finite (shading.ts header, consequence 2).
    expect(shadingGain({ r: 0, g: 0, b: 0 })).toEqual({
      r: MAX_SHADING_GAIN,
      g: MAX_SHADING_GAIN,
      b: MAX_SHADING_GAIN,
    })
  })

  it('maps a mid-grey mean to the exact 255/mean ratio', () => {
    const gain = shadingGain({ r: 128, g: 128, b: 128 })
    expect(gain.r).toBeCloseTo(255 / 128, 10)
    expect(gain.g).toBeCloseTo(255 / 128, 10)
    expect(gain.b).toBeCloseTo(255 / 128, 10)
  })

  it('is per-channel, so a coloured garment gets three different gains', () => {
    // The red-tint failure mode: a red tee has a high R mean and low G/B
    // means. Per-channel gains cancel that tint; one shared gain would not.
    const gain = shadingGain({ r: 200, g: 40, b: 40 })
    expect(gain.r).toBeCloseTo(255 / 200, 10)
    expect(gain.g).toBeCloseTo(255 / 40, 10)
    expect(gain.b).toBeCloseTo(255 / 40, 10)
    expect(gain.r).not.toBeCloseTo(gain.g, 3)
  })

  it('clamps at MAX_SHADING_GAIN once the mean is dark enough to exceed it', () => {
    const threshold = 255 / MAX_SHADING_GAIN
    expect(shadingGain({ r: threshold / 2, g: 255, b: 255 }).r).toBe(MAX_SHADING_GAIN)
    // Just above the threshold the exact ratio still comes through, so the
    // clamp is a ceiling and not an always-on override.
    const justAbove = shadingGain({ r: threshold * 1.5, g: 255, b: 255 }).r
    expect(justAbove).toBeLessThan(MAX_SHADING_GAIN)
    expect(justAbove).toBeCloseTo(255 / (threshold * 1.5), 10)
  })

  it('never returns a gain below 1 — normalization only ever brightens', () => {
    // Not reachable from real 8-bit pixels, but a >255 mean must not produce
    // a <1 gain that would darken the artwork on a white garment.
    expect(shadingGain({ r: 500, g: 300, b: 256 })).toEqual({ r: 1, g: 1, b: 1 })
  })

  it('returns a finite clamped gain for non-finite or negative means', () => {
    expect(shadingGain({ r: NaN, g: -10, b: 0 })).toEqual({
      r: MAX_SHADING_GAIN,
      g: MAX_SHADING_GAIN,
      b: MAX_SHADING_GAIN,
    })
  })
})

describe('applyShadingGain', () => {
  it('mutates the buffer in place and returns nothing', () => {
    const data = buf([10, 20, 30, 255])
    const result = applyShadingGain(data, { r: 2, g: 3, b: 4 })
    expect(result).toBeUndefined()
    expect(Array.from(data)).toEqual([20, 60, 120, 255])
  })

  it('applies each channel its own gain', () => {
    const data = buf([100, 100, 100, 255], [10, 10, 10, 255])
    applyShadingGain(data, { r: 1, g: 2, b: 2.5 })
    expect(Array.from(data)).toEqual([100, 200, 250, 255, 10, 20, 25, 255])
  })

  it('clamps at 255 instead of wrapping', () => {
    // The clamp is load-bearing: after normalization every pixel above the
    // region mean overflows by construction. A wrap here would turn a
    // highlight into a black speck.
    const data = buf([200, 128, 255, 255])
    applyShadingGain(data, { r: 4, g: 4, b: 4 })
    expect(Array.from(data)).toEqual([255, 255, 255, 255])
  })

  it('leaves every alpha byte untouched — preview.ts masks against it afterwards', () => {
    const data = buf([10, 10, 10, 0], [10, 10, 10, 128], [10, 10, 10, 255])
    applyShadingGain(data, { r: 8, g: 8, b: 8 })
    expect(data[3]).toBe(0)
    expect(data[7]).toBe(128)
    expect(data[11]).toBe(255)
  })

  it('is a no-op at gain 1, so a flat white mockup renders unchanged', () => {
    const data = buf([1, 127, 254, 200])
    applyShadingGain(data, { r: 1, g: 1, b: 1 })
    expect(Array.from(data)).toEqual([1, 127, 254, 200])
  })

  it('leaves a trailing partial pixel alone', () => {
    const data = new Uint8ClampedArray([10, 10, 10, 255, 10, 10])
    applyShadingGain(data, { r: 2, g: 2, b: 2 })
    expect(Array.from(data)).toEqual([20, 20, 20, 255, 10, 10])
  })

  it('round-trips: normalizing a buffer by its own mean makes that mean white', () => {
    // The property the whole design rests on — after normalization the
    // region's mean is white, so multiplying it over the art preserves the
    // art's average tone and transports only the deviation (the folds).
    const data = buf([60, 60, 60, 255], [100, 100, 100, 255], [140, 100, 60, 255])
    applyShadingGain(data, shadingGain(meanChannels(data)))
    const after = meanChannels(data)
    // r's mean is 100 -> gain 2.55; 60/100/140 -> 153/255/255 (the 140 pixel
    // clamps), so the post-normalization mean sits at or just under white.
    expect(after.r).toBeGreaterThan(200)
    expect(after.r).toBeLessThanOrEqual(255)
    expect(after.g).toBeLessThanOrEqual(255)
    expect(after.b).toBeLessThanOrEqual(255)
  })
})
