import { Hono } from 'hono'
import type { Env } from '../index'
import { sendEmail } from '../lib/email'
import { orderConfirmationHtml, newOrderAlertHtml } from '../lib/emailTemplates'
import { verifyJWT, getOrCreateJwtSecret } from '../lib/auth'
import {
  computeLine,
  computeOrderQuote,
  pricesMatch,
  type LineInput,
  type PricingProduct,
  type PricingSize,
  type PricingSide,
  type PricingDesign,
  type ResolvedLineItem,
  type OrderQuote,
} from '../lib/pricing'

const checkout = new Hono<{ Bindings: Env }>()

async function getCustomerIdFromHeader(authHeader: string, db: D1Database): Promise<number | null> {
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null
  try {
    const secret = await getOrCreateJwtSecret(db)
    const payload = await verifyJWT(token, secret)
    if (!payload || typeof payload.sub !== 'number') return null
    return payload.sub
  } catch {
    return null
  }
}

interface StockLine {
  product_id: number
  name: string
  quantity: number
  size?: string | null
}

async function validateStock(
  db: D1Database,
  items: StockLine[]
): Promise<Array<{ id: number; name: string; available: number }> | null> {
  if (!items.length) return null
  const insufficient: Array<{ id: number; name: string; available: number }> = []

  for (const item of items) {
    if (item.size) {
      const sizeRow = await db.prepare(
        'SELECT stock_count FROM product_sizes WHERE product_id = ? AND label = ?'
      ).bind(item.product_id, item.size).first<{ stock_count: number }>()
      if (!sizeRow) {
        insufficient.push({ id: item.product_id, name: item.name, available: 0 })
      } else if (item.quantity > sizeRow.stock_count) {
        insufficient.push({ id: item.product_id, name: item.name, available: sizeRow.stock_count })
      }
    } else {
      const product = await db.prepare(
        'SELECT id, name, stock_count FROM products WHERE id = ?'
      ).bind(item.product_id).first<{ id: number; name: string; stock_count: number }>()
      if (!product) {
        insufficient.push({ id: item.product_id, name: item.name, available: 0 })
      } else if (item.quantity > product.stock_count) {
        insufficient.push({ id: product.id, name: product.name, available: product.stock_count })
      }
    }
  }
  return insufficient.length > 0 ? insufficient : null
}

export async function decrementStock(db: D1Database, items: StockLine[]): Promise<void> {
  const stmts = items.map((item) =>
    item.size
      ? db.prepare(
          'UPDATE product_sizes SET stock_count = MAX(0, stock_count - ?) WHERE product_id = ? AND label = ?'
        ).bind(item.quantity, item.product_id, item.size)
      : db.prepare(
          'UPDATE products SET stock_count = MAX(0, stock_count - ?) WHERE id = ?'
        ).bind(item.quantity, item.product_id)
  )
  if (stmts.length > 0) await db.batch(stmts)
}

/**
 * POD.md §7.3 — the security-critical rewrite. Re-reads products,
 * product_sizes, product_sides and designs fresh from D1 for EVERY line
 * the client posted, and recomputes the whole order server-side via
 * lib/pricing.ts. The client's `items` therefore only ever carries
 * `{ product_id, quantity, size?, design_id? }` — no price of any kind is
 * trusted from the request body. `total_amount` is still accepted, but
 * purely so a mismatch can be detected and reported back as a
 * `price_mismatch`, never used to create the order or the Razorpay charge.
 */
async function buildQuote(
  db: D1Database,
  items: LineInput[]
): Promise<{ ok: true; quote: OrderQuote } | { ok: false; error: string; product_id?: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: 'empty_cart' }
  }

  const resolvedItems: ResolvedLineItem[] = []

  for (const input of items) {
    const productId = Number(input.product_id)
    const product = await db.prepare(
      'SELECT id, name, base_price, status, is_customizable FROM products WHERE id = ?'
    ).bind(productId).first<PricingProduct>()

    const size = input.size
      ? await db.prepare(
          'SELECT label, price_delta, stock_count FROM product_sizes WHERE product_id = ? AND label = ?'
        ).bind(productId, input.size).first<PricingSize>()
      : null

    const { results: sides } = await db.prepare(
      'SELECT side, customizable, print_fee FROM product_sides WHERE product_id = ?'
    ).bind(productId).all<PricingSide>()

    let design: PricingDesign | null = null
    let previewJson: Record<string, string> = {}
    if (input.design_id) {
      design = await db.prepare(
        'SELECT id, product_id, design_json, sides_used FROM designs WHERE id = ?'
      ).bind(input.design_id).first<PricingDesign>()
      const previewRow = await db.prepare('SELECT preview_json FROM designs WHERE id = ?')
        .bind(input.design_id).first<{ preview_json: string }>()
      try { previewJson = JSON.parse(previewRow?.preview_json ?? '{}') } catch { /* leave empty */ }
    }

    const result = computeLine({
      input: { ...input, product_id: productId },
      product: product ?? null,
      size: size ?? null,
      sides: sides ?? [],
      design,
      previewJson,
    })

    if (!result.ok) {
      return { ok: false, error: result.error, product_id: productId }
    }
    resolvedItems.push(result.item)
  }

  const shipRows = await db.prepare(
    "SELECT key, value FROM settings WHERE key IN ('flat_shipping_amount', 'free_shipping_over')"
  ).all<{ key: string; value: string }>()
  const shipCfg: Record<string, string> = {}
  for (const row of shipRows.results) shipCfg[row.key] = row.value

  const quote = computeOrderQuote(resolvedItems, {
    flat_shipping_amount: Number(shipCfg.flat_shipping_amount ?? 49),
    free_shipping_over: Number(shipCfg.free_shipping_over ?? 999),
  })

  return { ok: true, quote }
}

async function linkDesignsToOrder(db: D1Database, orderId: string, items: ResolvedLineItem[]): Promise<void> {
  const designIds = Array.from(new Set(items.map((i) => i.design_id).filter((id): id is string => !!id)))
  if (designIds.length === 0) return
  await db.batch(designIds.map((id) => db.prepare('UPDATE designs SET order_id = ? WHERE id = ?').bind(orderId, id)))
}

checkout.post('/', async (c) => {
  const body = await c.req.json<{
    customer_name: string
    customer_email: string
    customer_phone: string
    shipping_address: string
    shipping_city?: string
    shipping_state?: string
    shipping_pincode?: string
    shipping_country?: string
    payment_method: 'razorpay' | 'cod'
    items: LineInput[]
    total_amount: number
  }>()

  if (!body.customer_name || !body.customer_email || !body.shipping_address) {
    return c.json({ error: 'Missing required fields' }, 400)
  }
  if (!['razorpay', 'cod'].includes(body.payment_method)) {
    return c.json({ error: 'Invalid payment_method' }, 400)
  }

  const quoteResult = await buildQuote(c.env.DB, body.items)
  if (!quoteResult.ok) {
    return c.json({ error: quoteResult.error, product_id: quoteResult.product_id }, 400)
  }
  const { quote } = quoteResult

  if (!pricesMatch(Number(body.total_amount), quote.total_amount)) {
    return c.json(
      {
        error: 'price_mismatch',
        quote: {
          subtotal: quote.subtotal,
          print_total: quote.print_total,
          shipping_amount: quote.shipping_amount,
          total_amount: quote.total_amount,
          items: quote.items,
        },
      },
      400
    )
  }

  const orderId = `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const stockLines: StockLine[] = quote.items.map((i) => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, size: i.size }))

  if (body.payment_method === 'cod') {
    const stockIssues = await validateStock(c.env.DB, stockLines)
    if (stockIssues) {
      return c.json({ error: 'stock_error', items: stockIssues }, 400)
    }

    await c.env.DB.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
        items_json, subtotal, print_total, shipping_amount, total_amount,
        payment_method, payment_status, order_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'placed')
    `).bind(
      orderId,
      body.customer_name,
      body.customer_email,
      body.customer_phone ?? '',
      body.shipping_address,
      body.shipping_city ?? '',
      body.shipping_state ?? '',
      body.shipping_pincode ?? '',
      body.shipping_country ?? 'India',
      JSON.stringify(quote.items),
      quote.subtotal,
      quote.print_total,
      quote.shipping_amount,
      quote.total_amount
    ).run()

    await linkDesignsToOrder(c.env.DB, orderId, quote.items)

    const authHeaderCod = c.req.header('Authorization') ?? ''
    const customerIdCod = await getCustomerIdFromHeader(authHeaderCod, c.env.DB)
    if (customerIdCod !== null) {
      await c.env.DB.prepare('UPDATE orders SET customer_id = ? WHERE id = ?')
        .bind(customerIdCod, orderId).run()
    }

    await decrementStock(c.env.DB, stockLines)

    try {
      const emailRows = await c.env.DB.prepare(
        "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','merchant_email')"
      ).all<{ key: string; value: string }>()
      const eCfg: Record<string, string> = {}
      for (const row of emailRows.results) eCfg[row.key] = row.value

      const origin = new URL(c.req.url).origin

      try {
        await sendEmail(
          {
            to: body.customer_email,
            subject: `Order ${orderId} Confirmed`,
            html: orderConfirmationHtml({
              id: orderId,
              customer_name: body.customer_name,
              items_json: JSON.stringify(quote.items),
              total_amount: quote.total_amount,
              shipping_amount: quote.shipping_amount,
              payment_method: 'cod',
              shipping_address: body.shipping_address,
              origin,
            }),
          },
          { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
        )
      } catch { /* non-fatal — order already placed */ }

      if (eCfg.merchant_email) {
        try {
          await sendEmail(
            {
              to: eCfg.merchant_email,
              subject: `New Order: ${orderId}`,
              html: newOrderAlertHtml({
                id: orderId,
                customer_name: body.customer_name,
                customer_email: body.customer_email,
                total_amount: quote.total_amount,
                payment_method: 'cod',
              }),
            },
            { email_api_key: eCfg.email_api_key ?? '', email_from_name: eCfg.email_from_name ?? '', email_from_address: eCfg.email_from_address ?? '' }
          )
        } catch { /* non-fatal — order already placed */ }
      }
    } catch (err) {
      console.error('COD confirmation email failed:', err)
    }

    return c.json({ order_id: orderId, payment_method: 'cod' }, 201)
  }

  // Razorpay flow
  const settingsRows = await c.env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('razorpay_key_id', 'razorpay_key_secret')"
  ).all<{ key: string; value: string }>()
  const cfg: Record<string, string> = {}
  for (const row of settingsRows.results) cfg[row.key] = row.value

  if (!cfg.razorpay_key_id || !cfg.razorpay_key_secret) {
    return c.json({ error: 'Razorpay not configured' }, 503)
  }

  const rzpStockIssues = await validateStock(c.env.DB, stockLines)
  if (rzpStockIssues) {
    return c.json({ error: 'stock_error', items: rzpStockIssues }, 400)
  }

  const authHeader = 'Basic ' + btoa(`${cfg.razorpay_key_id}:${cfg.razorpay_key_secret}`)
  const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    // The Razorpay order is created from the SERVER-computed total, never
    // body.total_amount — this is the whole point of §7.3.
    body: JSON.stringify({
      amount: Math.round(quote.total_amount * 100),
      currency: 'INR',
      receipt: orderId,
    }),
  })
  if (!rzpRes.ok) {
    return c.json({ error: 'Razorpay order creation failed' }, 502)
  }
  const rzpOrder = await rzpRes.json() as { id: string }

  await c.env.DB.prepare(`
    INSERT INTO orders (id, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, shipping_state, shipping_pincode, shipping_country,
      items_json, subtotal, print_total, shipping_amount, total_amount,
      payment_method, payment_status, order_status, razorpay_order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'razorpay', 'pending', 'placed', ?)
  `).bind(
    orderId,
    body.customer_name,
    body.customer_email,
    body.customer_phone ?? '',
    body.shipping_address,
    body.shipping_city ?? '',
    body.shipping_state ?? '',
    body.shipping_pincode ?? '',
    body.shipping_country ?? 'India',
    JSON.stringify(quote.items),
    quote.subtotal,
    quote.print_total,
    quote.shipping_amount,
    quote.total_amount,
    rzpOrder.id
  ).run()

  await linkDesignsToOrder(c.env.DB, orderId, quote.items)

  const authHeaderRzp = c.req.header('Authorization') ?? ''
  const customerIdRzp = await getCustomerIdFromHeader(authHeaderRzp, c.env.DB)
  if (customerIdRzp !== null) {
    await c.env.DB.prepare('UPDATE orders SET customer_id = ? WHERE id = ?')
      .bind(customerIdRzp, orderId).run()
  }

  return c.json({
    order_id: orderId,
    razorpay_order_id: rzpOrder.id,
    razorpay_key_id: cfg.razorpay_key_id,
    payment_method: 'razorpay',
  }, 201)
})

export default checkout
