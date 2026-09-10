import { useEffect, useRef, useState } from 'react'
import type { FabricModule, FabricCanvas } from './fabric/loadFabric'
import {
  createCanvas,
  disposeCanvas,
  resizeCanvasScaled,
  snapshotCanvas,
  restoreCanvas,
  clearCanvas,
  setCanvasDimensionsRaw,
  getObjectCount,
  positionCanvasWrapper,
  setCanvasInteractive,
} from './fabric/canvas'
import { computeFlatStageGeometry, type NormalizedRect, type StageGeometry } from './geometry'
import { HANDLE_GUTTER_PX, gutteredCanvasSize, gutteredWrapperOrigin, gutterViewportTransform } from './canvasGutter'
import type { EditorMode, EditorSideName } from './types'

export interface SideSnapshot {
  json: string
  width: number
  height: number
}

export interface EditorStageProps {
  fabric: FabricModule | null
  sideKey: EditorSideName
  mockupUrl: string
  imageNaturalW: number
  imageNaturalH: number
  printRect: NormalizedRect
  bleedPercent: number
  safePercent: number
  mode: EditorMode
  onCanvasReady?: (canvas: FabricCanvas | null) => void
  onObjectCountChange?: (side: EditorSideName, count: number) => void
  /** Fires immediately before a side-switch content swap starts — wire to useEditorObjects().suspendHistory (see that hook for why). */
  onBeforeSideSwap?: () => void
  /** Fires once the side-switch content swap has fully settled — wire to useEditorObjects().resumeAndReseedHistory. */
  onAfterSideSwap?: () => void
  /** POD.md §7.3 — re-editing an existing design (`/customize/:id?design=`). Seeds the internal per-side snapshot cache once, on mount, so opening on a side other than the design's first side still restores correctly. Read once; later prop changes are ignored (this component never remounts across a design load). */
  initialSnapshots?: Partial<Record<EditorSideName, SideSnapshot>>
  /** Fires whenever a side's snapshot is cached on swap-out, i.e. the moment it stops being the live/active side — lets the caller keep an always-fresh copy of every side's {json,width,height} without needing to force a side switch (see CustomizerEditor's add-to-cart flow). */
  onSnapshotCached?: (side: EditorSideName, snapshot: SideSnapshot) => void
  /**
   * POD-UI.md §3 Workstream C7 — live object count of the currently active
   * side, purely to decide whether to show the "Tap + to add text or an
   * image" empty-state prompt. Presentational only: never written to the
   * canvas, so it can never leak into a print file. Omit (or leave
   * undefined) to never show the prompt.
   */
  objectCount?: number
  /**
   * Bug 3b (canvasGutter.ts) — fires with the PURE bleed-rect pixel size
   * (never the gutter-inclusive `canvas.getWidth()/getHeight()`) every
   * time geometry is (re)computed. CustomizerEditor threads this into
   * `useEditorObjects` (new-object placement/sizing) and its own live DPI
   * scan / add-to-cart canonicalization, all of which used to read
   * `canvas.getWidth()/getHeight()` directly as a stand-in for "the bleed
   * rect's size" — a stand-in the gutter breaks. See canvasGutter.ts's
   * header for why this must not just be recomputed ad hoc from
   * `canvas.getWidth()`.
   */
  onBleedSizeChange?: (width: number, height: number) => void
  /**
   * POD-V2.md §6.6 — opens the "browse ready-made designs" drawer
   * (TemplateDrawer.tsx, owned by CustomizerEditor). Wired to the "Start
   * from a design" half of the empty-state prompt below. Optional so this
   * component's existing tests/stories that don't care about templates
   * don't all need updating just to satisfy a required prop.
   */
  onOpenDesigns?: () => void
}

/**
 * POD.md §5.2 / §6.2 as amended by POD-UI3.md §3.1 / §4.4 — the DESIGN
 * surface. This is the single most important component in the customizer:
 *
 *   <div class="stage">          <- fits the viewport, ResizeObserver'd, bg-surface-2
 *     <div class="plane">        <- paper-tinted card AT the bleed rect (the trim ring)
 *     <div class="sheet">        <- pure white fill AT the true print rect
 *     <canvas>                   <- absolutely positioned; its box IS the bleed rect
 *     <div class="gutter-scrim"> <- translucent PAPER band over the handle gutter
 *     <div class="safe-guide">   <- dashed inner outline, pure CSS
 *     <div class="print-guide">  <- solid outline at the true print rect
 *     <img>                      <- static ~80px mockup thumbnail, top-right
 *   </div>
 *
 * WHAT USED TO BE HERE, AND WHY IT ISN'T (POD-UI3.md §1.1): a full-stage
 * mockup <img> (object-fit: contain) under a `scrim` div whose
 * `0 0 0 9999px rgba(16,16,20,0.45)` box-shadow dimmed everything outside
 * the bleed rect. Both are deleted. A tee's print area is only ~35% of the
 * mockup's width, so the mockup squeezed the design canvas to ~150px on a
 * 390px phone, and the scrim's undimmed hole read as a hard-edged box
 * floating on a dark photo — the reported "large bounding box". With no
 * mockup there is nothing left to dim, so the scrim goes with it, and the
 * same print area now renders ~262px wide. Placement context comes from
 * the static thumbnail (purely decorative, `aria-hidden`); the REAL check
 * is preview mode, which composites the artwork into the mockup and shades
 * it with the garment's own folds (POD-UI3.md §3.2).
 *
 * The plane is always WHITE, never sampled from the garment (POD-UI3.md
 * §3.1): a colour clash (black art on a black tee) is what Preview is for,
 * and sampling would make the design surface depend on mockup pixels that
 * `design_json` deliberately doesn't reference.
 *
 * This component only ever renders the design surface. Preview mode is an
 * opaque sibling overlay ABOVE it (components/PreviewStage.tsx, POD-UI3.md
 * §4.6), and this component deliberately stays mounted and laid out
 * underneath — it owns the live Fabric canvas and the per-side snapshot
 * cache, so unmounting it on a mode change would destroy the shopper's
 * design. `mode` therefore still does exactly two things here: it
 * cross-fades the guides (and the thumbnail), and it flips
 * `setCanvasInteractive`. The prop interface is unchanged: `mockupUrl` is
 * still required (the thumbnail uses it) and `printRect` still drives
 * every rect.
 *
 * Geometry comes from `computeFlatStageGeometry(…, padding:
 * HANDLE_GUTTER_PX)` instead of `computeStageGeometry` — the same
 * normalized `print_*` fractions and the same frozen bleed/safe maths, but
 * fitting the BLEED RECT to the stage rather than fitting a photo and
 * taking whatever slice of it the print area happens to be. It still
 * returns a real (if synthetic) `containBox` at provably the same aspect
 * ratio as the canonical reference geometry (geometry.ts, POD-UI3.md §4.1
 * guarantee 3 — the invariant that keeps `rescaleFabricSnapshot` from
 * stretching a stored design onto this stage), so nothing else in this
 * file or downstream of it needed to change.
 *
 * We deliberately do NOT use Fabric clipPath: the canvas element cannot
 * paint outside itself, so clipping is free and exact, the export IS the
 * canvas (no re-compositing drift between preview and print), and the
 * guides are DOM so they can never leak into the exported artwork.
 *
 * One Fabric canvas instance lives for the component's whole lifetime;
 * switching `sideKey` snapshots the outgoing side's design into an
 * internal cache and restores (or blanks) the incoming side, so front and
 * back never leak objects into each other (POD.md §6.7) while still
 * sharing one <canvas> element.
 *
 * Bug 3b — the canvas ELEMENT is actually sized to the bleed rect PLUS a
 * fixed `HANDLE_GUTTER_PX` gutter on every side (canvasGutter.ts), not
 * exactly the bleed rect as POD.md §5.2 originally specified. This is
 * that section's own documented fallback: on a small print area, an
 * object's resize/rotate handles can sit outside the bleed rect and are
 * then clipped by the canvas element's own bounds — invisible and
 * unusable. Growing the element gives handles room to render.
 *
 * This is safe for print fidelity because of what a Fabric
 * `viewportTransform` actually is: a render/pointer-mapping camera, not a
 * coordinate rewrite. `canvas.toObject()` (snapshotCanvas) never
 * serializes it, and object `left`/`top` are never expressed relative to
 * it — so `design_json`, `preview.ts` and `admin/print/renderPrintFile.ts`
 * (which all only ever see JSON, never this live element) need no gutter
 * awareness at all. Concretely, every geometry pass below:
 *   1. Sets the canvas to the PURE bleed size (via the frozen
 *      `setCanvasDimensionsRaw`/`resizeCanvasScaled` — same calls as
 *      before, same object-rescale guarantee) so those two functions'
 *      `canvas.getWidth()`-based ratio math is never polluted by a
 *      gutter that was added on a previous pass.
 *   2. THEN grows the element by the gutter via one more
 *      `setCanvasDimensionsRaw` call — this only changes the backstore
 *      size, never rescales objects, so it cannot shift anything.
 *   3. Applies `setViewportTransform([1,0,0,1,G,G])` so rendering (and
 *      pointer<->object coordinate mapping) shifts by the gutter, while
 *      `positionCanvasWrapper` moves the wrapper outward by the same `G`
 *      — the two cancel out, so the bleed rect still lands exactly where
 *      `geometry.bleedRectPx` says it should, pixel for pixel.
 * `canvas.getWidth()/getHeight()` therefore now report the gutter-
 * inclusive size — every caller elsewhere that used to treat those as
 * "the bleed size" (useEditorObjects.ts, CustomizerEditor.tsx) has been
 * switched to `onBleedSizeChange`'s PURE value instead.
 *
 * The visual clip is restored with a DOM-only `gutter-scrim` overlay (a
 * `box-shadow` band exactly `HANDLE_GUTTER_PX` wide, painted OUTSIDE the
 * bleed rect, sitting ON TOP of the canvas in the stage) so art dragged
 * into the gutter still reads as "will be trimmed" while handles — drawn
 * by Fabric outside the scrim's stacking, and always `pointer-events:
 * none` on the scrim itself — remain visible and grabbable through it.
 *
 * That band is now the WORKSPACE GROUND's own colour at 72% —
 * `rgba(241,241,244,0.72)`, i.e. `--color-surface-2`, the container's
 * background — where it used to be `rgba(16,16,20,0.4)` (POD-UI3.md
 * §1.1/§3.1). It is the one overlay deliberately NOT faded by `mode` (see
 * its own comment below), so on a light workspace a 64px dark band was the
 * only thing left on screen in preview: a picture frame drawn around the
 * print area, which is half of the "large bounding box" report.
 *
 * Matching the ground EXACTLY is the point, and it is why this is not
 * `--color-paper`: a band whose colour differs from what it sits on is
 * visible as a band even at low alpha — which is the very artifact being
 * removed. Ground-coloured, it disappears over the workspace and does its
 * only real job, muting art dragged past the trim edge 72% of the way back
 * to the ground, so off-plane art reads as "this part fades away" instead
 * of looking fully kept. Alpha, not hue, is what does the muting, so this
 * loses nothing. Everything else about it is unchanged, `pointer-events:
 * none` included.
 */
export default function EditorStage({
  fabric,
  sideKey,
  mockupUrl,
  imageNaturalW,
  imageNaturalH,
  printRect,
  bleedPercent,
  safePercent,
  mode,
  onCanvasReady,
  onObjectCountChange,
  onBeforeSideSwap,
  onAfterSideSwap,
  initialSnapshots,
  onSnapshotCached,
  objectCount,
  onBleedSizeChange,
  onOpenDesigns,
}: EditorStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [geometry, setGeometry] = useState<StageGeometry | null>(null)
  // Bug 3b — the PURE bleed-rect pixel size the live canvas's objects are
  // CURRENTLY registered against (i.e. what `canvas.getWidth()/getHeight()`
  // would report if there were no gutter). Tracked separately from the
  // canvas's own (now gutter-inclusive) getWidth()/getHeight() so every
  // geometry pass can un-grow the canvas back to this exact size before
  // asking the frozen `resizeCanvasScaled` to rescale — see the
  // component doc comment above.
  const liveBleedPxRef = useRef({ w: 0, h: 0 })

  // Seeded once from `initialSnapshots` (re-editing an existing design —
  // POD.md §7.3). `useRef`'s initializer only runs on the first render, so
  // later prop changes are intentionally ignored — this component's
  // lifetime never spans "load one design, then load a different one".
  const snapshotsRef = useRef<Partial<Record<EditorSideName, SideSnapshot>>>(initialSnapshots ?? {})
  const prevSideKeyRef = useRef<EditorSideName | null>(null)
  const onCanvasReadyRef = useRef(onCanvasReady)
  onCanvasReadyRef.current = onCanvasReady
  const onObjectCountChangeRef = useRef(onObjectCountChange)
  onObjectCountChangeRef.current = onObjectCountChange
  const onBeforeSideSwapRef = useRef(onBeforeSideSwap)
  onBeforeSideSwapRef.current = onBeforeSideSwap
  const onAfterSideSwapRef = useRef(onAfterSideSwap)
  onAfterSideSwapRef.current = onAfterSideSwap
  const onSnapshotCachedRef = useRef(onSnapshotCached)
  onSnapshotCachedRef.current = onSnapshotCached
  const onBleedSizeChangeRef = useRef(onBleedSizeChange)
  onBleedSizeChangeRef.current = onBleedSizeChange

  // Create the Fabric canvas exactly once, as soon as the module and the
  // <canvas> element both exist. Disposed on unmount only.
  useEffect(() => {
    if (!fabric || !canvasElRef.current) return
    const created = createCanvas(fabric, canvasElRef.current, { width: 10, height: 10 })
    setCanvas(created)
    onCanvasReadyRef.current?.(created)
    return () => {
      onCanvasReadyRef.current?.(null)
      void disposeCanvas(created)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabric])

  // Track the stage container's rendered size.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    const rect = el.getBoundingClientRect()
    setContainerSize({ w: rect.width, h: rect.height })
    return () => observer.disconnect()
  }, [])

  // The core geometry + side-swap effect. Runs on mount, on every
  // container resize, and whenever the active side (or its print rect /
  // mockup) changes. POD.md §6.2 requires that a resize scale existing
  // objects proportionally rather than shifting them relative to the
  // print area — resizeCanvasScaled handles that; the side-swap branch
  // additionally restores each side's own snapshot at the pixel size it
  // was saved at before rescaling to the current stage size, so a window
  // resize that happens while a side is inactive doesn't leave that side's
  // design misregistered when the shopper switches back to it.
  useEffect(() => {
    if (!canvas || containerSize.w <= 0 || containerSize.h <= 0 || imageNaturalW <= 0 || imageNaturalH <= 0) return
    let cancelled = false

    async function run() {
      // POD-UI3.md §4.1/§4.4 — the ONLY thing that changed for the flat
      // design surface. `computeFlatStageGeometry` fits the BLEED rect to
      // the stage (minus HANDLE_GUTTER_PX on every side, so handles at the
      // plane's edge aren't clipped by the stage's overflow:hidden) instead
      // of fitting a mockup photo and taking whatever slice of it the print
      // area happens to be. It returns the identical `StageGeometry` shape,
      // derived from the same normalized `print_*` fractions through the
      // same frozen helpers, at provably the same aspect ratio as the
      // canonical reference geometry — so every line below, and every
      // consumer of `onBleedSizeChange`, is untouched by the swap.
      const geo = computeFlatStageGeometry({
        stageW: containerSize.w,
        stageH: containerSize.h,
        imageNaturalW,
        imageNaturalH,
        printRect,
        bleedPercent,
        safePercent,
        padding: HANDLE_GUTTER_PX,
      })
      const targetW = Math.max(1, Math.round(geo.bleedRectPx.w))
      const targetH = Math.max(1, Math.round(geo.bleedRectPx.h))

      const prevSideKey = prevSideKeyRef.current
      if (prevSideKey !== sideKey) {
        // Bracket the whole swap: canvas.clear() + loadFromJSON fires a
        // flurry of individual object:added/removed events that must NOT
        // each land their own entry on the undo stack (see
        // useEditorObjects' suspendHistory/resumeAndReseedHistory).
        onBeforeSideSwapRef.current?.()
        if (prevSideKey) {
          // Bug 3b — cache the OUTGOING side at its PURE bleed size
          // (liveBleedPxRef), never `getCanvasSize(canvas)` (which now
          // includes the gutter) — see the component doc comment.
          const outgoing = { json: snapshotCanvas(canvas!), width: liveBleedPxRef.current.w, height: liveBleedPxRef.current.h }
          snapshotsRef.current[prevSideKey] = outgoing
          onSnapshotCachedRef.current?.(prevSideKey, outgoing)
        }
        const stored = snapshotsRef.current[sideKey]
        if (stored) {
          setCanvasDimensionsRaw(canvas!, stored.width, stored.height) // PURE bleed size, raw (no rescale)
          await restoreCanvas(canvas!, stored.json)
          if (cancelled) return
          resizeCanvasScaled(canvas!, targetW, targetH) // PURE ratio: targetW / stored.width, exact
        } else {
          clearCanvas(canvas!)
          setCanvasDimensionsRaw(canvas!, targetW, targetH) // PURE bleed size, raw (nothing to rescale)
        }
        prevSideKeyRef.current = sideKey
        onAfterSideSwapRef.current?.()
      } else {
        // Bug 3b — same-side resize (e.g. window resize, or the mobile
        // properties Sheet opening/closing and shrinking/growing the
        // stage). First collapse back to the PURE size the live objects
        // are CURRENTLY registered against (undoing the previous pass's
        // gutter grow below) so resizeCanvasScaled's internal
        // `nextWidth / canvas.getWidth()` ratio is the exact pure-bleed
        // ratio, not polluted by a gutter that doesn't scale with it.
        setCanvasDimensionsRaw(canvas!, liveBleedPxRef.current.w, liveBleedPxRef.current.h)
        resizeCanvasScaled(canvas!, targetW, targetH)
      }

      // Bug 3b — grow the canvas ELEMENT by a fixed gutter so resize/
      // rotate handles have room to render and be grabbed even when the
      // print area is small (POD.md §5.2's documented fallback). This
      // step only changes the backstore size — it never touches an
      // object's left/top/scaleX/scaleY, so it cannot affect print
      // registration. The viewport transform then shifts RENDERING
      // (never the stored coordinates) by the same amount the wrapper is
      // about to move outward by, so the visible bleed rect lands
      // exactly where `geo.bleedRectPx` says it should either way.
      const grown = gutteredCanvasSize(targetW, targetH)
      setCanvasDimensionsRaw(canvas!, grown.width, grown.height)
      canvas!.setViewportTransform(gutterViewportTransform())
      liveBleedPxRef.current = { w: targetW, h: targetH }

      const wrapperOrigin = gutteredWrapperOrigin(geo.bleedRectPx.x, geo.bleedRectPx.y)
      positionCanvasWrapper(canvas!, wrapperOrigin.x, wrapperOrigin.y)
      setGeometry(geo)
      onBleedSizeChangeRef.current?.(targetW, targetH)
      onObjectCountChangeRef.current?.(sideKey, getObjectCount(canvas!))
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, containerSize.w, containerSize.h, sideKey, imageNaturalW, imageNaturalH, printRect.x, printRect.y, printRect.w, printRect.h, bleedPercent, safePercent])

  // POD.md §6.8 — preview mode hides selection handles and disables editing.
  useEffect(() => {
    if (!canvas) return
    setCanvasInteractive(canvas, mode === 'edit')
  }, [canvas, mode])

  // POD.md §5.2/§6.2 — this is presentation-only: `geometry` (computed by
  // the frozen computeStageGeometry) still drives every guide's left/top/
  // width/height exactly as before. The only change here is HOW visibility
  // toggles between edit/preview — an opacity + pointer-events transition
  // instead of an unmount/mount — so switching modes cross-fades smoothly
  // (POD-UI.md §3 C6) rather than snapping. Guides stay functionally
  // hidden in preview either way: `pointer-events-none` was already
  // unconditional on every guide, and `setCanvasInteractive` (unchanged,
  // fabric/canvas.ts) is what actually disables/hides selection handles.
  const guidesReady = !!geometry
  const guidesVisible = mode === 'edit'
  const isEmpty = mode === 'edit' && guidesReady && (objectCount ?? 1) === 0
  const guideTransitionCls = `pointer-events-none absolute transition-opacity duration-base ease-out-soft ${
    guidesVisible ? 'opacity-100' : 'opacity-0'
  }`

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden overscroll-contain bg-surface-2"
      style={{ touchAction: 'pinch-zoom' }}
      data-testid="editor-stage"
    >
      {/* POD-UI3.md §4.4 layers 2-3 — the flat design plane, in place of
          the deleted mockup <img> + dark scrim. Two stacked fills, both
          BELOW the Fabric canvas wrapper in DOM order (nothing here sets a
          z-index, so DOM order is paint order) so the shopper's artwork
          always draws on top of them:
            - the plane card at the BLEED rect: a diagonal HATCH, lifted
              off the workspace by `shadow-lift`. The hatch is doing real
              work, not decoration. Every flat fill available here —
              `bg-paper` on a `bg-surface-2` ground — puts
              the trim ring within ~6 RGB levels of the workspace, so a
              shopper cannot tell where the sheet ends and, worse, cannot
              tell that the ring is the part that gets trimmed. A hatch is
              the standard, self-explanatory notation for "margin, will be
              cut", and it survives any future change to the ground
              colour. Square corners deliberately: the bleed rect IS the
              exported area (it is exactly what `toDataURL` returns), and
              rounding it would misrepresent the export boundary.
            - the print sheet at the TRUE print rect: `bg-surface`, i.e.
              pure white — the paper the art actually lands on. Covers the
              hatch inside the print area, so the hatch remains visible
              only in the bleed ring, which is precisely the region it
              describes.
          Neither is gated by `mode`. In preview mode PreviewStage's opaque
          overlay covers them anyway, and a plane that flickered out from
          under the artwork mid-cross-fade would look like a bug. */}
      {guidesReady && geometry && (
        <div
          className="pointer-events-none absolute shadow-lift"
          style={{
            left: geometry.bleedRectPx.x,
            top: geometry.bleedRectPx.y,
            width: geometry.bleedRectPx.w,
            height: geometry.bleedRectPx.h,
            backgroundColor: 'var(--color-paper)',
            backgroundImage:
              'repeating-linear-gradient(45deg, var(--color-line) 0 1px, transparent 1px 7px)',
          }}
          data-testid="design-plane"
        />
      )}

      {guidesReady && geometry && (
        <div
          className="pointer-events-none absolute bg-surface"
          style={{
            left: geometry.printRectPx.x,
            top: geometry.printRectPx.y,
            width: geometry.printRectPx.w,
            height: geometry.printRectPx.h,
          }}
          data-testid="print-sheet"
        />
      )}

      {/* Wrapper only so we can pin the Fabric-owned canvas container to a
          fixed layer; Fabric replaces this <canvas> with its own wrapper
          div (canvas.wrapperEl) and positions it via positionCanvasWrapper
          above — see fabric/canvas.ts. */}
      <div style={{ touchAction: 'none' }}>
        <canvas ref={canvasElRef} />
      </div>

      {/* Bug 3b — restores the visual clip the gutter (canvasGutter.ts)
          gave up: a `box-shadow` band exactly HANDLE_GUTTER_PX wide,
          painted OUTSIDE the bleed rect's own box (never inside it, so
          the artwork itself is never dimmed), sitting ON TOP of the
          canvas in paint order (it's later in the DOM than the canvas
          wrapper above) so art dragged into the gutter reads as "will be
          trimmed" instead of looking fully kept. `pointer-events-none`
          means handles drawn in that band stay grabbable through it.
          Deliberately NOT gated by `guidesVisible`/edit-vs-preview like
          the other guides below — in preview mode the canvas element is
          still the gutter-inclusive size (only interactivity is
          disabled), so fading this out would let off-print art show
          through unclipped exactly when a shopper is reviewing what
          they're about to buy.

          POD-UI3.md §1.1/§3.1 — tinted `rgba(247,247,249,0.72)`
          (`--color-paper` at 72%) rather than the old
          `rgba(16,16,20,0.4)`. Because it is un-faded by mode, the dark
          version was the ONLY overlay left on screen in preview: a 64px
          dark band around the print area, i.e. exactly the "large
          bounding box" being removed. Paper-coloured and translucent it
          still mutes what will be trimmed without drawing a frame. This
          is the one literal rgba() in the file: it needs the token's
          value at a specific alpha inside a `box-shadow` spread, which no
          `bg-*`/`shadow-*` utility can express. */}
      {guidesReady && geometry && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: geometry.bleedRectPx.x,
            top: geometry.bleedRectPx.y,
            width: geometry.bleedRectPx.w,
            height: geometry.bleedRectPx.h,
            boxShadow: `0 0 0 ${HANDLE_GUTTER_PX}px rgba(241,241,244,0.72)`,
          }}
          data-testid="gutter-scrim"
        />
      )}

      {/* POD-UI.md §3 C7 — empty-state prompt. A DOM overlay, positioned by
          the same frozen geometry as the print guide, so it sits centred
          in the print area without ever becoming a canvas object (and
          therefore can never leak into the exported print file). */}
      {isEmpty && geometry && (
        <div
          className="pointer-events-none absolute flex items-center justify-center p-4 text-center animate-fade-in"
          style={{
            left: geometry.printRectPx.x,
            top: geometry.printRectPx.y,
            width: geometry.printRectPx.w,
            height: geometry.printRectPx.h,
          }}
        >
          {/* POD-UI3.md §4.4 — `bg-surface/80` (its pre-flat-plane value)
              was designed to sit on a dark scrim. On the white print sheet
              it is invisible, leaving a bare floating label; a tinted fill
              with a real border keeps it reading as a chip.

              POD-V2.md §6.6 — the chip itself gets `pointer-events-auto`
              (its wrapper above stays `pointer-events-none` so the rest of
              the print area is still draggable/tappable) so "Start from a
              design" is a real, clickable trigger for the template drawer
              while "or start blank" stays plain descriptive text — tapping
              + on the tool rail is still how a shopper does that half. */}
          <p className="pointer-events-auto rounded-btn border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-soft">
            <button
              type="button"
              onClick={() => onOpenDesigns?.()}
              className="font-semibold text-ink underline underline-offset-2 hover:text-accent"
            >
              Start from a design
            </button>
            , or start blank
          </p>
        </div>
      )}

      {guidesReady && geometry && (
        <div
          className={`safe-guide rounded-sm border border-dashed border-accent/80 ${guideTransitionCls}`}
          style={{
            left: geometry.safeRectPx.x,
            top: geometry.safeRectPx.y,
            width: geometry.safeRectPx.w,
            height: geometry.safeRectPx.h,
          }}
        />
      )}

      {guidesReady && geometry && (
        <div
          className={`print-guide border-2 border-ink/60 ${guideTransitionCls}`}
          style={{
            left: geometry.printRectPx.x,
            top: geometry.printRectPx.y,
            width: geometry.printRectPx.w,
            height: geometry.printRectPx.h,
          }}
        />
      )}

      {/* POD-UI3.md §3.1/§4.4 layer 9 — static mockup thumbnail. The stage
          no longer shows the garment, so this is the only on-stage answer
          to "where does this land?". It needs NO geometry call: the stored
          `print_*` values are normalized fractions of the mockup's OWN
          box, and this wrapper is exactly the <img>'s box (width-driven,
          height from the intrinsic aspect), so `left: print_x * 100%` etc.
          is exact at any thumbnail size and stays exact if the size ever
          changes. Static by design — no artwork is composited into it, so
          it never re-renders and costs nothing beyond the mockup fetch the
          preview compositor warms anyway. Purely decorative: `aria-hidden`
          + `alt=""` keep it out of the accessibility tree (Preview is the
          real check, and it is reachable by its own button), and
          `draggable={false}` stops a drag-to-desktop gesture from
          interrupting a design drag. Fades with `mode` on the same
          transition as the guides. */}
      {guidesReady && (
        <div
          aria-hidden
          className={`right-3 top-3 w-20 overflow-hidden rounded-card border border-line bg-surface shadow-card ${guideTransitionCls}`}
          data-testid="mockup-thumbnail"
        >
          <div className="relative">
            <img src={mockupUrl} alt="" draggable={false} className="block w-full select-none" />
            <div
              className="absolute border border-accent"
              style={{
                left: `${printRect.x * 100}%`,
                top: `${printRect.y * 100}%`,
                width: `${printRect.w * 100}%`,
                height: `${printRect.h * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
