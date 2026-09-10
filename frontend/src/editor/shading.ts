// frontend/src/editor/shading.ts
//
// POD-UI3.md §4.2 — the tone-normalization maths behind `editor/preview.ts`'s
// garment-shading pass (step 3 of its composite). Extracted here for the same
// reason `canvasGutter.ts` was: it is a subtle rendering decision whose
// correctness is arithmetic, so it belongs in a pure, DOM-free module that can
// be unit-tested directly (see __tests__/shading.test.ts) instead of being
// buried in a function that needs a real canvas, a real Fabric module and a
// real mockup image to exercise at all.
//
// WHY NORMALIZE AT ALL (read this before changing the gain maths).
// The goal is that the shopper's artwork picks up the garment's folds, seams
// and shadows so it reads as printed rather than pasted. The naive way to get
// that is a raw `multiply` of the mockup's pixels over the art — and that is
// only correct on a pure-white garment. On a black tee the mockup's print
// area is ~0.08 of full brightness, so `multiply` scales the artwork by ~0.08
// and the artwork simply disappears. On a red tee it scales G and B toward
// zero and the artwork comes out red.
//
// Both failures come from the same thing: `multiply` transports the garment's
// ABSOLUTE brightness, when the only information we actually want is its
// RELATIVE variation. So we divide it out. Take the mean of the region we are
// about to blend, compute the gain that maps that mean to white (255), and
// apply it. After that the region's mean is white — i.e. a multiply by the
// normalized region leaves the artwork's average tone unchanged and passes
// through only the deviation from the mean, which is exactly the fold/shadow
// structure. Ink printed on a black tee stays the colour it prints.
//
// PER-CHANNEL, NOT LUMINANCE. Each of R, G and B gets its own gain. A single
// luminance-derived gain would normalize brightness but preserve the garment's
// hue, so a red garment would still tint the artwork red and a black one would
// still shift it. Normalizing each channel independently removes the garment's
// base colour AND its tint, leaving only achromatic shading structure — which
// is what a fold actually is.
//
// TWO CONSEQUENCES WORTH STATING, because both look like bugs and are not:
//   1. On a perfectly flat mockup (a solid-colour fill, no photographic
//      shading) every pixel equals the mean, so the normalized layer is
//      uniform white and the shading is INVISIBLE. Correct — there is no
//      shading in the source to blend. The effect scales with how much real
//      shading the mockup photo carries.
//   2. Gain is clamped BELOW at 1, so normalization only ever brightens. A
//      mockup region brighter than white cannot exist, but a region whose
//      mean is already 255 must yield exactly 1 (not 1.0000001), so that a
//      white garment is a genuine no-op rather than a faint darkening.
// And clamped ABOVE at MAX_SHADING_GAIN so a near-black garment cannot blow
// up: as the mean approaches 0 the ideal gain approaches infinity, which would
// amplify the mockup's sensor noise and JPEG blocking into visible mottling
// across the artwork. The clamp trades exact mean-to-white normalization on
// very dark garments for a stable image; the residual darkening it leaves is
// far less objectionable than amplified noise.

/**
 * Strength of the garment-shading multiply layer, applied as `globalAlpha`
 * when the masked shade canvas is drawn back over the flat composite. Below 1
 * so the blend reads as fabric texture under the ink rather than as the
 * mockup's shadows stamped onto it at full contrast.
 */
export const SHADING_STRENGTH = 0.85

/**
 * Upper clamp on per-channel gain, so a near-black garment can't blow up —
 * see this file's header. 16 corresponds to fully normalizing a region whose
 * mean channel value is ~16/255 (a very dark garment); anything darker than
 * that stays partially darkened rather than becoming a noise amplifier.
 */
export const MAX_SHADING_GAIN = 16

export interface Channels {
  r: number
  g: number
  b: number
}

/**
 * Mean per-channel value of an RGBA buffer, ignoring fully transparent pixels.
 *
 * Transparent pixels are excluded because their RGB bytes are undefined in
 * practice — a browser is free to leave whatever it likes under alpha 0, and
 * canvases commonly report (0,0,0) there — so counting them would drag the
 * mean toward black and inflate the gain. For `preview.ts`'s actual use the
 * shade buffer is the opaque mockup, so this rarely matters; it matters for
 * the degenerate case, where a fully transparent (or zero-length) buffer must
 * return `{r:0,g:0,b:0}` rather than `NaN` from a 0/0 divide. `shadingGain`
 * maps that zero straight to `MAX_SHADING_GAIN`, so the whole chain stays
 * finite for any input.
 */
export function meanChannels(data: Uint8ClampedArray): Channels {
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] === 0) continue
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    n++
  }
  if (n === 0) return { r: 0, g: 0, b: 0 }
  return { r: r / n, g: g / n, b: b / n }
}

/**
 * Per-channel gain mapping `mean` to 255 (white), clamped to
 * `[1, MAX_SHADING_GAIN]`. A zero (or negative, or non-finite) mean yields
 * `MAX_SHADING_GAIN` — see `meanChannels` on why a zero mean is reachable.
 */
export function shadingGain(mean: Channels): Channels {
  return { r: gainFor(mean.r), g: gainFor(mean.g), b: gainFor(mean.b) }
}

function gainFor(meanValue: number): number {
  // Guards NaN as well as <=0: `NaN > 0` is false, so a non-finite mean falls
  // into the same branch as black and returns a finite clamped gain. Nothing
  // downstream should ever have to defend against NaN pixel data.
  if (!(meanValue > 0)) return MAX_SHADING_GAIN
  const gain = 255 / meanValue
  if (gain < 1) return 1
  if (gain > MAX_SHADING_GAIN) return MAX_SHADING_GAIN
  return gain
}

/**
 * In place: multiplies each pixel's R/G/B by the per-channel gain, clamping at
 * 255. Alpha is untouched — the buffer's alpha channel is what `preview.ts`
 * masks against afterwards (`destination-in` with the art canvas), and any
 * change to it here would change which garment pixels get darkened.
 *
 * Mutates rather than allocating a copy because the caller's next move is
 * `putImageData` of this very buffer; a ~330x330 RGBA region is ~435KB and
 * there is no reason to double that per preview render.
 */
export function applyShadingGain(data: Uint8ClampedArray, gain: Channels): void {
  for (let i = 0; i + 3 < data.length; i += 4) {
    // Uint8ClampedArray clamps to [0,255] on assignment, so no explicit
    // Math.min is needed — but the clamp is load-bearing, not incidental:
    // every pixel brighter than the mean overflows 255 by construction.
    data[i] = data[i] * gain.r
    data[i + 1] = data[i + 1] * gain.g
    data[i + 2] = data[i + 2] * gain.b
  }
}
