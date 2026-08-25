import { Fragment, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'
import { SkeletonTable } from '../../components/Skeleton'
import Field from '../../components/Field'
import Button from '../../components/Button'
import Badge from '../../components/ui/Badge'

interface Customer {
  id: number
  name: string
  email: string
  phone: string
  created_at: string
  order_count: number
  total_spent: number
}

interface CustomerDetail {
  customer: Omit<Customer, 'order_count' | 'total_spent'>
  orders: Array<{
    id: string
    total_amount: number
    order_status: string
    payment_status: string
    created_at: string
  }>
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }

function OrderHistory({ detail }: { detail: CustomerDetail | undefined }) {
  if (!detail) return <p className="text-xs text-ink-faint">Loading…</p>
  if (detail.orders.length === 0) return <p className="text-xs text-ink-faint">No orders yet.</p>
  return (
    <div className="space-y-1.5">
      {detail.orders.map(order => (
        <div key={order.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-ink">
          <Link
            to={`/admin/orders/${order.id}`}
            className="font-mono text-accent hover:underline"
            onClick={e => e.stopPropagation()}
          >
            {order.id}
          </Link>
          <span className="text-ink-faint">{new Date(order.created_at).toLocaleDateString()}</span>
          <Badge variant="neutral" size="sm" className="capitalize">{order.order_status}</Badge>
          <span className="font-medium">{order.total_amount.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminCustomers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: settingsData } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => adminFetch('/api/settings').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const currency = CURRENCY_SYMBOLS[settingsData?.currency ?? 'INR'] ?? '₹'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      return adminFetch(`/api/admin/customers?${params}`).then(r => r.json()) as Promise<{
        customers: Customer[]; total: number; pages: number; page: number
      }>
    },
  })

  const { data: detail } = useQuery<CustomerDetail>({
    queryKey: ['admin-customer', expandedId],
    queryFn: () => adminFetch(`/api/admin/customers/${expandedId}`).then(r => r.json()),
    enabled: expandedId !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/customers/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      setExpandedId(null)
    },
  })

  const customers = data?.customers ?? []

  function confirmDelete(c: Customer, e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Delete ${c.email}? Their order history will be preserved.`)) {
      deleteMutation.mutate(c.id)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Customers</h1>
        <span className="text-sm text-ink-soft">{data?.total ?? 0} total</span>
      </div>

      <div className="mb-4">
        <Field
          label="Search"
          containerClassName="max-w-sm"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {isLoading && <SkeletonTable rows={8} cols={5} />}

      {!isLoading && customers.length === 0 && (
        <p className="rounded-card border border-line bg-surface py-8 text-center text-sm text-ink-faint">No customers found.</p>
      )}

      {customers.length > 0 && (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 md:hidden">
            {customers.map(customer => {
              const expanded = expandedId === customer.id
              return (
                <div key={customer.id} className="rounded-card border border-line bg-surface shadow-card">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : customer.id)}
                    className="w-full p-4 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{customer.name || '—'}</p>
                        <p className="truncate text-xs text-ink-faint">{customer.email}</p>
                      </div>
                      <p className="shrink-0 font-semibold text-ink">{currency}{Number(customer.total_spent).toFixed(2)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                      <span>{customer.phone || '—'}</span>
                      <span>{customer.order_count} order{customer.order_count !== 1 ? 's' : ''}</span>
                      <span>Joined {new Date(customer.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-line bg-surface-2 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Order history</p>
                      <OrderHistory detail={detail} />
                      <Button
                        variant="danger"
                        size="sm"
                        className="mt-3"
                        onClick={(e) => confirmDelete(customer, e)}
                      >
                        Delete customer
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Registered</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-ink-soft">Orders</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-ink-soft">Spent</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-ink-soft">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map(customer => {
                  const expanded = expandedId === customer.id
                  return (
                    <Fragment key={customer.id}>
                      <tr
                        className="cursor-pointer transition-colors duration-fast hover:bg-surface-2"
                        onClick={() => setExpandedId(expanded ? null : customer.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">{customer.name || '—'}</p>
                          <p className="text-xs text-ink-faint">{customer.email}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">{customer.phone || '—'}</td>
                        <td className="px-4 py-3 text-ink-faint">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right text-ink-soft">{customer.order_count}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">
                          {currency}{Number(customer.total_spent).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => confirmDelete(customer, e)}
                            className="text-xs font-medium text-danger hover:text-danger/80"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={6} className="bg-surface-2 px-4 py-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-faint">Order history</p>
                            <OrderHistory detail={detail} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {(data?.pages ?? 1) > 1 && (
              <div className="flex items-center justify-center gap-4 border-t border-line py-4">
                <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  ← Prev
                </Button>
                <span className="text-sm text-ink-soft">Page {page} of {data?.pages}</span>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))} disabled={page === data?.pages}>
                  Next →
                </Button>
              </div>
            )}
          </div>

          {/* Mobile pagination */}
          {(data?.pages ?? 1) > 1 && (
            <div className="mt-4 flex items-center justify-center gap-4 md:hidden">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                ← Prev
              </Button>
              <span className="text-sm text-ink-soft">Page {page} of {data?.pages}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))} disabled={page === data?.pages}>
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
