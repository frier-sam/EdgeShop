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
  default_country_code: string
  cod_enabled: string
  razorpay_key_id: string
  razorpay_key_secret: string
  flat_shipping_amount: string
  free_shipping_over: string
  default_print_fee: string
  print_dpi: string
  print_bleed_percent: string
  print_safe_percent: string
  max_art_upload_mb: string
  email_provider: string
  email_api_key: string
  email_from_name: string
  email_from_address: string
  merchant_email: string
  [key: string]: string
}

const DEFAULT_FORM: Settings = {
  store_name: '',
  currency: 'INR',
  default_country_code: '+91',
  cod_enabled: 'true',
  razorpay_key_id: '',
  razorpay_key_secret: '',
  flat_shipping_amount: '49',
  free_shipping_over: '999',
  default_print_fee: '99',
  print_dpi: '300',
  print_bleed_percent: '4',
  print_safe_percent: '4',
  max_art_upload_mb: '15',
  email_provider: 'resend',
  email_api_key: '',
  email_from_name: '',
  email_from_address: '',
  merchant_email: '',
}

class SaveError extends Error {
  field?: string
  constructor(message: string, field?: string) {
    super(message)
    this.field = field
  }
}

interface FieldErrorHintProps {
  fieldError: { field?: string; message: string } | null
  field: string
}

function FieldErrorHint({ fieldError, field }: FieldErrorHintProps) {
  if (!fieldError || fieldError.field !== field) return null
  return <p className="text-xs text-red-500 mt-1">{fieldError.message}</p>
}

function errorBorder(fieldError: { field?: string; message: string } | null, field: string) {
  return fieldError?.field === field
    ? 'border-red-400 focus:border-red-500'
    : 'border-gray-300 focus:border-gray-500'
}

export default function AdminSettings() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings', 'admin'],
    queryFn: () => adminFetch('/api/settings/admin').then((r) => r.json()),
  })

  const [form, setForm] = useState<Settings>(DEFAULT_FORM)
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null)

  useEffect(() => {
    if (settings) setForm((prev) => ({ ...prev, ...settings }))
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async (body: Partial<Settings>) => {
      const r = await adminFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json().catch(() => ({})) as { error?: string; field?: string; ok?: boolean }
      if (!r.ok) throw new SaveError(data.error ?? 'Save failed', data.field)
      return data
    },
    onSuccess: () => {
      setFieldError(null)
      qc.invalidateQueries({ queryKey: ['settings', 'admin'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      showToast('Settings saved', 'success')
    },
    onError: (err: SaveError) => {
      setFieldError({ field: err.field, message: err.message })
      showToast(err.message, 'error')
    },
  })

  if (isLoading) return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-7 w-24" />
      {Array.from({ length: 5 }).map((_, i) => (
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
        {/* Store */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Store</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Store Name</label>
              <input
                value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'store_name')}`}
              />
              <FieldErrorHint fieldError={fieldError} field="store_name" />
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

        {/* Payments */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Payments</h2>
          <ToggleField
            label="Cash on Delivery"
            description="Let customers pay on delivery instead of online."
            checked={form.cod_enabled === 'true'}
            onChange={(checked) => setForm({ ...form, cod_enabled: checked ? 'true' : 'false' })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Razorpay Key ID</label>
              <input
                value={form.razorpay_key_id}
                onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none font-mono ${errorBorder(fieldError, 'razorpay_key_id')}`}
              />
              <FieldErrorHint fieldError={fieldError} field="razorpay_key_id" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Razorpay Key Secret</label>
              <input
                type="password"
                value={form.razorpay_key_secret}
                onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none font-mono ${errorBorder(fieldError, 'razorpay_key_secret')}`}
                autoComplete="off"
              />
              <FieldErrorHint fieldError={fieldError} field="razorpay_key_secret" />
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Shipping</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Flat Shipping Amount</label>
              <input
                type="number" min={0} step="0.01"
                value={form.flat_shipping_amount}
                onChange={(e) => setForm({ ...form, flat_shipping_amount: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'flat_shipping_amount')}`}
              />
              <FieldErrorHint fieldError={fieldError} field="flat_shipping_amount" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Free Shipping Over</label>
              <input
                type="number" min={0} step="0.01"
                value={form.free_shipping_over}
                onChange={(e) => setForm({ ...form, free_shipping_over: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'free_shipping_over')}`}
              />
              <p className="text-xs text-gray-400 mt-1">Order subtotal above which shipping is free. 0 = never free.</p>
              <FieldErrorHint fieldError={fieldError} field="free_shipping_over" />
            </div>
          </div>
        </div>

        {/* Printing */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Printing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default Print Fee</label>
              <input
                type="number" min={0} step="0.01"
                value={form.default_print_fee}
                onChange={(e) => setForm({ ...form, default_print_fee: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'default_print_fee')}`}
              />
              <p className="text-xs text-gray-400 mt-1">Pre-fills the per-side fee in the product editor.</p>
              <FieldErrorHint fieldError={fieldError} field="default_print_fee" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Print DPI</label>
              <input
                type="number" min={0} step="1"
                value={form.print_dpi}
                onChange={(e) => setForm({ ...form, print_dpi: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'print_dpi')}`}
              />
              <p className="text-xs text-gray-400 mt-1">Resolution used for the print-ready export.</p>
              <FieldErrorHint fieldError={fieldError} field="print_dpi" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bleed %</label>
              <input
                type="number" min={0} max={25} step="0.5"
                value={form.print_bleed_percent}
                onChange={(e) => setForm({ ...form, print_bleed_percent: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'print_bleed_percent')}`}
              />
              <p className="text-xs text-gray-400 mt-1">How far artwork bleeds outside the print area. 0-25.</p>
              <FieldErrorHint fieldError={fieldError} field="print_bleed_percent" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Safe Area %</label>
              <input
                type="number" min={0} max={25} step="0.5"
                value={form.print_safe_percent}
                onChange={(e) => setForm({ ...form, print_safe_percent: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'print_safe_percent')}`}
              />
              <p className="text-xs text-gray-400 mt-1">Inset kept clear of the print area edge. 0-25.</p>
              <FieldErrorHint fieldError={fieldError} field="print_safe_percent" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Max Art Upload (MB)</label>
              <input
                type="number" min={0} step="1"
                value={form.max_art_upload_mb}
                onChange={(e) => setForm({ ...form, max_art_upload_mb: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'max_art_upload_mb')}`}
              />
              <p className="text-xs text-gray-400 mt-1">Largest file a customer can upload for their design.</p>
              <FieldErrorHint fieldError={fieldError} field="max_art_upload_mb" />
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Email</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Provider"
              value={form.email_provider}
              onChange={(v) => setForm({ ...form, email_provider: v })}
              options={[
                { value: 'resend', label: 'Resend' },
                { value: 'sendgrid', label: 'SendGrid' },
                { value: 'brevo', label: 'Brevo' },
              ]}
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key</label>
              <input
                type="password"
                value={form.email_api_key}
                onChange={(e) => setForm({ ...form, email_api_key: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none font-mono ${errorBorder(fieldError, 'email_api_key')}`}
                autoComplete="off"
              />
              <FieldErrorHint fieldError={fieldError} field="email_api_key" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Name</label>
              <input
                value={form.email_from_name}
                onChange={(e) => setForm({ ...form, email_from_name: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'email_from_name')}`}
              />
              <FieldErrorHint fieldError={fieldError} field="email_from_name" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From Address</label>
              <input
                type="email"
                value={form.email_from_address}
                onChange={(e) => setForm({ ...form, email_from_address: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'email_from_address')}`}
              />
              <FieldErrorHint fieldError={fieldError} field="email_from_address" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Merchant Email</label>
              <input
                type="email"
                value={form.merchant_email}
                onChange={(e) => setForm({ ...form, merchant_email: e.target.value })}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none ${errorBorder(fieldError, 'merchant_email')}`}
              />
              <p className="text-xs text-gray-400 mt-1">Where order and contact notifications are sent.</p>
              <FieldErrorHint fieldError={fieldError} field="merchant_email" />
            </div>
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
        </div>
      </form>
    </div>
  )
}
