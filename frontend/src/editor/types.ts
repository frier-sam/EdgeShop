// frontend/src/editor/types.ts — shared editor types.
import type { ProductSide } from '../lib/types'

export type EditorSideName = 'front' | 'back'

export type ShapeKind = 'rect' | 'circle' | 'triangle' | 'star' | 'line'

export type EditorMode = 'edit' | 'preview'

/** Per-side editor state the top-level CustomizerEditor keeps in React state. */
export interface SideRuntimeState {
  /** Fabric canvas.toJSON() snapshot for this side, or null if never touched. */
  json: string | null
  /** How many objects the last-known snapshot of this side's canvas has — drives pricing (POD.md §6.7) and the tab badge. */
  objectCount: number
}

export type SidesRuntimeState = Partial<Record<EditorSideName, SideRuntimeState>>

/** A product_side row, narrowed to the ones actually usable in the editor (customizable === 1). */
export type CustomizableSide = ProductSide & { side: EditorSideName }
