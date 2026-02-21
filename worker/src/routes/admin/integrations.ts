// worker/src/routes/admin/integrations.ts
import { Hono } from 'hono'
import type { Env } from '../../index'
import { sendEmail } from '../../lib/email'

const integrations = new Hono<{ Bindings: Env }>()

// Test ShipRocket credentials
integrations.post('/test-shiprocket', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>()

  if (!email || !password) {
    return c.json({ ok: false, error: 'Email and password are required' }, 400)
  }

  try {
    const res = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!res.ok) {
      const body = await res.text()
      return c.json({ ok: false, error: `ShipRocket rejected credentials: ${res.status} ${body}` })
    }

    const data = await res.json() as {
      token: string
      company: string
      company_id: number
      expires_in?: number
    }

    if (!data.token) {
      return c.json({ ok: false, error: 'ShipRocket returned no token' })
    }

    // Cache token in D1 — expires in 10 days (ShipRocket default)
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('shiprocket_token', ?)").bind(data.token),
      c.env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('shiprocket_token_expires_at', ?)").bind(expiresAt),
    ])

    return c.json({ ok: true, company: data.company ?? 'Unknown' })
  } catch (err) {
    return c.json({ ok: false, error: `Connection failed: ${String(err)}` })
  }
})

// Send a test email using submitted credentials (doesn't require saved settings)
integrations.post('/test-email', async (c) => {
  const { provider, api_key, from_name, from_address, test_to } = await c.req.json<{
    provider: string
    api_key: string
    from_name: string
    from_address: string
    test_to: string
  }>()

  if (!api_key || !from_address || !test_to) {
    return c.json({ ok: false, error: 'api_key, from_address, and test_to are required' }, 400)
  }

  try {
    await sendEmail(
      {
        to: test_to,
        subject: 'EdgeShop: Test Email',
        html: '<p>This is a test email from your EdgeShop store. If you received this, your email integration is working correctly!</p>',
      },
      {
        email_provider: provider,
        email_api_key: api_key,
        email_from_name: from_name,
        email_from_address: from_address,
      }
    )
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ ok: false, error: String(err) })
  }
})

export default integrations
