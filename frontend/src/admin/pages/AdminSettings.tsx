import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { themes } from '../../themes'

interface Settings {
  store_name: string
  currency: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
  active_theme: string
  [key: string]: string
}

export default function AdminSettings() {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  })

  const [form, setForm] = useState<Settings>({
    store_name: '',
    currency: 'INR',
    cod_enabled: 'true',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    active_theme: 'jewellery',
  })

  useEffect(() => {
    if (settings) setForm((prev) => ({ ...prev, ...settings }))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Settings</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form) }}
        className="space-y-6"
      >
        {/* Store Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Store Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Store Name</label>
              <input
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Currency Code</label>
              <input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                placeholder="INR"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.cod_enabled === 'true'}
              onChange={(e) => setForm({ ...form, cod_enabled: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Enable Cash on Delivery</span>
          </label>
        </div>

        {/* Razorpay */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Razorpay</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Key ID</label>
            <input
              value={form.razorpay_key_id}
              onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
              placeholder="rzp_live_..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Key Secret</label>
            <input
              type="password"
              value={form.razorpay_key_secret}
              onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <p className="text-xs text-gray-400">Keys are stored securely in D1 and read server-side only.</p>
        </div>

        {/* Theme Selector */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-medium text-gray-800 mb-4">Storefront Theme</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(themes).map((t) => (
              <label
                key={t.id}
                className={`cursor-pointer border-2 rounded-lg p-4 transition-colors ${
                  form.active_theme === t.id
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="active_theme"
                  value={t.id}
                  checked={form.active_theme === t.id}
                  onChange={() => setForm({ ...form, active_theme: t.id })}
                  className="sr-only"
                />
                <div className="flex items-start justify-between mb-2">
                  <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                  {form.active_theme === t.id && (
                    <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Active</span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{t.description}</p>
                {/* Colour swatches */}
                <div className="flex gap-1 mt-3">
                  {t.id === 'jewellery' && (
                    <>
                      <div className="w-4 h-4 rounded-full bg-[#FAFAF8] border border-gray-200" title="Background" />
                      <div className="w-4 h-4 rounded-full bg-[#1A1A1A]" title="Text" />
                      <div className="w-4 h-4 rounded-full bg-[#C9A96E]" title="Accent" />
                    </>
                  )}
                  {t.id === 'artsCrafts' && (
                    <>
                      <div className="w-4 h-4 rounded-full bg-[#F5F0E8] border border-gray-200" title="Background" />
                      <div className="w-4 h-4 rounded-full bg-[#2C2416]" title="Text" />
                      <div className="w-4 h-4 rounded-full bg-[#C4622D]" title="Accent" />
                    </>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        </div>
      </form>
    </div>
  )
}
