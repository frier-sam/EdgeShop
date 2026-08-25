// frontend/src/admin/print/orderPrintFiles.ts
//
// POD.md §4.2 / §8.3 — bridges the admin order-detail API response
// (AdminOrderLineItem[]) to renderPrintFile.ts's per-side renderer, shared
// by the per-side "Download print file" button and the whole-order
// "Download all print files" zip so there is exactly one place that
// decides which (line, side) pairs are renderable.
import { loadFabric } from '../../editor/fabric/loadFabric'
import type { EditorSideName } from '../../editor/types'
import type { StoredSideSnapshot } from '../../editor/designSchema'
import type { AdminOrderLineItem } from '../types'
import { renderPrintFile, type PrintFileResult } from './renderPrintFile'
import { printFileName } from './downloadPrintFiles'

export interface RenderableSide {
  lineIndex: number
  side: EditorSideName
  snapshot: StoredSideSnapshot
  printWidthIn: number
}

/**
 * Every (line item, side) pair that actually has both a canonical design
 * snapshot AND a matching product-side geometry row — i.e. everything
 * `renderPrintFile` can produce a file for. A design's `sides_used` and
 * the order's line items are both trusted server data by this point
 * (POD.md §7.3 already validated them at checkout), but a snapshot can
 * still be legitimately absent (e.g. `design.design_json` failed to
 * parse) — this filters those out rather than crashing "Download all".
 */
export function collectRenderableSides(items: AdminOrderLineItem[]): RenderableSide[] {
  const out: RenderableSide[] = []
  items.forEach((item, lineIndex) => {
    if (!item.design) return
    for (const sideGeo of item.sides) {
      const side = sideGeo.side as EditorSideName
      const snapshot = item.design.design_json[side]
      if (!snapshot) continue
      out.push({ lineIndex, side, snapshot, printWidthIn: sideGeo.print_width_in })
    }
  })
  return out
}

export interface RenderedOrderFile extends PrintFileResult {
  filename: string
}

/** Lazy-loads Fabric (cached after the first call — see loadFabric.ts) and renders one side's print file. */
export async function renderOrderSide(orderId: string, r: RenderableSide, printDpi: number): Promise<RenderedOrderFile> {
  const fabric = await loadFabric()
  const result = await renderPrintFile(fabric, { snapshot: r.snapshot, printWidthIn: r.printWidthIn, printDpi })
  return { ...result, filename: printFileName(orderId, r.lineIndex, r.side) }
}
