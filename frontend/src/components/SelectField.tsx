// frontend/src/components/SelectField.tsx

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

export default function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required,
  hint,
  className = '',
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 bg-white appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
