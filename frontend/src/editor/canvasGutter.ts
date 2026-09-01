// frontend/src/editor/canvasGutter.ts
//
// Bug 3b — POD.md §5.2's documented fallback: "grow the canvas by a fixed
// gutter G and export with toDataURL({left:G, top:G, width, height,
// multiplier})". The canvas ELEMENT is grown by a fixed on-screen gutter
// so an object's resize/rotate handles have room to render and be
// grabbed even when the print area is small enough that they'd otherwise
// sit outside the canvas's own bounds (and therefore be clipped and
// unusable — the bug this fixes).
//
// This module is pure maths — no Fabric, no DOM — so it's directly
// unit-testable (see __tests__/canvasGutter.test.ts). The one place it
// touches Fabric is EditorStage.tsx calling `canvas.setViewportTransform`
// with `gutterViewportTransform()`'s output; nothing here requires
// changing frozen/fabric/canvas.ts.
//
// WHY THIS CANNOT SILENTLY DRIFT THE PRINT FILE (read this before editing
// callers): every persisted coordinate — `design_json`'s object left/top,
// `StoredSideSnapshot.canvasWidth/canvasHeight`, and everything
// `admin/print/renderPrintFile.ts` and `editor/preview.ts` consume — is
// expressed in the CANVAS'S OWN MODEL SPACE, which is untouched by
// `viewportTransform` (Fabric's vpt is purely a render/pointer-mapping
// camera; `canvas.toObject()`/`obj.left`/`obj.top` never include it — see
// EditorStage.tsx's header comment for the full chain of reasoning). What
// DOES change once the canvas element is grown is `canvas.getWidth()`/
// `getHeight()` (Fabric's own bookkeeping reports the real, gutter-
// inclusive backstore size) — so every caller that used to treat
// `canvas.getWidth()` as a stand-in for "the bleed rect's size" (object
// placement in useEditorObjects.ts, the live DPI scan and the
// canonicalization step in CustomizerEditor.tsx) MUST be switched to read
// the PURE bleed size instead (threaded through via EditorStage's
// `onBleedSizeChange` callback), or those numbers silently pick up a
// constant +2*HANDLE_GUTTER_PX error.

/**
 * On-screen gutter, in CSS px, on every side of the bleed rect.
 *
 * POD.md §5.2 suggested "24-32px" as a ballpark. Checked against the
 * installed fabric@6.9.1 source (node_modules/fabric/dist/src/controls/
 * commonControls.mjs) instead of going with that ballpark as-is: the
 * rotation control (`mtr`) has a FIXED `offsetY: -40` — 40 CSS px beyond
 * the object's own edge, independent of the object's size or how much
 * margin `fitObject.ts` left around it — plus its `touchCornerSize: 24`
 * hit area (defaultValues.mjs) extends another 12px past that point, for
 * a 52px total reach. And because a user can rotate an object to any
 * angle, that reach can point out of ANY of the four sides, not just
 * "up" — so all four sides need the same margin, not just the top.
 * 52px is the theoretical minimum for the rotation handle to stay fully
 * visible AND grabbable in the worst case; 24-32px would still leave it
 * clipped. 64px is used instead of 52-56px after live-browser
 * measurement (Playwright against `wrangler dev`, a genuinely tiny print
 * area at a 390px mobile viewport) showed the selection UI's REAL
 * rendered extent — border stroke, antialiasing, the handle-to-object
 * connecting line — landing exactly at a 56px gutter's edge with zero
 * spare px. 64px restores real safety margin on top of the theoretical
 * minimum rather than shipping a knife-edge fit.
 */
export const HANDLE_GUTTER_PX = 64

export interface SizePx {
  width: number
  height: number
}

export interface PointPx {
  x: number
  y: number
}

/** The Fabric canvas ELEMENT's real (gutter-inclusive) backstore size for a given PURE bleed-rect pixel size. Always >=1px so a zero-sized bleed rect (e.g. before the mockup image has loaded) never produces an invalid canvas. */
export function gutteredCanvasSize(bleedWidthPx: number, bleedHeightPx: number, gutter: number = HANDLE_GUTTER_PX): SizePx {
  return {
    width: Math.max(1, Math.round(bleedWidthPx) + gutter * 2),
    height: Math.max(1, Math.round(bleedHeightPx) + gutter * 2),
  }
}

/**
 * Where to position the Fabric-owned wrapper element so the now-larger
 * canvas's BLEED-RECT REGION still lands exactly on `(bleedX, bleedY)` —
 * i.e. pixel-identical to where it renders with no gutter at all. Pair
 * with `gutterViewportTransform` (below): the wrapper moves outward by
 * `gutter`, and the viewport transform shifts rendering inward by the
 * same amount, so the two cancel out exactly.
 */
export function gutteredWrapperOrigin(bleedX: number, bleedY: number, gutter: number = HANDLE_GUTTER_PX): PointPx {
  return { x: bleedX - gutter, y: bleedY - gutter }
}

/**
 * `canvas.setViewportTransform(...)` argument that shifts on-screen
 * rendering by `gutter` in both axes while leaving every object's own
 * model-space `left`/`top` completely untouched — Fabric's vpt is a pure
 * render/pointer-mapping camera, not a coordinate rewrite (see this
 * file's header). A plain translation matrix: `[1,0,0,1,gutter,gutter]`.
 */
export function gutterViewportTransform(gutter: number = HANDLE_GUTTER_PX): [number, number, number, number, number, number] {
  return [1, 0, 0, 1, gutter, gutter]
}
