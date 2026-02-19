import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

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

export default function AdminOrders() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ orders: Order[] }>({
    queryKey: ['admin-orders'],
    queryFn: () => fetch('/api/admin/orders').then((r) => r.json()),
    refetchInterval: 30_000, // refresh every 30s
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { order_status?: string; payment_status?: string } }) =>
      fetch(`/api/admin/orders/${id}/status`, {
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
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Orders</h1>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No orders yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Payment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Pay Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Order Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.id.slice(0, 16)}…</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 text-xs">{order.customer_name}</p>
                    <p className="text-gray-400 text-xs">{order.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">₹{order.total_amount.toFixed(2)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="capitalize text-gray-500 text-xs">{order.payment_method}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.payment_status}
                      onChange={(e) => statusMutation.mutate({ id: order.id, updates: { payment_status: e.target.value } })}
                      className={`text-xs px-2 py-1 rounded font-medium border-0 cursor-pointer ${statusColors[order.payment_status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={order.order_status}
                      onChange={(e) => statusMutation.mutate({ id: order.id, updates: { order_status: e.target.value } })}
                      className={`text-xs px-2 py-1 rounded font-medium border-0 cursor-pointer ${statusColors[order.order_status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{formatDate(order.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
