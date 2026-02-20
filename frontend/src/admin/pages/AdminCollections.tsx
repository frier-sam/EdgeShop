import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'

interface Collection {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
  parent_id: number | null
  depth: number
}

interface Product {
  id: number
  name: string
  price: number
  status: string
}

type ModalMode = 'create' | 'edit' | null

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  image_url: '',
  sort_order: 0,
  seo_title: '',
  seo_description: '',
  parent_id: null as number | null,
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function getDescendantIds(collections: Collection[], id: number): Set<number> {
  const result = new Set<number>()
  const queue = [id]
  while (queue.length) {
    const current = queue.shift()!
    for (const col of collections) {
      if (col.parent_id === current) {
        result.add(col.id)
        queue.push(col.id)
      }
    }
  }
  return result
}

export default function AdminCollections() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [assignCollection, setAssignCollection] = useState<Collection | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())

  const { data, isLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['admin-collections'],
    queryFn: () => fetch('/api/admin/collections').then(r => r.json()),
  })

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['admin-products'],
    queryFn: () => fetch('/api/admin/products').then(r => r.json()),
    enabled: !!assignCollection,
  })

  const { data: collectionDetail } = useQuery<{ collection: Collection; products: Product[] }>({
    queryKey: ['collection-detail', assignCollection?.id],
    queryFn: () => fetch(`/api/collections/${assignCollection!.slug}`).then(r => r.json()),
    enabled: !!assignCollection,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ body, editingId }: { body: typeof emptyForm; editingId: number | null }) => {
      const url = editingId ? `/api/admin/collections/${editingId}` : '/api/admin/collections'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: (_, { editingId }) => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      showToast(editingId ? 'Collection updated' : 'Collection created', 'success')
      closeModal()
    },
    onError: () => showToast('Failed to save collection', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/collections/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      setDeleteId(null)
      showToast('Collection deleted', 'success')
    },
    onError: () => showToast('Failed to delete', 'error'),
  })

  const assignMutation = useMutation({
    mutationFn: async ({ id, product_ids }: { id: number; product_ids: number[] }) => {
      const res = await fetch(`/api/admin/collections/${id}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids }),
      })
      if (!res.ok) throw new Error('Failed to assign products')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      if (assignCollection) qc.invalidateQueries({ queryKey: ['collection-detail', assignCollection.id] })
      showToast('Products assigned', 'success')
      closeAssignModal()
    },
    onError: () => showToast('Failed to assign products', 'error'),
  })

  function openCreate(parentId: number | null = null) {
    setEditing(null)
    setForm({ ...emptyForm, parent_id: parentId })
    setSlugManuallyEdited(false)
    setModal('create')
  }

  function openEdit(col: Collection) {
    setEditing(col)
    setForm({
      name: col.name,
      slug: col.slug,
      description: col.description ?? '',
      image_url: col.image_url ?? '',
      sort_order: col.sort_order ?? 0,
      seo_title: col.seo_title ?? '',
      seo_description: col.seo_description ?? '',
      parent_id: col.parent_id,
    })
    setSlugManuallyEdited(true)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setForm(emptyForm)
    setSlugManuallyEdited(false)
  }

  function openAssign(col: Collection) {
    setAssignCollection(col)
    setSelectedProductIds(new Set())
  }

  function closeAssignModal() {
    setAssignCollection(null)
    setSelectedProductIds(new Set())
  }

  function handleNameChange(value: string) {
    setForm(f => ({
      ...f,
      name: value,
      slug: slugManuallyEdited ? f.slug : toSlug(value),
    }))
  }

  function toggleProduct(id: number) {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (assignCollection && collectionDetail) {
      setSelectedProductIds(new Set((collectionDetail.products ?? []).map((p: Product) => p.id)))
    }
  }, [assignCollection?.id, collectionDetail])

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  const collections = data?.collections ?? []
  const allProducts = productsData?.products ?? []
  const excludedIds = editing
    ? new Set([editing.id, ...getDescendantIds(collections, editing.id)])
    : new Set<number>()
  const parentOptions = collections.filter(c => !excludedIds.has(c.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Collections</h1>
        <button
          onClick={() => openCreate(null)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Collection
        </button>
      </div>
      <p className="text-sm text-gray-500">Collections support unlimited nesting. Use "+ Child" to add sub-collections.</p>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        {collections.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No collections yet. Create your first collection.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {collections.map(col => (
              <div
                key={col.id}
                className="flex items-center gap-2 py-2.5 pr-4 hover:bg-gray-50"
                style={{ paddingLeft: `${16 + col.depth * 20}px` }}
              >
                {col.depth > 0 && <span className="text-gray-300 shrink-0 text-xs select-none">└</span>}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{col.name}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">/collections/{col.slug}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs">
                  <button
                    onClick={() => openAssign(col)}
                    className="text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5"
                  >
                    Products
                  </button>
                  <button
                    onClick={() => openCreate(col.id)}
                    className="text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5"
                  >
                    + Child
                  </button>
                  <button onClick={() => openEdit(col)} className="text-blue-600 hover:text-blue-800 px-1">Edit</button>
                  {deleteId === col.id ? (
                    <>
                      <button
                        onClick={() => deleteMutation.mutate(col.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setDeleteId(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteId(col.id)} className="text-red-400 hover:text-red-600 px-1">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {modal === 'create' ? 'New Collection' : 'Edit Collection'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); saveMutation.mutate({ body: form, editingId: editing?.id ?? null }) }}
              className="px-6 py-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Parent Collection</label>
                <select
                  value={form.parent_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
                >
                  <option value="">— Root level (no parent)</option>
                  {parentOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {'—'.repeat(c.depth + 1)} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="Summer Sale"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Slug *</label>
                  <input
                    required
                    value={form.slug}
                    onChange={e => { setSlugManuallyEdited(true); setForm(f => ({ ...f, slug: e.target.value })) }}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
                    placeholder="summer-sale"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                  <input
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SEO Title</label>
                  <input
                    value={form.seo_title}
                    onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SEO Description</label>
                  <input
                    value={form.seo_description}
                    onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Products Modal */}
      {assignCollection && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-gray-900">Products in "{assignCollection.name}"</h2>
              <button onClick={closeAssignModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!productsData ? (
                <p className="text-sm text-gray-400">Loading products…</p>
              ) : allProducts.length === 0 ? (
                <p className="text-sm text-gray-400">No products found.</p>
              ) : (
                <ul className="space-y-2">
                  {allProducts.map(product => (
                    <li key={product.id}>
                      <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-800 flex-1">{product.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex justify-between items-center">
              <span className="text-xs text-gray-400">{selectedProductIds.size} selected</span>
              <div className="flex gap-2">
                <button onClick={closeAssignModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate({ id: assignCollection.id, product_ids: Array.from(selectedProductIds) })}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
