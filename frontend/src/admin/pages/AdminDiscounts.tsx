import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface DiscountCode {
  id: number
  code: string
  type: 'percent' | 'fixed' | 'free_shipping'
  value: number
  min_order_amount: number
  max_uses: number
  uses_count: number
  expires_at: string | null
  is_active: number
  created_at: string
}

type ModalMode = 'create' | 'edit' | null

const emptyForm = {
  code: '',
  type: 'percent' as DiscountCode['type'],
  value: 0,
  min_order_amount: 0,
  max_uses: 0,
  expires_at: '',
  is_active: true,
}

function formatValue(discount: DiscountCode): string {
  if (discount.type === 'percent') return `${discount.value}% off`
  if (discount.type === 'fixed') return `₹${discount.value} off`
  return 'Free shipping'
}

function formatExpiry(expires_at: string | null): string {
  if (!expires_at) return 'Never'
  return new Date(expires_at).toLocaleDateString()
}

function formatUses(uses_count: number, max_uses: number): string {
  const maxStr = max_uses === 0 ? '∞' : String(max_uses)
  return `${uses_count} / ${maxStr}`
}

export default function AdminDiscounts() {
  const qc = useQueryClient()

  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<DiscountCode | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState('')

  const { data, isLoading } = useQuery<{ discounts: DiscountCode[] }>({
    queryKey: ['admin-discounts'],
    queryFn: () =>
      fetch('/api/admin/discounts').then(r => {
        if (!r.ok) throw new Error('Failed to load discounts')
        return r.json() as Promise<{ discounts: DiscountCode[] }>
      }),
  })

  const saveMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const payload: Record<string, unknown> = {
        code: body.code,
        type: body.type,
        value: body.type === 'free_shipping' ? 0 : body.value,
        min_order_amount: body.min_order_amount,
        max_uses: body.max_uses,
        is_active: body.is_active,
        expires_at: body.expires_at || null,
      }
      if (editing) {
        const res = await fetch(`/api/admin/discounts/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to save')
      } else {
        const res = await fetch('/api/admin/discounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-discounts'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-discounts'] })
      setDeleteId(null)
      setDeleteError('')
    },
    onError: () => {
      setDeleteError('Failed to delete. Please try again.')
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModal('create')
  }

  function openEdit(discount: DiscountCode) {
    setEditing(discount)
    setForm({
      code: discount.code,
      type: discount.type,
      value: discount.value,
      min_order_amount: discount.min_order_amount ?? 0,
      max_uses: discount.max_uses ?? 0,
      expires_at: discount.expires_at
        ? discount.expires_at.split('T')[0]
        : '',
      is_active: Boolean(discount.is_active),
    })
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setForm(emptyForm)
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  const discounts = data?.discounts ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Discount Codes</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Discount
        </button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Value</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Min Order</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Uses / Max</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Active</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {discounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No discount codes yet. Create your first discount code.
                </td>
              </tr>
            )}
            {discounts.map(discount => (
              <tr key={discount.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-medium text-gray-900">{discount.code}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">
                  {discount.type === 'free_shipping' ? 'Free Shipping' : discount.type}
                </td>
                <td className="px-4 py-3 text-gray-700">{formatValue(discount)}</td>
                <td className="px-4 py-3 text-gray-500">
                  {discount.min_order_amount > 0 ? `₹${discount.min_order_amount}` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">{formatUses(discount.uses_count, discount.max_uses)}</td>
                <td className="px-4 py-3 text-gray-500">{formatExpiry(discount.expires_at)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      discount.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {discount.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openEdit(discount)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  {deleteId === discount.id ? (
                    <span className="text-xs">
                      {deleteError && (
                        <span className="text-red-600 mr-1">{deleteError}</span>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(discount.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-800 mr-1 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => { setDeleteId(discount.id); setDeleteError('') }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {modal === 'create' ? 'New Discount Code' : 'Edit Discount Code'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                saveMutation.mutate(form)
              }}
              className="px-6 py-4 space-y-4"
            >
              {/* Code */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
                <input
                  required
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono uppercase"
                  placeholder="SUMMER20"
                />
              </div>

              {/* Type + Value row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={e =>
                      setForm(f => ({ ...f, type: e.target.value as DiscountCode['type'] }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  >
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Value {form.type !== 'free_shipping' ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required={form.type !== 'free_shipping'}
                    disabled={form.type === 'free_shipping'}
                    value={form.type === 'free_shipping' ? 0 : form.value}
                    onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder={form.type === 'percent' ? '20' : '100'}
                  />
                </div>
              </div>

              {/* Min Order + Max Uses row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Min Order Amount
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_order_amount}
                    onChange={e =>
                      setForm(f => ({ ...f, min_order_amount: Number(e.target.value) }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Max Uses <span className="text-gray-400 font-normal">(0 = unlimited)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.max_uses}
                    onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Expires At */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Expires At <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>

              {/* Is Active */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              {saveMutation.isError && (
                <p className="text-red-600 text-xs">Failed to save. Please try again.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save Discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
