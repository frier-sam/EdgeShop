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
