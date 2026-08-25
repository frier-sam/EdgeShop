// worker/src/lib/emailTemplates.ts

// Matches the §7.4 items_json shape produced by lib/pricing.ts. Duplicated
// here (rather than imported) so this module has zero dependency on
// pricing.ts's D1-facing types — it only needs to describe the JSON shape
// it renders.
interface OrderConfirmationItem {
  name: string
  size?: string | null
  quantity: number
  unit_price?: number
  price?: number
  print_fees?: { side: 'front' | 'back'; fee: number }[]
  previews?: Record<string, string>
  image_url?: string
}

function absoluteUrl(origin: string, path: string): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
}

/** POD.md §7.5 — one row per order line, showing the design preview (if
 * any), size, and a per-side print-fee breakdown. Email clients can't
 * resolve root-relative `/img/...` paths, so every image src is built
 * absolute from the request's own origin. */
function renderItemRow(item: OrderConfirmationItem, origin: string): string {
  const unitPrice = item.unit_price ?? item.price ?? 0
  const previewPath = item.previews?.front ?? item.previews?.back ?? item.image_url ?? ''
  const previewUrl = previewPath ? absoluteUrl(origin, previewPath) : ''

  const thumbCell = previewUrl
    ? `<img src="${escapeHtml(previewUrl)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #e5e5e5" />`
    : `<div style="width:64px;height:64px;border-radius:6px;background:#f5f5f5"></div>`

  const feesLine = (item.print_fees ?? [])
    .map((f) => `${escapeHtml(f.side)} print +₹${f.fee}`)
    .join(', ')

  const metaBits = [item.size ? `Size ${escapeHtml(item.size)}` : '', feesLine].filter(Boolean).join(' · ')

  return `
    <tr>
      <td style="padding:8px;vertical-align:top">${thumbCell}</td>
      <td style="padding:8px;vertical-align:top">
        <div style="font-weight:600">${escapeHtml(item.name)}</div>
        ${metaBits ? `<div style="font-size:12px;color:#666;margin-top:2px">${metaBits}</div>` : ''}
      </td>
      <td style="padding:8px;text-align:center;vertical-align:top">${item.quantity}</td>
      <td style="padding:8px;text-align:right;vertical-align:top">₹${unitPrice}</td>
    </tr>
  `
}

export function orderConfirmationHtml(order: {
  id: string
  customer_name: string
  items_json: string
  total_amount: number
  shipping_amount?: number
  payment_method: string
  shipping_address: string
  /** Request origin (e.g. https://shop.example.com), used to make preview image srcs absolute — see POD.md §7.5. */
  origin: string
}): string {
  let items: OrderConfirmationItem[] = []
  try {
    items = JSON.parse(order.items_json)
  } catch {
    // malformed items_json — render empty list
  }

  const itemRows = items.map((i) => renderItemRow(i, order.origin)).join('')

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2 style="margin-bottom:8px">Order Confirmed! 🎉</h2>
      <p>Hi ${escapeHtml(order.customer_name)}, your order <strong>${escapeHtml(order.id)}</strong> has been placed successfully.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px;text-align:left">Item</th>
            <th></th>
            <th style="padding:8px;text-align:center">Qty</th>
            <th style="padding:8px;text-align:right">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      ${order.shipping_amount != null ? `<p>Shipping: ${order.shipping_amount === 0 ? 'Free' : `₹${order.shipping_amount}`}</p>` : ''}
      <p><strong>Total: ₹${order.total_amount}</strong></p>
      <p>Payment: ${escapeHtml(order.payment_method).toUpperCase()}</p>
      <p>Shipping to: ${escapeHtml(order.shipping_address)}</p>
    </body>
    </html>
  `
}

export function newOrderAlertHtml(order: {
  id: string
  customer_name: string
  customer_email: string
  total_amount: number
  payment_method: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2>New Order Received 🛍️</h2>
      <p>Order <strong>${escapeHtml(order.id)}</strong> from ${escapeHtml(order.customer_name)} (${escapeHtml(order.customer_email)})</p>
      <p><strong>Total: ₹${order.total_amount}</strong> — ${escapeHtml(order.payment_method).toUpperCase()}</p>
    </body>
    </html>
  `
}

export function shippingUpdateHtml(order: {
  id: string
  customer_name: string
  tracking_number: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2>Your Order Has Shipped! 📦</h2>
      <p>Hi ${escapeHtml(order.customer_name)}, order <strong>${escapeHtml(order.id)}</strong> is on its way.</p>
      <p>Tracking number: <strong>${escapeHtml(order.tracking_number)}</strong></p>
    </body>
    </html>
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function passwordResetHtml(data: {
  customer_name: string
  reset_url: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2>Reset Your Password</h2>
      <p>Hi ${escapeHtml(data.customer_name)},</p>
      <p>We received a request to reset your password. Click the link below — it expires in 1 hour.</p>
      <a href="${escapeHtml(data.reset_url)}"
         style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1A1A1A;color:white;text-decoration:none;border-radius:4px">
        Reset Password
      </a>
      <p style="font-size:12px;color:#888">If you didn't request this, ignore this email. Your password won't change.</p>
    </body>
    </html>
  `
}
