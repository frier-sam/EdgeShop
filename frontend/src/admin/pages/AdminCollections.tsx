import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Collection {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
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
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminCollections() {
  const qc = useQueryClient()

  // List/CRUD state
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Product assignment modal state
  const [assignCollection, setAssignCollection] = useState<Collection | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())

  // Delete error state
  const [deleteError, setDeleteError] = useState('')

  // Fetch collections
  const { data, isLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['admin-collections'],
    queryFn: () =>
      fetch('/api/admin/collections').then(r => {
        if (!r.ok) throw new Error('Failed to load collections')
        return r.json() as Promise<{ collections: Collection[] }>
      }),
  })

  // Fetch all products (for assignment modal)
  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['admin-products'],
    queryFn: () =>
      fetch('/api/admin/products').then(r => {
        if (!r.ok) throw new Error('Failed to load products')
        return r.json() as Promise<{ products: Product[] }>
      }),
    enabled: !!assignCollection,
  })

  // Fetch assigned products for the selected collection
  const { data: collectionDetail, isLoading: isLoadingDetail } = useQuery<{
    collection: Collection
    products: Product[]
  }>({
    queryKey: ['collection-detail', assignCollection?.id],
    queryFn: () =>
      fetch(`/api/collections/${assignCollection!.slug}`).then(r => {
        if (!r.ok) throw new Error('Failed to load collection products')
        return r.json() as Promise<{ collection: Collection; products: Product[] }>
      }),
    enabled: !!assignCollection,
    // When data loads, initialise the selected set
    select: data => data,
  })

  // Save (create or edit) mutation
  const saveMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      if (editing) {
        const res = await fetch(`/api/admin/collections/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to save')
      } else {
        const res = await fetch('/api/admin/collections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      closeModal()
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/collections/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      setDeleteId(null)
      setDeleteError('')
    },
    onError: () => {
      setDeleteError('Failed to delete. Please try again.')
    },
  })

  // Assign products mutation
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
      if (assignCollection) {
        qc.invalidateQueries({ queryKey: ['collection-detail', assignCollection.id] })
      }
      closeAssignModal()
    },
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
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
    })
    setSlugManuallyEdited(true) // When editing, don't auto-update slug from name
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

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true)
    setForm(f => ({ ...f, slug: value }))
  }

  function toggleProduct(id: number) {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // When collection detail loads, seed selected product IDs
  useEffect(() => {
    if (assignCollection && collectionDetail) {
      setSelectedProductIds(
        new Set((collectionDetail.products ?? []).map((p: { id: number }) => p.id))
      )
    }
  }, [assignCollection?.id, collectionDetail])

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  const collections = data?.collections ?? []
  const allProducts = productsData?.products ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Collections</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Collection
        </button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Sort Order</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {collections.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No collections yet. Create your first collection.
                </td>
              </tr>
            )}
            {collections.map(col => (
              <tr key={col.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{col.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">/collections/{col.slug}</td>
                <td className="px-4 py-3 text-gray-500">{col.sort_order}</td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openAssign(col)}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-0.5"
                  >
                    Products
                  </button>
                  <button
                    onClick={() => openEdit(col)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  {deleteId === col.id ? (
                    <span className="text-xs">
                      {deleteError && (
                        <span className="text-red-600 mr-1">{deleteError}</span>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(col.id)}
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
                      onClick={() => { setDeleteId(col.id); setDeleteError('') }}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {modal === 'create' ? 'New Collection' : 'Edit Collection'}
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
                    onChange={e => handleSlugChange(e.target.value)}
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
                  placeholder="A short description of this collection…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                  <input
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e =>
                      setForm(f => ({ ...f, sort_order: Number(e.target.value) }))
                    }
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
              <h2 className="font-semibold text-gray-900">
                Products in &quot;{assignCollection.name}&quot;
              </h2>
              <button
                onClick={closeAssignModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingDetail || !productsData ? (
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
                        <span className="text-xs text-gray-400">
                          ${(product.price / 100).toFixed(2)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 shrink-0">
              {assignMutation.isError && (
                <p className="text-red-600 text-xs mb-2">Failed to save. Please try again.</p>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  {selectedProductIds.size} product{selectedProductIds.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeAssignModal}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={assignMutation.isPending}
                    onClick={() =>
                      assignMutation.mutate({
                        id: assignCollection.id,
                        product_ids: Array.from(selectedProductIds),
                      })
                    }
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                  >
                    {assignMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
