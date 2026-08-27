import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminFetch'
import { fetchJsonWith } from '../../lib/api'
import { SkeletonStatCards, Skeleton } from '../../components/Skeleton'
import Badge from '../../components/ui/Badge'

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
    queryFn: () => fetchJsonWith<DashboardData>(adminFetch, '/api/admin/dashboard'),
    refetchInterval: 60_000, // auto-refresh every minute
  })

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <SkeletonStatCards count={4} />
      <div className="h-64 rounded-card border border-line bg-surface" />
    </div>
  )
  if (isError) return <p className="text-sm text-danger">Failed to load dashboard. Please refresh.</p>
  if (!data) return null

  const stats = [
    { label: 'Orders today', value: data.orders_today.toString() },
    { label: 'Revenue today', value: `₹${data.revenue_today.toLocaleString('en-IN')}` },
    { label: 'Revenue (30d)', value: `₹${data.revenue_30d.toLocaleString('en-IN')}` },
    { label: 'Pending fulfilment', value: data.pending_fulfilment.toString(), emphasize: data.pending_fulfilment > 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, emphasize }) => (
          <div key={label} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${emphasize ? 'text-accent' : 'text-ink'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Low stock */}
      <div className="rounded-card border border-line bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Low stock (&lt; 5)</h2>
          <Link to="/admin/products" className="text-xs font-medium text-accent transition-colors duration-fast hover:text-accent-dark">
            View all
          </Link>
        </div>
        <div className="divide-y divide-line">
          {data.low_stock.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">All products are well stocked.</p>
          )}
          {data.low_stock.map(row => (
            <div key={`${row.product_id}-${row.size_label ?? 'base'}`} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-ink">
                {row.name}
                {row.size_label && <span className="text-ink-faint"> &middot; {row.size_label}</span>}
              </p>
              <Badge variant={row.stock_count === 0 ? 'danger' : 'warning'} size="sm">
                {row.stock_count === 0 ? 'Out of stock' : `${row.stock_count} left`}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
