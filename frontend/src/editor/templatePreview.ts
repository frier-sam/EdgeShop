// frontend/src/editor/templatePreview.ts
//
// POD-V2.md §6.4 / §11 Phase 4 task 4.4 — renders a design template's
// browse-card thumbnail: the ART LAYER ALONE, no mockup. A template is
// product-independent (one "Corporate" collection design might meet a
// business card, a t-shirt or a bottle wrap — §6.2), so its preview must
// never bake in someone else's product photo.
//
// This makes it closer to admin/print/renderPrintFile.ts's transparent
// export than to preview.ts's mockup composite, and deliberately reuses
// that exact pattern rather than inventing a third one: `StaticCanvas` +
// `loadFromJSON` on the snapshot's own canonical size, `ensureFontsReady`
// BEFORE any drawing (POD.md §5.5 — skip the gate and a template's listed
// thumbnail can silently differ from what applying it actually produces),
// then export at a fixed size. The one genuinely new step is the downscale
// to a small browse-card thumbnail (preview.ts's compositor also does a
// scaled export, but at a much larger, mockup-driven size).
import type { FabricModule } from './fabric/loadFabric'
import type { FabricSnapshot } from './fabric/rescaleSnapshot'
import { ensureFontsReady } from './fonts'
import { extractSnapshotFontFamilies } from './designSchema'

/** Long edge, in px, of a rendered template thumbnail (§11 Phase 4 task 4.4 — "~400px WebP"). */
export const TEMPLATE_PREVIEW_LONG_EDGE = 400

/**
 * Renders `snapshot` (a template's own art layer, at `canvasW x canvasH` —
 * see templatesApi.ts's `TemplateSummary`) to a small transparent-background
 * WebP thumbnail. `canvasW`/`canvasH` are passed separately rather than
 * embedded in `snapshot` because a template's own coordinate space is
 * whatever it was authored at (CustomizerEditor's template-mode "Save as
 * template" hands over the live bleed size directly — see
 * `TemplateModeConfig`'s doc comment) and this function has no reason to
 * assume a particular shape carrying those two numbers.
 */
export async function renderTemplatePreview(fabric: FabricModule, snapshot: FabricSnapshot, canvasW: number, canvasH: number): Promise<Blob> {
  const safeW = Math.max(1, Math.round(canvasW))
  const safeH = Math.max(1, Math.round(canvasH))

  // POD.md §5.5 — gate on the fonts the snapshot actually uses before any
  // drawing happens, exactly like preview.ts and renderPrintFile.ts do.
  await ensureFontsReady(extractSnapshotFontFamilies({ ...snapshot, canvasWidth: safeW, canvasHeight: safeH }))

  const artEl = document.createElement('canvas')
  const staticCanvas = new fabric.StaticCanvas(artEl, { width: safeW, height: safeH })
  try {
    await staticCanvas.loadFromJSON(snapshot)
    staticCanvas.renderAll()

    // Scale so the LONG edge lands at TEMPLATE_PREVIEW_LONG_EDGE. Uniform on
    // both axes (unlike fitSnapshotToCanvas, there is no fixed target shape
    // to letterbox into here — the output canvas's own aspect ratio just
    // follows the snapshot's), so a landscape or portrait template both come
    // out proportional with no wasted transparent margin.
    const scale = TEMPLATE_PREVIEW_LONG_EDGE / Math.max(safeW, safeH)
    const outW = Math.max(1, Math.round(safeW * scale))
    const outH = Math.max(1, Math.round(safeH * scale))

    const outCanvas = document.createElement('canvas')
    outCanvas.width = outW
    outCanvas.height = outH
    const ctx = outCanvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    // Explicit destination size (never the 2-arg drawImage form): Fabric's
    // StaticCanvas applies retina scaling to the element it owns (same note
    // as preview.ts's own art-layer draw), so `artEl`'s actual pixel size
    // can be a multiple of `safeW x safeH`. The 4-arg form always stretches
    // the WHOLE source image to `outW x outH` regardless of its real pixel
    // dimensions, so the downscale is correct either way.
    ctx.drawImage(artEl, 0, 0, outW, outH)

    return await new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/webp', 0.85)
    })
  } finally {
    await staticCanvas.dispose()
  }
}
