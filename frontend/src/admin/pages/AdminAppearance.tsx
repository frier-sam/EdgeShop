import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { themes } from '../../themes'
import ImageUploader from '../ImageUploader'

export default function AdminAppearance() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const [activeTheme, setActiveTheme] = useState('jewellery')
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!settings) return
    setActiveTheme(settings.active_theme ?? 'jewellery')
    try {
      const parsed: Record<string, Record<string, string>> = settings.theme_overrides_json
        ? JSON.parse(settings.theme_overrides_json)
        : {}
      setOverrideForm(parsed[settings.active_theme ?? 'jewellery'] ?? {})
    } catch {
      setOverrideForm({})
    }
  }, [settings])

  function handleThemeChange(themeId: string) {
    setActiveTheme(themeId)
    try {
      const parsed: Record<string, Record<string, string>> = settings?.theme_overrides_json
        ? JSON.parse(settings.theme_overrides_json)
        : {}
      setOverrideForm(parsed[themeId] ?? {})
    } catch {
      setOverrideForm({})
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let existingOverrides: Record<string, Record<string, string>> = {}
      try {
        if (settings?.theme_overrides_json) existingOverrides = JSON.parse(settings.theme_overrides_json)
      } catch { /* ignore */ }
      const mergedOverrides = { ...existingOverrides, [activeTheme]: overrideForm }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_theme: activeTheme,
          theme_overrides_json: JSON.stringify(mergedOverrides),
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  const theme = themes[activeTheme]
  const cssFields = [
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
    <div className="max-w-2xl space-y-8">
      <h1 className="text-xl font-semibold text-gray-900">Appearance</h1>

      {/* Theme selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-4">Storefront Theme</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(themes).map(t => (
            <label
              key={t.id}
              className={`cursor-pointer border-2 rounded-lg p-4 transition-colors ${
                activeTheme === t.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="active_theme"
                value={t.id}
                checked={activeTheme === t.id}
                onChange={() => handleThemeChange(t.id)}
                className="sr-only"
              />
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                {activeTheme === t.id && (
                  <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Active</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{t.description}</p>
              <div className="flex gap-1">
                {Object.entries(t.defaultCssVars)
                  .filter(([k]) => k.startsWith('--color'))
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: v ?? '#ccc' }}
                      title={k}
                    />
                  ))}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Customizer */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
        <div>
          <h2 className="font-medium text-gray-800">Customise: {theme?.name}</h2>
          <p className="text-xs text-gray-400 mt-1">Override colours and fonts for this theme. Leave blank to use defaults.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cssFields.map(({ key, label, type }) => {
            const defaultVal = theme?.defaultCssVars[key] ?? ''
            return (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  {type === 'color' && (
                    <input
                      type="color"
                      value={overrideForm[key] || defaultVal || '#000000'}
                      onChange={e => setOverrideForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5 shrink-0"
                    />
                  )}
                  <input
                    type="text"
                    value={overrideForm[key] ?? ''}
                    onChange={e => setOverrideForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={defaultVal || label}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500 font-mono"
                  />
                  {overrideForm[key] !== undefined && (
                    <button
                      type="button"
                      onClick={() => setOverrideForm(f => { const n = { ...f }; delete n[key]; return n })}
                      className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                      title="Reset to default"
                    >
                      ↺
                    </button>
                  )}
                </div>
                {defaultVal && <p className="text-xs text-gray-300 mt-0.5 font-mono">default: {defaultVal}</p>}
                {(key === '--logo-url' || key === '--hero-image') && (
                  <div className="mt-2">
                    <ImageUploader
                      existingUrl={overrideForm[key] ?? ''}
                      onUploadComplete={(url) => setOverrideForm(f => ({ ...f, [key]: url }))}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Appearance'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        {saveMutation.isError && <span className="text-sm text-red-500">Failed to save</span>}
      </div>
    </div>
  )
}
