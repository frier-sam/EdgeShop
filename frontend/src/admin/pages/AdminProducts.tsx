import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ImageUploader from '../ImageUploader'

interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  stock_count: number
  category: string
  seo_title: string | null
  seo_description: string | null
  compare_price: number | null
  tags: string
  status: 'active' | 'draft' | 'archived'
  product_type: 'physical' | 'digital'
}

interface ProductForm {
  name: string
  description: string
  price: string
  image_url: string
  stock_count: string
  category: string
  seo_title: string
  seo_description: string
  compare_price: string
  tags: string
  status: 'active' | 'draft' | 'archived'
  product_type: 'physical' | 'digital'
}

interface Collection {
  id: number
  name: string
  slug: string
}

const emptyForm: ProductForm = {
  name: '', description: '', price: '', image_url: '', stock_count: '0', category: '',
  seo_title: '', seo_description: '', compare_price: '', tags: '',
  status: 'active', product_type: 'physical',
}

export default function AdminProducts() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedCollections, setSelectedCollections] = useState<number[]>([])

  const { data, isLoading } = useQuery<{ products: Product[] }>({
    queryKey: ['admin-products', q, statusFilter],
    queryFn: () =>
      fetch('/api/admin/products?' + new URLSearchParams({ ...(q && { q }), ...(statusFilter && { status: statusFilter }) })).then((r) => r.json()),
  })

  const { data: collectionsData } = useQuery<{ collections: Collection[] }>({
    queryKey: ['collections'],
    queryFn: () => fetch('/api/collections').then(r => r.json()),
  })

  const { data: productCollectionsData } = useQuery<{ collection_ids: number[] }>({
    queryKey: ['product-collections', editingId],
    queryFn: () => fetch(`/api/admin/products/${editingId}/collections`).then(r => r.json()),
    enabled: editingId !== null,
  })

  useEffect(() => {
    if (productCollectionsData?.collection_ids) {
      setSelectedCollections(productCollectionsData.collection_ids)
    }
  }, [productCollectionsData])

  const createMutation = useMutation({
    mutationFn: (body: Omit<ProductForm, 'price' | 'stock_count' | 'compare_price'> & { price: number; stock_count: number; compare_price: number | null }) =>
      fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: async (data: { id?: number }) => {
      if (selectedCollections.length > 0 && data.id) {
        await fetch(`/api/admin/products/${data.id}/collections`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection_ids: selectedCollections }),
        })
      }
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & Omit<ProductForm, 'price' | 'stock_count' | 'compare_price'> & { price: number; stock_count: number; compare_price: number | null }) =>
      fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: async () => {
      if (editingId !== null) {
        await fetch(`/api/admin/products/${editingId}/collections`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection_ids: selectedCollections }),
        })
      }
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/products/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); setDeleteId(null) },
  })

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setSelectedCollections([])
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      image_url: p.image_url,
      stock_count: String(p.stock_count),
      category: p.category,
      seo_title: p.seo_title ?? '',
      seo_description: p.seo_description ?? '',
      compare_price: p.compare_price != null ? String(p.compare_price) : '',
      tags: p.tags ?? '',
      status: p.status ?? 'active',
      product_type: p.product_type ?? 'physical',
    })
    setEditingId(p.id)
    setSelectedCollections([])
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setSelectedCollections([])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      image_url: form.image_url,
      stock_count: parseInt(form.stock_count, 10),
      category: form.category,
      seo_title: form.seo_title,
      seo_description: form.seo_description,
      compare_price: form.compare_price !== '' ? parseFloat(form.compare_price) : null,
      tags: form.tags,
      status: form.status,
      product_type: form.product_type,
    }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function toggleCollection(id: number) {
    setSelectedCollections(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const products = data?.products ?? []
  const collections = collectionsData?.collections ?? []
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors">
          + Add Product
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="search"
          placeholder="Search products..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:border-gray-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-2">No products yet</p>
          <button onClick={openAdd} className="text-sm underline">Add your first product</button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">₹{p.price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.stock_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 text-xs mr-3">Edit</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form slide-over */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeForm} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white z-50 overflow-y-auto shadow-xl">
            <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Price (₹) *</label>
                  <input required type="number" min="0" step="0.01" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Stock</label>
                  <input type="number" min="0" value={form.stock_count}
                    onChange={(e) => setForm({ ...form, stock_count: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
              </div>

              {/* Status + Product Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductForm['status'] })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500">
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Product Type</label>
                  <select value={form.product_type} onChange={(e) => setForm({ ...form, product_type: e.target.value as ProductForm['product_type'] })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500">
                    <option value="physical">Physical</option>
                    <option value="digital">Digital</option>
                  </select>
                </div>
              </div>

              {/* Compare Price + Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Compare at Price (₹)</label>
                  <input type="number" min="0" step="0.01" value={form.compare_price}
                    onChange={(e) => setForm({ ...form, compare_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tags</label>
                  <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    placeholder="e.g. summer, sale"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
                </div>
              </div>

              {/* Collections */}
              {collections.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Collections</label>
                  <div className="border border-gray-300 rounded px-3 py-2 max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-1">
                      {collections.map(col => (
                        <label key={col.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={selectedCollections.includes(col.id)}
                            onChange={() => toggleCollection(col.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300"
                          />
                          <span className="text-xs text-gray-700 truncate">{col.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SEO */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">SEO</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">SEO Title</label>
                    <input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                      placeholder={form.name} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">SEO Description</label>
                    <textarea rows={2} value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                      placeholder="Brief description for search engines (max 160 chars)"
                      maxLength={160} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-2">Product Image</label>
                <ImageUploader
                  existingUrl={form.image_url}
                  onUploadComplete={(url) => setForm({ ...form, image_url: url })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm}
                  className="flex-1 py-2 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50">
                  {isSaving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDeleteId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
              <h3 className="font-semibold text-gray-900 mb-2">Delete product?</h3>
              <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2 border border-gray-300 text-sm rounded text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}
                  className="flex-1 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50">
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
