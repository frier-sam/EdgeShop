import { Hono } from 'hono'
import type { Env } from '../../index'

const dashboard = new Hono<{ Bindings: Env }>()

// POD.md §8.4 — trimmed to the four things a merchant needs at a glance for
// fulfilment: how many orders came in today, revenue today and over the
// trailing 30 days, how many orders are waiting to be printed/shipped, and
// what stock is about to run out. v1's "all time revenue" and "recent
// orders" widgets are gone — /admin/orders already covers that, and
// all-time revenue isn't a fulfilment signal. Low stock now checks
// `product_sizes` for sized products (POD's actual stock model) and only
// falls back to `products.stock_count` for the sizeless case (POD.md §6.1).
dashboard.get('/', async (c) => {
  try {
    const [ordersToday, revenueToday, revenue30d, pendingFulfilment, lowStock] = await Promise.all([
      c.env.DB.prepare(
        "SELECT COUNT(*) as v FROM orders WHERE date(created_at) = date('now')"
      ).first<{ v: number }>(),
      c.env.DB.prepare(
        "SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE payment_status = 'paid' AND date(created_at) = date('now')"
      ).first<{ v: number }>(),
      c.env.DB.prepare(
        "SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE payment_status = 'paid' AND created_at >= datetime('now', '-30 days')"
      ).first<{ v: number }>(),
      // "Pending fulfilment" = placed or confirmed but not yet shipped —
      // the set of orders a merchant still needs to print and pack.
      c.env.DB.prepare(
        "SELECT COUNT(*) as v FROM orders WHERE order_status IN ('placed', 'confirmed')"
      ).first<{ v: number }>(),
      c.env.DB.prepare(
        `SELECT p.id as product_id, p.name as name, ps.label as size_label, ps.stock_count as stock_count
           FROM product_sizes ps
           JOIN products p ON p.id = ps.product_id
          WHERE p.status = 'active' AND ps.stock_count < 5
         UNION ALL
         SELECT p.id as product_id, p.name as name, NULL as size_label, p.stock_count as stock_count
           FROM products p
          WHERE p.status = 'active' AND p.stock_count < 5
            AND NOT EXISTS (SELECT 1 FROM product_sizes ps2 WHERE ps2.product_id = p.id)
          ORDER BY stock_count ASC
          LIMIT 10`
      ).all<{ product_id: number; name: string; size_label: string | null; stock_count: number }>(),
    ])

    return c.json({
      orders_today: ordersToday?.v ?? 0,
      revenue_today: revenueToday?.v ?? 0,
      revenue_30d: revenue30d?.v ?? 0,
      pending_fulfilment: pendingFulfilment?.v ?? 0,
      low_stock: lowStock.results,
    })
  } catch (err) {
    console.error('[dashboard] query failed', err)
    return c.json({ error: 'Failed to load dashboard data' }, 500)
  }
})

export default dashboard
