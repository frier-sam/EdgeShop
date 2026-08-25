import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import { COUNTRY_CODES } from '../../utils/countryCodes'
import { Skeleton } from '../../components/Skeleton'
import ToggleField from '../../components/ToggleField'
import SelectField from '../../components/SelectField'
import Field from '../../components/Field'
import Button from '../../components/Button'

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
  design_retention_days: string
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
  design_retention_days: '30',
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

type FieldError = { field?: string; message: string } | null

function fieldErrorFor(fieldError: FieldError, field: string): string | undefined {
  return fieldError?.field === field ? fieldError.message : undefined
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display font-semibold text-ink">{title}</h2>
      {children}
    </div>
  )
}

export default function AdminSettings() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['settings', 'admin'],
    queryFn: () => adminFetch('/api/settings/admin').then((r) => r.json()),
  })

  const [form, setForm] = useState<Settings>(DEFAULT_FORM)
  const [fieldError, setFieldError] = useState<FieldError>(null)

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
        <div key={i} className="space-y-3 rounded-card border border-line bg-surface p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Settings</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(form) }}
        className="space-y-6"
      >
        {/* Store */}
        <Section title="Store">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Store name"
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              error={fieldErrorFor(fieldError, 'store_name')}
            />
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
          <Field
            label="Default country (phone dial code)"
            as="select"
            value={form.default_country_code}
            onChange={(e) => setForm({ ...form, default_country_code: e.target.value })}
            hint="Pre-selected dial code on the checkout phone field."
            options={COUNTRY_CODES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
          />
        </Section>

        {/* Payments */}
        <Section title="Payments">
          <ToggleField
            label="Cash on Delivery"
            description="Let customers pay on delivery instead of online."
            checked={form.cod_enabled === 'true'}
            onChange={(checked) => setForm({ ...form, cod_enabled: checked ? 'true' : 'false' })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Razorpay key ID"
              value={form.razorpay_key_id}
              onChange={(e) => setForm({ ...form, razorpay_key_id: e.target.value })}
              error={fieldErrorFor(fieldError, 'razorpay_key_id')}
            />
            <Field
              label="Razorpay key secret"
              type="password"
              autoComplete="off"
              value={form.razorpay_key_secret}
              onChange={(e) => setForm({ ...form, razorpay_key_secret: e.target.value })}
              error={fieldErrorFor(fieldError, 'razorpay_key_secret')}
            />
          </div>
        </Section>

        {/* Shipping */}
        <Section title="Shipping">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Flat shipping amount"
              type="number" min={0} step="0.01"
              value={form.flat_shipping_amount}
              onChange={(e) => setForm({ ...form, flat_shipping_amount: e.target.value })}
              error={fieldErrorFor(fieldError, 'flat_shipping_amount')}
            />
            <Field
              label="Free shipping over"
              type="number" min={0} step="0.01"
              value={form.free_shipping_over}
              onChange={(e) => setForm({ ...form, free_shipping_over: e.target.value })}
              hint="Order subtotal above which shipping is free. 0 = never free."
              error={fieldErrorFor(fieldError, 'free_shipping_over')}
            />
          </div>
        </Section>

        {/* Printing */}
        <Section title="Printing">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Default print fee"
              type="number" min={0} step="0.01"
              value={form.default_print_fee}
              onChange={(e) => setForm({ ...form, default_print_fee: e.target.value })}
              hint="Pre-fills the per-side fee in the product editor."
              error={fieldErrorFor(fieldError, 'default_print_fee')}
            />
            <Field
              label="Print DPI"
              type="number" min={0} step="1"
              value={form.print_dpi}
              onChange={(e) => setForm({ ...form, print_dpi: e.target.value })}
              hint="Resolution used for the print-ready export."
              error={fieldErrorFor(fieldError, 'print_dpi')}
            />
            <Field
              label="Bleed %"
              type="number" min={0} max={25} step="0.5"
              value={form.print_bleed_percent}
              onChange={(e) => setForm({ ...form, print_bleed_percent: e.target.value })}
              hint="How far artwork bleeds outside the print area. 0-25."
              error={fieldErrorFor(fieldError, 'print_bleed_percent')}
            />
            <Field
              label="Safe area %"
              type="number" min={0} max={25} step="0.5"
              value={form.print_safe_percent}
              onChange={(e) => setForm({ ...form, print_safe_percent: e.target.value })}
              hint="Inset kept clear of the print area edge. 0-25."
              error={fieldErrorFor(fieldError, 'print_safe_percent')}
            />
            <Field
              label="Max art upload (MB)"
              type="number" min={0} step="1"
              value={form.max_art_upload_mb}
              onChange={(e) => setForm({ ...form, max_art_upload_mb: e.target.value })}
              hint="Largest file a customer can upload for their design."
              error={fieldErrorFor(fieldError, 'max_art_upload_mb')}
            />
            <Field
              label="Design retention (days)"
              type="number" min={1} step="1"
              value={form.design_retention_days}
              onChange={(e) => setForm({ ...form, design_retention_days: e.target.value })}
              hint="A daily cleanup job deletes abandoned designs (never added to a paid order) and their preview images once they're older than this. Designs linked to an order are never deleted."
              error={fieldErrorFor(fieldError, 'design_retention_days')}
            />
          </div>
        </Section>

        {/* Email */}
        <Section title="Email">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Field
              label="API key"
              type="password"
              autoComplete="off"
              value={form.email_api_key}
              onChange={(e) => setForm({ ...form, email_api_key: e.target.value })}
              error={fieldErrorFor(fieldError, 'email_api_key')}
            />
            <Field
              label="From name"
              value={form.email_from_name}
              onChange={(e) => setForm({ ...form, email_from_name: e.target.value })}
              error={fieldErrorFor(fieldError, 'email_from_name')}
            />
            <Field
              label="From address"
              type="email"
              value={form.email_from_address}
              onChange={(e) => setForm({ ...form, email_from_address: e.target.value })}
              error={fieldErrorFor(fieldError, 'email_from_address')}
            />
            <Field
              label="Merchant email"
              type="email"
              value={form.merchant_email}
              onChange={(e) => setForm({ ...form, merchant_email: e.target.value })}
              hint="Where order and contact notifications are sent."
              error={fieldErrorFor(fieldError, 'merchant_email')}
            />
          </div>
        </Section>

        <div className="flex items-center gap-4">
          <Button type="submit" variant="primary" loading={saveMutation.isPending}>
            Save settings
          </Button>
        </div>
      </form>
    </div>
  )
}
