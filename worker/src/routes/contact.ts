import { Hono } from 'hono'
import { sendEmail } from '../lib/email'
import { contactFormHtml } from '../lib/emailTemplates'

type Env = {
  DB: D1Database
  BUCKET: R2Bucket
  RAZORPAY_WEBHOOK_SECRET: string
  R2_PUBLIC_URL: string
  FRONTEND_URL: string
}

const contact = new Hono<{ Bindings: Env }>()

contact.post('/', async (c) => {
  const body = await c.req.json<{ name: string; email: string; message: string }>()

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim()
  const message = (body.message ?? '').trim()

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'A valid email address is required' }, 400)
  }
  if (!message) {
    return c.json({ error: 'Message is required' }, 400)
  }
  if (message.length > 5000) {
    return c.json({ error: 'Message too long (max 5000 characters)' }, 400)
  }

  const { results } = await c.env.DB.prepare(
    "SELECT key, value FROM settings WHERE key IN ('email_api_key','email_from_name','email_from_address','merchant_email')"
  ).all<{ key: string; value: string }>()

  const cfg: Record<string, string> = {}
  for (const row of results) cfg[row.key] = row.value

  const merchantEmail = cfg.merchant_email ?? ''

  // Strip CR and LF from name to prevent email header injection via the subject line
  const safeName = name.replace(/[\r\n]/g, '')

  if (merchantEmail) {
    await sendEmail(
      {
        to: merchantEmail,
        subject: `Contact form: ${safeName}`,
        html: contactFormHtml({ name, email, message }),
      },
      {
        email_api_key: cfg.email_api_key ?? '',
        email_from_name: cfg.email_from_name ?? '',
        email_from_address: cfg.email_from_address ?? '',
      }
    )
  } else {
    console.warn('merchant_email not configured — contact form email skipped')
  }

  return c.json({ ok: true })
})

export default contact
