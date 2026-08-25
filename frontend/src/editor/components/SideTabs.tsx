import type { EditorSideName, SidesRuntimeState } from '../types'

export interface SideTabsProps {
  sides: EditorSideName[]
  activeSide: EditorSideName
  onChange: (side: EditorSideName) => void
  state: SidesRuntimeState
}

const LABELS: Record<EditorSideName, string> = { front: 'Front', back: 'Back' }

/** POD.md §6.7 — front/back tabs, shown only when the product actually has a customizable back. */
export default function SideTabs({ sides, activeSide, onChange, state }: SideTabsProps) {
  if (sides.length <= 1) return null

  return (
    <div className="flex gap-1 rounded-full border border-line bg-surface p-1" role="tablist">
      {sides.map((side) => {
        const active = side === activeSide
        const hasDesign = (state[side]?.objectCount ?? 0) > 0
        return (
          <button
            key={side}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(side)}
            className={`relative flex min-h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${
              active ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {LABELS[side]}
            {hasDesign && <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-paper' : 'bg-accent'}`} />}
          </button>
        )
      })}
    </div>
  )
}
