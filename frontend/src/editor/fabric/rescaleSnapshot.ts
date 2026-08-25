// frontend/src/editor/fabric/rescaleSnapshot.ts
//
// A pure, Fabric-free JSON transform: given a canvas.toObject() snapshot
// (as produced by fabric/canvas.ts's snapshotCanvas) captured at one pixel
// size, produce the equivalent snapshot at a DIFFERENT pixel size. Every
// object in Fabric's serialized form is positioned with left/top (its
// origin point, which every factory in fabric/objects.ts sets to
// originX:'center', originY:'center') plus scaleX/scaleY — so a uniform
// resize is just "multiply all four by the same factor", exactly what
// fabric/canvas.ts's `resizeCanvasScaled` does to a LIVE canvas. This is
// the same math applied to plain JSON instead, which is what
// CustomizerEditor needs to normalize a side's design to the canonical
// reference size (see geometry.ts's computeReferenceGeometry) before
// POSTing it to the server, and to rehydrate a persisted design back down
// to whatever size the current device's stage happens to be.
//
// Deliberately has zero dependency on the `fabric` package or the DOM, so
// it can run before Fabric has loaded and is trivially unit-testable.

export interface FabricSnapshot {
  version?: string
  objects?: Array<Record<string, unknown>>
  background?: unknown
  [key: string]: unknown
}

export function rescaleFabricSnapshot(
  snapshot: FabricSnapshot,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number
): FabricSnapshot {
  const scaleX = fromWidth > 0 ? toWidth / fromWidth : 1
  const scaleY = fromHeight > 0 ? toHeight / fromHeight : 1
  if (!Array.isArray(snapshot.objects)) return snapshot

  return {
    ...snapshot,
    objects: snapshot.objects.map((obj) => {
      const left = typeof obj.left === 'number' ? obj.left : 0
      const top = typeof obj.top === 'number' ? obj.top : 0
      const objScaleX = typeof obj.scaleX === 'number' ? obj.scaleX : 1
      const objScaleY = typeof obj.scaleY === 'number' ? obj.scaleY : 1
      return {
        ...obj,
        left: left * scaleX,
        top: top * scaleY,
        scaleX: objScaleX * scaleX,
        scaleY: objScaleY * scaleY,
      }
    }),
  }
}

/** True if a snapshot (parsed or not-yet-parsed) actually has >=1 object — the same test the server applies at checkout time (POD.md §7.3). */
export function snapshotHasArt(snapshot: FabricSnapshot | null | undefined): boolean {
  return !!snapshot && Array.isArray(snapshot.objects) && snapshot.objects.length > 0
}
