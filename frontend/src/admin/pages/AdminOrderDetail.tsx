import { useState, useMemo, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface OrderItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url?: string
}

interface Order {
  id: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  items_json: string
  total_amount: number
  discount_code?: string
  discount_amount?: number
  shipping_amount?: number
  order_status: string
  payment_status: string
  payment_method: string
  shipping_address: string
  tracking_number?: string
  customer_notes?: string
  internal_notes?: string
  created_at: string
  razorpay_order_id?: string
  razorpay_payment_id?: string
}

const ORDER_STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']

const statusColors: Record<string, string> = {
  placed: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-indigo-50 text-indigo-700',
  shipped: 'bg-yellow-50 text-yellow-700',
  delivered: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-green-50 text-green-700',
  refunded: 'bg-orange-50 text-orange-700',
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ label }: { label: string }) {
  const colorClass = statusColors[label] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${colorClass}`}>
      {label}
    </span>
  )
}

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: order, isLoading, isError } = useQuery<Order>({
    queryKey: ['admin-order', id],
    queryFn: () =>
      fetch(`/api/admin/orders/${id}`).then((r) => {
        if (!r.ok) throw new Error('Order not found')
        return r.json()
      }),
    enabled: !!id,
  })

  const [orderStatus, setOrderStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  useEffect(() => {
    if (order) {
      setOrderStatus(order.order_status)
      setTrackingNumber(order.tracking_number ?? '')
      setInternalNotes(order.internal_notes ?? '')
    }
  }, [order])

  const updateMutation = useMutation({
    mutationFn: async (update: Partial<Order>) => {
      const r = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      if (!r.ok) throw new Error('Update failed')
      return r.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-order', id] }),
  })

  const items: OrderItem[] = useMemo(() => {
    try {
      return JSON.parse(order?.items_json ?? '[]')
    } catch {
      return []
    }
  }, [order?.items_json])

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400 py-10 text-center">Loading order...</div>
    )
  }

  if (isError || !order) {
    return (
      <div className="text-sm text-red-500 py-10 text-center">
        Order not found.{' '}
        <Link to="/admin/orders" className="underline text-gray-600">
          Back to orders
        </Link>
      </div>
    )
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const shippingAmount = order.shipping_amount ?? 0
  const discountAmount = order.discount_amount ?? 0

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          to="/admin/orders"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-800 mb-3"
        >
          &larr; Back to Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900 font-mono">
            {order.id}
          </h1>
          <StatusBadge label={order.order_status} />
          <StatusBadge label={order.payment_status} />
          <span className="text-sm text-gray-400 ml-auto">{formatDate(order.created_at)}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer info */}
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Customer</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Name</dt>
                <dd className="text-gray-900 font-medium">{order.customer_name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0">Email</dt>
                <dd className="text-gray-900">{order.customer_email}</dd>
              </div>
              {order.customer_phone && (
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-20 shrink-0">Phone</dt>
                  <dd className="text-gray-900">{order.customer_phone}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Shipping address */}
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Shipping Address</h2>
            <p className="text-sm text-gray-700 whitespace-pre-line">{order.shipping_address}</p>
          </section>

          {/* Payment info */}
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Payment</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 shrink-0">Method</dt>
                <dd className="text-gray-900 capitalize">{order.payment_method}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-400 w-32 shrink-0">Status</dt>
                <dd><StatusBadge label={order.payment_status} /></dd>
              </div>
              {order.razorpay_order_id && (
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-32 shrink-0">Razorpay Order</dt>
                  <dd className="text-gray-700 font-mono text-xs break-all">{order.razorpay_order_id}</dd>
                </div>
              )}
              {order.razorpay_payment_id && (
                <div className="flex gap-2">
                  <dt className="text-gray-400 w-32 shrink-0">Razorpay Payment</dt>
                  <dd className="text-gray-700 font-mono text-xs break-all">{order.razorpay_payment_id}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Notes */}
          {order.customer_notes && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Customer Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-line">{order.customer_notes}</p>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Line items */}
          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-100">
              Items
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Product</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Price</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-8 h-8 object-cover rounded border border-gray-100 shrink-0"
                          />
                        )}
                        <span className="text-gray-800">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      &#8377;{item.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-800">
                      &#8377;{(item.price * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 px-4 py-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>&#8377;{subtotal.toFixed(2)}</span>
              </div>
              {shippingAmount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>&#8377;{shippingAmount.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount{order.discount_code ? ` (${order.discount_code})` : ''}
                  </span>
                  <span>-&#8377;{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-100">
                <span>Total</span>
                <span>&#8377;{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Admin actions */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">Admin Actions</h2>

        {updateMutation.isError && (
          <p className="text-xs text-red-500">Update failed. Please try again.</p>
        )}

        {/* Order status */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600 w-32 shrink-0">Order Status</label>
          <select
            value={orderStatus}
            onChange={(e) => setOrderStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={() => updateMutation.mutate({ order_status: orderStatus })}
            disabled={updateMutation.isPending || orderStatus === order.order_status}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>

        {/* Tracking number */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600 w-32 shrink-0">Tracking Number</label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g. 1Z999AA10123456784"
            className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700 w-64"
          />
          <button
            onClick={() => updateMutation.mutate({ tracking_number: trackingNumber })}
            disabled={updateMutation.isPending || trackingNumber === (order.tracking_number ?? '')}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>

        {/* Internal notes */}
        <div className="flex flex-wrap items-start gap-3">
          <label className="text-sm text-gray-600 w-32 shrink-0 pt-1.5">Internal Notes</label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={3}
            placeholder="Notes visible only to admins..."
            className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700 w-64 resize-y"
          />
          <button
            onClick={() => updateMutation.mutate({ internal_notes: internalNotes })}
            disabled={updateMutation.isPending || internalNotes === (order.internal_notes ?? '')}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed self-start mt-0"
          >
            Save
          </button>
        </div>
      </section>
    </div>
  )
}
