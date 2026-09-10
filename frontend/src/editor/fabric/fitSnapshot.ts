// frontend/src/editor/fabric/fitSnapshot.ts
//
// POD-V2.md §6.2 — a sibling to rescaleFabricSnapshot for a DIFFERENT job:
// fitting a design TEMPLATE (authored against one print area's shape) into
// a DIFFERENTLY-SHAPED print area. Templates are keyed to a category, not a
// specific product, so a "Corporate" collection's template might meet a
// 90x50mm business card, a square 8in chest print AND a tall bottle wrap —
// three different aspect ratios, one design.
//
// rescaleFabricSnapshot scales each axis independently (correct for a
// same-shape resize — e.g. the canonical reference size <-> the live stage,
// which are ALWAYS the same print area at different pixel densities). Reused
// here it would STRETCH the artwork: a circle authored on a square template
// would become an oval on a wide bottle wrap. What's needed instead is a
// uniform scale — the SAME factor on both axes — by
// `min(toW/fromW, toH/fromH)` (the smaller of the two axis ratios, i.e.
// "grow/shrink only as far as the tighter-fitting axis allows"), then
// re-centre the result in the target. This is letterboxing, never
// distortion: whichever axis doesn't fill the target gets an equal margin
// on both sides.
//
// Every object's left/top/scaleX/scaleY transforms by that ONE scalar (never
// two independent per-axis factors), which is exactly why this preserves
// every object's own aspect ratio: a square logo in the template stays
// square no matter how differently-shaped the destination print area is.
//
// Pure, DOM-free, Fabric-free — same contract as rescaleFabricSnapshot, same
// reason: unit-testable in isolation and safe to call before the `fabric`
// module has ever loaded (the editor still lazy-loads it — CustomizerEditor.
// tsx's header comment).
import type { FabricSnapshot } from './rescaleSnapshot'

/**
 * Uniform-scale + re-centre `snapshot` (authored at `fromW x fromH`) into a
 * `toW x toH` canvas — letterbox, never stretch (POD-V2.md §6.2).
 *
 * Degenerate inputs (any of the four dimensions `<= 0`) have no meaningful
 * scale factor to compute, so the snapshot is returned unchanged rather than
 * dividing by zero or producing NaN/Infinity — the same defensive shape as
 * rescaleFabricSnapshot's own zero-guard and geometry.ts's
 * `computeFlatStageGeometry` degenerate fallback.
 */
export function fitSnapshotToCanvas(
  snapshot: FabricSnapshot,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number
): FabricSnapshot {
  if (!Array.isArray(snapshot.objects)) return snapshot
  if (fromW <= 0 || fromH <= 0 || toW <= 0 || toH <= 0) return snapshot

  const scale = Math.min(toW / fromW, toH / fromH)
  // The re-centring offset: half of whatever gap is left on each axis once
  // the (uniformly scaled) source is placed in the target. Zero on the axis
  // that fills the target exactly; positive (a letterbox margin) on the
  // other.
  const offsetX = (toW - fromW * scale) / 2
  const offsetY = (toH - fromH * scale) / 2

  return {
    ...snapshot,
    objects: snapshot.objects.map((obj) => {
      const left = typeof obj.left === 'number' ? obj.left : 0
      const top = typeof obj.top === 'number' ? obj.top : 0
      const objScaleX = typeof obj.scaleX === 'number' ? obj.scaleX : 1
      const objScaleY = typeof obj.scaleY === 'number' ? obj.scaleY : 1
      return {
        ...obj,
        left: left * scale + offsetX,
        top: top * scale + offsetY,
        scaleX: objScaleX * scale,
        scaleY: objScaleY * scale,
      }
    }),
  }
}
