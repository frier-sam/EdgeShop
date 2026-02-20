import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'

interface Settings {
  store_name: string
  currency: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
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
    cod_enabled: 'true',
    razorpay_key_id: '',
    razorpay_key_secret: '',
    announcement_bar_enabled: 'false',
    announcement_bar_text: '',
    announcement_bar_color: '#1A1A1A',
    reviews_visibility: 'all',
    admin_email_notifications: 'false',
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

        {/* Announcement Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Announcement Bar</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.announcement_bar_enabled === 'true'}
              onChange={(e) => setForm({ ...form, announcement_bar_enabled: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Enable Announcement Bar</span>
          </label>
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
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.admin_email_notifications === 'true'}
              onChange={(e) => setForm({ ...form, admin_email_notifications: e.target.checked ? 'true' : 'false' })}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Send email to store email when a new order is placed</span>
          </label>
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
