import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'

interface DashboardData {
  revenue_all_time: number
  revenue_today: number
  total_orders: number
  pending_orders: number
  recent_orders: Array<{
    id: string
    customer_name: string
    total_amount: number
    order_status: string
    created_at: string
  }>
  low_stock_products: Array<{
    id: number
    name: string
    stock_count: number
  }>
}

export default function AdminDashboard() {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => adminFetch('/api/admin/dashboard').then(r => {
      if (!r.ok) throw new Error('Failed to load dashboard')
      return r.json()
    }),
    refetchInterval: 60_000, // auto-refresh every minute
  })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (isError) return <p className="text-sm text-red-500">Failed to load dashboard. Please refresh.</p>
  if (!data) return null

  const stats = [
    { label: 'Revenue (All Time)', value: `₹${data.revenue_all_time.toLocaleString('en-IN')}` },
    { label: 'Revenue (Today)', value: `₹${data.revenue_today.toLocaleString('en-IN')}` },
    { label: 'Total Orders', value: data.total_orders.toString() },
    { label: 'Pending Orders', value: data.pending_orders.toString() },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-800 text-sm">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recent_orders.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">No orders yet.</p>
            )}
            {data.recent_orders.map(order => (
              <div key={order.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
                  <p className="text-xs text-gray-400 font-mono">{order.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">₹{order.total_amount.toLocaleString('en-IN')}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    order.order_status === 'placed' ? 'bg-yellow-100 text-yellow-700' :
                    order.order_status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                    order.order_status === 'delivered' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {order.order_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-medium text-gray-800 text-sm">Low Stock (&lt; 5)</h2>
            <Link to="/admin/products" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.low_stock_products.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">All products are well stocked.</p>
            )}
            {data.low_stock_products.map(product => (
              <div key={product.id} className="px-4 py-3 flex items-center justify-between">
                <p className="text-sm text-gray-900">{product.name}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  product.stock_count === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {product.stock_count === 0 ? 'Out of stock' : `${product.stock_count} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
