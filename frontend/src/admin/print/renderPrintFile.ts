// frontend/src/admin/print/renderPrintFile.ts
//
// POD.md §5.7 / §8.2 — renders ONE side's print file in the merchant's own
// browser. This is deliberately the customer's own renderer with a
// different multiplier, not a second rendering path (POD.md's explicit
// warning: "if preview and print ever disagree, the merchant ships the
// wrong garment"):
//   - `loadFabric` is the exact same cached dynamic import the customizer
//     uses (frontend/src/editor/fabric/loadFabric.ts) — Fabric stays out
//     of the main bundle here too.
//   - `ensureFontsReady` is the exact same font-gate as the add-to-cart
//     preview compositor (frontend/src/editor/fonts.ts).
//   - The snapshot is loaded into a `fabric.StaticCanvas` exactly like
//     `editor/preview.ts`'s art layer — `loadFromJSON` on the same
//     canonical-size JSON, so there is no second deserialization path to
//     drift out of sync with the editor.
// The only genuinely new thing here is `multiplier` (printMath.ts) and
// exporting on a TRANSPARENT background instead of compositing onto the
// mockup — print files ship without the mockup baked in.
import { loadFabric, type FabricModule } from '../../editor/fabric/loadFabric'
import { ensureFontsReady } from '../../editor/fonts'
import { extractSnapshotFontFamilies, type StoredSideSnapshot } from '../../editor/designSchema'
import { computePrintDims, type PrintDimsInfo } from './printMath'

export interface RenderPrintFileArgs {
  snapshot: StoredSideSnapshot
  printWidthIn: number
  printDpi: number
}

export interface PrintFileResult extends PrintDimsInfo {
  blob: Blob
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = /data:([^;]+);base64/.exec(header)
  const mime = mimeMatch?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * Renders one side's print file at `print_dpi` (clamped to a browser-safe
 * canvas size — POD.md §8.2). The exported canvas IS `snapshot`'s own
 * canonical bleed-rect canvas (POD.md §5.2), scaled up by `multiplier` —
 * no cropping, no re-composition, so the artwork registers with the
 * customer's approved preview by construction, not by coincidence.
 */
export async function renderPrintFile(fabric: FabricModule, { snapshot, printWidthIn, printDpi }: RenderPrintFileArgs): Promise<PrintFileResult> {
  // POD.md §5.5 — a missing font here silently changes the artwork the
  // customer approved. Gate before touching the canvas at all.
  await ensureFontsReady(extractSnapshotFontFamilies(snapshot))

  const dims = computePrintDims(snapshot.canvasWidth, snapshot.canvasHeight, printWidthIn, printDpi)

  const el = document.createElement('canvas')
  const staticCanvas = new fabric.StaticCanvas(el, {
    width: snapshot.canvasWidth,
    height: snapshot.canvasHeight,
  })
  try {
    await staticCanvas.loadFromJSON(snapshot)
    staticCanvas.renderAll()
    // Transparent background — never fill white (POD.md §8.2). StaticCanvas
    // has no background by default, which is exactly what's wanted here.
    const dataUrl = staticCanvas.toDataURL({ format: 'png', multiplier: dims.multiplier })
    const blob = dataUrlToBlob(dataUrl)
    return { ...dims, blob }
  } finally {
    await staticCanvas.dispose()
  }
}

export { loadFabric }
export type { FabricModule }
