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

// 44px minimum touch target (POD-UI.md §5 acceptance #5).
const toolBtnCls =
  'flex min-h-11 min-w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-btn border border-line bg-surface px-2 py-2 text-[10px] font-medium text-ink transition-[background-color,border-color,transform] duration-fast active:scale-[0.95] hover:border-ink/30 disabled:opacity-40 disabled:active:scale-100'

/**
 * POD-UI.md §3 Workstream C2 — a left rail on desktop, a bottom bar on
 * mobile pinned above the price footer (the whole editor page is a
 * non-scrolling `100dvh` flex column — see CustomizerEditor.tsx — so an
 * in-flow bottom row reads identically to a CSS-`fixed` one without
 * fighting the properties Sheet's own `fixed` stacking). Same component,
 * same buttons; only the outer layout classes change per breakpoint.
 */
export default function ToolRail({ onAddText, onPickImage, onAddShape, onUndo, onRedo, canUndo, canRedo, uploading }: ToolRailProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div
      className="flex shrink-0 gap-2 overflow-x-auto border-t border-line bg-surface p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-card
                 md:h-full md:w-24 md:flex-col md:overflow-visible md:border-r md:border-t-0 md:p-3 md:pb-3 md:shadow-none"
      data-testid="tool-rail"
    >
      <button className={toolBtnCls} onClick={onAddText}>
        <span className="text-base leading-none">T</span>
        Text
      </button>

      <button className={toolBtnCls} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        {uploading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-faint border-t-ink" aria-hidden="true" />
        ) : (
          <span className="text-base leading-none">🖼</span>
        )}
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
        <button key={s.kind} className={toolBtnCls} onClick={() => onAddShape(s.kind)} title={s.label} aria-label={`Add ${s.label.toLowerCase()}`}>
          <span className="text-base leading-none">{s.glyph}</span>
          {s.label}
        </button>
      ))}

      <div className="hidden shrink-0 self-stretch border-t border-line md:block" />

      <div className="flex shrink-0 gap-2 md:mt-auto md:flex-col">
        <button className={toolBtnCls} onClick={onUndo} disabled={!canUndo} title="Undo (Cmd/Ctrl+Z)" aria-label="Undo">
          <span className="text-base leading-none">↺</span>
          Undo
        </button>
        <button className={toolBtnCls} onClick={onRedo} disabled={!canRedo} title="Redo (Cmd/Ctrl+Shift+Z)" aria-label="Redo">
          <span className="text-base leading-none">↻</span>
          Redo
        </button>
      </div>
    </div>
  )
}
