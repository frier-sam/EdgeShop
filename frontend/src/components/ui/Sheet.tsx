import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

export type SheetSnap = 'peek' | 'full'

export interface SheetProps {
  /** Controlled open state. */
  open: boolean
  /** Called on backdrop click, Escape, or a drag-to-dismiss past threshold. */
  onClose: () => void
  children: ReactNode
  /** Compact snap height. Number = px, string = any CSS length. Default `40vh`. */
  peekHeight?: number | string
  /** Expanded snap height. Number = px, string = any CSS length. Default `85vh`. */
  fullHeight?: number | string
  /** Snap state the sheet opens in (and resets to on every open). Default `'peek'`. */
  initialSnap?: SheetSnap
  /** Optional heading rendered above the content, wired to `aria-labelledby`. */
  title?: string
  className?: string
}

const toCssLength = (value: number | string) => (typeof value === 'number' ? `${value}px` : value)

let sheetIdCounter = 0

/**
 * Mobile bottom sheet: fade backdrop, `slide-up-sheet` entrance, drag-to-
 * dismiss, two configurable snap heights (peek/full), safe-area padding,
 * focus trap, Escape-to-close, body scroll lock while open.
 *
 * Drag is deliberately scoped to the handle/header row, not the whole
 * panel — that keeps scrollable content in the body usable with normal
 * touch scrolling while the handle stays a dedicated drag affordance.
 * From `peek`: drag down past ~35% of panel height (or a fast downward
 * flick) closes; drag up snaps to `full`. From `full`: drag down snaps
 * back to `peek` (or closes on a fast flick).
 */
const Sheet = forwardRef<HTMLDivElement, SheetProps>(function Sheet(
  { open, onClose, children, peekHeight = '40vh', fullHeight = '85vh', initialSnap = 'peek', title, className = '' },
  forwardedRef,
) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const [snap, setSnap] = useState<SheetSnap>(initialSnap)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragState = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null)
  const titleId = useRef(`sheet-title-${++sheetIdCounter}`).current

  const setPanelRef = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node
      if (typeof forwardedRef === 'function') forwardedRef(node)
      else if (forwardedRef) (forwardedRef as MutableRefObject<HTMLDivElement | null>).current = node
    },
    [forwardedRef],
  )

  // Reset to the initial snap every time the sheet opens.
  useEffect(() => {
    if (open) {
      setSnap(initialSnap)
      setDragOffset(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Body scroll lock while open.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Escape to close.
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Focus trap: move focus in on open, cycle Tab within the panel, restore on close.
  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current

    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : []

    const first = focusables()[0]
    ;(first ?? panel)?.focus()

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => {
      document.removeEventListener('keydown', handleTab)
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  const currentHeight = snap === 'full' ? fullHeight : peekHeight

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    dragState.current = { startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, velocity: 0 }
    setDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragState.current
    if (!state) return
    const delta = event.clientY - state.startY
    // Sheet only drags downward from its current snap; upward drag beyond
    // `full` isn't a supported state, so clamp at 0.
    const next = Math.max(0, delta)
    const dt = event.timeStamp - state.lastT
    if (dt > 0) state.velocity = (event.clientY - state.lastY) / dt
    state.lastY = event.clientY
    state.lastT = event.timeStamp
    setDragOffset(next)
  }

  const endDrag = () => {
    const state = dragState.current
    if (!state) return
    dragState.current = null
    setDragging(false)

    const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0
    const draggedFraction = panelHeight > 0 ? dragOffset / panelHeight : 0
    const fastFlickDown = state.velocity > 0.6

    if (snap === 'peek' && (draggedFraction > 0.35 || fastFlickDown)) {
      onClose()
    } else if (snap === 'full' && (draggedFraction > 0.5 || fastFlickDown)) {
      setSnap('peek')
    }
    setDragOffset(0)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/40" />
      <div
        ref={setPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{
          height: toCssLength(currentHeight),
          maxHeight: '92vh',
          transform: `translateY(${dragOffset}px)`,
          transitionProperty: dragging ? 'none' : undefined,
        }}
        className={`absolute inset-x-0 bottom-0 flex flex-col rounded-t-sheet bg-surface shadow-sheet ` +
          `animate-slide-up-sheet transition-[height,transform] duration-base ease-out-soft ${className}`}
      >
        {/* Drag handle — the only region that starts a drag-to-dismiss gesture. */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="flex shrink-0 touch-none select-none flex-col items-center gap-2 pb-1 pt-2.5 cursor-grab active:cursor-grabbing"
        >
          <span className="h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
          {title && (
            <h2 id={titleId} className="w-full px-5 pb-1 text-left font-display text-base font-semibold text-ink">
              {title}
            </h2>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
})

export default Sheet
