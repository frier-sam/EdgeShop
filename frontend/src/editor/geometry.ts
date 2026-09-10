// frontend/src/editor/geometry.ts
//
// Pure coordinate maths for the customizer stage — POD.md §5.1, §5.2, §5.3.
// Nothing in this file touches the DOM or Fabric; it is fully unit-testable
// (see __tests__/geometry.test.ts) which matters because a bug here shifts
// every print file the store ever produces.
//
// Everything the product stores is a *normalized* fraction (0..1) of the
// mockup's natural pixel dimensions (POD.md §6.1 `product_sides`). Pixel
// geometry is always derived fresh from those fractions plus the current
// stage size — never the other way around — so the print area survives a
// window resize, a different mockup resolution, or re-mounting the editor.

export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PixelRect {
  x: number
  y: number
  w: number
  h: number
}

/** Where the mockup <img> actually renders inside the stage under object-fit: contain. */
export interface ContainBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Reproduces CSS `object-fit: contain` maths: fit `naturalW x naturalH`
 * inside `stageW x stageH`, centered, preserving aspect ratio.
 */
export function computeContainBox(
  stageW: number,
  stageH: number,
  naturalW: number,
  naturalH: number
): ContainBox {
  if (stageW <= 0 || stageH <= 0 || naturalW <= 0 || naturalH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 }
  }
  const stageAspect = stageW / stageH
  const imgAspect = naturalW / naturalH

  let width: number
  let height: number
  if (imgAspect > stageAspect) {
    // Image is relatively wider than the stage — width-constrained.
    width = stageW
    height = stageW / imgAspect
  } else {
    // Image is relatively taller — height-constrained.
    height = stageH
    width = stageH * imgAspect
  }
  return {
    left: (stageW - width) / 2,
    top: (stageH - height) / 2,
    width,
    height,
  }
}

/** normalized (0..1, fraction of the mockup's rendered box) -> stage pixels */
export function normalizedToPixelRect(norm: NormalizedRect, box: ContainBox): PixelRect {
  return {
    x: box.left + norm.x * box.width,
    y: box.top + norm.y * box.height,
    w: norm.w * box.width,
    h: norm.h * box.height,
  }
}

/** Inverse of normalizedToPixelRect — stage pixels -> normalized fraction. Used for round-trip tests. */
export function pixelToNormalizedRect(px: PixelRect, box: ContainBox): NormalizedRect {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0, w: 0, h: 0 }
  return {
    x: (px.x - box.left) / box.width,
    y: (px.y - box.top) / box.height,
    w: px.w / box.width,
    h: px.h / box.height,
  }
}

/** Grows a rect outward by `amount` px on every edge. */
export function growRect(rect: PixelRect, amount: number): PixelRect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    w: rect.w + amount * 2,
    h: rect.h + amount * 2,
  }
}

/** Shrinks a rect inward by `amount` px on every edge. */
export function shrinkRect(rect: PixelRect, amount: number): PixelRect {
  return growRect(rect, -amount)
}

/**
 * POD.md §5.3 — bleed/safe are a percentage of the *shorter side* of the
 * true print rect, not of the stage or the mockup. This keeps the bleed
 * band visually proportionate regardless of how skewed the print area's
 * aspect ratio is.
 */
export function marginAmountPx(printRectPx: PixelRect, percent: number): number {
  return (percent / 100) * Math.min(printRectPx.w, printRectPx.h)
}

export function deriveBleedRect(printRectPx: PixelRect, bleedPercent: number): PixelRect {
  return growRect(printRectPx, marginAmountPx(printRectPx, bleedPercent))
}

export function deriveSafeRect(printRectPx: PixelRect, safePercent: number): PixelRect {
  return shrinkRect(printRectPx, marginAmountPx(printRectPx, safePercent))
}

export interface StageGeometryInput {
  stageW: number
  stageH: number
  imageNaturalW: number
  imageNaturalH: number
  printRect: NormalizedRect
  bleedPercent: number
  safePercent: number
}

export interface StageGeometry {
  containBox: ContainBox
  printRectPx: PixelRect
  bleedRectPx: PixelRect
  safeRectPx: PixelRect
}

/** The single entry point EditorStage calls on mount and on every resize. */
export function computeStageGeometry(input: StageGeometryInput): StageGeometry {
  const containBox = computeContainBox(input.stageW, input.stageH, input.imageNaturalW, input.imageNaturalH)
  const printRectPx = normalizedToPixelRect(input.printRect, containBox)
  const bleedRectPx = deriveBleedRect(printRectPx, input.bleedPercent)
  const safeRectPx = deriveSafeRect(printRectPx, input.safePercent)
  return { containBox, printRectPx, bleedRectPx, safeRectPx }
}

// ── Reference (canonical) geometry — POD.md §5.6, §7.2 ───────────────────
//
// Persisted `design_json` and the add-to-cart preview compositor both need
// a canvas size for each side that is INDEPENDENT of whatever the shopper's
// viewport happened to be. Rather than inventing a second coordinate
// system, both reuse `computeStageGeometry` with a synthetic "stage" that
// is exactly the mockup rendered at `PREVIEW_REFERENCE_WIDTH` px wide (the
// same width POD.md §5.6 specifies for the preview render). The resulting
// `bleedRectPx` is then, by construction, both:
//   - the exact size/position to draw the art layer onto in the preview
//     compositor (no rescale step needed — see editor/preview.ts), and
//   - the canonical width/height a side's Fabric JSON is rescaled to
//     before it's POSTed to the server (see editor/fabric/rescaleSnapshot.ts),
//     so re-editing on a different device rescales FROM this fixed
//     reference size instead of an arbitrary "whatever the last save's
//     viewport was" size.
export const PREVIEW_REFERENCE_WIDTH = 1000

export function computeReferenceGeometry(
  imageNaturalW: number,
  imageNaturalH: number,
  printRect: NormalizedRect,
  bleedPercent: number,
  safePercent: number,
  refWidth: number = PREVIEW_REFERENCE_WIDTH
): StageGeometry {
  const stageH = imageNaturalW > 0 ? refWidth * (imageNaturalH / imageNaturalW) : 0
  return computeStageGeometry({
    stageW: refWidth,
    stageH,
    imageNaturalW,
    imageNaturalH,
    printRect,
    bleedPercent,
    safePercent,
  })
}

// ── Flat design-surface geometry — POD-UI3.md §4.1 ───────────────────────
//
// Design mode no longer renders the mockup at all (POD-UI3.md §3.1): the
// shopper draws on a flat white plane whose aspect ratio IS the print
// area's, fit to the stage. That plane is much bigger than the mockup-
// relative print rect ever was (on a 390px phone: ~262px wide instead of
// ~150px), because nothing has to leave room for a photo of a t-shirt.
//
// The trick that keeps this cheap and safe is that we do NOT invent a
// second coordinate system for it. We solve for the *synthetic* mockup
// `containBox` whose print rect, once run through the existing frozen
// `normalizedToPixelRect` -> `deriveBleedRect`/`deriveSafeRect` chain,
// happens to land its bleed rect centred and fit to the padded stage.
// Everything downstream (the guides, `pixelToNormalizedRect`, any future
// normalized lookup) therefore keeps working against a real contain box —
// there is no "flat mode" special case anywhere else in the codebase.
//
// It also means the plane is proportional to the print area *by
// construction* rather than by assertion, which is a print-safety
// property and not a cosmetic one: `fabric/rescaleSnapshot.ts` rescales a
// stored design between the live canvas size and the canonical reference
// size (`computeReferenceGeometry`) by scaling each axis INDEPENDENTLY.
// If the flat stage's bleed aspect differed from the reference's by even a
// few percent, every design a shopper ever saved would come back
// stretched. Guarantee 3 below pins that down.

export interface FlatStageGeometryInput {
  stageW: number
  stageH: number
  imageNaturalW: number
  imageNaturalH: number
  printRect: NormalizedRect
  bleedPercent: number
  safePercent: number
  /** Reserved on every side of the stage so selection handles at the plane's
   *  edge aren't clipped by the stage's own overflow:hidden. Callers pass
   *  canvasGutter.ts's HANDLE_GUTTER_PX; kept as a parameter so geometry.ts
   *  stays dependency-free and the invariants below are testable at any padding. */
  padding: number
}

/**
 * Design-mode geometry: the BLEED rect fit to the stage, no mockup involved
 * (POD-UI3.md §4.1). Returns the same `StageGeometry` shape as
 * `computeStageGeometry`, with these guarantees (each one a unit test in
 * __tests__/geometry.test.ts):
 *
 *   1. `bleedRectPx` is centred in `stageW x stageH`.
 *   2. `bleedRectPx` fits inside `(stageW - 2*padding) x (stageH - 2*padding)`
 *      and touches it on exactly one axis — a fit, not a shrink.
 *   3. `bleedRectPx`'s aspect ratio equals `computeReferenceGeometry`'s for
 *      the same inputs (the print-safety invariant above).
 *   4. `printRectPx`/`safeRectPx` are exactly what the frozen
 *      `normalizedToPixelRect`/`deriveBleedRect`/`deriveSafeRect` produce
 *      from the returned `containBox` — i.e. that box really is a mockup
 *      box, so normalized <-> pixel mapping is still valid.
 *   5. Degenerate inputs fall back to `computeStageGeometry(input)`.
 *
 * Derivation is closed-form (no iteration). Writing `ar` for the mockup's
 * aspect and `W` for the synthetic box width, `normalizedToPixelRect` gives
 * printW = printRect.w * W and printH = printRect.h * ar * W, so
 * `marginAmountPx`'s percent-of-the-shorter-side bleed is
 * `bp * W * min(printRect.w, printRect.h * ar)` — linear in W. Both bleed
 * dimensions are therefore `W * const`, and the largest W that fits the
 * padded stage is a single `min` of two divisions.
 */
export function computeFlatStageGeometry(input: FlatStageGeometryInput): StageGeometry {
  const { stageW, stageH, imageNaturalW, imageNaturalH, printRect, bleedPercent, safePercent, padding } = input

  const availW = stageW - 2 * padding
  const availH = stageH - 2 * padding

  const ar = imageNaturalH / imageNaturalW // mockup aspect (height per unit width)
  const bp = bleedPercent / 100
  // The print rect's shorter side, in box-width units — the quantity
  // `marginAmountPx` takes its percentage of.
  const minc = Math.min(printRect.w, printRect.h * ar)
  // Bleed width/height, also in box-width units.
  const a = printRect.w + 2 * bp * minc
  const b = printRect.h * ar + 2 * bp * minc

  // Guarantee 5. `availW`/`availH` are in here as well as the six inputs
  // §4.1 lists: a stage narrower than its own padding has no positive plane
  // to fit, and the same fallback is the right answer for the same reason.
  // (The fallback keeps guarantee 3 too, incidentally — `computeContainBox`
  // always preserves the mockup's aspect, so a contain-fit bleed rect has
  // the same aspect as the reference one.) A non-positive `a`/`b` can only
  // come from a negative `bleedPercent`, which no caller produces; guarded
  // anyway so this function can never return a negative-width rect.
  if (
    stageW <= 0 ||
    stageH <= 0 ||
    imageNaturalW <= 0 ||
    imageNaturalH <= 0 ||
    printRect.w <= 0 ||
    printRect.h <= 0 ||
    availW <= 0 ||
    availH <= 0 ||
    a <= 0 ||
    b <= 0
  ) {
    return computeStageGeometry(input)
  }

  // Guarantee 2: the binding axis hits its limit exactly, the other has slack.
  const width = Math.min(availW / a, availH / b)
  const height = width * ar

  // Guarantee 1: solve `left`/`top` backwards from "the bleed rect is
  // centred". bleedRectPx.x is `containBox.left + printRect.x * width`
  // (normalizedToPixelRect) minus the bleed margin (deriveBleedRect), and
  // we want that to equal `(stageW - width * a) / 2`. Same in y, where the
  // normalized offset is scaled by `height` rather than `width`.
  const left = (stageW - width * a) / 2 - printRect.x * width + bp * width * minc
  const top = (stageH - width * b) / 2 - printRect.y * height + bp * width * minc

  // Guarantee 4: from here on it is the ordinary frozen chain, byte for
  // byte the same calls `computeStageGeometry` makes — only the box they
  // are fed is synthetic.
  const containBox: ContainBox = { left, top, width, height }
  const printRectPx = normalizedToPixelRect(printRect, containBox)
  const bleedRectPx = deriveBleedRect(printRectPx, bleedPercent)
  const safeRectPx = deriveSafeRect(printRectPx, safePercent)
  return { containBox, printRectPx, bleedRectPx, safeRectPx }
}

// ── DPI (POD.md §5.1, §6.5) ──────────────────────────────────────────────

/** Below this, show a non-blocking "may look blurry" badge on the object. */
export const DPI_WARN_THRESHOLD = 150
/** Below this, the quality issue is severe enough to block add-to-cart. */
export const DPI_BLOCK_THRESHOLD = 100

export interface DpiInput {
  /** Natural (source) pixel width of the uploaded asset. */
  assetNaturalWidth: number
  /** The object's rendered width on the design canvas, in canvas CSS px. */
  objectWidthPx: number
  /** The design canvas's own CSS width in px (== the bleed rect's width). */
  canvasCssWidth: number
  /** Physical print width of the side, in inches (product_sides.print_width_in). */
  printWidthIn: number
}

/**
 * POD.md §5.1 / §6.5:
 *   assetDpi = assetNaturalWidth / (objectWidthPx / canvasCssWidth * printWidthIn)
 */
export function computeEffectiveDpi({ assetNaturalWidth, objectWidthPx, canvasCssWidth, printWidthIn }: DpiInput): number {
  if (canvasCssWidth <= 0 || printWidthIn <= 0 || objectWidthPx <= 0) return Infinity
  const inchesOccupied = (objectWidthPx / canvasCssWidth) * printWidthIn
  if (inchesOccupied <= 0) return Infinity
  return assetNaturalWidth / inchesOccupied
}

export type DpiSeverity = 'ok' | 'warn' | 'block'

export function dpiSeverity(dpi: number): DpiSeverity {
  if (dpi < DPI_BLOCK_THRESHOLD) return 'block'
  if (dpi < DPI_WARN_THRESHOLD) return 'warn'
  return 'ok'
}

// ── Shape helpers ─────────────────────────────────────────────────────────

/** Points for a 5-point (or n-spike) star, centered at (cx, cy), for fabric.Polygon. */
export function starPoints(
  cx: number,
  cy: number,
  spikes: number,
  outerRadius: number,
  innerRadius: number
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const step = Math.PI / spikes
  let angle = -Math.PI / 2
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius })
    angle += step
  }
  return points
}
