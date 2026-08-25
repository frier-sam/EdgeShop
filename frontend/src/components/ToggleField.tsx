// frontend/src/components/ToggleField.tsx
//
// POD-UI.md §6 lane-boundary fix: this sat between Workstream C (editor)
// and D (admin) and was missed by the visual overhaul, so it kept its
// pre-overhaul raw Tailwind gray/red palette while Field.tsx (its sibling
// in AdminSettings' forms) moved onto the design tokens. Retinted onto the
// same tokens Field.tsx uses (ink/ink-soft/line/accent), with the same
// 44px touch floor and accent focus ring. Prop API is unchanged — no
// caller (AdminSettings.tsx) needed to change.

interface ToggleFieldProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export default function ToggleField({ label, description, checked, onChange, disabled = false }: ToggleFieldProps) {
  return (
    <label
      className={`flex min-h-11 items-start gap-3 py-1 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {/* Toggle pill */}
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <div
          className={`h-5 w-9 rounded-full border transition-colors duration-fast ${
            checked ? 'border-ink bg-ink' : 'border-line bg-surface-2'
          } peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2`}
        />
        <div
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform duration-fast ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      {/* Text — same tokens as Field's label (text-ink) / hint (text-ink-soft) */}
      <div>
        <span className="text-sm font-medium leading-5 text-ink">{label}</span>
        {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
      </div>
    </label>
  )
}
