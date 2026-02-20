import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { useAdminAuthStore } from '../../store/adminAuthStore'

const PERMISSION_KEYS = [
  { key: 'products', label: 'Products & Collections' },
  { key: 'orders', label: 'Orders' },
  { key: 'customers', label: 'Customers' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'content', label: 'Content (Pages/Blog/Nav)' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'settings', label: 'Settings' },
]

interface StaffMember {
  id: number
  name: string
  email: string
  role: 'staff' | 'super_admin'
  permissions: Record<string, boolean>
}

interface Customer {
  id: number
  name: string
  email: string
}

export default function AdminStaff() {
  const qc = useQueryClient()
  const adminRole = useAdminAuthStore(s => s.adminRole)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({})

  const { data, isLoading } = useQuery<{ staff: StaffMember[] }>({
    queryKey: ['admin-staff'],
    queryFn: () => adminFetch('/api/admin/staff').then(r => r.json()),
  })

  const { data: searchData } = useQuery<{ customers: Customer[] }>({
    queryKey: ['staff-search', search],
    queryFn: () => adminFetch(`/api/admin/staff/search?q=${encodeURIComponent(search)}`).then(r => r.json()),
    enabled: search.length >= 2,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, role, permissions }: { id: number; role: 'staff' | 'customer'; permissions?: Record<string, boolean> }) =>
      adminFetch(`/api/admin/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permissions }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-staff'] })
      setEditingId(null)
    },
  })

  const staffList = data?.staff ?? []
  const searchResults = searchData?.customers ?? []

  function startEdit(member: StaffMember) {
    setEditingId(member.id)
    setEditPerms({ ...member.permissions })
  }

  if (adminRole !== 'super_admin') {
    return <div className="text-sm text-gray-500 py-10 text-center">Access denied.</div>
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Staff Management</h1>

      {/* Add staff by searching customers */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Staff Member</h2>
        <input
          type="search"
          placeholder="Search customers by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 mb-3"
        />
        {searchResults.length > 0 && (
          <div className="border border-gray-200 rounded divide-y divide-gray-100">
            {searchResults.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-sm text-gray-800">{c.name || '(no name)'}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </div>
                <button
                  onClick={() => updateMutation.mutate({ id: c.id, role: 'staff', permissions: Object.fromEntries(PERMISSION_KEYS.map(k => [k.key, false])) })}
                  disabled={updateMutation.isPending}
                  className="px-3 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  Add as Staff
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current staff list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Permissions</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : staffList.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No staff members yet</td></tr>
            ) : staffList.map(member => (
              <tr key={member.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{member.name || '(no name)'}</p>
                  <p className="text-xs text-gray-400">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${member.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                    {member.role === 'super_admin' ? 'Super Admin' : 'Staff'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {member.role === 'super_admin' ? (
                    <span className="text-xs text-gray-400">All access</span>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {PERMISSION_KEYS.filter(k => member.permissions[k.key]).map(k => k.label).join(', ') || 'No access'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {member.role !== 'super_admin' && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(member)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { if (confirm('Remove staff access?')) updateMutation.mutate({ id: member.id, role: 'customer' }) }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit permissions modal */}
      {editingId !== null && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditingId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
              <h3 className="font-semibold text-gray-900 mb-4">Edit Permissions</h3>
              <div className="space-y-2 mb-6">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editPerms[key]}
                      onChange={e => setEditPerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setEditingId(null)} className="flex-1 py-2 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate({ id: editingId, role: 'staff', permissions: editPerms })}
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
