import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'

interface OrderItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url?: string
}

interface EmailLog {
  id: number
  type: string
  recipient: string
  subject: string
  status: 'sent' | 'failed'
  sent_at: number  // unix seconds
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
  shipping_city?: string
  shipping_state?: string
  shipping_pincode?: string
  shipping_country?: string
  tracking_number?: string
  customer_notes?: string
  internal_notes?: string
  created_at: string
  razorpay_order_id?: string
  razorpay_payment_id?: string
  emails?: EmailLog[]
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
      adminFetch(`/api/admin/orders/${id}`).then((r) => {
        if (!r.ok) throw new Error('Order not found')
        return r.json()
      }),
    enabled: !!id,
  })

  const [orderStatus, setOrderStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingPincode, setShippingPincode] = useState('')
  const [shippingCountry, setShippingCountry] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [editingShipping, setEditingShipping] = useState(false)
  const [editingPayment, setEditingPayment] = useState(false)
  const [editingAdminActions, setEditingAdminActions] = useState(false)

  const seeded = useRef(false)

  useEffect(() => {
    if (order && !seeded.current) {
      seeded.current = true
      setOrderStatus(order.order_status)
      setPaymentStatus(order.payment_status)
      setTrackingNumber(order.tracking_number ?? '')
      setPrivateNote(order.internal_notes ?? '')
      setCustomerName(order.customer_name)
      setShippingAddress(order.shipping_address)
      setShippingCity(order.shipping_city ?? '')
      setShippingState(order.shipping_state ?? '')
      setShippingPincode(order.shipping_pincode ?? '')
      setShippingCountry(order.shipping_country ?? 'India')
    }
  }, [order])

  const refundMutation = useMutation({
    mutationFn: async (payload: { notes: string }) => {
      const r = await adminFetch(`/api/admin/orders/${id}/refund`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('Refund failed')
      return r.json()
    },
    onSuccess: () => {
      qc.setQueryData(['admin-order', id], (old: Order | undefined) =>
        old ? { ...old, payment_status: 'refunded' } : old
      )
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (update: Partial<Order>) => {
      const r = await adminFetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      if (!r.ok) throw new Error('Update failed')
      return r.json()
    },
    onSuccess: (_, variables) => {
      qc.setQueryData(['admin-order', id], (old: Order | undefined) =>
        old ? { ...old, ...variables } : old
      )
    },
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Customer</h2>
              {!editingCustomer && (
                <button
                  onClick={() => setEditingCustomer(true)}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name</label>
                {editingCustomer ? (
                  <input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
                  />
                ) : (
                  <p className="text-sm text-gray-800">{order.customer_name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <p className="text-sm text-gray-800">{order.customer_email}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <p className="text-sm text-gray-800">{order.customer_phone ?? '—'}</p>
              </div>
            </div>
            {editingCustomer && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    updateMutation.mutate(
                      { customer_name: customerName },
                      { onSuccess: () => setEditingCustomer(false) }
                    )
                  }}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </section>

          {/* Shipping address */}
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Shipping Address</h2>
              {!editingShipping && (
                <button
                  onClick={() => setEditingShipping(true)}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Edit
                </button>
              )}
            </div>
            {editingShipping ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Address Line</label>
                  <input
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">City</label>
                    <input
                      value={shippingCity}
                      onChange={e => setShippingCity(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">State</label>
                    <input
                      value={shippingState}
                      onChange={e => setShippingState(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Pincode</label>
                    <input
                      value={shippingPincode}
                      onChange={e => setShippingPincode(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Country</label>
                    <input
                      value={shippingCountry}
                      onChange={e => setShippingCountry(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-800 space-y-0.5">
                <p>{order.shipping_address}</p>
                <p>
                  {[order.shipping_city, order.shipping_state, order.shipping_pincode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p>{order.shipping_country}</p>
              </div>
            )}
            {editingShipping && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    updateMutation.mutate(
                      {
                        shipping_address: shippingAddress,
                        shipping_city: shippingCity,
                        shipping_state: shippingState,
                        shipping_pincode: shippingPincode,
                        shipping_country: shippingCountry,
                      },
                      { onSuccess: () => setEditingShipping(false) }
                    )
                  }}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </section>

          {/* Payment info */}
          <section className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Payment</h2>
              {!editingPayment && (
                <button
                  onClick={() => setEditingPayment(true)}
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Edit
                </button>
              )}
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2 items-center">
                <dt className="text-gray-400 w-32 shrink-0">Method</dt>
                <dd className="text-gray-900 capitalize">{order.payment_method}</dd>
              </div>
              <div className="flex gap-2 items-center">
                <dt className="text-gray-400 w-32 shrink-0">Status</dt>
                <dd>
                  {editingPayment ? (
                    <select
                      value={paymentStatus}
                      onChange={e => setPaymentStatus(e.target.value)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:border-gray-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  ) : (
                    <StatusBadge label={order.payment_status} />
                  )}
                </dd>
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
            {editingPayment && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => {
                    updateMutation.mutate(
                      { payment_status: paymentStatus },
                      { onSuccess: () => setEditingPayment(false) }
                    )
                  }}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
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

      {/* Timeline + Private Notes */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Timeline</h2>

        {/* Private note input */}
        <div className="mb-5">
          <textarea
            value={privateNote}
            onChange={e => setPrivateNote(e.target.value)}
            rows={2}
            placeholder="Add a private note (only visible to admins)…"
            className="w-full text-sm border border-gray-300 rounded px-3 py-2 text-gray-700 resize-none focus:outline-none focus:border-gray-500"
          />
          <button
            onClick={() => updateMutation.mutate({ internal_notes: privateNote })}
            disabled={updateMutation.isPending || privateNote === (order.internal_notes ?? '')}
            className="mt-1.5 px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save note
          </button>
        </div>

        {/* Timeline events */}
        <div className="relative pl-5 space-y-4">
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200" />

          {/* Order placed */}
          <div className="relative">
            <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />
            <p className="text-xs font-medium text-gray-700">Order placed</p>
            <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
          </div>

          {/* Payment */}
          {order.payment_status === 'paid' && (
            <div className="relative">
              <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
              <p className="text-xs font-medium text-gray-700">Payment received</p>
              <p className="text-xs text-gray-400 capitalize">{order.payment_method}</p>
            </div>
          )}

          {/* Tracking set */}
          {order.tracking_number && (
            <div className="relative">
              <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-yellow-400 border-2 border-white" />
              <p className="text-xs font-medium text-gray-700">Shipped</p>
              <p className="text-xs text-gray-400">Tracking: {order.tracking_number}</p>
            </div>
          )}

          {/* Refunded */}
          {order.payment_status === 'refunded' && (
            <div className="relative">
              <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-white" />
              <p className="text-xs font-medium text-gray-700">Refunded</p>
            </div>
          )}

          {/* Emails */}
          {(order.emails ?? []).map(email => (
            <div key={email.id} className="relative">
              <div className={`absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full border-2 border-white ${email.status === 'failed' ? 'bg-red-400' : 'bg-blue-400'}`} />
              <p className="text-xs font-medium text-gray-700 capitalize">
                {email.type.replace(/_/g, ' ')}
                {email.status === 'failed' && <span className="ml-1 text-red-500">(failed)</span>}
              </p>
              <p className="text-xs text-gray-400">
                To: {email.recipient} · {new Date(email.sent_at * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}

          {/* Private note */}
          {order.internal_notes && (
            <div className="relative">
              <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-purple-400 border-2 border-white" />
              <p className="text-xs font-medium text-gray-700">Private note</p>
              <p className="text-xs text-gray-500 whitespace-pre-line mt-0.5">{order.internal_notes}</p>
            </div>
          )}
        </div>
      </section>

      {/* Admin actions */}
      <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Admin Actions</h2>
          {!editingAdminActions && (
            <button
              onClick={() => setEditingAdminActions(true)}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Edit
            </button>
          )}
        </div>

        {updateMutation.isError && (
          <p className="text-xs text-red-500">Update failed. Please try again.</p>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-32 shrink-0">Order Status</label>
            {editingAdminActions ? (
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <StatusBadge label={order.order_status} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-32 shrink-0">Tracking Number</label>
            {editingAdminActions ? (
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700 w-64"
              />
            ) : (
              <span className="text-sm text-gray-800">{order.tracking_number ?? '—'}</span>
            )}
          </div>
        </div>

        {editingAdminActions && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                updateMutation.mutate(
                  {
                    order_status: orderStatus,
                    tracking_number: trackingNumber,
                  },
                  { onSuccess: () => setEditingAdminActions(false) }
                )
              }}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {/* Refund — destructive action, stays separate */}
        {order.payment_status !== 'refunded' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <label className="text-sm text-gray-600 w-32 shrink-0">Refund</label>
            <button
              onClick={() => {
                if (window.confirm('Mark this order as refunded? This cannot be undone.')) {
                  refundMutation.mutate({ notes: privateNote })
                }
              }}
              disabled={refundMutation.isPending}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refundMutation.isPending ? 'Refunding...' : 'Mark as Refunded'}
            </button>
            {refundMutation.isError && (
              <p className="text-xs text-red-500">Refund failed. Please try again.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
