// frontend/src/editor/designSchema.ts
//
// The wire shape of `design_json` (POD.md §5.4, §6.1). Each side is stored
// at the CANONICAL reference size (geometry.ts's computeReferenceGeometry)
// rather than whatever pixel size the shopper's own viewport happened to
// be at save time — `canvasWidth`/`canvasHeight` record that reference
// size so a later re-edit (or the preview/print render) can rescale
// correctly regardless of device. This is a deliberate, documented
// extension of POD.md §5.4's illustrative sketch (which shows only
// `{ objects, background }` per side) — see the Phase 7 decisions log in
// POD.md.
import type { EditorSideName } from './types'
import type { FabricSnapshot } from './fabric/rescaleSnapshot'
import { computeEffectiveDpi, dpiSeverity, type DpiSeverity } from './geometry'

export interface StoredSideSnapshot extends FabricSnapshot {
  canvasWidth: number
  canvasHeight: number
}

export interface DesignJson {
  version: 1
  front?: StoredSideSnapshot
  back?: StoredSideSnapshot
}

export function emptyDesignJson(): DesignJson {
  return { version: 1 }
}

export function sideHasArt(design: DesignJson, side: EditorSideName): boolean {
  const s = design[side]
  return !!s && Array.isArray(s.objects) && s.objects.length > 0
}

export function sidesUsedFrom(design: DesignJson, candidateSides: EditorSideName[]): EditorSideName[] {
  return candidateSides.filter((side) => sideHasArt(design, side))
}

/**
 * Every font family actually used by a side's canonical snapshot — shared
 * by the add-to-cart preview compositor (preview.ts) and the admin's
 * PrintFileRenderer (frontend/src/admin/print/), both of which must gate
 * on `document.fonts` before drawing (POD.md §5.5) or risk silently
 * shipping different artwork than what the snapshot actually contains.
 */
export function extractSnapshotFontFamilies(snapshot: StoredSideSnapshot | undefined): string[] {
  if (!snapshot?.objects) return []
  const families = new Set<string>()
  for (const obj of snapshot.objects) {
    const family = (obj as { fontFamily?: unknown }).fontFamily
    if (typeof family === 'string') families.add(family)
  }
  return Array.from(families)
}

export interface CanonicalDpiIssue {
  side: EditorSideName
  dpi: number
  severity: DpiSeverity
}

/**
 * POD.md §5.1's low-DPI check, applied at add-to-cart across BOTH sides'
 * canonical snapshots — not just whichever side is on screen. Phase 6 only
 * had a live-canvas scan of the active side (design_json didn't exist yet
 * to check the inactive one against); this is the "authoritative check…
 * once design_json exists for both sides" the Phase 6 decisions log
 * flagged as Phase 7's job. Operates on the same canonical snapshot that
 * gets persisted, so `canvasCssWidth` is simply the snapshot's own
 * canvasWidth — no live canvas or stage geometry needed here.
 */
export function scanCanonicalDpiIssues(
  design: DesignJson,
  sides: { side: EditorSideName; print_width_in: number }[]
): CanonicalDpiIssue[] {
  const out: CanonicalDpiIssue[] = []
  for (const { side, print_width_in } of sides) {
    const snapshot = design[side]
    if (!snapshot?.objects) continue
    for (const obj of snapshot.objects) {
      const o = obj as { type?: string; isVectorAsset?: boolean; assetNaturalWidth?: number; width?: number; scaleX?: number }
      if (o.type !== 'Image' || o.isVectorAsset || !o.assetNaturalWidth) continue
      const objectWidthPx = (o.width ?? 0) * (o.scaleX ?? 1)
      const dpi = computeEffectiveDpi({
        assetNaturalWidth: o.assetNaturalWidth,
        objectWidthPx,
        canvasCssWidth: snapshot.canvasWidth,
        printWidthIn: print_width_in,
      })
      out.push({ side, dpi, severity: dpiSeverity(dpi) })
    }
  }
  return out
}
