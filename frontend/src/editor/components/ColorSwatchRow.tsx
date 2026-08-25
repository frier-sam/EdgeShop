import { useId } from 'react'

export interface ColorPreset {
  hex: string
  label: string
}

/**
 * POD-UI.md §3 Workstream C1 — "black, white, greys, and strong
 * print-friendly colours". Deliberately flat, saturated swatches (no
 * pastels) since these are going on physical merchandise, not a UI.
 */
export const DEFAULT_COLOR_PRESETS: ColorPreset[] = [
  { hex: '#101014', label: 'Black' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#6A6A77', label: 'Grey' },
  { hex: '#9B9BA6', label: 'Light grey' },
  { hex: '#DC2626', label: 'Red' },
  { hex: '#EA580C', label: 'Orange' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#16A34A', label: 'Green' },
  { hex: '#2563EB', label: 'Blue' },
  { hex: '#4F46E5', label: 'Indigo' },
]

export interface ColorSwatchRowProps {
  value: string | null
  onChange: (hex: string) => void
  presets?: ColorPreset[]
  /** Accessible label for the row itself (e.g. "Colour" or "Stroke colour"). */
  label?: string
  className?: string
}

const sameColor = (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase()

/**
 * POD-UI.md §3 Workstream C1 — the headline fix. This is the FIRST thing
 * rendered in both the mobile properties `Sheet` and the desktop rail
 * (`PropertiesPanel` puts it above the tabs in both places), so colour is
 * reachable in exactly one tap from selecting an object: no scrolling, no
 * tab switch, no sheet expansion required.
 *
 * Every swatch is a full 44px touch target (POD-UI.md §5 acceptance #5)
 * even though it renders as a smaller circle — the row scrolls
 * horizontally rather than shrinking targets to fit, matching the chip-row
 * pattern used elsewhere in the mobile overhaul.
 */
export default function ColorSwatchRow({ value, onChange, presets = DEFAULT_COLOR_PRESETS, label = 'Colour', className = '' }: ColorSwatchRowProps) {
  const customInputId = useId()
  const activeIsCustom = !presets.some((p) => sameColor(value, p.hex))

  return (
    <div className={`flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 ${className}`} role="group" aria-label={label}>
      {presets.map((preset) => {
        const active = sameColor(value, preset.hex)
        const isLight = preset.hex.toLowerCase() === '#ffffff'
        return (
          <button
            key={preset.hex}
            type="button"
            aria-label={preset.label}
            aria-pressed={active}
            onClick={() => onChange(preset.hex)}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-fast ease-out-soft active:scale-90 ${
              isLight ? 'border border-line' : ''
            }`}
          >
            <span
              className="h-7 w-7 rounded-full shadow-card"
              style={{ backgroundColor: preset.hex, boxShadow: isLight ? 'inset 0 0 0 1px var(--color-line)' : undefined }}
            />
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full ring-2 ring-accent ring-offset-2 ring-offset-surface"
              />
            )}
          </button>
        )
      })}

      {/* Custom trigger: a real <input type="color"> stretched invisibly over
          a styled 44px swatch button — the standard way to theme a native
          color input while keeping its OS picker. */}
      <label
        htmlFor={customInputId}
        className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-fast ease-out-soft active:scale-90`}
        title="Custom colour"
      >
        <span
          className="h-7 w-7 rounded-full border border-line"
          style={{
            background: activeIsCustom && value
              ? value
              : 'conic-gradient(from 90deg, #DC2626, #F59E0B, #16A34A, #2563EB, #4F46E5, #DC2626)',
          }}
        />
        {activeIsCustom && value && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full ring-2 ring-accent ring-offset-2 ring-offset-surface"
          />
        )}
        <input
          id={customInputId}
          type="color"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Custom colour"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}
