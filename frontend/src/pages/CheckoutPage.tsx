import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCartStore, type ServerQuoteItem } from '../store/cartStore'
import { useAuthStore } from '../store/authStore'
import { loadRazorpay, openRazorpayModal } from '../utils/razorpay'
import { COUNTRY_CODES } from '../utils/countryCodes'
import { currencySymbol } from '../lib/storeConfig'
import Field from '../components/Field'
import Button from '../components/Button'

interface Settings {
  store_name?: string
  currency?: string
  cod_enabled?: string
  default_country_code?: string
  flat_shipping_amount?: string
  free_shipping_over?: string
  [key: string]: string | undefined
}

interface CheckoutResponse {
  order_id: string
  payment_method: string
  razorpay_order_id?: string
  razorpay_key_id?: string
}

interface PriceMismatchResponse {
  error: 'price_mismatch'
  quote: {
    subtotal: number
    print_total: number
    shipping_amount: number
    total_amount: number
    items: ServerQuoteItem[]
  }
}

function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', 'noindex, nofollow')
  return () => el!.setAttribute('content', '')
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const lines = useCartStore((s) => s.lines)
  const subtotal = useCartStore((s) => s.subtotal)
  const clearCart = useCartStore((s) => s.clearCart)
  const reconcilePricing = useCartStore((s) => s.reconcilePricing)
  const token = useAuthStore((s) => s.token)

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    country_code: '+91',
    shipping_address: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: 'India',
  })
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [stockErrors, setStockErrors] = useState<string[]>([])
  const [priceChanged, setPriceChanged] = useState(false)

  const currency = currencySymbol(settings?.currency)
  const codEnabled = settings?.cod_enabled !== 'false'
  const storeName = settings?.store_name ?? 'EdgeShop'
  const cartSubtotal = subtotal()

  // Flat shipping, free above a threshold — POD.md §6.3. There is no
  // /api/shipping/calculate any more (dropped with shipping zones), so
  // this is derived client-side straight from settings.
  const flatShipping = Number(settings?.flat_shipping_amount ?? 49)
  const freeShippingOver = Number(settings?.free_shipping_over ?? 999)
  const shippingAmount = freeShippingOver > 0 && cartSubtotal >= freeShippingOver ? 0 : flatShipping
  const total = cartSubtotal + shippingAmount

  useEffect(() => {
    if (!token) return
    fetch('/api/account/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((profile: { name?: string; email?: string; phone?: string } | null) => {
        if (!profile) return
        setForm((f) => ({
          ...f,
          customer_name: f.customer_name || profile.name || '',
          customer_email: f.customer_email || profile.email || '',
          customer_phone: f.customer_phone || profile.phone || '',
        }))
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (settings?.default_country_code) {
      setForm((f) => ({ ...f, country_code: settings.default_country_code! }))
    }
  }, [settings?.default_country_code])
  useEffect(() => setNoIndex(), [])

  const countryOptions = useMemo(
    () => COUNTRY_CODES.map((c) => ({ value: c.code, label: c.code })),
    []
  )

  if (lines.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-sm text-ink-soft">Your cart is empty.</p>
          <Link to="/shop" className="text-sm text-accent underline underline-offset-2">
            Continue shopping
          </Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStockErrors([])
    setPriceChanged(false)
    setSubmitting(true)

    try {
      const { country_code, ...formFields } = form
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formFields,
          customer_phone: country_code + form.customer_phone,
          payment_method: paymentMethod,
          // POD.md §7.3 — the server re-reads products/sizes/sides/designs
          // and recomputes every price itself; the client sends only what
          // identifies each line, never a price. `total_amount` below is
          // still sent, purely so the server can detect + report a mismatch.
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            size: l.size ?? undefined,
            design_id: l.design_id ?? undefined,
          })),
          total_amount: total,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as
          | { error?: string; items?: Array<{ id: number; name: string; available: number }> }
          | PriceMismatchResponse
        if (data.error === 'stock_error') {
          const msgs = data.items?.length
            ? data.items.map((i) => (i.available === 0 ? `"${i.name}" is out of stock` : `Only ${i.available} left in stock for "${i.name}"`))
            : ['Some items in your cart are no longer available. Please review your cart.']
          setStockErrors(msgs)
          setSubmitting(false)
          return
        }
        if (data.error === 'price_mismatch' && 'quote' in data) {
          // Refresh the quote: pull the server-computed prices onto the
          // cart lines in place, then ask the shopper to review and
          // re-submit — never silently charge the corrected (possibly
          // higher) total without them seeing it.
          reconcilePricing(data.quote.items)
          setPriceChanged(true)
          setError('Prices for one or more items in your cart have changed. Please review your updated total below and place the order again.')
          setSubmitting(false)
          return
        }
        throw new Error(data.error ?? 'Checkout failed')
      }

      const data = (await res.json()) as CheckoutResponse

      if (data.payment_method === 'cod') {
        clearCart()
        navigate('/order-success')
        return
      }

      if (!data.razorpay_order_id || !data.razorpay_key_id) {
        throw new Error('Invalid Razorpay response')
      }

      await loadRazorpay()
      openRazorpayModal({
        key: data.razorpay_key_id,
        amount: Math.round(total * 100),
        currency: 'INR',
        name: storeName,
        order_id: data.razorpay_order_id,
        prefill: {
          name: form.customer_name,
          email: form.customer_email,
          contact: form.country_code + form.customer_phone,
        },
        onSuccess: () => {
          clearCart()
          navigate('/order-success')
        },
        onFailure: () => {
          setError('Payment was cancelled.')
          setSubmitting(false)
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link to="/shop" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-soft transition-colors hover:text-ink">
          ← Back to shop
        </Link>
        <h1 className="mb-6 font-display text-2xl font-semibold text-ink">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order summary */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-display font-semibold text-ink">Order Summary</h2>
            <ul className="space-y-3">
              {lines.map((line) => (
                <li key={line.key} className="flex justify-between text-sm text-ink-soft">
                  <span>
                    {line.name}
                    {line.size ? ` (${line.size})` : ''} × {line.quantity}
                  </span>
                  <span>
                    {currency}
                    {(line.unit_price * line.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm text-ink-soft">
              <span>Shipping</span>
              <span>{shippingAmount === 0 ? 'Free' : `${currency}${shippingAmount.toFixed(2)}`}</span>
            </div>
            <div className="mt-2 flex justify-between font-semibold text-ink">
              <span>Total</span>
              <span>
                {currency}
                {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Shipping details */}
          <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
            <h2 className="font-display font-semibold text-ink">Shipping Details</h2>
            <Field
              label="Full name"
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                type="email"
                required
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
              />
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-soft">
                  Phone<span className="ml-0.5 text-danger">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.country_code}
                    onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                    className="h-11 w-24 shrink-0 rounded-lg border border-line bg-surface px-2 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {countryOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="tel"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="98765 43210"
                    className="h-11 flex-1 rounded-lg border border-line bg-surface px-3.5 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>
              </div>
            </div>
            <Field
              label="Address line"
              required
              placeholder="House / Flat no., Street, Locality"
              value={form.shipping_address}
              onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="City"
                required
                value={form.shipping_city}
                onChange={(e) => setForm({ ...form, shipping_city: e.target.value })}
              />
              <Field
                label="State"
                required
                value={form.shipping_state}
                onChange={(e) => setForm({ ...form, shipping_state: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Pincode"
                required
                placeholder="e.g. 400001"
                value={form.shipping_pincode}
                onChange={(e) => setForm({ ...form, shipping_pincode: e.target.value })}
              />
              <Field
                label="Country"
                placeholder="India"
                value={form.shipping_country}
                onChange={(e) => setForm({ ...form, shipping_country: e.target.value })}
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-display font-semibold text-ink">Payment Method</h2>
            <div className="space-y-2">
              {codEnabled && (
                <label
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                    paymentMethod === 'cod' ? 'border-ink' : 'border-line'
                  }`}
                >
                  <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="sr-only" />
                  <span className="text-lg">💵</span>
                  <span className="text-sm font-medium text-ink">Cash on Delivery</span>
                  <span className="ml-auto text-xs text-ink-soft">Pay on arrival</span>
                </label>
              )}
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors ${
                  paymentMethod === 'razorpay' ? 'border-ink' : 'border-line'
                }`}
              >
                <input type="radio" name="payment" value="razorpay" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} className="sr-only" />
                <span className="text-lg">💳</span>
                <span className="text-sm font-medium text-ink">Razorpay</span>
                <span className="ml-auto text-xs text-ink-soft">Cards, UPI, Netbanking</span>
              </label>
            </div>
          </div>

          {stockErrors.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3">
              <p className="mb-1 text-sm font-medium text-danger">Cannot place order — stock issues:</p>
              <ul className="list-inside list-disc space-y-0.5 text-sm text-danger">
                {stockErrors.map((msg, i) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className={`rounded-lg px-4 py-3 text-sm ${priceChanged ? 'border border-amber-300 bg-amber-50 text-amber-800' : 'bg-danger/5 text-danger'}`}>
              {error}
            </p>
          )}

          <Button type="submit" variant="accent" size="lg" fullWidth disabled={submitting}>
            {submitting
              ? 'Processing…'
              : priceChanged
                ? `Place Order at Updated Total — ${currency}${total.toFixed(2)}`
                : `Place Order — ${currency}${total.toFixed(2)}`}
          </Button>
        </form>
      </div>
    </div>
  )
}
