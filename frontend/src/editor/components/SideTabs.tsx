import SegmentedControl from '../../components/ui/SegmentedControl'
import type { EditorSideName, SidesRuntimeState } from '../types'

export interface SideTabsProps {
  sides: EditorSideName[]
  activeSide: EditorSideName
  onChange: (side: EditorSideName) => void
  state: SidesRuntimeState
  className?: string
}

const LABELS: Record<EditorSideName, string> = { front: 'Front', back: 'Back' }

/**
 * POD.md §6.7 / POD-UI.md §3 C4 — front/back tabs, shown only when the
 * product actually has a customizable back. Built on the shared
 * `SegmentedControl` primitive for the animated sliding indicator and
 * roving-tabindex keyboard nav; a trailing dot on the label marks a side
 * that already has artwork (SegmentedControl only accepts plain-text
 * labels, so this rides in the label string rather than a separate badge
 * node — still legible, and keeps the tab strip a single primitive
 * instance rather than a bespoke re-implementation).
 */
export default function SideTabs({ sides, activeSide, onChange, state, className = '' }: SideTabsProps) {
  if (sides.length <= 1) return null

  const options = sides.map((side) => {
    const hasDesign = (state[side]?.objectCount ?? 0) > 0
    return { value: side, label: hasDesign ? `${LABELS[side]} •` : LABELS[side] }
  })

  return (
    <SegmentedControl
      options={options}
      value={activeSide}
      onChange={onChange}
      aria-label="Side"
      className={className}
    />
  )
}
