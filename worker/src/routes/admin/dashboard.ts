import { Hono } from 'hono'
import type { Env } from '../../index'

const dashboard = new Hono<{ Bindings: Env }>()

dashboard.get('/', async (c) => {
  const [
    revenueAll,
    revenueToday,
    totalOrders,
    pendingOrders,
    recentOrders,
    lowStock,
  ] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE payment_status = 'paid'"
    ).first<{ v: number }>(),
    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE payment_status = 'paid' AND date(created_at) = date('now')"
    ).first<{ v: number }>(),
    c.env.DB.prepare('SELECT COUNT(*) as v FROM orders').first<{ v: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as v FROM orders WHERE order_status = 'placed'"
    ).first<{ v: number }>(),
    c.env.DB.prepare(
      'SELECT id, customer_name, total_amount, order_status, created_at FROM orders ORDER BY created_at DESC LIMIT 5'
    ).all<{ id: string; customer_name: string; total_amount: number; order_status: string; created_at: string }>(),
    c.env.DB.prepare(
      "SELECT id, name, stock_count FROM products WHERE stock_count < 5 AND status = 'active' ORDER BY stock_count ASC LIMIT 10"
    ).all<{ id: number; name: string; stock_count: number }>(),
  ])

  return c.json({
    revenue_all_time: revenueAll?.v ?? 0,
    revenue_today: revenueToday?.v ?? 0,
    total_orders: totalOrders?.v ?? 0,
    pending_orders: pendingOrders?.v ?? 0,
    recent_orders: recentOrders.results,
    low_stock_products: lowStock.results,
  })
})

export default dashboard
