// frontend/src/editor/fabric/selection.ts
//
// Selection, delete/duplicate, layer-order and the low-DPI scan — every
// Fabric API touch for "acting on the current object(s)" (POD.md §11).
import type { FabricCanvas, FabricObject } from './loadFabric'
import { computeEffectiveDpi, dpiSeverity, type DpiSeverity } from '../geometry'

export function getActiveObject(canvas: FabricCanvas | null): FabricObject | null {
  return canvas?.getActiveObject() ?? null
}

export function isTextEditing(obj: FabricObject | null): boolean {
  return !!obj && (obj as unknown as { isEditing?: boolean }).isEditing === true
}

/** Deletes the current selection (single object or a multi-object ActiveSelection). */
export function deleteSelection(canvas: FabricCanvas): boolean {
  const active = canvas.getActiveObjects()
  if (active.length === 0) return false
  canvas.discardActiveObject()
  canvas.remove(...active)
  canvas.requestRenderAll()
  return true
}

/** Duplicates the active object (single-object only — multi-select duplicate is not exposed in the UI). */
export async function duplicateSelection(canvas: FabricCanvas): Promise<FabricObject | null> {
  const active = canvas.getActiveObject()
  if (!active) return null
  const clone = await active.clone()
  clone.set({
    left: (active.left ?? 0) + 20,
    top: (active.top ?? 0) + 20,
  })
  canvas.add(clone)
  canvas.setActiveObject(clone)
  canvas.requestRenderAll()
  return clone
}

export function bringForward(canvas: FabricCanvas): void {
  const active = canvas.getActiveObject()
  if (!active) return
  canvas.bringObjectForward(active)
  canvas.requestRenderAll()
}

export function sendBackward(canvas: FabricCanvas): void {
  const active = canvas.getActiveObject()
  if (!active) return
  canvas.sendObjectBackwards(active)
  canvas.requestRenderAll()
}

export function bringToFront(canvas: FabricCanvas): void {
  const active = canvas.getActiveObject()
  if (!active) return
  canvas.bringObjectToFront(active)
  canvas.requestRenderAll()
}

export function sendToBack(canvas: FabricCanvas): void {
  const active = canvas.getActiveObject()
  if (!active) return
  canvas.sendObjectToBack(active)
  canvas.requestRenderAll()
}

/** Centers the active object within the (canvas-local) print rect. */
export function centerInPrintArea(canvas: FabricCanvas, printCenter: { x: number; y: number }): void {
  const active = canvas.getActiveObject()
  if (!active) return
  active.set({ left: printCenter.x, top: printCenter.y })
  active.setCoords()
  canvas.requestRenderAll()
}

export interface ImageDpiInfo {
  object: FabricObject
  dpi: number
  severity: DpiSeverity
}

/**
 * POD.md §5.1 / §6.5 — scans every raster image object for print
 * resolution. Vector-sourced (SVG) images are skipped: their "natural
 * width" is the SVG's intrinsic viewBox size, not a meaningful raster
 * pixel count, so the formula would produce false low-DPI warnings.
 */
export function scanImageDpi(canvas: FabricCanvas, canvasCssWidth: number, printWidthIn: number): ImageDpiInfo[] {
  const out: ImageDpiInfo[] = []
  for (const obj of canvas.getObjects()) {
    // Fabric v6 object.type is PascalCase ('Image', 'IText', 'Rect', ...).
    if (obj.type !== 'Image') continue
    const meta = obj as unknown as { assetNaturalWidth?: number; isVectorAsset?: boolean }
    if (meta.isVectorAsset) continue
    const assetNaturalWidth = meta.assetNaturalWidth
    if (!assetNaturalWidth) continue
    const dpi = computeEffectiveDpi({
      assetNaturalWidth,
      objectWidthPx: obj.getScaledWidth(),
      canvasCssWidth,
      printWidthIn,
    })
    out.push({ object: obj, dpi, severity: dpiSeverity(dpi) })
  }
  return out
}
