import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'
import { SkeletonStatCards } from '../../components/Skeleton'

// POD.md §8.4 — trimmed to what a merchant needs at a glance for
// fulfilment: today's orders, revenue today/30d, orders waiting to be
// printed & shipped, and what's about to run out of stock. Matches
// worker/src/routes/admin/dashboard.ts's response exactly — no v1 fields
// (all-time revenue, recent orders) whose usefulness doesn't carry over.
interface DashboardData {
  orders_today: number
  revenue_today: number
  revenue_30d: number
  pending_fulfilment: number
  low_stock: Array<{
    product_id: number
    name: string
    size_label: string | null
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

  if (isLoading) return (
    <div className="space-y-6">
      <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
      <SkeletonStatCards count={4} />
      <div className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
    </div>
  )
  if (isError) return <p className="text-sm text-red-500">Failed to load dashboard. Please refresh.</p>
  if (!data) return null

  const stats = [
    { label: 'Orders Today', value: data.orders_today.toString() },
    { label: 'Revenue Today', value: `₹${data.revenue_today.toLocaleString('en-IN')}` },
    { label: 'Revenue (30d)', value: `₹${data.revenue_30d.toLocaleString('en-IN')}` },
    { label: 'Pending Fulfilment', value: data.pending_fulfilment.toString() },
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

      {/* Low stock */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium text-gray-800 text-sm">Low Stock (&lt; 5)</h2>
          <Link to="/admin/products" className="text-xs text-blue-600 hover:text-blue-800">View all</Link>
        </div>
        <div className="divide-y divide-gray-100">
          {data.low_stock.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">All products are well stocked.</p>
          )}
          {data.low_stock.map(row => (
            <div key={`${row.product_id}-${row.size_label ?? 'base'}`} className="px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-900">
                {row.name}
                {row.size_label && <span className="text-gray-400"> &middot; {row.size_label}</span>}
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                row.stock_count === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {row.stock_count === 0 ? 'Out of stock' : `${row.stock_count} left`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
