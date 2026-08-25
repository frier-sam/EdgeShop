import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import Field from '../../components/Field'
import Button from '../../components/Button'

export default function AdminLogin() {
  const navigate = useNavigate()
  const adminToken = useAdminAuthStore(s => s.adminToken)
  const setAdminAuth = useAdminAuthStore(s => s.setAdminAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (adminToken) navigate('/admin/dashboard', { replace: true })
  }, [adminToken, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json() as {
        token?: string
        customer_id?: number
        name?: string
        role?: string
        permissions?: Record<string, boolean>
        error?: string
      }
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Login failed')
        return
      }
      if (data.role !== 'staff' && data.role !== 'super_admin') {
        setError('Access denied. This account does not have admin access.')
        return
      }
      setAdminAuth(data.token, data.customer_id!, data.name ?? '', data.role!, data.permissions ?? {})
      navigate('/admin/dashboard', { replace: true })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-bold tracking-tight text-ink">Admin Login</p>
          <p className="mt-2 text-sm text-ink-soft">Sign in to access the admin panel</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-card border border-line bg-surface p-6 shadow-card">
          <Field
            label="Email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
