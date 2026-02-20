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

export function abandonedCartHtml(data: {
  email: string
  items: Array<{ name: string; price: number; quantity: number; image_url?: string }>
  frontendUrl: string
}): string {
  const itemRows = data.items
    .map(i => `<tr><td style="padding:4px 8px">${escapeHtml(i.name)}</td><td style="padding:4px 8px;text-align:center">${Number(i.quantity) || 0}</td><td style="padding:4px 8px;text-align:right">₹${(Number(i.price) || 0).toFixed(2)}</td></tr>`)
    .join('')

  const checkoutUrl = data.frontendUrl ? `${data.frontendUrl}/checkout` : '/checkout'

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2>You left something behind! 🛒</h2>
      <p>Hi, you added items to your cart but didn't complete your purchase.</p>
      ${itemRows ? `
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
      ` : ''}
      <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#1A1A1A;color:white;text-decoration:none;border-radius:4px">Complete Your Purchase</a>
    </body>
    </html>
  `
}

export function contactFormHtml(data: {
  name: string
  email: string
  message: string
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1A1A1A">
      <h2 style="margin-bottom:8px">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
      <p><strong>Message:</strong></p>
      <div style="background:#f5f5f5;padding:16px;border-radius:4px;white-space:pre-wrap">${escapeHtml(data.message)}</div>
    </body>
    </html>
  `
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
