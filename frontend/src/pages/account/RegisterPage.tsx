import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useSettings } from '../../lib/useSettings'
import { NAV_ITEMS } from '../../lib/storeConfig'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header'
import Field from '../../components/Field'
import Button from '../../components/Button'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { store_name: storeName } = useSettings()
  const totalItems = useCartStore((s) => s.totalItems)
  const setAuth = useAuthStore((s) => s.setAuth)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = (await res.json()) as { token?: string; customer_id?: number; name?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.')
        return
      }
      if (data.token && data.customer_id != null) {
        setAuth(data.token, data.customer_id, data.name ?? name)
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
        <h1 className="mb-2 font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink">Create Account</h1>
        <p className="mb-8 text-sm text-ink-soft">Track your orders and check out faster next time.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
            Create Account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-soft">
          Already have an account?{' '}
          <Link to="/account/login" className="font-medium text-ink underline underline-offset-2 hover:text-accent">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  )
}
