import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSettings } from '../../lib/useSettings'
import { NAV_ITEMS, currencySymbol } from '../../lib/storeConfig'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header'

interface OrderItem {
  product_id: string
  name: string
  price: number
  quantity: number
  image_url: string
}

interface Order {
  id: string
  total_amount: number
  order_status: string
  payment_status: string
  created_at: string
  items_json: string
  tracking_number: string | null
}

export default function AccountOrdersPage() {
  const navigate = useNavigate()
  const { store_name: storeName, currency: storeCurrency } = useSettings()
  const totalItems = useCartStore((s) => s.totalItems)
  const token = useAuthStore((s) => s.token)
  const customerName = useAuthStore((s) => s.customerName)
  const logout = useAuthStore((s) => s.logout)
  const queryClient = useQueryClient()
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      navigate('/account/login', { replace: true })
    }
  }, [token, navigate])

  const { data, isLoading: ordersLoading, error } = useQuery<{ orders: Order[] }>({
    queryKey: ['account-orders', token],
    queryFn: () =>
      fetch('/api/account/orders', {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to load orders')
        return r.json()
      }),
    enabled: !!token,
  })

  const currency = currencySymbol(storeCurrency)
  const orders = data?.orders ?? []

  const handleLogout = () => {
    queryClient.removeQueries({ queryKey: ['account-orders'] })
    logout()
    navigate('/')
  }

  const toggleOrder = (id: string) => {
    setExpandedOrderId((prev) => (prev === id ? null : id))
  }

  const parseItems = (itemsJson: string): OrderItem[] => {
    try {
      return JSON.parse(itemsJson) ?? []
    } catch {
      return []
    }
  }

  if (!token) {
    return null
  }

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => {}}
        navItems={NAV_ITEMS}
      />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">My Account</h1>
            {customerName && (
              <p className="text-sm text-gray-500 mt-1">Welcome back, {customerName}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 border border-gray-300 rounded px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-8">
          <span className="pb-3 text-sm font-medium border-b-2 border-gray-900 text-gray-900">
            Orders
          </span>
          <Link
            to="/account/profile"
            className="pb-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            Profile
          </Link>
        </div>

        {ordersLoading && (
          <p className="text-sm text-gray-400">Loading orders...</p>
        )}

        {error && (
          <p className="text-sm text-red-600">Failed to load orders. Please try again.</p>
        )}

        {!ordersLoading && !error && orders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">You haven't placed any orders yet.</p>
          </div>
        )}

        {!ordersLoading && !error && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id
              const items = parseItems(order.items_json)
              return (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  {/* Summary row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">Order #{order.id}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right sm:text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Total</p>
                        <p className="text-sm font-medium text-gray-900">
                          {currency}{order.total_amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right sm:text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Status</p>
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                          {order.order_status}
                        </span>
                      </div>
                      <div className="text-right sm:text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Payment</p>
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">
                          {order.payment_status}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? 'Hide ▲' : 'Details ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {/* Items list */}
                      {items.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm text-gray-700"
                            >
                              <span>
                                <span className="text-gray-500">{item.quantity}×</span>{' '}
                                {item.name}
                              </span>
                              <span className="text-gray-900 font-medium">
                                {currency}{(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tracking number */}
                      {order.tracking_number && (
                        <p className="text-xs text-gray-500 mt-2">
                          Shipped — Tracking:{' '}
                          <span className="font-medium text-gray-700">{order.tracking_number}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
