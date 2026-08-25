// frontend/src/editor/designApi.ts
//
// Thin fetch wrappers for POD.md §7.1's design endpoints, plus the
// canonicalization step (POD.md §7.2's add-to-cart sequence, step 2-4).
import { rescaleFabricSnapshot } from './fabric/rescaleSnapshot'
import { computeReferenceGeometry } from './geometry'
import type { NormalizedRect } from './geometry'
import type { DesignJson, StoredSideSnapshot } from './designSchema'
import type { EditorSideName } from './types'

export class DesignApiError extends Error {}

/** Rescales a side's live (or cached) Fabric JSON snapshot to the canonical reference size — POD.md §5.6/§7.2, see designSchema.ts. */
export function canonicalizeSideSnapshot(
  liveJson: string,
  liveWidth: number,
  liveHeight: number,
  mockupNaturalW: number,
  mockupNaturalH: number,
  printRect: NormalizedRect,
  bleedPercent: number,
  safePercent: number
): StoredSideSnapshot {
  const parsed = JSON.parse(liveJson)
  const geo = computeReferenceGeometry(mockupNaturalW, mockupNaturalH, printRect, bleedPercent, safePercent)
  const targetW = Math.max(1, Math.round(geo.bleedRectPx.w))
  const targetH = Math.max(1, Math.round(geo.bleedRectPx.h))
  const rescaled = rescaleFabricSnapshot(parsed, liveWidth, liveHeight, targetW, targetH)
  return { ...rescaled, canvasWidth: targetW, canvasHeight: targetH }
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function createDesign(
  productId: number,
  design: DesignJson,
  sidesUsed: EditorSideName[],
  token: string | null
): Promise<string> {
  const res = await fetch('/api/designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({
      product_id: productId,
      design_json: JSON.stringify(design),
      sides_used: sidesUsed,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string })
    throw new DesignApiError(data.error ?? `Failed to save design (${res.status})`)
  }
  const data = (await res.json()) as { design_id: string }
  return data.design_id
}

export async function uploadDesignPreview(designId: string, side: EditorSideName, blob: Blob, token: string | null): Promise<string> {
  const res = await fetch(`/api/designs/${designId}/preview?side=${side}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/webp', ...authHeaders(token) },
    body: blob,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string })
    throw new DesignApiError(data.error ?? `Failed to upload ${side} preview (${res.status})`)
  }
  const data = (await res.json()) as { url: string }
  return data.url
}

export interface FetchedDesign {
  id: string
  product_id: number
  design_json: DesignJson
  preview_json: Record<string, string>
  sides_used: EditorSideName[]
}

export async function fetchDesign(id: string): Promise<FetchedDesign> {
  const res = await fetch(`/api/designs/${id}`)
  if (!res.ok) throw new DesignApiError(`Design not found (${res.status})`)
  return (await res.json()) as FetchedDesign
}
