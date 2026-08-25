// frontend/src/editor/fabric/objectTypes.ts
//
// Single source of truth for classifying a Fabric object (or a plain JSON
// snapshot of one — POD.md §5.4's design_json is Fabric's own toObject()
// shape) by its `.type`.
//
// Verified against the installed fabric@6.9.1 source
// (node_modules/fabric/dist/index.node.mjs):
//
//   get type() {                          // FabricObject.prototype
//     const name = this.constructor.type  // e.g. 'Rect', 'FabricImage', 'IText'
//     if (name === 'FabricObject') return 'object'
//     return name.toLowerCase()           // 'rect', 'image', ...
//   }
//
//   get type() {                          // IText.prototype override
//     const type = super.type             // 'itext' (IText.type.toLowerCase())
//     return type === 'itext' ? 'i-text' : type   // backward-compat hyphenation
//   }
//
// So at runtime `.type` is ALWAYS lowercase, and text objects specifically
// come back hyphenated as 'i-text' (Textbox, which extends IText and adds
// no override of its own, comes back as plain 'textbox'). The PascalCase
// class names ('Image', 'IText', 'Rect', ...) are the *constructor's*
// static `.type` — they never appear on an instance. Comparing an
// instance's `.type` against a PascalCase literal silently never matches,
// which is exactly the bug this module exists to make impossible to
// repeat (POD.md §5.1's low-DPI warning went dead this way).
//
// Every `.type` comparison anywhere in the editor MUST go through one of
// the predicates below instead of a raw string comparison, so a future
// Fabric upgrade (or another case/alias quirk like IText's) only ever
// needs fixing in this one file.

/** Anything with a `.type` string — a live FabricObject, or a plain object from a design_json snapshot. Deliberately structural (not `FabricObject`) so it works on both without a cast. */
export interface Typed {
  type?: string | null
}

export const FABRIC_TYPE = {
  IMAGE: 'image',
  TEXT: 'i-text',
  RECT: 'rect',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  POLYGON: 'polygon',
  LINE: 'line',
} as const

// 'itext' and 'textbox' are defensive aliases (see file header) — the live
// getter only ever actually emits 'i-text', but design_json is persisted
// JSON that could in principle have been written by a different Fabric
// version or hand-authored fixture.
const TEXT_TYPES = new Set<string>(['i-text', 'itext', 'text', 'textbox'])

const SHAPE_TYPES = new Set<string>([
  FABRIC_TYPE.RECT,
  FABRIC_TYPE.CIRCLE,
  FABRIC_TYPE.TRIANGLE,
  FABRIC_TYPE.POLYGON,
  FABRIC_TYPE.LINE,
  // Not created anywhere in objects.ts today, but real Fabric shape types —
  // included so this stays a complete "is this a shape, not text/image"
  // classifier rather than an enumeration of only what the toolbar exposes.
  'ellipse',
  'path',
])

/** Lowercases a Fabric `.type` value for comparison. `null`/`undefined`/non-string becomes `''`, which matches nothing. */
export function normalizeFabricType(type: string | null | undefined): string {
  return typeof type === 'string' ? type.toLowerCase() : ''
}

export function isImageObject(obj: Typed | null | undefined): boolean {
  return normalizeFabricType(obj?.type) === FABRIC_TYPE.IMAGE
}

export function isTextObject(obj: Typed | null | undefined): boolean {
  return TEXT_TYPES.has(normalizeFabricType(obj?.type))
}

export function isShapeObject(obj: Typed | null | undefined): boolean {
  return SHAPE_TYPES.has(normalizeFabricType(obj?.type))
}

export function isLineObject(obj: Typed | null | undefined): boolean {
  return normalizeFabricType(obj?.type) === FABRIC_TYPE.LINE
}

export function isRectObject(obj: Typed | null | undefined): boolean {
  return normalizeFabricType(obj?.type) === FABRIC_TYPE.RECT
}
