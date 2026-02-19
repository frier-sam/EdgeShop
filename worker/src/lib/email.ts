// worker/src/lib/email.ts

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(
  options: EmailOptions,
  settings: { email_api_key: string; email_from_name: string; email_from_address: string }
): Promise<void> {
  if (!settings.email_api_key || !settings.email_from_address) {
    console.warn('Email not configured — skipping send')
    return
  }

  const fromName = settings.email_from_name || settings.email_from_address
  const from = `${fromName} <${settings.email_from_address}>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.email_api_key}`,
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      console.error('Resend API error:', res.status, error)
    }
  } catch (err) {
    console.error('Resend fetch failed:', err)
  }
}
