import { useRef, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { PrintRect } from './types'
import Button from '../components/Button'

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

// Positions the (larger, invisible) hit-target; the visible puck is
// centred inside it via flex, so the two stay in sync automatically.
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
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full touch-none select-none overflow-hidden rounded-card bg-surface-2"
        style={{ aspectRatio: `${imageW} / ${imageH}` }}
      >
        <img
          src={imageUrl}
          alt="Mockup"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-fill"
        />
        {/* The rect itself doubles as the dimmed scrim: a huge box-shadow
            spread fills everything outside it, clipped by the container's
            overflow-hidden. A dual-tone (white + accent) boundary keeps the
            print-area edge legible whether the mockup underneath it is
            light or dark — a single-colour line can vanish against either. */}
        <div
          role="group"
          aria-label="Print area — drag to move, drag handles to resize, arrow keys to nudge"
          tabIndex={0}
          onPointerDown={(e) => startDrag(e, 'move')}
          onKeyDown={handleKeyDown}
          className="absolute cursor-move touch-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          style={{
            left: `${value.print_x * 100}%`,
            top: `${value.print_y * 100}%`,
            width: `${value.print_w * 100}%`,
            height: `${value.print_h * 100}%`,
            boxShadow:
              '0 0 0 2px #ffffff, 0 0 0 4px var(--color-accent), 0 0 0 9999px rgb(16 16 20 / 0.6)',
          }}
        >
          {(Object.keys(HANDLE_AXES) as HandleKey[]).map((h) => (
            <div
              key={h}
              onPointerDown={(e) => startDrag(e, h)}
              // Hit target is a full 24px (touch-floor) square even though
              // the visible puck is smaller — POD-UI.md §D3: "large enough
              // to grab on touch (≥24px hit area even if visually smaller)".
              className={`absolute flex h-6 w-6 touch-none items-center justify-center ${HANDLE_POSITION[h]}`}
              style={{ cursor: HANDLE_CURSOR[h] }}
            >
              {/* White fill + dark ring reads on any garment colour —
                  black jacket or white tee alike — unlike a single accent
                  dot which can disappear against a similarly-toned mockup. */}
              <span className="pointer-events-none block h-3 w-3 rounded-full border-2 border-ink bg-white shadow-[0_1px_3px_rgb(0_0_0_/_0.4)]" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
          Reset
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={handleCenter}>
          Center
        </Button>
      </div>

      <div className="font-mono text-[11px] leading-relaxed text-ink-soft">
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
