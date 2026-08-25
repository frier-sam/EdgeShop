import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSettings } from '../../lib/useSettings'
import { NAV_ITEMS } from '../../lib/storeConfig'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header'
import Field from '../../components/Field'
import Button from '../../components/Button'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const resetSuccess = searchParams.get('reset') === '1'
  const { store_name: storeName } = useSettings()
  const totalItems = useCartStore((s) => s.totalItems)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as { token?: string; customer_id?: number; name?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please try again.')
        return
      }
      if (data.token && data.customer_id != null) {
        setAuth(data.token, data.customer_id, data.name ?? '')
        navigate('/account/orders')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={() => {}} navItems={NAV_ITEMS} />
      <main className="mx-auto max-w-sm px-4 py-16 sm:py-20">
        <h1 className="mb-2 font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink">Sign In</h1>
        <p className="mb-8 text-sm text-ink-soft">Welcome back — sign in to view your orders.</p>

        {resetSuccess && (
          <div className="mb-6 rounded-btn border border-success/30 bg-success/10 p-3 text-sm text-success">
            Password updated successfully. Please log in.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div>
            <Field
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="mt-1.5 text-right">
              <Link to="/account/forgot-password" className="text-xs text-ink-soft hover:text-ink hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
            Sign In
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Don't have an account?{' '}
          <Link to="/account/register" className="font-medium text-ink underline underline-offset-2 hover:text-accent">
            Create one
          </Link>
        </p>
      </main>
    </div>
  )
}
