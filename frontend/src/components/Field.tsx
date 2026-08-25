import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export interface FieldOption {
  value: string
  label: string
  disabled?: boolean
}

interface FieldBaseProps {
  label: string
  error?: string
  hint?: string
  containerClassName?: string
}

type FieldInputProps = FieldBaseProps & { as?: 'input' } & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>
type FieldTextareaProps = FieldBaseProps & { as: 'textarea' } & Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
>
type FieldSelectProps = FieldBaseProps & {
  as: 'select'
  options: FieldOption[]
  placeholder?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>

// Kept as a discriminated union on `as` — this is the pre-existing API
// shape (POD-UI.md §A5: "preserve the API"). Only additions here are the
// accessibility wiring (aria-invalid/aria-describedby) and the design
// system's tokens/radius; no prop was renamed or removed.
export type FieldProps = FieldInputProps | FieldTextareaProps | FieldSelectProps

// 44px min height (h-11) on the touch floor; accent focus ring; danger
// border + ring when `error` is set.
const CONTROL_CLASSES =
  'w-full rounded-btn border bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint ' +
  'transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-accent/30'

function fieldId(props: FieldProps): string {
  if ('id' in props && props.id) return props.id
  if ('name' in props && props.name) return props.name
  return props.label.toLowerCase().replace(/\s+/g, '-')
}

/** Text input / select / textarea with a shared label, hint and error style. */
export default function Field(props: FieldProps) {
  const { label, error, hint, containerClassName = '' } = props
  const id = fieldId(props)
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined
  const borderClasses = error ? 'border-danger focus:border-danger' : 'border-line focus:border-ink'

  let control: React.ReactNode
  if (props.as === 'select') {
    const { label: _label, error: _error, hint: _hint, containerClassName: _c, as: _as, options, placeholder, ...selectProps } = props
    control = (
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${CONTROL_CLASSES} ${borderClasses} h-11 appearance-none pr-9`}
          {...selectProps}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    )
  } else if (props.as === 'textarea') {
    const { label: _label, error: _error, hint: _hint, containerClassName: _c, as: _as, ...textareaProps } = props
    control = (
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${CONTROL_CLASSES} ${borderClasses} min-h-24 py-2.5`}
        {...textareaProps}
      />
    )
  } else {
    const { label: _label, error: _error, hint: _hint, containerClassName: _c, as: _as, ...inputProps } = props
    control = (
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${CONTROL_CLASSES} ${borderClasses} h-11`}
        {...inputProps}
      />
    )
  }

  return (
    <div className={containerClassName}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
        {'required' in props && props.required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
