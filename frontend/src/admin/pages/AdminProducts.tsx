import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'

interface Product {
  id: number
  name: string
  description: string
  price: number
  image_url: string
  stock_count: number
  category: string
  compare_price: number | null
  tags: string
  status: 'active' | 'draft' | 'archived'
  product_type: 'physical' | 'digital'
}

interface Collection {
  id: number
  name: string
  slug: string
}

export default function AdminProducts() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ products: Product[]; total: number; page: number; pages: number }>({
    queryKey: ['admin-products', q, statusFilter, collectionFilter, tagFilter, page],
    queryFn: () =>
      adminFetch('/api/admin/products?' + new URLSearchParams({
        ...(q && { q }),
        ...(statusFilter && { status: statusFilter }),
        ...(collectionFilter && { collection_id: collectionFilter }),
        ...(tagFilter && { tag: tagFilter }),
        page: String(page),
      })).then((r) => r.json()),
  })

  const { data: collectionsData } = useQuery<{ collections: Collection[] }>({
    queryKey: ['collections'],
    queryFn: () => adminFetch('/api/collections').then(r => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); setDeleteId(null) },
  })

  const products = data?.products ?? []
  const totalPages = data?.pages ?? 1
  const totalProducts = data?.total ?? 0
  const collections = collectionsData?.collections ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <button
          onClick={() => navigate('/admin/products/new')}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          + Add Product
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search products..."
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:border-gray-500"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={collectionFilter}
          onChange={e => { setCollectionFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="">All collections</option>
          {collections.map(col => (
            <option key={col.id} value={String(col.id)}>{col.name}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={e => { setTagFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-36 focus:outline-none focus:border-gray-500"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-2">No products yet</p>
          <button onClick={() => navigate('/admin/products/new')} className="text-sm underline">Add your first product</button>
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
                    <Link to={`/admin/products/${p.id}`} className="text-blue-600 hover:text-blue-800 text-xs mr-3">Edit</Link>
                    <button onClick={() => setDeleteId(p.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{totalProducts} product{totalProducts !== 1 ? 's' : ''} — page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
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
