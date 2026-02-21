// frontend/src/components/ToggleField.tsx

interface ToggleFieldProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export default function ToggleField({ label, description, checked, onChange, disabled = false }: ToggleFieldProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {/* Toggle pill */}
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors duration-200 ${
            checked ? 'bg-gray-900' : 'bg-gray-300'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      {/* Text */}
      <div>
        <span className="text-sm text-gray-700 leading-5">{label}</span>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )
}
