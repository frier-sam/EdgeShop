// worker/src/lib/emailTemplates.ts

export function orderConfirmationHtml(order: {
  id: string
  customer_name: string
  items_json: string
  total_amount: number
  payment_method: string
  shipping_address: string
}): string {
  let items: Array<{ name: string; quantity: number; price: number }> = []
  try {
    items = JSON.parse(order.items_json)
  } catch {
    // malformed items_json — render empty list
  }

  const itemRows = items
    .map(i => `<tr><td style="padding:4px 8px">${escapeHtml(i.name)}</td><td style="padding:4px 8px;text-align:center">${i.quantity}</td><td style="padding:4px 8px;text-align:right">₹${i.price}</td></tr>`)
    .join('')

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
            <th style="padding:8px;text-align:center">Qty</th>
            <th style="padding:8px;text-align:right">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
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
