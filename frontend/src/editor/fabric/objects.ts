// frontend/src/editor/fabric/objects.ts
//
// Every `new fabric.X(...)` call for creating text/image/shape objects
// lives here (POD.md §11 — isolate all Fabric API calls so a future
// library swap only touches this directory). All factories place the new
// object with originX/originY = 'center', so "left/top" always means
// "where is this object's center" — that makes centering-in-print-area
// and the canvas resize/rescale math (see ./canvas.ts) uniform across
// every object type.
import type { FabricModule, FabricCanvas, FabricIText, FabricImage } from './loadFabric'
import { starPoints } from '../geometry'

export interface Point {
  x: number
  y: number
}

const DEFAULT_FILL = '#1a1512'

export function makeText(fabric: FabricModule, text: string, center: Point, fontFamily: string): FabricIText {
  const obj = new fabric.IText(text, {
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    fontFamily,
    fontSize: 48,
    fill: DEFAULT_FILL,
    textAlign: 'center',
    fontWeight: 400,
    fontStyle: 'normal',
    charSpacing: 0,
  })
  return obj
}

export interface MakeImageOptions {
  /** Cap the object's initial on-canvas width, in canvas px (object is scaled down proportionally to fit). */
  maxDisplayWidth?: number
  isVectorAsset?: boolean
  sourceUrl?: string
}

/**
 * Loads an image (raster or SVG rasterized via <img>) into a FabricImage
 * centered at `center`. Stashes the asset's natural pixel size as custom
 * properties — `useEditorObjects`'s DPI scan (POD.md §6.5) reads these
 * rather than re-measuring the underlying element, so a reloaded design
 * (loadFromJSON) keeps showing accurate low-DPI badges without a re-fetch.
 */
export async function makeImage(fabric: FabricModule, url: string, center: Point, opts: MakeImageOptions = {}): Promise<FabricImage> {
  const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
  const naturalWidth = img.width
  const naturalHeight = img.height

  let scale = 1
  if (opts.maxDisplayWidth && naturalWidth > opts.maxDisplayWidth) {
    scale = opts.maxDisplayWidth / naturalWidth
  }

  img.set({
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    scaleX: scale,
    scaleY: scale,
  })
  // Custom bookkeeping — must be listed in CUSTOM_OBJECT_PROPS (./canvas.ts)
  // to survive toJSON/loadFromJSON round-trips.
  Object.assign(img, {
    assetNaturalWidth: naturalWidth,
    assetNaturalHeight: naturalHeight,
    isVectorAsset: !!opts.isVectorAsset,
    sourceUrl: opts.sourceUrl ?? url,
  })
  return img
}

export interface ShapeStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
}

const DEFAULT_SHAPE_STYLE: Required<ShapeStyle> = { fill: '#c2410c', stroke: '', strokeWidth: 0 }

export function makeRect(fabric: FabricModule, center: Point, width: number, height: number, style: ShapeStyle = {}, cornerRadius = 0) {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style }
  return new fabric.Rect({
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    width,
    height,
    rx: cornerRadius,
    ry: cornerRadius,
    fill: s.fill,
    stroke: s.stroke || undefined,
    strokeWidth: s.stroke ? s.strokeWidth : 0,
  })
}

export function makeCircle(fabric: FabricModule, center: Point, radius: number, style: ShapeStyle = {}) {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style }
  return new fabric.Circle({
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    radius,
    fill: s.fill,
    stroke: s.stroke || undefined,
    strokeWidth: s.stroke ? s.strokeWidth : 0,
  })
}

export function makeTriangle(fabric: FabricModule, center: Point, width: number, height: number, style: ShapeStyle = {}) {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style }
  return new fabric.Triangle({
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    width,
    height,
    fill: s.fill,
    stroke: s.stroke || undefined,
    strokeWidth: s.stroke ? s.strokeWidth : 0,
  })
}

export function makeStar(fabric: FabricModule, center: Point, outerRadius: number, style: ShapeStyle = {}) {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style }
  const points = starPoints(0, 0, 5, outerRadius, outerRadius * 0.4)
  return new fabric.Polygon(points, {
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    fill: s.fill,
    stroke: s.stroke || undefined,
    strokeWidth: s.stroke ? s.strokeWidth : 0,
  })
}

export function makeLine(fabric: FabricModule, center: Point, length: number, style: ShapeStyle = {}) {
  const half = length / 2
  return new fabric.Line([-half, 0, half, 0], {
    left: center.x,
    top: center.y,
    originX: 'center',
    originY: 'center',
    stroke: style.stroke || DEFAULT_SHAPE_STYLE.fill,
    strokeWidth: style.strokeWidth ?? 4,
  })
}

/** Adds an object to the canvas, makes it the active selection, and renders. */
export function addAndSelect(canvas: FabricCanvas, obj: Parameters<FabricCanvas['add']>[0]): void {
  canvas.add(obj)
  canvas.setActiveObject(obj)
  canvas.requestRenderAll()
}
