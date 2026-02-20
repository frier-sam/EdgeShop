import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../../themes/ThemeProvider'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'

interface Profile {
  id: number
  name: string
  email: string
  phone: string
}

interface Address {
  id: number
  label: string
  address_line: string
  city: string
  state: string
  pincode: string
  country: string
}

interface Settings {
  store_name?: string
  [key: string]: string | undefined
}

export default function AccountProfilePage() {
  const navigate = useNavigate()
  const { theme, isLoading: themeLoading, navItems } = useTheme()
  const totalItems = useCartStore((s) => s.totalItems)
  const token = useAuthStore((s) => s.token)
  const setCustomerName = useAuthStore((s) => s.setCustomerName)
  const logout = useAuthStore((s) => s.logout)
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [saveError, setSaveError] = useState('')

  if (!token) {
    navigate('/account/login', { replace: true })
    return null
  }

  const authHeaders = { Authorization: `Bearer ${token}` }

  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ['account-profile', token],
    queryFn: () =>
      fetch('/api/account/profile', { headers: authHeaders })
        .then((r) => {
          if (!r.ok) throw new Error('Failed to load profile')
          return r.json()
        }),
    enabled: !!token,
  })

  const { data: addressData, isLoading: addressesLoading } = useQuery<{ addresses: Address[] }>({
    queryKey: ['account-addresses', token],
    queryFn: () =>
      fetch('/api/account/addresses', { headers: authHeaders })
        .then((r) => {
          if (!r.ok) throw new Error('Failed to load addresses')
          return r.json()
        }),
    enabled: !!token,
  })

  const saveMutation = useMutation({
    mutationFn: (body: { name?: string; phone?: string }) =>
      fetch('/api/account/profile', {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to save')
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-profile'] })
      if (editName) setCustomerName(editName)
      setEditing(false)
      setSaveError('')
    },
    onError: () => setSaveError('Failed to save changes. Please try again.'),
  })

  const storeName = settings?.store_name ?? 'EdgeShop'
  const addresses = addressData?.addresses ?? []

  const handleEdit = () => {
    setEditName(profile?.name ?? '')
    setEditPhone(profile?.phone ?? '')
    setSaveError('')
    setEditing(true)
  }

  const handleSave = () => {
    const body: { name?: string; phone?: string } = {}
    if (editName.trim() !== profile?.name) body.name = editName.trim()
    if (editPhone.trim() !== profile?.phone) body.phone = editPhone.trim()
    if (!Object.keys(body).length) { setEditing(false); return }
    saveMutation.mutate(body)
  }

  const handleLogout = () => {
    queryClient.removeQueries({ queryKey: ['account-orders'] })
    queryClient.removeQueries({ queryKey: ['account-profile'] })
    queryClient.removeQueries({ queryKey: ['account-addresses'] })
    logout()
    navigate('/')
  }

  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const { Header } = theme.components

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => {}}
        navItems={navItems}
      />
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">My Account</h1>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 border border-gray-300 rounded px-4 py-2 hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-8">
          <Link
            to="/account/orders"
            className="pb-3 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors"
          >
            Orders
          </Link>
          <span className="pb-3 text-sm font-medium border-b-2 border-gray-900 text-gray-900">
            Profile
          </span>
        </div>

        {profileLoading ? (
          <p className="text-sm text-gray-400">Loading profile...</p>
        ) : profile ? (
          <div className="space-y-8">
            {/* Profile card */}
            <section className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-800">Personal details</h2>
                {!editing && (
                  <button
                    onClick={handleEdit}
                    className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <p className="text-sm text-gray-500">{profile.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed</p>
                  </div>
                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      className="text-sm bg-gray-900 text-white rounded px-4 py-2 hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="text-sm text-gray-500 border border-gray-300 rounded px-4 py-2 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div className="flex gap-4">
                    <dt className="w-20 text-xs text-gray-400 pt-0.5">Name</dt>
                    <dd className="text-sm text-gray-800">{profile.name || '—'}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-20 text-xs text-gray-400 pt-0.5">Email</dt>
                    <dd className="text-sm text-gray-800">{profile.email}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-20 text-xs text-gray-400 pt-0.5">Phone</dt>
                    <dd className="text-sm text-gray-800">{profile.phone || '—'}</dd>
                  </div>
                </dl>
              )}
            </section>

            {/* Saved addresses */}
            <section>
              <h2 className="text-base font-semibold text-gray-800 mb-4">Saved addresses</h2>
              {addressesLoading ? (
                <p className="text-sm text-gray-400">Loading addresses...</p>
              ) : addresses.length === 0 ? (
                <p className="text-sm text-gray-500">No saved addresses yet. They are saved automatically when you place an order.</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{addr.label}</p>
                      <p className="text-sm text-gray-800">{addr.address_line}</p>
                      {(addr.city || addr.state || addr.pincode) && (
                        <p className="text-sm text-gray-600 mt-0.5">
                          {[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {addr.country && <p className="text-sm text-gray-500">{addr.country}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <p className="text-sm text-red-600">Failed to load profile.</p>
        )}
      </main>
    </div>
  )
}
