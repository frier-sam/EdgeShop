import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'

interface ContactPayload {
  name: string
  email: string
  message: string
}

async function submitContactForm(payload: ContactPayload): Promise<void> {
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? 'Something went wrong. Please try again.')
  }
}

export default function ContactPage() {
  const { theme, settings, isLoading: themeLoading, navItems } = useTheme()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const storeName = settings.store_name ?? 'EdgeShop'

  const mutation = useMutation({
    mutationFn: submitContactForm,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ name, email, message })
  }

  if (themeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    )
  }

  if (!theme) return null

  const { Header, Footer } = theme.components

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={0}
        onCartOpen={() => {}}
        navItems={navItems}
      />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Contact Us</h1>

        {mutation.isSuccess ? (
          <div className="rounded-md bg-green-50 border border-green-200 p-6 text-center">
            <p className="text-green-800 font-medium">
              Thank you, we&apos;ll be in touch!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {mutation.isError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-4">
                <p className="text-red-700 text-sm">
                  {(mutation.error as Error).message}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="contact-message"
                required
                rows={6}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-y"
                maxLength={5000}
                placeholder="How can we help you?"
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-gray-900 text-white rounded-md px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}
      </main>
      <Footer storeName={storeName} />
    </div>
  )
}
