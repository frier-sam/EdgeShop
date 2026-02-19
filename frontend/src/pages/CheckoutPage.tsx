import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useCartStore } from '../store/cartStore'
import { loadRazorpay, openRazorpayModal } from '../utils/razorpay'

interface Settings {
  store_name?: string
  currency?: string
  cod_enabled?: string
  [key: string]: string | undefined
}

interface CheckoutResponse {
  order_id: string
  payment_method: string
  razorpay_order_id?: string
  razorpay_key_id?: string
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const totalAmount = useCartStore((s) => s.totalAmount)
  const clearCart = useCartStore((s) => s.clearCart)

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    shipping_address: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('cod')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [discountCode, setDiscountCode] = useState('')
  const [discountResult, setDiscountResult] = useState<{
    discount_amount: number; type: string; code: string
  } | null>(null)
  const [discountError, setDiscountError] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)

  const currency = settings?.currency === 'INR' ? '₹' : (settings?.currency ?? '₹')
  const codEnabled = settings?.cod_enabled !== 'false'
  const storeName = settings?.store_name ?? 'EdgeShop'
  const cartTotal = totalAmount()
  const total = cartTotal - (discountResult?.discount_amount ?? 0)

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Your cart is empty.</p>
          <Link to="/" className="text-sm underline">Continue shopping</Link>
        </div>
      </div>
    )
  }

  async function applyDiscount() {
    if (!discountCode.trim()) return
    setApplyingDiscount(true)
    try {
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim(), cart_total: cartTotal }),
      })
      if (res.ok) {
        setDiscountResult(await res.json())
        setDiscountError('')
      } else {
        const err = await res.json()
        setDiscountError(err.error)
      }
    } catch {
      setDiscountError('Failed to apply discount. Please try again.')
    } finally {
      setApplyingDiscount(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          payment_method: paymentMethod,
          items,
          total_amount: total,
          discount_code: discountResult?.code ?? '',
          discount_amount: discountResult?.discount_amount ?? 0,
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Checkout failed')
      }

      const data = await res.json() as CheckoutResponse

      if (data.payment_method === 'cod') {
        clearCart()
        navigate('/order-success')
        return
      }

      // Razorpay flow
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
          contact: form.customer_phone,
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-flex items-center gap-1">
          ← Back to shop
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Checkout</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-4">Order Summary</h2>
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.product_id} className="flex justify-between text-sm text-gray-600">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{currency}{(item.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            {discountResult && (
              <div className="flex justify-between text-sm text-green-700 mt-3">
                <span>Discount ({discountResult.code})</span>
                <span>-{currency}{discountResult.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 mt-4 pt-3 flex justify-between font-semibold text-gray-900">
              <span>Total</span>
              <span>{currency}{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Shipping details */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-800">Shipping Details</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name *</label>
              <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email *</label>
                <input required type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input type="tel" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Shipping Address *</label>
              <textarea required rows={3} value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            </div>
          </div>

          {/* Discount code */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-4">Discount Code</h2>
            {discountResult ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700 font-medium">
                  {discountResult.code} applied — {currency}{discountResult.discount_amount.toFixed(2)} off
                </span>
                <button
                  type="button"
                  onClick={() => { setDiscountResult(null); setDiscountCode('') }}
                  className="text-xs text-gray-500 hover:text-gray-800 underline ml-4"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => { setDiscountCode(e.target.value); setDiscountError('') }}
                  placeholder="Enter discount code"
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
                <button
                  type="button"
                  onClick={applyDiscount}
                  disabled={applyingDiscount}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {applyingDiscount ? 'Applying...' : 'Apply'}
                </button>
              </div>
            )}
            {discountError && (
              <p className="text-xs text-red-500 mt-2">{discountError}</p>
            )}
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-medium text-gray-800 mb-4">Payment Method</h2>
            <div className="space-y-2">
              {codEnabled && (
                <label className={`flex items-center gap-3 p-3 border-2 rounded cursor-pointer ${paymentMethod === 'cod' ? 'border-gray-900' : 'border-gray-200'}`}>
                  <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="sr-only" />
                  <span className="text-sm font-medium text-gray-800">Cash on Delivery</span>
                  <span className="text-xs text-gray-400">Pay when your order arrives</span>
                </label>
              )}
              <label className={`flex items-center gap-3 p-3 border-2 rounded cursor-pointer ${paymentMethod === 'razorpay' ? 'border-gray-900' : 'border-gray-200'}`}>
                <input type="radio" name="payment" value="razorpay" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} className="sr-only" />
                <span className="text-sm font-medium text-gray-800">Razorpay</span>
                <span className="text-xs text-gray-400">Cards, UPI, Netbanking</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full py-3 bg-gray-900 text-white font-medium rounded hover:bg-gray-700 disabled:opacity-50 transition-colors">
            {submitting ? 'Processing...' : `Place Order — ${currency}${total.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
