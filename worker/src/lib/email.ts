// worker/src/lib/email.ts

export interface EmailOptions {
  to: string
  subject: string
  html: string
}

export type EmailProvider = 'resend' | 'sendgrid' | 'brevo'

export interface EmailSettings {
  email_provider?: string
  email_api_key: string
  email_from_name: string
  email_from_address: string
}

async function sendViaResend(options: EmailOptions, settings: EmailSettings): Promise<void> {
  const fromName = settings.email_from_name || settings.email_from_address
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.email_api_key}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${settings.email_from_address}>`,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  })
  if (!res.ok) {
    const error = await res.text()
    console.error('Resend API error:', res.status, error)
  }
}

async function sendViaSendGrid(options: EmailOptions, settings: EmailSettings): Promise<void> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.email_api_key}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: options.to }] }],
      from: {
        email: settings.email_from_address,
        name: settings.email_from_name || settings.email_from_address,
      },
      subject: options.subject,
      content: [{ type: 'text/html', value: options.html }],
    }),
  })
  if (!res.ok) {
    const error = await res.text()
    console.error('SendGrid API error:', res.status, error)
  }
}

async function sendViaBrevo(options: EmailOptions, settings: EmailSettings): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': settings.email_api_key,
    },
    body: JSON.stringify({
      sender: {
        name: settings.email_from_name || settings.email_from_address,
        email: settings.email_from_address,
      },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    }),
  })
  if (!res.ok) {
    const error = await res.text()
    console.error('Brevo API error:', res.status, error)
  }
}

export async function sendEmail(
  options: EmailOptions,
  settings: EmailSettings
): Promise<void> {
  if (!settings.email_api_key || !settings.email_from_address) {
    console.warn('Email not configured — skipping send')
    return
  }

  try {
    const provider = (settings.email_provider ?? 'resend') as EmailProvider
    if (provider === 'sendgrid') {
      await sendViaSendGrid(options, settings)
    } else if (provider === 'brevo') {
      await sendViaBrevo(options, settings)
    } else {
      await sendViaResend(options, settings)
    }
  } catch (err) {
    console.error('Email send failed:', err)
  }
}
