import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSettings } from '../../lib/useSettings'
import { NAV_ITEMS } from '../../lib/storeConfig'
import { useCartStore } from '../../store/cartStore'
import { useAuthStore } from '../../store/authStore'
import Header from '../../components/Header'
import Field from '../../components/Field'
import Button from '../../components/Button'
import Skeleton from '../../components/ui/Skeleton'

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

export default function AccountProfilePage() {
  const navigate = useNavigate()
  const { store_name: storeName } = useSettings()
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

  const { data: profile, isLoading: profileLoading } = useQuery<Profile>({
    queryKey: ['account-profile', token],
    queryFn: () =>
      fetch('/api/account/profile', { headers: authHeaders }).then((r) => {
        if (!r.ok) throw new Error('Failed to load profile')
        return r.json()
      }),
    enabled: !!token,
  })

  const { data: addressData, isLoading: addressesLoading } = useQuery<{ addresses: Address[] }>({
    queryKey: ['account-addresses', token],
    queryFn: () =>
      fetch('/api/account/addresses', { headers: authHeaders }).then((r) => {
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
    if (!Object.keys(body).length) {
      setEditing(false)
      return
    }
    saveMutation.mutate(body)
  }

  const handleLogout = () => {
    queryClient.removeQueries({ queryKey: ['account-orders'] })
    queryClient.removeQueries({ queryKey: ['account-profile'] })
    queryClient.removeQueries({ queryKey: ['account-addresses'] })
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen">
      <Header storeName={storeName} cartCount={totalItems()} onCartOpen={() => {}} navItems={NAV_ITEMS} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink">My Account</h1>
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Nav tabs */}
        <div className="mb-8 flex gap-6 border-b border-line">
          <Link to="/account/orders" className="pb-3 text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink">
            Orders
          </Link>
          <span className="border-b-2 border-ink pb-3 text-sm font-medium text-ink">Profile</span>
        </div>

        {profileLoading ? (
          <div className="space-y-3 rounded-card border border-line bg-surface p-6">
            <Skeleton shape="text" width={140} height={16} />
            <Skeleton shape="text" width="60%" height={14} />
            <Skeleton shape="text" width="50%" height={14} />
            <Skeleton shape="text" width="40%" height={14} />
          </div>
        ) : profile ? (
          <div className="space-y-8">
            {/* Profile card */}
            <section className="rounded-card border border-line bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink">Personal details</h2>
                {!editing && (
                  <button onClick={handleEdit} className="text-sm text-ink-soft transition-colors duration-fast hover:text-ink">
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <Field label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Field label="Phone" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-soft">Email</label>
                    <p className="text-sm text-ink-soft">{profile.email}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">Email cannot be changed</p>
                  </div>
                  {saveError && <p className="text-xs text-danger">{saveError}</p>}
                  <div className="flex gap-3 pt-1">
                    <Button variant="primary" size="md" onClick={handleSave} loading={saveMutation.isPending}>
                      Save
                    </Button>
                    <Button variant="secondary" size="md" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div className="flex gap-4">
                    <dt className="w-20 pt-0.5 text-xs text-ink-faint">Name</dt>
                    <dd className="text-sm text-ink">{profile.name || '—'}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-20 pt-0.5 text-xs text-ink-faint">Email</dt>
                    <dd className="text-sm text-ink">{profile.email}</dd>
                  </div>
                  <div className="flex gap-4">
                    <dt className="w-20 pt-0.5 text-xs text-ink-faint">Phone</dt>
                    <dd className="text-sm text-ink">{profile.phone || '—'}</dd>
                  </div>
                </dl>
              )}
            </section>

            {/* Saved addresses */}
            <section>
              <h2 className="mb-4 text-base font-semibold text-ink">Saved addresses</h2>
              {addressesLoading ? (
                <div className="space-y-3">
                  <Skeleton shape="rect" height={72} />
                  <Skeleton shape="rect" height={72} />
                </div>
              ) : addresses.length === 0 ? (
                <p className="text-sm text-ink-soft">No saved addresses yet. They are saved automatically when you place an order.</p>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <div key={addr.id} className="rounded-card border border-line bg-surface p-4">
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">{addr.label}</p>
                      <p className="text-sm text-ink">{addr.address_line}</p>
                      {(addr.city || addr.state || addr.pincode) && (
                        <p className="mt-0.5 text-sm text-ink-soft">{[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</p>
                      )}
                      {addr.country && <p className="text-sm text-ink-soft">{addr.country}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <p className="text-sm text-danger">Failed to load profile.</p>
        )}
      </main>
    </div>
  )
}
