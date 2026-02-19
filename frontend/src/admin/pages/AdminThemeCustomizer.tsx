// frontend/src/admin/pages/AdminThemeCustomizer.tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { themes } from '../../themes'

export default function AdminThemeCustomizer() {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()) as Promise<Record<string, string>>,
  })

  const activeThemeId = settings?.active_theme ?? 'jewellery'

  const [form, setForm] = useState<Record<string, string>>({})

  // Reset form when activeThemeId changes (e.g. after settings load)
  useEffect(() => {
    try {
      const parsed: Record<string, Record<string, string>> = settings?.theme_overrides_json
        ? JSON.parse(settings.theme_overrides_json)
        : {}
      setForm(parsed[activeThemeId] ?? {})
    } catch {
      setForm({})
    }
  }, [activeThemeId, settings?.theme_overrides_json])

  const save = useMutation({
    mutationFn: async () => {
      let existingOverrides: Record<string, Record<string, string>> = {}
      try {
        if (settings?.theme_overrides_json) {
          existingOverrides = JSON.parse(settings.theme_overrides_json)
        }
      } catch {
        // ignore malformed stored JSON
      }
      const merged = { ...existingOverrides, [activeThemeId]: form }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_overrides_json: JSON.stringify(merged) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  const theme = themes[activeThemeId]

  const fields = [
    { key: '--color-accent', label: 'Accent Color', type: 'color' },
    { key: '--color-bg', label: 'Background Color', type: 'color' },
    { key: '--color-primary', label: 'Primary Color', type: 'color' },
    { key: '--color-text', label: 'Text Color', type: 'color' },
    { key: '--font-heading', label: 'Heading Font', type: 'text' },
    { key: '--font-body', label: 'Body Font', type: 'text' },
    { key: '--tagline', label: 'Tagline', type: 'text' },
    { key: '--logo-url', label: 'Logo URL', type: 'text' },
    { key: '--hero-image', label: 'Hero Image URL', type: 'text' },
  ] as const

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Theme Customizer</h1>
      {theme && (
        <p className="text-gray-500 text-sm">Customising: <strong>{theme.name}</strong></p>
      )}
      {fields.map(({ key, label, type }) => {
        const defaultVal = theme?.defaultCssVars[key] ?? ''
        return (
          <div key={key} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={type}
                value={form[key] ?? ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={defaultVal}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              {defaultVal && (
                <p className="text-xs text-gray-400 mt-1">Default: {defaultVal}</p>
              )}
            </div>
            {form[key] !== undefined && (
              <button
                type="button"
                onClick={() => setForm(f => { const next = { ...f }; delete next[key]; return next })}
                className="text-xs text-gray-400 hover:text-gray-600 pb-1 whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        )
      })}
      {save.isError && (
        <p className="text-red-600 text-sm">Failed to save. Please try again.</p>
      )}
      {save.isSuccess && (
        <p className="text-green-600 text-sm">Saved successfully.</p>
      )}
      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-gray-700 text-sm disabled:opacity-50"
      >
        {save.isPending ? 'Saving…' : 'Save Customization'}
      </button>
    </div>
  )
}
