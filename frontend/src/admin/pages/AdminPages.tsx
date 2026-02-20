import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'

interface Page {
  id: number
  slug: string
  title: string
  content_html: string
  meta_title: string
  meta_description: string
  is_visible: number
  created_at: string
}

type ModalMode = 'create' | 'edit' | null

const emptyForm = {
  slug: '',
  title: '',
  content_html: '',
  meta_title: '',
  meta_description: '',
  is_visible: 1,
}

export default function AdminPages() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<Page | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<{ pages: Page[] }>({
    queryKey: ['admin-pages'],
    queryFn: () => adminFetch('/api/admin/pages').then(r => {
      if (!r.ok) throw new Error('Failed to load pages')
      return r.json() as Promise<{ pages: Page[] }>
    }),
  })

  // When editing, fetch full page content
  const { data: fullPage } = useQuery<Page>({
    queryKey: ['admin-page', editing?.id],
    queryFn: () => adminFetch(`/api/admin/pages/${editing!.id}`).then(r => {
      if (!r.ok) throw new Error('Failed to load page')
      return r.json() as Promise<Page>
    }),
    enabled: !!editing,
  })

  // Sync fullPage content into form when it loads
  useEffect(() => {
    if (fullPage && fullPage.id === editing?.id) {
      setForm(f => ({ ...f, content_html: fullPage.content_html }))
    }
  }, [fullPage, editing?.id])

  const saveMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      if (editing) {
        const res = await adminFetch(`/api/admin/pages/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to save')
      } else {
        const res = await adminFetch('/api/admin/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pages'] })
      if (editing) qc.invalidateQueries({ queryKey: ['admin-page', editing.id] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/pages/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pages'] })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setModal('create')
  }

  function openEdit(page: Page) {
    setEditing(page)
    setForm({
      slug: page.slug,
      title: page.title,
      content_html: '',  // will be replaced when fullPage loads
      meta_title: page.meta_title ?? '',
      meta_description: page.meta_description ?? '',
      is_visible: page.is_visible,
    })
    setModal('edit')
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  const pages = data?.pages ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Pages</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Page
        </button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Visible</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No pages yet. Create your first page.
                </td>
              </tr>
            )}
            {pages.map(page => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{page.title}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">/pages/{page.slug}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${page.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {page.is_visible ? 'Visible' : 'Hidden'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openEdit(page)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  {deleteId === page.id ? (
                    <span className="text-xs">
                      <button
                        onClick={() => deleteMutation.mutate(page.id)}
                        className="text-red-600 hover:text-red-800 mr-1"
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
                      onClick={() => setDeleteId(page.id)}
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{modal === 'create' ? 'New Page' : 'Edit Page'}</h2>
              <button onClick={() => { setModal(null); setEditing(null); setForm(emptyForm); setDeleteId(null) }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }}
              className="px-6 py-4 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                  <input
                    required
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Slug *</label>
                  <input
                    required
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
                    placeholder="about-us"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Content (HTML)</label>
                <textarea
                  rows={12}
                  value={form.content_html}
                  onChange={e => setForm(f => ({ ...f, content_html: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono text-xs"
                  placeholder="<p>Page content here…</p>"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SEO Title</label>
                  <input
                    value={form.meta_title}
                    onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SEO Description</label>
                  <input
                    value={form.meta_description}
                    onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_visible"
                  checked={!!form.is_visible}
                  onChange={e => setForm(f => ({ ...f, is_visible: e.target.checked ? 1 : 0 }))}
                />
                <label htmlFor="is_visible" className="text-sm text-gray-700">Visible on storefront</label>
              </div>
              {saveMutation.isError && (
                <p className="text-red-600 text-xs">Failed to save. Please try again.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setModal(null); setEditing(null); setForm(emptyForm); setDeleteId(null) }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
