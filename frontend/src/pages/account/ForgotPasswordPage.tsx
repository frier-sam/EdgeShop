import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../../components/Field'
import Button from '../../components/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } finally {
      setLoading(false)
      setSubmitted(true) // always show success — don't leak email existence
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink">Forgot password?</h1>
        <p className="mb-8 text-sm text-ink-soft">Enter your email and we'll send a reset link.</p>

        {submitted ? (
          <div className="mb-6 rounded-btn border border-success/30 bg-success/10 p-4 text-sm text-success">
            If that email exists in our system, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Send Reset Link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-ink-soft">
          <Link to="/account/login" className="text-ink underline underline-offset-2 hover:text-accent">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  )
}
