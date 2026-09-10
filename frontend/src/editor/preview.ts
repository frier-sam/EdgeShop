// frontend/src/editor/preview.ts
//
// POD.md §5.6 / §7.2 + POD-UI3.md §3.2 / §4.3 — the shopper-facing preview
// compositor. Renders one side's flattened composite at ~1000px wide and
// exports it as a WebP blob.
//
// SINGLE SOURCE OF TRUTH FOR "WHAT THE DESIGN LOOKS LIKE ON THE PRODUCT".
// As of POD-UI3.md this function has two consumers, not one:
//   - `PUT /api/designs/:id/preview` at add-to-cart — the blob that becomes
//     the cart thumbnail, the order line's image and the confirmation email's
//     image.
//   - the customizer's PREVIEW MODE (CustomizerEditor.tsx -> PreviewStage.tsx),
//     which renders this same blob to an object URL and shows it as an opaque
//     overlay over the design stage.
// That is deliberate and load-bearing: what the shopper approves on screen and
// what they later see in their cart and inbox are the same bytes by
// construction rather than by two rendering paths agreeing. POD-UI3.md §3.3
// records why preview mode could not stay a live Fabric canvas with a CSS
// `mix-blend-mode` overlay — CSS blend modes cannot be masked by a canvas's
// alpha channel, so that approach necessarily darkens the bare garment inside
// the print area. Step 3 below is the reason this has to be a rendered image.
//
// THE COMPOSITE, IN THREE STEPS (POD-UI3.md §3.2):
//   1. The mockup, filling the whole outW x outH canvas.
//   2. The art layer, drawn at the reference bleed rect.
//   3. Garment shading — the mockup's own pixels over the bleed rect,
//      per-channel tone-normalized (shading.ts), MASKED TO THE ART'S ALPHA,
//      and drawn back with `multiply` at SHADING_STRENGTH. This is what makes
//      the garment's folds and shadows fall across the artwork so it reads as
//      printed rather than pasted. The mask is the whole trick: where the art
//      is transparent the shade layer is transparent too, so the bare garment
//      inside the print area is left exactly as the mockup had it and no dark
//      rectangle appears. Step 3 is entirely best-effort — see
//      `applyGarmentShading`.
//
// The art layer is drawn from the side's CANONICAL snapshot (see
// designSchema.ts) using geometry.ts's `computeReferenceGeometry` — the
// same reference coordinate space the snapshot was normalized into before
// persistence, so the bleed rect this function computes for the mockup
// lines up with the snapshot's own canvasWidth/canvasHeight with zero
// further rescaling. `admin/print/renderPrintFile.ts` deserializes the art
// with the same `StaticCanvas` + `loadFromJSON` on the same canonical JSON
// (its header comment says so explicitly); steps 1 and 3 here are precisely
// the "compositing onto the mockup" part it deliberately does not do, so its
// claim to share the art-layer path stays true.
import type { FabricModule } from './fabric/loadFabric'
import { computeReferenceGeometry, PREVIEW_REFERENCE_WIDTH } from './geometry'
import { ensureFontsReady } from './fonts'
import { extractSnapshotFontFamilies, type StoredSideSnapshot } from './designSchema'
import { meanChannels, shadingGain, applyShadingGain, SHADING_STRENGTH } from './shading'
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

interface GarmentShadingArgs {
  /** The output context, already carrying steps 1 and 2. */
  ctx: CanvasRenderingContext2D
  mockupImg: HTMLImageElement
  /** The Fabric-rendered art canvas. Its ALPHA is the mask. */
  artEl: HTMLCanvasElement
  /** Bleed rect in output-canvas pixels — identical values to the art draw. */
  bleedX: number
  bleedY: number
  artW: number
  artH: number
  outW: number
  outH: number
}

/**
 * Step 3 of the composite — POD-UI3.md §4.3. Best-effort by contract: ANY
 * failure here is swallowed and the flat two-step composite stands. A preview
 * must never fail to render, and the realistic failure is `getImageData`
 * throwing a SecurityError on a canvas tainted by a cross-origin mockup (or
 * refusing a very large surface on a memory-constrained device) — neither is
 * worth losing the whole preview over, and the flat composite is a perfectly
 * usable image, just a flatter-looking one.
 *
 * Two structural details keep that fallback honest, i.e. keep a mid-way throw
 * from leaving a half-shaded or corrupted output:
 *   - Every `getImageData`/`putImageData` happens on the SEPARATE shade
 *     canvas, so the throw-prone work cannot touch `ctx` at all.
 *   - `ctx` is only mutated between a `save()` and a `restore()` in a
 *     `finally`, so `globalCompositeOperation`/`globalAlpha` can never leak
 *     out to the `toBlob` that follows.
 */
function applyGarmentShading({
  ctx,
  mockupImg,
  artEl,
  bleedX,
  bleedY,
  artW,
  artH,
  outW,
  outH,
}: GarmentShadingArgs): void {
  ctx.save()
  try {
    const shadeEl = document.createElement('canvas')
    shadeEl.width = artW
    shadeEl.height = artH
    const shadeCtx = shadeEl.getContext('2d')
    if (!shadeCtx) throw new Error('shade canvas context unavailable')

    // Draw the WHOLE mockup at the OUTPUT canvas's scale, translated so the
    // bleed rect's top-left lands on the shade canvas's origin. Deliberately
    // not a source-rect (9-argument) drawImage: passing the same `outW, outH`
    // the output canvas used means the shade layer is at exactly the output
    // scale by construction, with no source-rect arithmetic to get wrong and
    // no way for a rounding difference to slide the garment's folds a pixel
    // off where the flat mockup underneath has them.
    shadeCtx.drawImage(mockupImg, -bleedX, -bleedY, outW, outH)

    // Per-channel tone-normalize so only the garment's RELATIVE variation —
    // folds, seams, shadows — survives into the multiply, and its base colour
    // and tint do not. shading.ts's header has the full rationale; the short
    // version is that a raw multiply is only correct on a white garment and
    // makes the artwork vanish on a black one.
    const shade = shadeCtx.getImageData(0, 0, artW, artH)
    applyShadingGain(shade.data, shadingGain(meanChannels(shade.data)))
    shadeCtx.putImageData(shade, 0, 0)

    // Mask by the art's own alpha. This is the line that stops the bare
    // garment inside the print area from being darkened into the dark
    // rectangle POD-UI3.md §1.1/§3.3 exists to remove: `destination-in` keeps
    // the shade layer only where the art canvas is opaque, and the editor
    // canvas exports with no background fill (fabric/canvas.ts) so everywhere
    // the shopper did not draw is alpha 0. Get this wrong and the bug is
    // straight back.
    //
    // The explicit destination size is required, not stylistic: Fabric's
    // StaticCanvas applies retina scaling to the element it owns, so on a 2x
    // display `artEl.width` is `2 * artW`. A two-argument drawImage would
    // therefore mask against the art's top-left quadrant. Scaling to
    // `artW x artH` here is the same mapping the visible art draw uses, so the
    // mask registers with the drawn art exactly.
    shadeCtx.globalCompositeOperation = 'destination-in'
    shadeCtx.drawImage(artEl, 0, 0, artW, artH)

    // `multiply` composited at SHADING_STRENGTH. `globalAlpha` is what caps
    // the effect's strength, and the source alpha is what bounds its extent:
    // where the art's alpha is 0 the source alpha is 0 and the backdrop is
    // returned untouched.
    ctx.globalCompositeOperation = 'multiply'
    ctx.globalAlpha = SHADING_STRENGTH
    ctx.drawImage(shadeEl, bleedX, bleedY, artW, artH)
  } catch {
    // Intentionally silent — the flat composite from steps 1 and 2 is already
    // on `ctx` and is a correct, shippable preview.
  } finally {
    ctx.restore()
  }
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

  // Step 1. The reference stage's aspect ratio is derived from the mockup's
  // own aspect ratio (computeReferenceGeometry), so the mockup always fills
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
      // Step 2.
      ctx.drawImage(artEl, geo.bleedRectPx.x, geo.bleedRectPx.y, artW, artH)
      // Step 3. Only reachable when this side actually HAS art: with no art
      // there is nothing for the shading to be masked to, so the mask would
      // be empty and the whole pass a no-op — skipping it outright also skips
      // a needless full-bleed-rect getImageData on every artless side.
      applyGarmentShading({
        ctx,
        mockupImg,
        artEl,
        bleedX: geo.bleedRectPx.x,
        bleedY: geo.bleedRectPx.y,
        artW,
        artH,
        outW,
        outH,
      })
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
