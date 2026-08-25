import { useRef, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { PrintRect } from './types'

// Minimum rect size, as a flat fraction of each axis (POD.md §4.1:
// "enforce a sensible minimum size (e.g. 5% of the image)").
const MIN_SIZE = 0.05

// A default centred rect used by the Reset button — 40% square, centred.
export const DEFAULT_PRINT_RECT: PrintRect = { print_x: 0.3, print_y: 0.3, print_w: 0.4, print_h: 0.4 }

type HandleKey = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se'
type DragMode = 'move' | HandleKey

// Which axis-edges each handle drags. 'min' = the x/y origin edge (moving it
// changes both position and size), 'max' = the far edge (only size changes).
const HANDLE_AXES: Record<HandleKey, { x?: 'min' | 'max'; y?: 'min' | 'max' }> = {
  nw: { x: 'min', y: 'min' },
  n: { y: 'min' },
  ne: { x: 'max', y: 'min' },
  w: { x: 'min' },
  e: { x: 'max' },
  sw: { x: 'min', y: 'max' },
  s: { y: 'max' },
  se: { x: 'max', y: 'max' },
}

const HANDLE_CURSOR: Record<HandleKey, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  w: 'ew-resize', e: 'ew-resize',
}

const HANDLE_POSITION: Record<HandleKey, string> = {
  nw: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
  n: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
  ne: 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
  w: 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2',
  e: 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

// Resize one axis: given the starting position/size and how far the pointer
// has moved (delta), return the new {pos, size} for that axis, clamped so
// the rect never leaves [0,1] and never shrinks below MIN_SIZE.
function resizeAxis(startPos: number, startSize: number, delta: number, edge: 'min' | 'max'): { pos: number; size: number } {
  if (edge === 'min') {
    const newPos = clamp(startPos + delta, 0, startPos + startSize - MIN_SIZE)
    return { pos: newPos, size: startPos + startSize - newPos }
  }
  const newSize = clamp(startSize + delta, MIN_SIZE, 1 - startPos)
  return { pos: startPos, size: newSize }
}

function round3(n: number): string {
  return n.toFixed(3)
}

interface PrintAreaSelectorProps {
  imageUrl: string
  imageW: number
  imageH: number
  value: PrintRect
  onChange: (rect: PrintRect) => void
  /** Physical width of the print area in inches — optional, only used to
   *  render the derived physical-size readout (§4.1: "live readout showing
   *  both the normalized values and the derived physical size in inches"). */
  printWidthIn?: number
}

export default function PrintAreaSelector({ imageUrl, imageW, imageH, value, onChange, printWidthIn }: PrintAreaSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Transient drag state — a ref, not React state, so pointermove doesn't
  // need to fight re-renders. Captured once at drag start; onChange (called
  // on every move) is the single source of truth for the actual rect.
  const dragRef = useRef<{ mode: DragMode; startNorm: { x: number; y: number }; startRect: PrintRect } | null>(null)
  // The exact listener functions currently attached to `window`, so endDrag
  // always removes precisely what startDrag added — never a stale closure
  // from an earlier render (a real footgun with useCallback + addEventListener).
  const attachedRef = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null)

  function normPos(clientX: number, clientY: number) {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height }
  }

  function applyDrag(clientX: number, clientY: number) {
    const drag = dragRef.current
    if (!drag) return
    const cur = normPos(clientX, clientY)
    const dx = cur.x - drag.startNorm.x
    const dy = cur.y - drag.startNorm.y
    const start = drag.startRect

    if (drag.mode === 'move') {
      const newX = clamp(start.print_x + dx, 0, 1 - start.print_w)
      const newY = clamp(start.print_y + dy, 0, 1 - start.print_h)
      onChange({ ...start, print_x: newX, print_y: newY })
      return
    }

    const axes = HANDLE_AXES[drag.mode]
    const next: PrintRect = { ...start }
    if (axes.x) {
      const { pos, size } = resizeAxis(start.print_x, start.print_w, dx, axes.x)
      next.print_x = pos
      next.print_w = size
    }
    if (axes.y) {
      const { pos, size } = resizeAxis(start.print_y, start.print_h, dy, axes.y)
      next.print_y = pos
      next.print_h = size
    }
    onChange(next)
  }

  function endDrag() {
    dragRef.current = null
    const attached = attachedRef.current
    if (attached) {
      window.removeEventListener('pointermove', attached.move)
      window.removeEventListener('pointerup', attached.up)
      window.removeEventListener('pointercancel', attached.up)
      attachedRef.current = null
    }
  }

  function startDrag(e: ReactPointerEvent, mode: DragMode) {
    e.preventDefault()
    e.stopPropagation()
    // Any previous drag session (e.g. pointerup missed) is torn down first.
    endDrag()
    dragRef.current = { mode, startNorm: normPos(e.clientX, e.clientY), startRect: { ...value } }
    const move = (ev: PointerEvent) => applyDrag(ev.clientX, ev.clientY)
    const up = () => endDrag()
    attachedRef.current = { move, up }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  function handleKeyDown(e: ReactKeyboardEvent) {
    const step = e.shiftKey ? 0.02 : 0.005
    let dx = 0
    let dy = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return
    e.preventDefault()
    const newX = clamp(value.print_x + dx, 0, 1 - value.print_w)
    const newY = clamp(value.print_y + dy, 0, 1 - value.print_h)
    onChange({ ...value, print_x: newX, print_y: newY })
  }

  function handleReset() {
    onChange({ ...DEFAULT_PRINT_RECT })
  }

  function handleCenter() {
    onChange({ ...value, print_x: (1 - value.print_w) / 2 })
  }

  const heightIn = printWidthIn != null && value.print_w > 0
    ? printWidthIn * (value.print_h * imageH) / (value.print_w * imageW)
    : null

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative w-full bg-gray-100 rounded overflow-hidden touch-none select-none"
        style={{ aspectRatio: `${imageW} / ${imageH}` }}
      >
        <img
          src={imageUrl}
          alt="Mockup"
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
        />
        {/* The rect itself doubles as the dimmed scrim: a huge box-shadow
            spread fills everything outside it, clipped by the container's
            overflow-hidden. */}
        <div
          role="group"
          aria-label="Print area — drag to move, drag handles to resize, arrow keys to nudge"
          tabIndex={0}
          onPointerDown={(e) => startDrag(e, 'move')}
          onKeyDown={handleKeyDown}
          className="absolute border-2 border-indigo-500 cursor-move touch-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
          style={{
            left: `${value.print_x * 100}%`,
            top: `${value.print_y * 100}%`,
            width: `${value.print_w * 100}%`,
            height: `${value.print_h * 100}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
          }}
        >
          {(Object.keys(HANDLE_AXES) as HandleKey[]).map((h) => (
            <div
              key={h}
              onPointerDown={(e) => startDrag(e, h)}
              className={`absolute w-3 h-3 bg-white border-2 border-indigo-500 rounded-full touch-none ${HANDLE_POSITION[h]}`}
              style={{ cursor: HANDLE_CURSOR[h] }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleCenter}
          className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
        >
          Center
        </button>
      </div>

      <div className="text-[11px] text-gray-500 font-mono leading-relaxed">
        <div>
          x {round3(value.print_x)} &nbsp; y {round3(value.print_y)} &nbsp; w {round3(value.print_w)} &nbsp; h {round3(value.print_h)}
        </div>
        {printWidthIn != null && heightIn != null && (
          <div>{printWidthIn.toFixed(2)}in × {heightIn.toFixed(2)}in physical print size</div>
        )}
      </div>
    </div>
  )
}
