// frontend/src/editor/preview.ts
//
// POD.md §5.6 / §7.2 — the add-to-cart preview compositor. Renders one
// side's flattened preview: the mockup image plus the customer's art, at
// ~1000px wide, exported as a WebP blob for `PUT /api/designs/:id/preview`.
//
// The art layer is drawn from the side's CANONICAL snapshot (see
// designSchema.ts) using geometry.ts's `computeReferenceGeometry` — the
// same reference coordinate space the snapshot was normalized into before
// persistence, so the bleed rect this function computes for the mockup
// lines up with the snapshot's own canvasWidth/canvasHeight with zero
// further rescaling.
import type { FabricModule } from './fabric/loadFabric'
import { computeReferenceGeometry, PREVIEW_REFERENCE_WIDTH } from './geometry'
import { ensureFontsReady } from './fonts'
import { extractSnapshotFontFamilies, type StoredSideSnapshot } from './designSchema'
import type { NormalizedRect } from './geometry'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // same-origin /img/* — POD.md §5.8 — but harmless to set
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load mockup image: ${url}`))
    img.src = url
  })
}

export interface RenderSidePreviewArgs {
  fabric: FabricModule
  mockupUrl: string
  mockupNaturalW: number
  mockupNaturalH: number
  printRect: NormalizedRect
  bleedPercent: number
  safePercent: number
  /** Canonical-sized snapshot for this side (designSchema.ts), or undefined for a side with no art — the mockup alone is still rendered. */
  snapshot: StoredSideSnapshot | undefined
}

/**
 * Renders one side's flattened preview to a WebP Blob (~100-200KB per
 * POD.md §5.6). Font-gates before any drawing (§5.5) so the exported
 * pixels can never silently diverge from what the shopper approved.
 */
export async function renderSidePreview({
  fabric,
  mockupUrl,
  mockupNaturalW,
  mockupNaturalH,
  printRect,
  bleedPercent,
  safePercent,
  snapshot,
}: RenderSidePreviewArgs): Promise<Blob> {
  await ensureFontsReady(extractSnapshotFontFamilies(snapshot))

  const geo = computeReferenceGeometry(mockupNaturalW, mockupNaturalH, printRect, bleedPercent, safePercent)
  const outW = PREVIEW_REFERENCE_WIDTH
  const outH = Math.max(1, Math.round(mockupNaturalW > 0 ? outW * (mockupNaturalH / mockupNaturalW) : outW))

  const mockupImg = await loadImage(mockupUrl)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = outW
  outCanvas.height = outH
  const ctx = outCanvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  // The reference stage's aspect ratio is derived from the mockup's own
  // aspect ratio (computeReferenceGeometry), so the mockup always fills
  // the whole outW x outH canvas exactly — no letterboxing to account for.
  ctx.drawImage(mockupImg, 0, 0, outW, outH)

  if (snapshot && Array.isArray(snapshot.objects) && snapshot.objects.length > 0) {
    const artW = Math.max(1, Math.round(geo.bleedRectPx.w))
    const artH = Math.max(1, Math.round(geo.bleedRectPx.h))
    const artEl = document.createElement('canvas')
    const staticCanvas = new fabric.StaticCanvas(artEl, { width: artW, height: artH })
    try {
      await staticCanvas.loadFromJSON(snapshot)
      staticCanvas.renderAll()
      ctx.drawImage(artEl, geo.bleedRectPx.x, geo.bleedRectPx.y, artW, artH)
    } finally {
      await staticCanvas.dispose()
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/webp',
      0.85
    )
  })
}
