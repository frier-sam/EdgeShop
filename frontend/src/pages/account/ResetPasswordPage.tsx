import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import Field from '../../components/Field'
import Button from '../../components/Button'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || data.error) {
        setError(data.error ?? 'Reset failed. The link may have expired.')
        return
      }
      navigate('/account/login?reset=1')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-center">
        <p className="text-sm text-danger">
          Invalid reset link.{' '}
          <Link to="/account/forgot-password" className="underline underline-offset-2">
            Request a new one.
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink">Set new password</h1>
        <p className="mb-8 text-sm text-ink-soft">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p role="alert" className="rounded-btn border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Field label="New Password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Confirm Password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            Update Password
          </Button>
        </form>
      </div>
    </div>
  )
}
