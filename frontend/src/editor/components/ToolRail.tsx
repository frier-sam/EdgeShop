import { useRef } from 'react'
import type { ShapeKind } from '../types'

export interface ToolRailProps {
  onAddText: () => void
  onPickImage: (file: File) => void
  onAddShape: (kind: ShapeKind) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  uploading: boolean
}

const SHAPES: { kind: ShapeKind; label: string; glyph: string }[] = [
  { kind: 'rect', label: 'Rectangle', glyph: '▭' },
  { kind: 'circle', label: 'Circle', glyph: '◯' },
  { kind: 'triangle', label: 'Triangle', glyph: '△' },
  { kind: 'star', label: 'Star', glyph: '★' },
  { kind: 'line', label: 'Line', glyph: '—' },
]

// 44px minimum touch target (POD.md §6.9).
const toolBtnCls =
  'flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-2 py-2 text-[10px] font-medium text-ink transition-colors hover:border-ink active:bg-ink/5 disabled:opacity-40'

/**
 * POD.md §6.9 — a left rail on desktop, a bottom sheet on mobile. Same
 * component, same buttons; only the outer layout classes change per
 * breakpoint (a fixed horizontal bar pinned to the bottom of the viewport
 * on small screens instead of a vertical column in the flow).
 */
export default function ToolRail({ onAddText, onPickImage, onAddShape, onUndo, onRedo, canUndo, canRedo, uploading }: ToolRailProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      className="flex shrink-0 gap-2 overflow-x-auto border-t border-line bg-paper p-2
                 md:h-full md:w-24 md:flex-col md:overflow-visible md:border-r md:border-t-0 md:p-3"
      data-testid="tool-rail"
    >
      <button className={toolBtnCls} onClick={onAddText}>
        <span className="text-base leading-none">T</span>
        Text
      </button>

      <button className={toolBtnCls} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        <span className="text-base leading-none">🖼</span>
        {uploading ? 'Uploading…' : 'Image'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPickImage(file)
          e.target.value = ''
        }}
      />

      <div className="hidden shrink-0 self-stretch border-t border-line md:block" />

      {SHAPES.map((s) => (
        <button key={s.kind} className={toolBtnCls} onClick={() => onAddShape(s.kind)} title={s.label}>
          <span className="text-base leading-none">{s.glyph}</span>
          {s.label}
        </button>
      ))}

      <div className="hidden shrink-0 self-stretch border-t border-line md:block" />

      <div className="flex shrink-0 gap-2 md:flex-col">
        <button className={toolBtnCls} onClick={onUndo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)">
          <span className="text-base leading-none">↺</span>
          Undo
        </button>
        <button className={toolBtnCls} onClick={onRedo} disabled={!canRedo} title="Redo (Cmd/Ctrl+Shift+Z)">
          <span className="text-base leading-none">↻</span>
          Redo
        </button>
      </div>
    </div>
  )
}
