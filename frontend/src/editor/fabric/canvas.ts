// frontend/src/editor/fabric/canvas.ts
//
// Canvas lifecycle: create/dispose, responsive resize that rescales
// existing objects (POD.md §6.2 — "the design must not shift relative to
// the print area"), JSON snapshot/restore for undo-redo and side-switching,
// and the preview-mode toggle (§6.8). Every direct Fabric API touch for
// canvas-level concerns lives in this one file.
import type { FabricModule, FabricCanvas, FabricObject } from './loadFabric'

/**
 * Extra per-object properties we round-trip through toJSON/loadFromJSON.
 * Fabric only serializes its own known props by default; anything we stash
 * on an object (asset natural size for the DPI badge, whether an image
 * came from an SVG, etc.) must be listed here or it's silently dropped on
 * save/reload, which would break the low-DPI warning after a reload.
 */
export const CUSTOM_OBJECT_PROPS = ['assetNaturalWidth', 'assetNaturalHeight', 'isVectorAsset', 'sourceUrl'] as const

export interface CreateCanvasOptions {
  width: number
  height: number
}

/**
 * The design canvas element IS the bleed rect (POD.md §5.2) — no
 * clipPath, no background fill (must export transparent), selection
 * enabled by default since we start in edit mode.
 */
export function createCanvas(fabric: FabricModule, el: HTMLCanvasElement, opts: CreateCanvasOptions): FabricCanvas {
  const canvas = new fabric.Canvas(el, {
    width: opts.width,
    height: opts.height,
    selection: true,
    preserveObjectStacking: true,
    stopContextMenu: true,
    fireRightClick: false,
  })
  return canvas
}

export async function disposeCanvas(canvas: FabricCanvas | null): Promise<void> {
  if (!canvas) return
  try {
    await canvas.dispose()
  } catch {
    // Fabric can throw if the element was already detached from the DOM
    // (e.g. React unmounted the stage before this ran) — never let cleanup
    // crash the app.
  }
}

/**
 * Resize the canvas element to `nextWidth x nextHeight` and rescale every
 * existing object by the same factor, so a design built at one viewport
 * size doesn't shift relative to the print area at another (POD.md §6.2 —
 * "the most likely place for a subtle bug"). Because the bleed rect's
 * aspect ratio is constant (derived from a fixed normalized print rect —
 * see geometry.ts), scaleX and scaleY are always equal in practice; we
 * still scale each axis independently rather than assuming a single
 * scalar; guarding against a currently-zero canvas.
 */
export function resizeCanvasScaled(canvas: FabricCanvas, nextWidth: number, nextHeight: number): void {
  const prevWidth = canvas.getWidth()
  const prevHeight = canvas.getHeight()

  if (prevWidth > 0 && prevHeight > 0 && (prevWidth !== nextWidth || prevHeight !== nextHeight)) {
    const scaleX = nextWidth / prevWidth
    const scaleY = nextHeight / prevHeight
    for (const obj of canvas.getObjects()) {
      obj.set({
        left: (obj.left ?? 0) * scaleX,
        top: (obj.top ?? 0) * scaleY,
        scaleX: (obj.scaleX ?? 1) * scaleX,
        scaleY: (obj.scaleY ?? 1) * scaleY,
      })
      obj.setCoords()
    }
  }

  canvas.setDimensions({ width: nextWidth, height: nextHeight })
  canvas.requestRenderAll()
}

/**
 * JSON string snapshot of the canvas, including our custom object props.
 * Fabric v6's `canvas.toJSON()` takes no arguments (it's just `JSON.stringify`
 * sugar over `toObject()`) — `toObject(propertiesToInclude)` is the one that
 * actually accepts the extra-properties list.
 */
export function snapshotCanvas(canvas: FabricCanvas): string {
  return JSON.stringify(canvas.toObject([...CUSTOM_OBJECT_PROPS]))
}

/** Restore a canvas from a snapshot produced by snapshotCanvas (or an empty side's initial state). */
export async function restoreCanvas(canvas: FabricCanvas, json: string): Promise<void> {
  await canvas.loadFromJSON(json)
  canvas.requestRenderAll()
}

export function clearCanvas(canvas: FabricCanvas): void {
  canvas.clear()
  canvas.requestRenderAll()
}

/** Sets the canvas element's pixel size with NO object rescaling — used when restoring a side's stored snapshot at the dimensions it was saved at, before rescaling to the current stage size (see CustomizerEditor's side-switch logic). */
export function setCanvasDimensionsRaw(canvas: FabricCanvas, width: number, height: number): void {
  canvas.setDimensions({ width, height })
}

export function getCanvasSize(canvas: FabricCanvas): { width: number; height: number } {
  return { width: canvas.getWidth(), height: canvas.getHeight() }
}

export function getObjectCount(canvas: FabricCanvas): number {
  return canvas.getObjects().length
}

/**
 * Fabric wraps the `<canvas>` you hand it in its own `.canvas-container`
 * div (`canvas.wrapperEl`) holding the lower (content) and upper
 * (interaction/selection) canvases stacked on top of each other. To make
 * "the canvas" sit exactly at the bleed rect within our stage (POD.md
 * §5.2) we position that wrapper, not the original element — React never
 * touches this node directly, Fabric owns it entirely.
 */
export function positionCanvasWrapper(canvas: FabricCanvas, x: number, y: number): void {
  const el = canvas.wrapperEl
  el.style.position = 'absolute'
  el.style.left = `${x}px`
  el.style.top = `${y}px`
}

/**
 * POD.md §6.8 — preview state hides every guide (those are DOM, handled by
 * the caller) and every selection handle. `discardActiveObject` removes the
 * live transform controls; toggling `selectable`/`evented` per object stops
 * a shopper from dragging art around while "reviewing" the print.
 */
export function setCanvasInteractive(canvas: FabricCanvas, interactive: boolean): void {
  if (!interactive) {
    canvas.discardActiveObject()
  }
  canvas.selection = interactive
  for (const obj of canvas.getObjects()) {
    obj.selectable = interactive
    obj.evented = interactive
  }
  canvas.requestRenderAll()
}

export function isTextEditing(obj: FabricObject | null | undefined): boolean {
  return !!obj && (obj as unknown as { isEditing?: boolean }).isEditing === true
}
