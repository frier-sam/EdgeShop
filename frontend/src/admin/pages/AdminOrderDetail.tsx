import { useState, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { fetchJsonWith } from '../../lib/api'
import { useEditorSettings } from '../../editor/useEditorSettings'
import OrderDesignPanel from '../OrderDesignPanel'
import { collectRenderableSides, renderOrderSide } from '../print/orderPrintFiles'
import { downloadAllPrintFiles } from '../print/downloadPrintFiles'
import type { AdminOrderLineItem } from '../types'
import Button from '../../components/Button'
import Badge, { type BadgeVariant } from '../../components/ui/Badge'

interface EmailLog {
  id: number
  type: string
  recipient: string
  subject: string
  status: 'sent' | 'failed'
  sent_at: number  // unix seconds
}

interface OrderEvent {
  id: number
  event_type: string
  data_json: string
  created_at: string
}

interface Order {
  id: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  items: AdminOrderLineItem[]
  subtotal: number
  print_total: number
  shipping_amount: number
  total_amount: number
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
  events?: OrderEvent[]
}

const ORDER_STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']

const statusVariant: Record<string, BadgeVariant> = {
  placed: 'accent',
  confirmed: 'accent',
  shipped: 'warning',
  delivered: 'success',
  cancelled: 'danger',
  pending: 'neutral',
  paid: 'success',
  refunded: 'warning',
}

const INPUT_CLASSES =
  'w-full rounded-btn border border-line bg-surface px-2.5 py-1.5 text-sm text-ink transition-colors duration-fast ' +
  'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/30'

const TIMELINE_DOT: Record<string, string> = {
  neutral: 'bg-ink-faint',
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  note: 'bg-accent-dark',
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
  return (
    <Badge variant={statusVariant[label] ?? 'neutral'} className="capitalize">
      {label}
    </Badge>
  )
}

function EditToggle({ editing, onEdit }: { editing: boolean; onEdit: () => void }) {
  if (editing) return null
  return (
    <button
      onClick={onEdit}
      className="text-xs font-medium text-accent underline-offset-2 transition-colors duration-fast hover:text-accent-dark hover:underline"
    >
      Edit
    </button>
  )
}

function TimelineDot({ tone }: { tone: keyof typeof TIMELINE_DOT }) {
  return <div className={`absolute -left-3.5 mt-0.5 h-3 w-3 rounded-full border-2 border-surface ${TIMELINE_DOT[tone]}`} />
}

export default function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: order, isLoading, isError } = useQuery<Order>({
    queryKey: ['admin-order', id],
    queryFn: () => fetchJsonWith<Order>(adminFetch, `/api/admin/orders/${id}`),
    enabled: !!id,
  })

  const { settings } = useEditorSettings()

  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadAllError, setDownloadAllError] = useState<string | null>(null)

  async function handleDownloadAll() {
    if (!order) return
    const renderable = collectRenderableSides(order.items ?? [])
    if (renderable.length === 0) return
    setDownloadAllError(null)
    setDownloadingAll(true)
    try {
      const files = []
      for (const r of renderable) {
        const result = await renderOrderSide(order.id, r, settings.printDpi)
        files.push({ filename: result.filename, blob: result.blob })
      }
      await downloadAllPrintFiles(order.id, files)
    } catch {
      setDownloadAllError('Could not render all print files. Please try again.')
    } finally {
      setDownloadingAll(false)
    }
  }

  const [orderStatus, setOrderStatus] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
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
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
    },
  })

  const [noteText, setNoteText] = useState('')

  const noteMutation = useMutation({
    mutationFn: async (text: string) => {
      const r = await adminFetch(`/api/admin/orders/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!r.ok) throw new Error('Failed to save note')
      return r.json()
    },
    onSuccess: () => {
      setNoteText('')
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
    },
  })

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm text-ink-faint">Loading order…</div>
    )
  }

  if (isError || !order) {
    return (
      <div className="py-10 text-center text-sm text-danger">
        Order not found.{' '}
        <Link to="/admin/orders" className="text-ink-soft underline">
          Back to orders
        </Link>
      </div>
    )
  }

  const items = order.items ?? []
  const renderableSideCount = collectRenderableSides(items).length

  return (
    <div className="mx-auto max-w-5xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link
          to="/admin/orders"
          className="mb-3 inline-flex items-center text-sm text-ink-soft transition-colors duration-fast hover:text-ink"
        >
          &larr; Back to Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono font-display text-lg font-bold text-ink sm:text-xl">
            {order.id}
          </h1>
          <StatusBadge label={order.order_status} />
          <StatusBadge label={order.payment_status} />
          <span className="ml-auto text-sm text-ink-faint">{formatDate(order.created_at)}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer info */}
          <section className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Customer</h2>
              <EditToggle editing={editingCustomer} onEdit={() => setEditingCustomer(true)} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-ink-faint">Name</label>
                {editingCustomer ? (
                  <input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className={INPUT_CLASSES}
                  />
                ) : (
                  <p className="text-sm text-ink">{order.customer_name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-faint">Email</label>
                <p className="text-sm text-ink">{order.customer_email}</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-faint">Phone</label>
                <p className="text-sm text-ink">{order.customer_phone ?? '—'}</p>
              </div>
            </div>
            {editingCustomer && (
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  loading={updateMutation.isPending}
                  onClick={() => {
                    updateMutation.mutate(
                      { customer_name: customerName },
                      { onSuccess: () => setEditingCustomer(false) }
                    )
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </section>

          {/* Shipping address */}
          <section className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Shipping Address</h2>
              <EditToggle editing={editingShipping} onEdit={() => setEditingShipping(true)} />
            </div>
            {editingShipping ? (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs text-ink-faint">Address Line</label>
                  <input
                    value={shippingAddress}
                    onChange={e => setShippingAddress(e.target.value)}
                    className={INPUT_CLASSES}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-ink-faint">City</label>
                    <input
                      value={shippingCity}
                      onChange={e => setShippingCity(e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-faint">State</label>
                    <input
                      value={shippingState}
                      onChange={e => setShippingState(e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-ink-faint">Pincode</label>
                    <input
                      value={shippingPincode}
                      onChange={e => setShippingPincode(e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-faint">Country</label>
                    <input
                      value={shippingCountry}
                      onChange={e => setShippingCountry(e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5 text-sm text-ink">
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
                <Button
                  size="sm"
                  loading={updateMutation.isPending}
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
                >
                  Save
                </Button>
              </div>
            )}
          </section>

          {/* Payment info */}
          <section className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Payment</h2>
              <EditToggle editing={editingPayment} onEdit={() => setEditingPayment(true)} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <dt className="w-32 shrink-0 text-ink-faint">Method</dt>
                <dd className="capitalize text-ink">{order.payment_method}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="w-32 shrink-0 text-ink-faint">Status</dt>
                <dd>
                  {editingPayment ? (
                    <select
                      value={paymentStatus}
                      onChange={e => setPaymentStatus(e.target.value)}
                      className={`${INPUT_CLASSES} w-auto cursor-pointer`}
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
                  <dt className="w-32 shrink-0 text-ink-faint">Razorpay Order</dt>
                  <dd className="break-all font-mono text-xs text-ink-soft">{order.razorpay_order_id}</dd>
                </div>
              )}
              {order.razorpay_payment_id && (
                <div className="flex gap-2">
                  <dt className="w-32 shrink-0 text-ink-faint">Razorpay Payment</dt>
                  <dd className="break-all font-mono text-xs text-ink-soft">{order.razorpay_payment_id}</dd>
                </div>
              )}
            </dl>
            {editingPayment && (
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  loading={updateMutation.isPending}
                  onClick={() => {
                    updateMutation.mutate(
                      { payment_status: paymentStatus },
                      { onSuccess: () => setEditingPayment(false) }
                    )
                  }}
                >
                  Save
                </Button>
              </div>
            )}
          </section>

          {/* Notes */}
          {order.customer_notes && (
            <section className="rounded-card border border-line bg-surface p-4 shadow-card">
              <h2 className="mb-2 text-sm font-semibold text-ink">Customer Notes</h2>
              <p className="whitespace-pre-line text-sm text-ink-soft">{order.customer_notes}</p>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Order totals — POD.md §7.1/§6.1: subtotal/print_total/shipping_amount
              are stored directly on the order row, not re-derived from items. */}
          <section className="rounded-card border border-line bg-surface p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-ink">Order Total</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-soft">
                <span>Subtotal</span>
                <span>&#8377;{order.subtotal.toFixed(2)}</span>
              </div>
              {order.print_total > 0 && (
                <div className="flex justify-between text-ink-soft">
                  <span>Print fees (included above)</span>
                  <span>&#8377;{order.print_total.toFixed(2)}</span>
                </div>
              )}
              {order.shipping_amount > 0 && (
                <div className="flex justify-between text-ink-soft">
                  <span>Shipping</span>
                  <span>&#8377;{order.shipping_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-1 font-semibold text-ink">
                <span>Total</span>
                <span>&#8377;{order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Design files — POD.md §4.2/§8.3: per-line size/qty/price, per-side
          flattened preview + print dimensions/effective-DPI readout, and a
          Download print file button per side, plus a whole-order zip. */}
      <section className="mb-6 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Items &amp; Design Files</h2>
          {renderableSideCount > 0 && (
            <Button size="sm" loading={downloadingAll} onClick={handleDownloadAll}>
              Download all print files ({renderableSideCount})
            </Button>
          )}
        </div>
        {downloadAllError && (
          <p className="px-4 pt-3 text-xs text-danger">{downloadAllError}</p>
        )}
        <div className="divide-y divide-line">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">No items on this order.</p>
          )}
          {items.map((item, idx) => (
            <OrderDesignPanel key={idx} orderId={order.id} lineIndex={idx} item={item} printDpi={settings.printDpi} />
          ))}
        </div>
      </section>

      {/* Timeline + Private Notes */}
      <section className="mb-6 rounded-card border border-line bg-surface p-4 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-ink">Timeline</h2>

        {/* Append note */}
        <div className="mb-5">
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={2}
            placeholder="Add a private note (only visible to admins)…"
            className={`${INPUT_CLASSES} resize-none`}
          />
          <Button
            size="sm"
            className="mt-1.5"
            disabled={!noteText.trim()}
            loading={noteMutation.isPending}
            onClick={() => {
              if (noteText.trim()) noteMutation.mutate(noteText.trim())
            }}
          >
            Add note
          </Button>
        </div>

        {/* Timeline events */}
        <div className="relative space-y-4 pl-5">
          <div className="absolute bottom-2 left-1.5 top-2 w-px bg-line" />

          {/* Order placed — always first */}
          <div className="relative">
            <TimelineDot tone="neutral" />
            <p className="text-xs font-medium text-ink">Order placed</p>
            <p className="text-xs text-ink-faint">{formatDate(order.created_at)}</p>
          </div>

          {/* Legacy: payment received (no event = webhook payment, no timestamp) */}
          {order.payment_status === 'paid' && !(order.events ?? []).some(e => e.event_type === 'payment_change') && (
            <div className="relative">
              <TimelineDot tone="success" />
              <p className="text-xs font-medium text-ink">Payment received</p>
              <p className="text-xs capitalize text-ink-faint">{order.payment_method}</p>
            </div>
          )}

          {/* Legacy: tracking set (no event = set before events table existed) */}
          {order.tracking_number && !(order.events ?? []).some(e => e.event_type === 'tracking_set') && (
            <div className="relative">
              <TimelineDot tone="warning" />
              <p className="text-xs font-medium text-ink">Shipped</p>
              <p className="text-xs text-ink-faint">Tracking: {order.tracking_number}</p>
            </div>
          )}

          {/* Legacy: refunded (no event) */}
          {order.payment_status === 'refunded' && !(order.events ?? []).some(e => e.event_type === 'refund') && (
            <div className="relative">
              <TimelineDot tone="warning" />
              <p className="text-xs font-medium text-ink">Refunded</p>
            </div>
          )}

          {/* Legacy: internal_notes text (old orders before events table) */}
          {order.internal_notes && (order.events ?? []).length === 0 && (
            <div className="relative">
              <TimelineDot tone="note" />
              <p className="text-xs font-medium text-ink">Private note</p>
              <p className="mt-0.5 whitespace-pre-line text-xs text-ink-soft">{order.internal_notes}</p>
            </div>
          )}

          {/* order_events entries — sorted by created_at (already ordered by backend) */}
          {(order.events ?? []).map(event => {
            let data: Record<string, string> = {}
            try { data = JSON.parse(event.data_json) } catch {}

            if (event.event_type === 'status_change') return (
              <div key={event.id} className="relative">
                <TimelineDot tone="info" />
                <p className="text-xs font-medium capitalize text-ink">Status → {data.to}</p>
                <p className="text-xs text-ink-faint">{formatDate(event.created_at)}</p>
              </div>
            )
            if (event.event_type === 'tracking_set') return (
              <div key={event.id} className="relative">
                <TimelineDot tone="warning" />
                <p className="text-xs font-medium text-ink">Shipped</p>
                <p className="text-xs text-ink-faint">Tracking: {data.tracking_number} · {formatDate(event.created_at)}</p>
              </div>
            )
            if (event.event_type === 'payment_change') return (
              <div key={event.id} className="relative">
                <TimelineDot tone="success" />
                <p className="text-xs font-medium capitalize text-ink">Payment {data.to}</p>
                <p className="text-xs text-ink-faint">{formatDate(event.created_at)}</p>
              </div>
            )
            if (event.event_type === 'refund') return (
              <div key={event.id} className="relative">
                <TimelineDot tone="warning" />
                <p className="text-xs font-medium text-ink">Refunded</p>
                <p className="text-xs text-ink-faint">{formatDate(event.created_at)}</p>
              </div>
            )
            if (event.event_type === 'note') return (
              <div key={event.id} className="relative">
                <TimelineDot tone="note" />
                <p className="text-xs font-medium text-ink">Private note</p>
                <p className="mt-0.5 whitespace-pre-line text-xs text-ink-soft">{data.text}</p>
                <p className="text-xs text-ink-faint">{formatDate(event.created_at)}</p>
              </div>
            )
            return null
          })}

          {/* Email events */}
          {(order.emails ?? []).map(email => (
            <div key={email.id} className="relative">
              <TimelineDot tone={email.status === 'failed' ? 'danger' : 'info'} />
              <p className="text-xs font-medium capitalize text-ink">
                {email.type.replace(/_/g, ' ')}
                {email.status === 'failed' && <span className="ml-1 text-danger">(failed)</span>}
              </p>
              <p className="text-xs text-ink-faint">
                To: {email.recipient} · {new Date(email.sent_at * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Admin actions */}
      <section className="space-y-5 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Admin Actions</h2>
          <EditToggle editing={editingAdminActions} onEdit={() => setEditingAdminActions(true)} />
        </div>

        {updateMutation.isError && (
          <p className="text-xs text-danger">Update failed. Please try again.</p>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-32 shrink-0 text-sm text-ink-soft">Order Status</label>
            {editingAdminActions ? (
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className={`${INPUT_CLASSES} w-auto cursor-pointer`}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <StatusBadge label={order.order_status} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-32 shrink-0 text-sm text-ink-soft">Tracking Number</label>
            {editingAdminActions ? (
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g. 1Z999AA10123456784"
                className={`${INPUT_CLASSES} w-64`}
              />
            ) : (
              <span className="text-sm text-ink">{order.tracking_number ?? '—'}</span>
            )}
          </div>
        </div>

        {editingAdminActions && (
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={updateMutation.isPending}
              onClick={() => {
                updateMutation.mutate(
                  {
                    order_status: orderStatus,
                    tracking_number: trackingNumber,
                  },
                  { onSuccess: () => setEditingAdminActions(false) }
                )
              }}
            >
              Save
            </Button>
          </div>
        )}

        {/* Refund — destructive action, stays separate */}
        {order.payment_status !== 'refunded' && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <label className="w-32 shrink-0 text-sm text-ink-soft">Refund</label>
            <Button
              variant="danger"
              size="sm"
              loading={refundMutation.isPending}
              onClick={() => {
                if (window.confirm('Mark this order as refunded? This cannot be undone.')) {
                  refundMutation.mutate({ notes: '' })
                }
              }}
            >
              Mark as Refunded
            </Button>
            {refundMutation.isError && (
              <p className="text-xs text-danger">Refund failed. Please try again.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
