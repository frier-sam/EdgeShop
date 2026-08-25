// frontend/src/admin/print/printMath.ts
//
// POD.md §5.1 / §5.7 / §8.2 — the pure export-multiplier maths behind the
// admin's "Download print file" button. Deliberately Fabric-free and
// DOM-free (no canvas, no document.fonts) so every number here is
// unit-testable without a browser — see __tests__/printMath.test.ts.
//
// A side's `design_json` snapshot is already stored at the CANONICAL
// reference size (designSchema.ts's StoredSideSnapshot.canvasWidth/Height
// == geometry.ts's computeReferenceGeometry's bleedRectPx at
// PREVIEW_REFERENCE_WIDTH — see designApi.ts's canonicalizeSideSnapshot).
// That canonical canvas IS the bleed rect (POD.md §5.2), so exporting it
// at the right `multiplier` needs no mockup image, no print rect, and no
// bleed/safe percent — just the snapshot's own width/height, the side's
// `print_width_in`, and the store's `print_dpi` setting:
//
//   printPx    = print_width_in * print_dpi
//   multiplier = printPx / canvasWidthAtReferenceScale
//
// which is exactly POD.md §5.1's `canvasScale = printPx / editorCanvasCssWidth`
// with "editorCanvasCssWidth" being the canvas element's own width — the
// bleed rect, per §5.2. The OUTPUT pixel width is then the full exported
// bleed rect, sized so it equals `printPx` — this is the documented
// design, not an approximation of it.

/** Chrome/Firefox desktop reliably handle a single canvas dimension up to
 *  ~16384px; pushing right up to that edge risks tipping into whatever a
 *  particular browser's actual ceiling is, so this stays comfortably under
 *  it rather than chasing the exact number. */
export const MAX_CANVAS_DIMENSION_PX = 16384

/** Total-pixel-AREA cap (width * height). A canvas can be narrow-but-fine
 *  on one axis and still OOM a tab if the other axis is huge — dimension
 *  and area are two independent constraints, both enforced. Safari
 *  (especially iOS) historically fails well below Chrome/Firefox's area
 *  ceiling; 40 megapixels comfortably covers realistic garment print
 *  files (e.g. 12in x 16in @ 300 DPI = 17.3MP) while still catching a
 *  pathological `print_width_in`/`print_dpi` combination before it tries
 *  to allocate a multi-hundred-megabyte bitmap. */
export const MAX_CANVAS_AREA_PX = 40_000_000

/** The multiplier that would reproduce POD.md's `print_dpi` exactly, before any safety clamp. */
export function computeDesiredMultiplier(canvasWidthPx: number, printWidthIn: number, printDpi: number): number {
  if (canvasWidthPx <= 0 || printWidthIn <= 0 || printDpi <= 0) return 0
  return (printWidthIn * printDpi) / canvasWidthPx
}

export interface ClampedMultiplier {
  /** The multiplier to actually pass to `toDataURL({ multiplier })` — equal to `desiredMultiplier` unless a cap was exceeded. */
  multiplier: number
  /** True if the desired multiplier had to be reduced to respect a browser canvas limit. */
  clamped: boolean
}

/**
 * Shrinks `desiredMultiplier` just enough to keep the exported canvas
 * within both the per-dimension and total-area caps. Never produces a
 * SMALLER file than necessary — it clamps to the largest size that still
 * fits, not to some fixed fallback resolution — and never silently
 * changes behavior: callers surface `clamped` (and the resulting
 * effective DPI) to the merchant rather than exporting quietly at a lower
 * resolution than requested.
 */
export function clampMultiplierForCanvasSize(
  canvasWidthPx: number,
  canvasHeightPx: number,
  desiredMultiplier: number,
  maxDimensionPx: number = MAX_CANVAS_DIMENSION_PX,
  maxAreaPx: number = MAX_CANVAS_AREA_PX
): ClampedMultiplier {
  if (canvasWidthPx <= 0 || canvasHeightPx <= 0 || desiredMultiplier <= 0) {
    return { multiplier: desiredMultiplier, clamped: false }
  }

  let multiplier = desiredMultiplier

  const rawW = canvasWidthPx * multiplier
  const rawH = canvasHeightPx * multiplier
  const largestRawDim = Math.max(rawW, rawH)
  if (largestRawDim > maxDimensionPx) {
    multiplier *= maxDimensionPx / largestRawDim
  }

  const areaAtDimScale = canvasWidthPx * multiplier * (canvasHeightPx * multiplier)
  if (areaAtDimScale > maxAreaPx) {
    multiplier *= Math.sqrt(maxAreaPx / areaAtDimScale)
  }

  // Floating point can leave `multiplier` a hair below `desiredMultiplier`
  // even when no cap actually applied (e.g. sqrt of something ~1) — only
  // report a clamp for a real, meaningful reduction.
  const clamped = multiplier < desiredMultiplier - 1e-9

  return { multiplier, clamped }
}

export interface PrintDimsInfo {
  /** The (possibly clamped) multiplier to hand to `toDataURL({ multiplier })`. */
  multiplier: number
  clamped: boolean
  pixelWidth: number
  pixelHeight: number
  widthIn: number
  heightIn: number
  /** POD.md §8.2 — the DPI the merchant will ACTUALLY get, after any clamp. Equal to `printDpi` unless `clamped`. */
  effectiveDpi: number
}

/**
 * The single source of truth for what the admin UI displays (dimensions +
 * effective DPI readout, POD.md §4.2) AND what `renderPrintFile.ts`
 * actually exports — computed once, from `design_json`'s own canonical
 * canvas size, with zero dependency on Fabric or the DOM so the readout
 * can render before Fabric has even started loading.
 */
export function computePrintDims(canvasWidthPx: number, canvasHeightPx: number, printWidthIn: number, printDpi: number): PrintDimsInfo {
  const desired = computeDesiredMultiplier(canvasWidthPx, printWidthIn, printDpi)
  const { multiplier, clamped } = clampMultiplierForCanvasSize(canvasWidthPx, canvasHeightPx, desired)

  const pixelWidth = Math.round(canvasWidthPx * multiplier)
  const pixelHeight = Math.round(canvasHeightPx * multiplier)
  const heightIn = canvasWidthPx > 0 ? printWidthIn * (canvasHeightPx / canvasWidthPx) : 0
  const effectiveDpi = desired > 0 ? printDpi * (multiplier / desired) : 0

  return { multiplier, clamped, pixelWidth, pixelHeight, widthIn: printWidthIn, heightIn, effectiveDpi }
}
