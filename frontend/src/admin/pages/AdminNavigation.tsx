import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface NavItem {
  label: string
  href: string
}

export default function AdminNavigation() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => {
      if (!r.ok) throw new Error('Failed to load settings')
      return r.json()
    }),
  })

  const [items, setItems] = useState<NavItem[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newHref, setNewHref] = useState('')

  useEffect(() => {
    if (!settings?.navigation_json) return
    try {
      setItems(JSON.parse(settings.navigation_json))
    } catch {
      setItems([])
    }
  }, [settings?.navigation_json])

  const saveMutation = useMutation({
    mutationFn: async (newItems: NavItem[]) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigation_json: JSON.stringify(newItems) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  function addItem() {
    const label = newLabel.trim()
    const href = newHref.trim()
    if (!label || !href) return
    const updated = [...items, { label, href }]
    setItems(updated)
    saveMutation.mutate(updated)
    setNewLabel('')
    setNewHref('')
  }

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
    saveMutation.mutate(updated)
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const updated = [...items]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= updated.length) return
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    setItems(updated)
    saveMutation.mutate(updated)
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Navigation Menu</h1>
      <p className="text-sm text-gray-500">Add links to your storefront navigation bar.</p>

      {/* Current items */}
      <div className="bg-white border border-gray-200 rounded divide-y divide-gray-100">
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No nav items yet.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-400 truncate">{item.href}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => moveItem(i, 'up')}
                disabled={i === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >↑</button>
              <button
                onClick={() => moveItem(i, 'down')}
                disabled={i === items.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >↓</button>
              <button
                onClick={() => removeItem(i)}
                className="p-1 text-red-400 hover:text-red-600 ml-1"
                title="Remove"
              >×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="border border-gray-200 rounded p-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-700">Add Link</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Label</label>
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="About Us"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">URL</label>
            <input
              value={newHref}
              onChange={e => setNewHref(e.target.value)}
              placeholder="/pages/about-us"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        <button
          onClick={addItem}
          disabled={!newLabel.trim() || !newHref.trim() || saveMutation.isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
        >
          Add Link
        </button>
      </div>

      {saveMutation.isError && (
        <p className="text-red-600 text-sm">Failed to save. Please try again.</p>
      )}
      {saveMutation.isSuccess && (
        <p className="text-green-600 text-sm">Saved.</p>
      )}
    </div>
  )
}
