import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

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

export default function AdminCustomers() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data: settingsData } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const currency = CURRENCY_SYMBOLS[settingsData?.currency ?? 'INR'] ?? '₹'

  const { data, isLoading } = useQuery({
    queryKey: ['admin-customers', search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      return fetch(`/api/admin/customers?${params}`).then(r => r.json()) as Promise<{
        customers: Customer[]; total: number; pages: number; page: number
      }>
    },
  })

  const { data: detail } = useQuery<CustomerDetail>({
    queryKey: ['admin-customer', expandedId],
    queryFn: () => fetch(`/api/admin/customers/${expandedId}`).then(r => r.json()),
    enabled: expandedId !== null,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/customers/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] })
      setExpandedId(null)
    },
  })

  const customers = data?.customers ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Customers</h1>
        <span className="text-sm text-gray-500">{data?.total ?? 0} total</span>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

      {!isLoading && customers.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">No customers found.</p>
      )}

      {customers.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Registered</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spent</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(customer => (
                <>
                  <tr
                    key={customer.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{customer.name || '—'}</p>
                      <p className="text-xs text-gray-500">{customer.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{customer.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{customer.order_count}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {currency}{Number(customer.total_spent).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (window.confirm(`Delete ${customer.email}? Their order history will be preserved.`)) {
                            deleteMutation.mutate(customer.id)
                          }
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedId === customer.id && detail && (
                    <tr key={`${customer.id}-detail`}>
                      <td colSpan={6} className="px-4 py-3 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Order History</p>
                        {detail.orders.length === 0 ? (
                          <p className="text-xs text-gray-400">No orders yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {detail.orders.map(order => (
                              <div key={order.id} className="flex items-center justify-between text-xs text-gray-700">
                                <Link
                                  to={`/admin/orders/${order.id}`}
                                  className="text-indigo-600 hover:underline font-mono"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {order.id}
                                </Link>
                                <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                <span className="capitalize px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">{order.order_status}</span>
                                <span className="font-medium">{currency}{order.total_amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {(data?.pages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-100">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-sm text-gray-500">Page {page} of {data?.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(data?.pages ?? 1, p + 1))}
                disabled={page === data?.pages}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
