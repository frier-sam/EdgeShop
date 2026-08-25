// frontend/src/components/SelectField.tsx
//
// POD-UI.md §6 lane-boundary fix: sat between Workstream C and D, missed
// by the visual overhaul, so it kept its pre-overhaul raw Tailwind gray
// palette (`border-gray-300`, `text-gray-500`, …) while its sibling
// Field.tsx moved onto the design tokens. Now a thin wrapper around
// Field's own `as="select"` rendering, so label/hint/error, the 44px
// touch floor and the accent focus ring come from the exact same code
// path as every other select in the app — no separate style to drift out
// of sync again. Prop API (value/onChange(value) rather than an event,
// no `error`) is unchanged, so no caller needed to change.
import Field from './Field'

interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  name?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  required?: boolean
  hint?: string
  className?: string
}

export default function SelectField({ label, name, value, onChange, options, required, hint, className = '' }: SelectFieldProps) {
  return (
    <Field
      as="select"
      label={label}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      options={options}
      required={required}
      hint={hint}
      containerClassName={className}
    />
  )
}
