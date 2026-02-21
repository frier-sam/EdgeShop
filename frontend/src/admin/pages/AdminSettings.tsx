import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import { COUNTRY_CODES } from '../../utils/countryCodes'
import { Skeleton } from '../../components/Skeleton'
import ToggleField from '../../components/ToggleField'
import SelectField from '../../components/SelectField'

interface Settings {
  store_name: string
  currency: string
  [key: string]: string
}

export default function AdminSettings() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => adminFetch('/api/settings').then((r) => r.json()),
  })

  const [form, setForm] = useState<Settings>({
    store_name: '',
    currency: 'INR',
    announcement_bar_enabled: 'false',
    announcement_bar_text: '',
    announcement_bar_color: '#1A1A1A',
    reviews_visibility: 'all',
    admin_email_notifications: 'false',
    default_country_code: '+91',
  })

  useEffect(() => {
    if (settings) setForm((prev) => ({ ...prev, ...settings }))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      adminFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      showToast('Settings saved', 'success')
    },
  })

  if (isLoading) return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-7 w-24" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )

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
            <SelectField
              label="Currency"
              value={form.currency}
              onChange={(v) => setForm({ ...form, currency: v })}
              options={[
                { value: 'INR', label: 'INR — Indian Rupee (₹)' },
                { value: 'USD', label: 'USD — US Dollar ($)' },
                { value: 'EUR', label: 'EUR — Euro (€)' },
                { value: 'GBP', label: 'GBP — British Pound (£)' },
                { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
                { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Default Country (phone dial code)</label>
            <select
              value={form.default_country_code}
              onChange={(e) => setForm({ ...form, default_country_code: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code + c.name} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Pre-selected dial code on the checkout phone field.</p>
          </div>
        </div>

        {/* Announcement Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Announcement Bar</h2>
          <ToggleField
            label="Enable Announcement Bar"
            description="Show a banner at the top of your storefront."
            checked={form.announcement_bar_enabled === 'true'}
            onChange={(checked) => setForm({ ...form, announcement_bar_enabled: checked ? 'true' : 'false' })}
          />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Message Text</label>
            <input
              value={form.announcement_bar_text}
              onChange={(e) => setForm({ ...form, announcement_bar_text: e.target.value })}
              placeholder="Free shipping on orders over ₹500!"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Bar Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.announcement_bar_color}
                onChange={(e) => setForm({ ...form, announcement_bar_color: e.target.value })}
                className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
              />
              <span className="text-sm text-gray-500 font-mono">{form.announcement_bar_color}</span>
            </div>
            <p className="text-xs text-gray-400">Text is always white — choose a dark color for best readability.</p>
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Reviews</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Who can write reviews?</label>
            <select
              value={form.reviews_visibility}
              onChange={(e) => setForm({ ...form, reviews_visibility: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            >
              <option value="all">Everyone</option>
              <option value="logged_in">Logged-in users</option>
              <option value="none">Disabled</option>
            </select>
          </div>
        </div>

        {/* Email Notifications */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Email Notifications</h2>
          <ToggleField
            label="New order email notifications"
            description="Send an email to your store address each time a new order is placed."
            checked={form.admin_email_notifications === 'true'}
            onChange={(checked) => setForm({ ...form, admin_email_notifications: checked ? 'true' : 'false' })}
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}
