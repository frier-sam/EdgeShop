import { Hono } from 'hono'
import type { Env } from '../../index'

const adminCustomers = new Hono<{ Bindings: Env }>()

// List customers with order stats
adminCustomers.get('/', async (c) => {
  const search = c.req.query('search') ?? ''
  const page = Math.max(1, Number(c.req.query('page') ?? '1'))
  const limit = 20
  const offset = (page - 1) * limit

  let rows
  if (search) {
    const like = `%${search}%`
    rows = await c.env.DB.prepare(`
      SELECT
        c.id, c.name, c.email, c.phone, c.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.name LIKE ? OR c.email LIKE ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(like, like, limit, offset).all()
  } else {
    rows = await c.env.DB.prepare(`
      SELECT
        c.id, c.name, c.email, c.phone, c.created_at,
        COUNT(o.id) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all()
  }

  const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>()
  const total = totalRow?.count ?? 0

  return c.json({
    customers: rows.results,
    total,
    pages: Math.ceil(total / limit),
    page,
  })
})

// Single customer + their orders
adminCustomers.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const customer = await c.env.DB.prepare(
    'SELECT id, name, email, phone, created_at FROM customers WHERE id = ?'
  ).bind(id).first()
  if (!customer) return c.json({ error: 'Not found' }, 404)

  const { results: orders } = await c.env.DB.prepare(
    'SELECT id, total_amount, order_status, payment_status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(id).all()

  return c.json({ customer, orders })
})

// Delete customer — nullify customer_id on orders to preserve order history
adminCustomers.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const existing = await c.env.DB.prepare('SELECT id FROM customers WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE orders SET customer_id = NULL WHERE customer_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id),
  ])

  return c.json({ ok: true })
})

export default adminCustomers
