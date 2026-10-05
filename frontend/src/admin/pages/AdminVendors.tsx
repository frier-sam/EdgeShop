import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { fetchJsonWith } from '../../lib/api'
import Field from '../../components/Field'
import Button from '../../components/Button'
import Badge from '../../components/ui/Badge'

interface Vendor {
  id: number
  name: string
  contact: string
  email: string
  phone: string
  notes: string
  active: number
  order_count: number
}

interface Draft {
  name: string
  contact: string
  email: string
  phone: string
  notes: string
}

const EMPTY: Draft = { name: '', contact: '', email: '', phone: '', notes: '' }

function VendorForm({
  initial,
  submitLabel,
  loading,
  error,
  onSubmit,
  onCancel,
}: {
  initial: Draft
  submitLabel: string
  loading: boolean
  error: string
  onSubmit: (d: Draft) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }))
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (draft.name.trim()) onSubmit(draft)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vendor name" required value={draft.name} onChange={set('name')} />
        <Field label="Contact person" value={draft.contact} onChange={set('contact')} />
        <Field label="Email" type="email" value={draft.email} onChange={set('email')} />
        <Field label="Phone" value={draft.phone} onChange={set('phone')} />
      </div>
      <Field
        label="Notes"
        as="textarea"
        rows={3}
        value={draft.notes}
        onChange={set('notes')}
        hint="What they produce, turnaround time, rates…"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={loading} disabled={!draft.name.trim()}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  )
}

export default function AdminVendors() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: () => fetchJsonWith<{ vendors: Vendor[] }>(adminFetch, '/api/admin/vendors'),
  })
  const vendors = data?.vendors ?? []

  const save = useMutation({
    mutationFn: async ({ id, body }: { id?: number; body: Partial<Draft> & { active?: number } }) => {
      const r = await adminFetch(id ? `/api/admin/vendors/${id}` : '/api/admin/vendors', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Save failed')
    },
    onSuccess: () => {
      setError('')
      setAdding(false)
      setEditingId(null)
      qc.invalidateQueries({ queryKey: ['admin-vendors'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await adminFetch(`/api/admin/vendors/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error(((await r.json()) as { error?: string }).error ?? 'Delete failed')
    },
    onSuccess: () => {
      setError('')
      qc.invalidateQueries({ queryKey: ['admin-vendors'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-headline-md text-primary">Vendors</h1>
        {!adding && <Button onClick={() => { setAdding(true); setEditingId(null); setError('') }}>Enroll vendor</Button>}
      </div>
      <p className="text-sm text-ink-soft">
        Vendors are the people you assign print and fulfilment work to. Assign one from an order's detail page.
      </p>

      {adding && (
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-4 font-display font-semibold text-ink">Enroll a vendor</h2>
          <VendorForm
            initial={EMPTY}
            submitLabel="Enroll vendor"
            loading={save.isPending}
            error={error}
            onSubmit={(body) => save.mutate({ body })}
            onCancel={() => { setAdding(false); setError('') }}
          />
        </div>
      )}

      {!adding && error && <p className="text-sm text-danger">{error}</p>}
      {isLoading && <p className="text-sm text-ink-faint">Loading…</p>}
      {!isLoading && vendors.length === 0 && !adding && (
        <p className="rounded-card border border-line bg-surface py-8 text-center text-sm text-ink-faint">
          No vendors enrolled yet.
        </p>
      )}

      <div className="space-y-3">
        {vendors.map((v) => (
          <div key={v.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
            {editingId === v.id ? (
              <VendorForm
                initial={{ name: v.name, contact: v.contact, email: v.email, phone: v.phone, notes: v.notes }}
                submitLabel="Save"
                loading={save.isPending}
                error={error}
                onSubmit={(body) => save.mutate({ id: v.id, body })}
                onCancel={() => { setEditingId(null); setError('') }}
              />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    {v.name}
                    {!v.active && <Badge variant="neutral" size="sm">Inactive</Badge>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {[v.contact, v.email, v.phone].filter(Boolean).join(' · ') || 'No contact details'}
                  </p>
                  {v.notes && <p className="mt-1 whitespace-pre-line text-xs text-ink-faint">{v.notes}</p>}
                  <p className="mt-1 text-xs text-ink-soft">{v.order_count} assigned order{v.order_count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => { setEditingId(v.id); setAdding(false); setError('') }}>Edit</Button>
                  <Button size="sm" variant="secondary" onClick={() => save.mutate({ id: v.id, body: { active: v.active ? 0 : 1 } })}>
                    {v.active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => { if (window.confirm(`Delete ${v.name}?`)) remove.mutate(v.id) }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
