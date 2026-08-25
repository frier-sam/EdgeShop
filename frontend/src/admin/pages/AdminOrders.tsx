import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'
import { SkeletonTable } from '../../components/Skeleton'
import Field from '../../components/Field'

interface Order {
  id: string
  customer_name: string
  customer_email: string
  total_amount: number
  payment_method: string
  payment_status: string
  order_status: string
  created_at: string
}

const ORDER_STATUSES = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'paid', 'refunded']

// Same palette Badge draws from (POD-UI.md §2.1 status tokens), applied to
// an editable <select> instead of a static pill so the colour still reads
// at a glance while the value stays changeable inline.
const statusClasses: Record<string, string> = {
  placed: 'bg-accent-soft text-accent-dark',
  confirmed: 'bg-accent-soft text-accent-dark',
  shipped: 'bg-warning/10 text-warning',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  pending: 'bg-surface-2 text-ink-soft',
  paid: 'bg-success/10 text-success',
  refunded: 'bg-warning/10 text-warning',
}

function StatusSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 cursor-pointer rounded-btn border-0 px-2 text-xs font-semibold capitalize transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${statusClasses[value] ?? 'bg-surface-2 text-ink-soft'}`}
    >
      {options.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

export default function AdminOrders() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery<{ orders: Order[] }>({
    queryKey: ['admin-orders', q, statusFilter],
    queryFn: () =>
      adminFetch('/api/admin/orders?' + new URLSearchParams({ ...(q && { q }), ...(statusFilter && { status: statusFilter }) })).then((r) => r.json()),
    refetchInterval: 30_000, // refresh every 30s
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { order_status?: string; payment_status?: string } }) =>
      adminFetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orders'] }),
  })

  const orders = data?.orders ?? []

  function formatDate(dt: string) {
    return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Orders</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <Field
          label="Search"
          containerClassName="min-w-40 flex-1"
          type="search"
          placeholder="Search by name, email, or order ID…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Field
          label="Status"
          as="select"
          containerClassName="w-40"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            ...ORDER_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
          ]}
        />
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : orders.length === 0 ? (
        <div className="rounded-card border border-line bg-surface py-16 text-center text-ink-faint">
          <p>No orders yet</p>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <div key={order.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{order.customer_name}</p>
                    <p className="truncate text-xs text-ink-faint">{order.customer_email}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-ink">₹{order.total_amount.toFixed(2)}</p>
                </div>
                <p className="mt-1 font-mono text-xs text-ink-faint">{order.id.slice(0, 20)}…</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusSelect
                    label="Order status"
                    value={order.order_status}
                    options={ORDER_STATUSES}
                    onChange={(v) => statusMutation.mutate({ id: order.id, updates: { order_status: v } })}
                  />
                  <StatusSelect
                    label="Payment status"
                    value={order.payment_status}
                    options={PAYMENT_STATUSES}
                    onChange={(v) => statusMutation.mutate({ id: order.id, updates: { payment_status: v } })}
                  />
                  <span className="text-xs text-ink-faint">{formatDate(order.created_at)}</span>
                </div>
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="mt-3 block text-center text-sm font-medium text-accent transition-colors duration-fast hover:text-accent-dark"
                >
                  View order →
                </Link>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Pay status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Order status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors duration-fast hover:bg-surface-2">
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{order.id.slice(0, 16)}…</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-ink">{order.customer_name}</p>
                      <p className="text-xs text-ink-faint">{order.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">₹{order.total_amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize text-ink-soft">{order.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        label="Payment status"
                        value={order.payment_status}
                        options={PAYMENT_STATUSES}
                        onChange={(v) => statusMutation.mutate({ id: order.id, updates: { payment_status: v } })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        label="Order status"
                        value={order.order_status}
                        options={ORDER_STATUSES}
                        onChange={(v) => statusMutation.mutate({ id: order.id, updates: { order_status: v } })}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-faint">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/orders/${order.id}`} className="text-xs font-medium text-accent hover:text-accent-dark">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
