import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface ShippingZone {
  id: number
  name: string
  countries_json: string
}

interface ShippingRate {
  id: number
  zone_id: number
  name: string
  min_weight: number
  max_weight: number
  price: number
  free_above_cart_total: number
}

const emptyZoneForm = { name: '', countries: '' }
const emptyRateForm = {
  name: '',
  min_weight: '0',
  max_weight: '1000',
  price: '0',
  free_above_cart_total: '0',
}

function parseCountries(countries_json: string): string {
  try {
    const arr = JSON.parse(countries_json) as string[]
    return arr.join(', ')
  } catch {
    return ''
  }
}

function serializeCountries(countries: string): string {
  const arr = countries
    .split(',')
    .map(c => c.trim().toUpperCase())
    .filter(Boolean)
  return JSON.stringify(arr)
}

export default function AdminShipping() {
  const qc = useQueryClient()

  // Zone view state
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null)
  const [zoneModal, setZoneModal] = useState<'create' | 'edit' | null>(null)
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null)
  const [zoneForm, setZoneForm] = useState(emptyZoneForm)
  const [deleteZoneId, setDeleteZoneId] = useState<number | null>(null)

  // Rate view state
  const [rateModal, setRateModal] = useState<'create' | 'edit' | null>(null)
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null)
  const [rateForm, setRateForm] = useState(emptyRateForm)
  const [deleteRateId, setDeleteRateId] = useState<number | null>(null)

  // Fetch all zones
  const { data: zonesData, isLoading: zonesLoading } = useQuery<{ zones: ShippingZone[] }>({
    queryKey: ['admin-shipping-zones'],
    queryFn: () =>
      fetch('/api/admin/shipping/zones').then(r => {
        if (!r.ok) throw new Error('Failed to load zones')
        return r.json() as Promise<{ zones: ShippingZone[] }>
      }),
  })

  // Fetch rates for selected zone
  const { data: ratesData, isLoading: ratesLoading } = useQuery<{ rates: ShippingRate[] }>({
    queryKey: ['admin-shipping-rates', selectedZoneId],
    queryFn: () =>
      fetch(`/api/admin/shipping/zones/${selectedZoneId}/rates`).then(r => {
        if (!r.ok) throw new Error('Failed to load rates')
        return r.json() as Promise<{ rates: ShippingRate[] }>
      }),
    enabled: !!selectedZoneId,
  })

  // Zone mutations
  const createZoneMutation = useMutation({
    mutationFn: (body: { name: string; countries_json: string }) =>
      fetch('/api/admin/shipping/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to create zone')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] })
      closeZoneModal()
    },
  })

  const updateZoneMutation = useMutation({
    mutationFn: (body: { name: string; countries_json: string }) =>
      fetch(`/api/admin/shipping/zones/${editingZone!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to update zone')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] })
      closeZoneModal()
    },
  })

  const deleteZoneMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/shipping/zones/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Failed to delete zone')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping-zones'] })
      setDeleteZoneId(null)
    },
  })

  // Rate mutations
  const createRateMutation = useMutation({
    mutationFn: (body: Omit<ShippingRate, 'id' | 'zone_id'>) =>
      fetch(`/api/admin/shipping/zones/${selectedZoneId}/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to create rate')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping-rates', selectedZoneId] })
      closeRateModal()
    },
  })

  const updateRateMutation = useMutation({
    mutationFn: (body: Partial<Omit<ShippingRate, 'id' | 'zone_id'>>) =>
      fetch(`/api/admin/shipping/rates/${editingRate!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to update rate')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping-rates', selectedZoneId] })
      closeRateModal()
    },
  })

  const deleteRateMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/shipping/rates/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Failed to delete rate')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping-rates', selectedZoneId] })
      setDeleteRateId(null)
    },
  })

  // Zone modal helpers
  function openCreateZone() {
    createZoneMutation.reset()
    updateZoneMutation.reset()
    setEditingZone(null)
    setZoneForm(emptyZoneForm)
    setZoneModal('create')
  }

  function openEditZone(zone: ShippingZone) {
    createZoneMutation.reset()
    updateZoneMutation.reset()
    setEditingZone(zone)
    setZoneForm({ name: zone.name, countries: parseCountries(zone.countries_json) })
    setZoneModal('edit')
  }

  function closeZoneModal() {
    setZoneModal(null)
    setEditingZone(null)
    setZoneForm(emptyZoneForm)
  }

  function submitZoneForm(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: zoneForm.name,
      countries_json: serializeCountries(zoneForm.countries),
    }
    if (zoneModal === 'edit') {
      updateZoneMutation.mutate(payload)
    } else {
      createZoneMutation.mutate(payload)
    }
  }

  const zoneSaveMutation = zoneModal === 'edit' ? updateZoneMutation : createZoneMutation

  // Rate modal helpers
  function openCreateRate() {
    createRateMutation.reset()
    updateRateMutation.reset()
    setEditingRate(null)
    setRateForm(emptyRateForm)
    setRateModal('create')
  }

  function openEditRate(rate: ShippingRate) {
    createRateMutation.reset()
    updateRateMutation.reset()
    setEditingRate(rate)
    setRateForm({
      name: rate.name,
      min_weight: String(rate.min_weight),
      max_weight: String(rate.max_weight),
      price: String(rate.price),
      free_above_cart_total: String(rate.free_above_cart_total),
    })
    setRateModal('edit')
  }

  function closeRateModal() {
    setRateModal(null)
    setEditingRate(null)
    setRateForm(emptyRateForm)
  }

  function submitRateForm(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: rateForm.name,
      min_weight: parseFloat(rateForm.min_weight) || 0,
      max_weight: parseFloat(rateForm.max_weight) || 0,
      price: parseFloat(rateForm.price) || 0,
      free_above_cart_total: parseFloat(rateForm.free_above_cart_total) || 0,
    }
    if (rateModal === 'edit') {
      updateRateMutation.mutate(payload)
    } else {
      createRateMutation.mutate(payload)
    }
  }

  const rateSaveMutation = rateModal === 'edit' ? updateRateMutation : createRateMutation

  const zones = zonesData?.zones ?? []
  const rates = ratesData?.rates ?? []
  const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null

  // ── Rates sub-view ──────────────────────────────────────────────────────────
  if (selectedZoneId !== null) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedZoneId(null)
                setDeleteRateId(null)
              }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              ← Zones
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {selectedZone ? selectedZone.name : 'Zone'} — Rates
            </h1>
          </div>
          <button
            onClick={openCreateRate}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
          >
            + Add Rate
          </button>
        </div>

        {/* Rates table */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Weight Range (g)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Price (₹)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Free Above (₹)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ratesLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!ratesLoading && rates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No rates yet. Add your first shipping rate.
                  </td>
                </tr>
              )}
              {rates.map(rate => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{rate.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {rate.min_weight}–{rate.max_weight} g
                  </td>
                  <td className="px-4 py-3 text-gray-700">₹{rate.price}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {rate.free_above_cart_total > 0 ? `₹${rate.free_above_cart_total}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEditRate(rate)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    {deleteRateId === rate.id ? (
                      <span className="text-xs">
                        <button
                          onClick={() => deleteRateMutation.mutate(rate.id)}
                          className="text-red-600 hover:text-red-800 mr-1"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteRateId(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteRateId(rate.id)}
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

        {/* Rate modal */}
        {rateModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  {rateModal === 'create' ? 'Add Shipping Rate' : 'Edit Shipping Rate'}
                </h2>
                <button
                  onClick={closeRateModal}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  &times;
                </button>
              </div>
              <form onSubmit={submitRateForm} className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    required
                    value={rateForm.name}
                    onChange={e => setRateForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="Standard Shipping"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Min Weight (g)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={rateForm.min_weight}
                      onChange={e => setRateForm(f => ({ ...f, min_weight: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Max Weight (g)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={rateForm.max_weight}
                      onChange={e => setRateForm(f => ({ ...f, max_weight: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rateForm.price}
                      onChange={e => setRateForm(f => ({ ...f, price: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Free Above Cart Total (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={rateForm.free_above_cart_total}
                      onChange={e =>
                        setRateForm(f => ({ ...f, free_above_cart_total: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                      placeholder="0 = never free"
                    />
                  </div>
                </div>

                {rateSaveMutation.isError && (
                  <p className="text-red-600 text-xs">Failed to save. Please try again.</p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeRateModal}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rateSaveMutation.isPending}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    {rateSaveMutation.isPending ? 'Saving…' : 'Save Rate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Zones list view ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Shipping Zones</h1>
        <button
          onClick={openCreateZone}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          + Add Zone
        </button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Zone Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Countries</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {zonesLoading && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}
            {!zonesLoading && zones.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  No shipping zones yet. Add your first zone.
                </td>
              </tr>
            )}
            {zones.map(zone => {
              let countryCodes: string[] = []
              try {
                countryCodes = JSON.parse(zone.countries_json) as string[]
              } catch {
                countryCodes = []
              }
              return (
                <tr key={zone.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{zone.name}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {countryCodes.length > 0 ? (
                      <span className="font-mono text-xs">{countryCodes.join(', ')}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setSelectedZoneId(zone.id)}
                      className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2 py-1"
                    >
                      Manage Rates
                    </button>
                    <button
                      onClick={() => openEditZone(zone)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    {deleteZoneId === zone.id ? (
                      <span className="text-xs">
                        <button
                          onClick={() => deleteZoneMutation.mutate(zone.id)}
                          className="text-red-600 hover:text-red-800 mr-1"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteZoneId(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteZoneId(zone.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Zone modal */}
      {zoneModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {zoneModal === 'create' ? 'Add Shipping Zone' : 'Edit Shipping Zone'}
              </h2>
              <button
                onClick={closeZoneModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form onSubmit={submitZoneForm} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Zone Name *
                </label>
                <input
                  required
                  value={zoneForm.name}
                  onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="e.g. India, International"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Countries{' '}
                  <span className="text-gray-400 font-normal">(comma-separated ISO codes)</span>
                </label>
                <input
                  value={zoneForm.countries}
                  onChange={e => setZoneForm(f => ({ ...f, countries: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
                  placeholder="IN, US, GB"
                />
              </div>

              {zoneSaveMutation.isError && (
                <p className="text-red-600 text-xs">Failed to save. Please try again.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeZoneModal}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={zoneSaveMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {zoneSaveMutation.isPending ? 'Saving…' : 'Save Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
