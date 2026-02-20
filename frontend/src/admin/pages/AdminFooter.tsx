import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FooterData, FooterColumn } from '../../themes/types'
import { showToast } from '../Toast'

export default function AdminFooter() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then(r => r.json()),
  })

  const [form, setForm] = useState<FooterData>({
    tagline: '',
    columns: [],
    socials: { instagram: '', facebook: '', whatsapp: '' },
    copyright: '',
  })

  useEffect(() => {
    if (!settings?.footer_json) return
    try { setForm(JSON.parse(settings.footer_json)) } catch { /* ignore */ }
  }, [settings?.footer_json])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ footer_json: JSON.stringify(form) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      showToast('Footer saved', 'success')
    },
    onError: () => {
      showToast('Failed to save footer', 'error')
    },
  })

  function addColumn() {
    if ((form.columns?.length ?? 0) >= 3) return
    setForm(f => ({ ...f, columns: [...(f.columns ?? []), { title: '', links: [] }] }))
  }

  function removeColumn(i: number) {
    setForm(f => ({ ...f, columns: (f.columns ?? []).filter((_, idx) => idx !== i) }))
  }

  function updateColumn(i: number, patch: Partial<FooterColumn>) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      cols[i] = { ...cols[i], ...patch }
      return { ...f, columns: cols }
    })
  }

  function addLink(colIndex: number) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      cols[colIndex] = { ...cols[colIndex], links: [...cols[colIndex].links, { label: '', href: '' }] }
      return { ...f, columns: cols }
    })
  }

  function removeLink(colIndex: number, linkIndex: number) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      cols[colIndex] = { ...cols[colIndex], links: cols[colIndex].links.filter((_, i) => i !== linkIndex) }
      return { ...f, columns: cols }
    })
  }

  function updateLink(colIndex: number, linkIndex: number, patch: { label?: string; href?: string }) {
    setForm(f => {
      const cols = [...(f.columns ?? [])]
      const links = [...cols[colIndex].links]
      links[linkIndex] = { ...links[linkIndex], ...patch }
      cols[colIndex] = { ...cols[colIndex], links }
      return { ...f, columns: cols }
    })
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Footer</h1>

      {/* Basic info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-medium text-gray-800">Basic Info</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tagline</label>
          <input
            value={form.tagline ?? ''}
            onChange={e => setForm(f => ({ ...f, tagline: e.target.value }))}
            placeholder="Crafted with care"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Copyright Text</label>
          <input
            value={form.copyright ?? ''}
            onChange={e => setForm(f => ({ ...f, copyright: e.target.value }))}
            placeholder={`© ${new Date().getFullYear()} Your Store`}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>

      {/* Social links */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-medium text-gray-800">Social Links</h2>
        {(['instagram', 'facebook', 'whatsapp'] as const).map(platform => (
          <div key={platform}>
            <label className="block text-xs text-gray-500 mb-1 capitalize">{platform}</label>
            <input
              value={form.socials?.[platform] ?? ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, [platform]: e.target.value } }))}
              placeholder={`https://${platform}.com/yourpage`}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        ))}
      </div>

      {/* Link columns */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-800">Link Columns</h2>
          {(form.columns?.length ?? 0) < 3 && (
            <button
              onClick={addColumn}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              + Add Column
            </button>
          )}
        </div>
        {form.columns?.map((col, ci) => (
          <div key={ci} className="border border-gray-100 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <input
                value={col.title}
                onChange={e => updateColumn(ci, { title: e.target.value })}
                placeholder="Column Title (e.g. Shop)"
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm mr-2 focus:outline-none focus:border-gray-500"
              />
              <button onClick={() => removeColumn(ci)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </div>
            <div className="space-y-2 pl-2">
              {col.links.map((link, li) => (
                <div key={li} className="flex items-center gap-2">
                  <input
                    value={link.label}
                    onChange={e => updateLink(ci, li, { label: e.target.value })}
                    placeholder="Label"
                    className="w-28 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                  />
                  <input
                    value={link.href}
                    onChange={e => updateLink(ci, li, { href: e.target.value })}
                    placeholder="/pages/about"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                  />
                  <button onClick={() => removeLink(ci, li)} className="text-red-400 hover:text-red-600 text-xs shrink-0">×</button>
                </div>
              ))}
              <button
                onClick={() => addLink(ci)}
                className="text-xs text-gray-500 hover:text-gray-700 pl-0"
              >
                + Add link
              </button>
            </div>
          </div>
        ))}
        {(form.columns?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-400">No link columns yet. Add up to 3.</p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Footer'}
        </button>
      </div>
    </div>
  )
}
