import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '../../lib/api'
import { useSettings } from '../../lib/useSettings'
import { NAV_ITEMS, currencySymbol } from '../../lib/storeConfig'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header'
import Button from '../../components/Button'
import Badge from '../../components/ui/Badge'
import Skeleton from '../../components/ui/Skeleton'

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

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton shape="text" width={140} height={14} />
              <Skeleton shape="text" width={90} height={12} />
            </div>
            <Skeleton shape="rect" width={80} height={28} />
          </div>
        </div>
      ))}
    </div>
  )
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
      fetchJson<{ orders: Order[] }>('/api/account/orders', {
        headers: { Authorization: `Bearer ${token}` },
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
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={() => {}} navItems={NAV_ITEMS} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink">My Account</h1>
            {customerName && <p className="mt-1 text-sm text-ink-soft">Welcome back, {customerName}</p>}
          </div>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Nav tabs */}
        <div className="mb-8 flex gap-6 border-b border-line">
          <span className="border-b-2 border-ink pb-3 text-sm font-medium text-ink">Orders</span>
          <Link to="/account/profile" className="pb-3 text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink">
            Profile
          </Link>
        </div>

        {ordersLoading && <OrdersSkeleton />}

        {error && <p className="text-sm text-danger">Failed to load orders. Please try again.</p>}

        {!ordersLoading && !error && orders.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-ink-soft">You haven't placed any orders yet.</p>
            <Button as={Link} to="/shop" variant="primary" size="md" className="mt-5">
              Start shopping
            </Button>
          </div>
        )}

        {!ordersLoading && !error && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((order) => {
              const isExpanded = expandedOrderId === order.id
              const items = parseItems(order.items_json)
              return (
                <div key={order.id} className="rounded-card border border-line bg-surface p-4">
                  {/* Summary row */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-ink">Order #{order.id}</p>
                      <p className="text-xs text-ink-soft">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right sm:text-center">
                        <p className="mb-0.5 text-xs text-ink-faint">Total</p>
                        <p className="text-sm font-medium text-ink">
                          {currency}
                          {order.total_amount.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right sm:text-center">
                        <p className="mb-0.5 text-xs text-ink-faint">Status</p>
                        <Badge variant="neutral" className="capitalize">
                          {order.order_status}
                        </Badge>
                      </div>
                      <div className="text-right sm:text-center">
                        <p className="mb-0.5 text-xs text-ink-faint">Payment</p>
                        <Badge variant="neutral" className="capitalize">
                          {order.payment_status}
                        </Badge>
                      </div>
                      <button
                        onClick={() => toggleOrder(order.id)}
                        className="whitespace-nowrap text-xs text-ink-soft transition-colors duration-fast hover:text-ink"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? 'Hide ▲' : 'Details ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-line pt-4">
                      {items.length > 0 && (
                        <div className="mb-3 space-y-2">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm text-ink">
                              <span>
                                <span className="text-ink-soft">{item.quantity}×</span> {item.name}
                              </span>
                              <span className="font-medium text-ink">
                                {currency}
                                {(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {order.tracking_number && (
                        <p className="mt-2 text-xs text-ink-soft">
                          Shipped — Tracking: <span className="font-medium text-ink">{order.tracking_number}</span>
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
