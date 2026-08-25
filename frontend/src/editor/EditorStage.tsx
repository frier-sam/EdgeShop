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
  getCanvasSize,
  getObjectCount,
  positionCanvasWrapper,
  setCanvasInteractive,
} from './fabric/canvas'
import { computeStageGeometry, type NormalizedRect, type StageGeometry } from './geometry'
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
}

/**
 * POD.md §5.2 / §6.2 — the two-layer stage. This is the single most
 * important component in the customizer:
 *
 *   <div class="stage">          <- fits the viewport, ResizeObserver'd
 *     <img>                      <- plain DOM <img>, object-fit: contain
 *     <div class="scrim">        <- dims the area OUTSIDE the bleed rect
 *     <canvas>                   <- absolutely positioned; its box IS the bleed rect
 *     <div class="safe-guide">   <- dashed inner outline, pure CSS
 *     <div class="print-guide">  <- solid outline at the true print rect
 *   </div>
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
}: EditorStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasElRef = useRef<HTMLCanvasElement | null>(null)
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [geometry, setGeometry] = useState<StageGeometry | null>(null)

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
      const geo = computeStageGeometry({
        stageW: containerSize.w,
        stageH: containerSize.h,
        imageNaturalW,
        imageNaturalH,
        printRect,
        bleedPercent,
        safePercent,
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
          const outgoing = { json: snapshotCanvas(canvas!), ...getCanvasSize(canvas!) }
          snapshotsRef.current[prevSideKey] = outgoing
          onSnapshotCachedRef.current?.(prevSideKey, outgoing)
        }
        const stored = snapshotsRef.current[sideKey]
        if (stored) {
          setCanvasDimensionsRaw(canvas!, stored.width, stored.height)
          await restoreCanvas(canvas!, stored.json)
          if (cancelled) return
          resizeCanvasScaled(canvas!, targetW, targetH)
        } else {
          clearCanvas(canvas!)
          setCanvasDimensionsRaw(canvas!, targetW, targetH)
        }
        prevSideKeyRef.current = sideKey
        onAfterSideSwapRef.current?.()
      } else {
        resizeCanvasScaled(canvas!, targetW, targetH)
      }

      positionCanvasWrapper(canvas!, geo.bleedRectPx.x, geo.bleedRectPx.y)
      setGeometry(geo)
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

  const showGuides = mode === 'edit' && !!geometry

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full select-none overflow-hidden bg-[#e9e4da]"
      style={{ touchAction: 'pinch-zoom' }}
      data-testid="editor-stage"
    >
      <img
        src={mockupUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      {showGuides && geometry && (
        <div
          className="scrim pointer-events-none absolute"
          style={{
            left: geometry.bleedRectPx.x,
            top: geometry.bleedRectPx.y,
            width: geometry.bleedRectPx.w,
            height: geometry.bleedRectPx.h,
            boxShadow: '0 0 0 9999px rgba(26,21,18,0.45)',
          }}
        />
      )}

      {/* Wrapper only so we can pin the Fabric-owned canvas container to a
          fixed layer; Fabric replaces this <canvas> with its own wrapper
          div (canvas.wrapperEl) and positions it via positionCanvasWrapper
          above — see fabric/canvas.ts. */}
      <div style={{ touchAction: 'none' }}>
        <canvas ref={canvasElRef} />
      </div>

      {showGuides && geometry && (
        <div
          className="safe-guide pointer-events-none absolute rounded-sm border border-dashed border-accent/80"
          style={{
            left: geometry.safeRectPx.x,
            top: geometry.safeRectPx.y,
            width: geometry.safeRectPx.w,
            height: geometry.safeRectPx.h,
          }}
        />
      )}

      {showGuides && geometry && (
        <div
          className="print-guide pointer-events-none absolute border-2 border-ink/60"
          style={{
            left: geometry.printRectPx.x,
            top: geometry.printRectPx.y,
            width: geometry.printRectPx.w,
            height: geometry.printRectPx.h,
          }}
        />
      )}
    </div>
  )
}
