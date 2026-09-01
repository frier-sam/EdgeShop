// frontend/src/editor/fitObject.ts
//
// Bug 3a — POD.md §5.2 records the known trade-off that an object whose
// selection handles start outside the bleed rect is unusable. Independent
// of the gutter fallback (canvasGutter.ts), it's always worth never
// creating that situation on insert in the first place: when adding
// text/image/shape, if the new object would exceed the bleed rect, scale
// it down to fit with a margin and keep it centred.
//
// Pure maths only (no Fabric, no DOM) so the scaling decision is
// unit-testable without a real canvas — see __tests__/fitObject.test.ts.
// useEditorObjects.ts applies the result to a live FabricObject.

/** A freshly inserted object's larger extent is capped to at most this fraction of the bleed rect's SMALLER side. 0.8 leaves a visible margin on every edge while still comfortably fitting non-square print areas. */
export const INSERT_FIT_MARGIN = 0.8

/**
 * The uniform multiplier to apply to an object's CURRENT scaleX/scaleY so
 * its bounding box's larger extent is at most `margin * min(boundW, boundH)`.
 * Returns 1 (no-op) if the object already fits, or for degenerate
 * (<=0) input. Never scales an object UP — this only ever shrinks an
 * oversized insert, it doesn't "helpfully" enlarge a small one.
 */
export function computeInsertFitScale(
  objectWidthPx: number,
  objectHeightPx: number,
  boundWidthPx: number,
  boundHeightPx: number,
  margin: number = INSERT_FIT_MARGIN
): number {
  const maxSide = Math.min(boundWidthPx, boundHeightPx) * margin
  const largest = Math.max(objectWidthPx, objectHeightPx)
  if (maxSide <= 0 || largest <= 0 || largest <= maxSide) return 1
  return maxSide / largest
}
