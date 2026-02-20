import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuthStore } from '../../store/adminAuthStore'

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Login</h1>
        <p className="text-sm text-gray-500 mb-8">Sign in to access the admin panel</p>
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
