import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

interface RevenueDay {
  day: string
  revenue: number
  orders: number
}

interface RevenueResponse {
  data: RevenueDay[]
}

function formatDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (days <= 30) {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  // For 90d view, show shorter label to avoid crowding
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function AdminAnalytics() {
  const [days, setDays] = useState<30 | 90>(30)

  const { data, isLoading, isError } = useQuery<RevenueResponse>({
    queryKey: ['analytics-revenue', days],
    queryFn: () =>
      fetch(`/api/admin/analytics/revenue?days=${days}`).then(r => {
        if (!r.ok) throw new Error('Failed to load analytics')
        return r.json()
      }),
  })

  const rows = data?.data ?? []

  const totalRevenue = rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0)
  const totalOrders = rows.reduce((sum, r) => sum + (r.orders ?? 0), 0)
  const maxRevenue = rows.reduce((max, r) => Math.max(max, r.revenue ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDays(30)}
            className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
              days === 30
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            30d
          </button>
          <button
            onClick={() => setDays(90)}
            className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
              days === 90
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            90d
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {isError && <p className="text-sm text-red-500">Failed to load. Please refresh.</p>}

      {!isLoading && !isError && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Revenue ({days}d)</p>
              <p className="text-2xl font-bold text-gray-900">{formatRupees(totalRevenue)}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Total Orders ({days}d)</p>
              <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Revenue per Day</h2>

            {rows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No paid orders in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="flex items-end gap-px"
                  style={{
                    height: '200px',
                    minWidth: days === 30 ? `${rows.length * 40}px` : `${rows.length * 14}px`,
                  }}
                >
                  {rows.map((row) => {
                    const heightPct = maxRevenue > 0 ? (row.revenue / maxRevenue) * 100 : 0
                    const label = formatDate(row.day, days)
                    const tooltip = `${row.day}\n${formatRupees(row.revenue)}\n${row.orders} order${row.orders !== 1 ? 's' : ''}`
                    return (
                      <div
                        key={row.day}
                        className="flex flex-col items-center justify-end flex-1"
                        style={{ minWidth: days === 30 ? '36px' : '10px', height: '100%' }}
                      >
                        <div
                          title={tooltip}
                          className="w-full bg-gray-800 hover:bg-gray-600 transition-colors rounded-t cursor-default"
                          style={{ height: `${heightPct}%`, minHeight: heightPct > 0 ? '2px' : '0' }}
                        />
                        {days === 30 && (
                          <p
                            className="text-gray-400 mt-1 text-center leading-tight"
                            style={{ fontSize: '9px', whiteSpace: 'nowrap' }}
                          >
                            {label}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* For 90d: show labels below the chart area separately, spaced evenly */}
                {days === 90 && (
                  <div
                    className="flex items-start gap-px mt-1"
                    style={{ minWidth: `${rows.length * 14}px` }}
                  >
                    {rows.map((row, i) => (
                      <div
                        key={row.day}
                        className="flex-1 text-center"
                        style={{ minWidth: '10px' }}
                      >
                        {/* Show label every ~10 bars to avoid crowding */}
                        {i % 10 === 0 && (
                          <p
                            className="text-gray-400 leading-tight"
                            style={{ fontSize: '9px', whiteSpace: 'nowrap' }}
                          >
                            {formatDate(row.day, days)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Daily breakdown table (only shown for 30d to keep it readable) */}
          {days === 30 && rows.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-700">Daily Breakdown</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {[...rows].reverse().map((row) => (
                  <div key={row.day} className="px-4 py-2.5 flex items-center justify-between">
                    <p className="text-sm text-gray-700">{formatDate(row.day, days)}</p>
                    <div className="flex gap-6 text-right">
                      <div>
                        <p className="text-xs text-gray-400">Orders</p>
                        <p className="text-sm font-medium text-gray-900">{row.orders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Revenue</p>
                        <p className="text-sm font-semibold text-gray-900">{formatRupees(row.revenue)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
