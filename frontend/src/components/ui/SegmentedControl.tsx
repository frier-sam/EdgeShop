import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  'aria-label'?: string
}

/**
 * 2+ option switch with an animated sliding indicator and roving-tabindex
 * keyboard navigation (`role="tablist"` / `role="tab"`, arrow keys move
 * focus AND select — the standard "automatic activation" tablist pattern).
 * Used by Workstream C for the editor's Front/Back side tabs.
 */
export default function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const recalc = () => {
      const container = containerRef.current
      const el = tabRefs.current.get(value)
      if (!container || !el) return
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      setIndicator({ left: elRect.left - containerRect.left, width: elRect.width })
    }
    recalc()

    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(recalc)
    observer.observe(container)
    return () => observer.disconnect()
    // options.length covers add/remove of tabs changing layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length])

  const move = (fromIndex: number, direction: 1 | -1) => {
    if (options.length === 0) return
    let index = fromIndex
    for (let i = 0; i < options.length; i++) {
      index = (index + direction + options.length) % options.length
      if (!options[index].disabled) break
    }
    const option = options[index]
    if (option.disabled) return
    tabRefs.current.get(option.value)?.focus()
    onChange(option.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(index, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(index, -1)
        break
      case 'Home':
        event.preventDefault()
        move(-1, 1)
        break
      case 'End':
        event.preventDefault()
        move(0, -1)
        break
      default:
        break
    }
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative inline-flex items-center gap-0.5 rounded-btn bg-surface-2 p-1 ${className}`}
    >
      {indicator && (
        <span
          aria-hidden="true"
          style={{ left: indicator.left, width: indicator.width }}
          className="absolute inset-y-1 rounded-[calc(var(--radius-btn)-4px)] bg-surface shadow-card transition-[left,width] duration-base ease-spring"
        />
      )}
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) tabRefs.current.set(option.value, el)
              else tabRefs.current.delete(option.value)
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={option.disabled || undefined}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`relative z-10 flex h-11 min-w-11 items-center justify-center rounded-[calc(var(--radius-btn)-4px)] px-4 text-sm font-semibold transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${
              selected ? 'text-ink' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
