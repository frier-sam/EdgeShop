import { useEffect, useState } from 'react'
import type { FabricObject } from '../fabric/loadFabric'
import { isLineObject, isShapeObject, isTextObject } from '../fabric/objectTypes'

export interface SelectionActionBarProps {
  selected: FabricObject
  onDelete: () => void
  onDuplicate: () => void
  onBringForward: () => void
  onSendBackward: () => void
  /** Call after mutating `selected` directly (the colour swatch below) so the change re-renders and lands on the undo stack — same contract as PropertiesPanel's onCommit. */
  onCommit: () => void
  /** Opens the full properties Sheet — the "More" escape hatch to every other control (font, size, opacity, stroke, flip, …). */
  onOpenSheet: () => void
}

// 44px minimum touch target (POD-UI.md §5 acceptance #5), matching ToolRail/ColorSwatchRow.
const barBtnCls =
  'flex h-11 min-w-11 shrink-0 items-center justify-center rounded-btn border border-line bg-surface px-2.5 text-base leading-none text-ink transition-[background-color,border-color,transform] duration-fast active:scale-[0.95] hover:border-ink/30'

/**
 * Bug 2 fix — the compact action bar that replaces auto-opening the full
 * properties Sheet on mobile selection (CustomizerEditor.tsx). Renders as
 * a single slim row that does NOT cover the canvas (it's a normal
 * document-flow row above the tool rail, never an overlay), carrying the
 * minimum the bug report calls for: delete, duplicate, layer forward/
 * back, a colour swatch, and an "Edit" control that opens the full Sheet
 * on demand for everything else (font, size, opacity, stroke, flip…).
 *
 * Every control here already exists elsewhere (PropertiesPanel's Arrange
 * tab, ColorSwatchRow) — this relocates the ones needed to keep a
 * selected object always manipulable without hiding it, it doesn't
 * replace them.
 */
export default function SelectionActionBar({
  selected,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onCommit,
  onOpenSheet,
}: SelectionActionBarProps) {
  const isText = isTextObject(selected)
  const isShape = isShapeObject(selected)
  const isLine = isLineObject(selected)
  const isColorable = isText || isShape // text/shape fill, or line stroke — never image; matches PropertiesPanel

  const [color, setColor] = useState('#101014')
  useEffect(() => {
    const obj = selected as unknown as { fill?: string | null; stroke?: string | null }
    const next = isLine ? obj.stroke : obj.fill
    if (typeof next === 'string') setColor(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const applyColor = (hex: string) => {
    const obj = selected as unknown as { set: (p: Record<string, unknown>) => void }
    obj.set(isLine ? { stroke: hex } : { fill: hex })
    setColor(hex)
    onCommit()
  }

  return (
    <div
      data-testid="selection-action-bar"
      role="toolbar"
      aria-label="Selected object actions"
      className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-line bg-surface px-3 py-2 md:hidden"
    >
      <button type="button" className={`${barBtnCls} border-danger/40 text-danger hover:border-danger`} onClick={onDelete} aria-label="Delete">
        <span aria-hidden="true">🗑</span>
      </button>
      <button type="button" className={barBtnCls} onClick={onDuplicate} aria-label="Duplicate">
        <span aria-hidden="true">⧉</span>
      </button>
      <button type="button" className={barBtnCls} onClick={onSendBackward} aria-label="Send backward">
        <span aria-hidden="true">↓</span>
      </button>
      <button type="button" className={barBtnCls} onClick={onBringForward} aria-label="Bring forward">
        <span aria-hidden="true">↑</span>
      </button>

      {isColorable && (
        <label
          className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-fast ease-out-soft active:scale-90"
          title="Colour"
        >
          <span className="h-7 w-7 rounded-full border border-line shadow-card" style={{ backgroundColor: color }} />
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'}
            onChange={(e) => applyColor(e.target.value)}
            aria-label={isLine ? 'Line colour' : isText ? 'Text colour' : 'Fill colour'}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      )}

      <button type="button" className={`${barBtnCls} ml-auto px-3 text-xs font-semibold`} onClick={onOpenSheet}>
        Edit
      </button>
    </div>
  )
}
