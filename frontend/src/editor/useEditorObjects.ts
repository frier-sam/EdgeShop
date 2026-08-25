import { useCallback, useEffect, useRef, useState } from 'react'
import type { FabricModule, FabricCanvas, FabricObject } from './fabric/loadFabric'
import { snapshotCanvas, restoreCanvas, isTextEditing as canvasIsTextEditing } from './fabric/canvas'
import {
  makeText,
  makeImage,
  makeRect,
  makeCircle,
  makeTriangle,
  makeStar,
  makeLine,
  addAndSelect,
  type ShapeStyle,
  type MakeImageOptions,
} from './fabric/objects'
import {
  deleteSelection,
  duplicateSelection,
  bringForward as fabricBringForward,
  sendBackward as fabricSendBackward,
  bringToFront as fabricBringToFront,
  sendToBack as fabricSendToBack,
  centerInPrintArea,
} from './fabric/selection'
import type { ShapeKind } from './types'

const HISTORY_LIMIT = 30 // POD.md §6.3 — ring buffer of at most 30 states

export interface UseEditorObjectsArgs {
  fabric: FabricModule | null
  canvas: FabricCanvas | null
  /** Fires after any change that could affect "does this side have >=1 object" (POD.md §6.7 pricing) or the persisted snapshot. */
  onContentChange?: (objectCount: number, json: string) => void
}

export interface UseEditorObjectsApi {
  selected: FabricObject | null
  objectCount: number
  canUndo: boolean
  canRedo: boolean
  addText: (fontFamily: string) => void
  addImage: (url: string, opts?: MakeImageOptions) => Promise<void>
  addShape: (kind: ShapeKind, style?: ShapeStyle) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  bringForward: () => void
  sendBackward: () => void
  bringToFront: () => void
  sendToBack: () => void
  centerSelected: () => void
  undo: () => void
  redo: () => void
  /** Call after mutating the selected object directly (e.g. from PropertiesPanel — font/color/fill/etc.) so the change is re-rendered and pushed onto the undo stack. Fabric only auto-fires object:modified for interactive transforms, not programmatic .set() calls. */
  commitChange: () => void
  /**
   * Mutes history recording — wire to EditorStage's `onBeforeSideSwap`.
   * A side switch does a `canvas.clear()` + `loadFromJSON(...)`, which
   * fires a flurry of individual object:added/object:removed events; left
   * unmuted, each one would land its own (wrong, partial) entry on the
   * undo stack. Pair with `resumeAndReseedHistory`.
   */
  suspendHistory: () => void
  /** Un-mutes history and records the just-settled canvas as this side's fresh baseline (index 0) — wire to EditorStage's `onAfterSideSwap`. Each side's history is independent (POD.md §6.7): this is what makes it so. */
  resumeAndReseedHistory: () => void
}

/**
 * POD.md §6.3 — the object model hook: add/select/transform/delete/
 * duplicate/reorder plus a 30-state undo/redo ring buffer, and the global
 * Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Delete/Backspace keybindings.
 *
 * One instance of this hook wraps the single shared Fabric canvas; history
 * is reset to a fresh per-side baseline via `suspendHistory` /
 * `resumeAndReseedHistory`, called from EditorStage around its side-swap
 * (see EditorStage's `onBeforeSideSwap` / `onAfterSideSwap`), so front and
 * back never leak undo state into each other (POD.md §6.7).
 */
export function useEditorObjects({ fabric, canvas, onContentChange }: UseEditorObjectsArgs): UseEditorObjectsApi {
  const [selected, setSelected] = useState<FabricObject | null>(null)
  const [objectCount, setObjectCount] = useState(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const restoringRef = useRef(false)
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange

  const pushHistory = useCallback(() => {
    if (!canvas || restoringRef.current) return
    const json = snapshotCanvas(canvas)
    const idx = historyIndexRef.current
    // A new action after an undo discards the redo branch — standard editor semantics.
    const truncated = historyRef.current.slice(0, idx + 1)
    truncated.push(json)
    while (truncated.length > HISTORY_LIMIT) truncated.shift()
    historyRef.current = truncated
    historyIndexRef.current = truncated.length - 1
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
    const count = canvas.getObjects().length
    setObjectCount(count)
    onContentChangeRef.current?.(count, json)
  }, [canvas])

  const suspendHistory = useCallback(() => {
    restoringRef.current = true
  }, [])

  const resumeAndReseedHistory = useCallback(() => {
    restoringRef.current = false
    historyRef.current = []
    historyIndexRef.current = -1
    setCanRedo(false)
    pushHistory() // records the just-settled (new side's) canvas as index 0
  }, [pushHistory])

  // Wire canvas events -> history / selection / object count.
  useEffect(() => {
    if (!canvas) return

    const handleChange = () => pushHistory()
    const handleSelection = () => setSelected(canvas.getActiveObject() ?? null)
    const handleCleared = () => setSelected(null)

    canvas.on('object:added', handleChange)
    canvas.on('object:removed', handleChange)
    canvas.on('object:modified', handleChange)
    canvas.on('text:changed', handleChange)
    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleCleared)

    return () => {
      canvas.off('object:added', handleChange)
      canvas.off('object:removed', handleChange)
      canvas.off('object:modified', handleChange)
      canvas.off('text:changed', handleChange)
      canvas.off('selection:created', handleSelection)
      canvas.off('selection:updated', handleSelection)
      canvas.off('selection:cleared', handleCleared)
    }
  }, [canvas, pushHistory])

  const undo = useCallback(() => {
    if (!canvas || historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    restoringRef.current = true
    restoreCanvas(canvas, historyRef.current[historyIndexRef.current]).finally(() => {
      restoringRef.current = false
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
      const count = canvas.getObjects().length
      setObjectCount(count)
      onContentChangeRef.current?.(count, historyRef.current[historyIndexRef.current])
    })
  }, [canvas])

  const redo = useCallback(() => {
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    restoringRef.current = true
    restoreCanvas(canvas, historyRef.current[historyIndexRef.current]).finally(() => {
      restoringRef.current = false
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
      const count = canvas.getObjects().length
      setObjectCount(count)
      onContentChangeRef.current?.(count, historyRef.current[historyIndexRef.current])
    })
  }, [canvas])

  // Global keybindings — POD.md §6.3: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, and
  // Delete/Backspace to remove the selection, EXCEPT while an IText object
  // is in in-canvas editing mode (that classic bug: Backspace should edit
  // the text, not delete the whole object).
  useEffect(() => {
    if (!canvas) return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const inFormField = !!target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        if (inFormField) return
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (inFormField) return
        const active = canvas!.getActiveObject()
        if (!active) return
        if (canvasIsTextEditing(active)) return // let the IText editor handle its own backspace
        e.preventDefault()
        deleteSelection(canvas!)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canvas, undo, redo])

  const canvasCenter = useCallback((): { x: number; y: number } => {
    if (!canvas) return { x: 0, y: 0 }
    // The design canvas element IS the bleed rect, and bleed grows the
    // print rect symmetrically (POD.md §5.3), so the canvas's own center
    // is always exactly the print rect's center too — no extra geometry
    // plumbing needed here.
    return { x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 }
  }, [canvas])

  const addText = useCallback(
    (fontFamily: string) => {
      if (!fabric || !canvas) return
      const obj = makeText(fabric, 'Your text', canvasCenter(), fontFamily)
      addAndSelect(canvas, obj)
    },
    [fabric, canvas, canvasCenter]
  )

  const addImage = useCallback(
    async (url: string, opts?: MakeImageOptions) => {
      if (!fabric || !canvas) return
      const maxDim = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.7
      const obj = await makeImage(fabric, url, canvasCenter(), { maxDisplayWidth: maxDim, ...opts })
      addAndSelect(canvas, obj)
    },
    [fabric, canvas, canvasCenter]
  )

  const addShape = useCallback(
    (kind: ShapeKind, style?: ShapeStyle) => {
      if (!fabric || !canvas) return
      const size = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.35
      const center = canvasCenter()
      let obj
      switch (kind) {
        case 'rect':
          obj = makeRect(fabric, center, size, size * 0.7, style)
          break
        case 'circle':
          obj = makeCircle(fabric, center, size / 2, style)
          break
        case 'triangle':
          obj = makeTriangle(fabric, center, size, size, style)
          break
        case 'star':
          obj = makeStar(fabric, center, size / 2, style)
          break
        case 'line':
          obj = makeLine(fabric, center, size, style)
          break
      }
      addAndSelect(canvas, obj)
    },
    [fabric, canvas, canvasCenter]
  )

  const deleteSelected = useCallback(() => {
    if (!canvas) return
    deleteSelection(canvas)
  }, [canvas])

  const duplicateSelected = useCallback(() => {
    if (!canvas) return
    void duplicateSelection(canvas)
  }, [canvas])

  const bringForward = useCallback(() => canvas && fabricBringForward(canvas), [canvas])
  const sendBackward = useCallback(() => canvas && fabricSendBackward(canvas), [canvas])
  const bringToFront = useCallback(() => canvas && fabricBringToFront(canvas), [canvas])
  const sendToBack = useCallback(() => canvas && fabricSendToBack(canvas), [canvas])
  const centerSelected = useCallback(() => canvas && centerInPrintArea(canvas, canvasCenter()), [canvas, canvasCenter])

  const commitChange = useCallback(() => {
    if (!canvas) return
    canvas.getActiveObject()?.setCoords()
    canvas.requestRenderAll()
    pushHistory()
  }, [canvas, pushHistory])

  return {
    selected,
    objectCount,
    canUndo,
    canRedo,
    addText,
    addImage,
    addShape,
    deleteSelected,
    duplicateSelected,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    centerSelected,
    undo,
    redo,
    commitChange,
    suspendHistory,
    resumeAndReseedHistory,
  }
}
