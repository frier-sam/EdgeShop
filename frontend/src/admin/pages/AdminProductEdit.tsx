import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'

interface Product {
  id: number
  name: string
  description: string
  price: number
  compare_price: number | null
  image_url: string
  stock_count: number
  category: string
  product_type: string
  status: string
}

// Generic section editor — controls edit/save/cancel for one section
function useSection<T extends Record<string, unknown>>(initial: T) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<T>(initial)

  function startEdit(current: T) {
    setDraft(current)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
  }

  return { editing, draft, setDraft, startEdit, cancel }
}

export default function AdminProductEdit() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () =>
      fetch(`/api/products/${id}`).then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
    enabled: !!id,
  })

  // One useMutation shared — called with different field subsets per section
  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Product>) =>
      adminFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json() as { error?: string }
          throw new Error(err.error ?? 'Update failed')
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', id] })
      showToast('Saved', 'success')
    },
    onError: (err: Error) => {
      showToast(err.message, 'error')
    },
  })

  // Section state — basic info
  const basicInfo = useSection({ name: '', description: '' })
  // Section state — pricing
  const pricing = useSection({ price: 0, compare_price: null as number | null })
  // Section state — stock + category
  const stock = useSection({ stock_count: 0, category: '' })

  const [savingSection, setSavingSection] = useState<'basicInfo' | 'pricing' | 'stock' | null>(null)

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (error || !product) return <p className="text-sm text-red-500">Product not found.</p>

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/admin/products" className="text-xs text-gray-400 hover:text-gray-700 mb-1 inline-block">
            ← Back to Products
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
        </div>
        <a
          href={`/product/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-3 py-1.5 mt-5"
        >
          View on storefront ↗
        </a>
      </div>

      {/* Section: Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Basic Info</h2>
          {!basicInfo.editing && (
            <button
              onClick={() => basicInfo.startEdit({ name: product.name, description: product.description })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {basicInfo.editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                value={basicInfo.draft.name}
                onChange={(e) => basicInfo.setDraft({ ...basicInfo.draft, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                rows={4}
                value={basicInfo.draft.description}
                onChange={(e) => basicInfo.setDraft({ ...basicInfo.draft, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!basicInfo.draft.name.trim()) return
                  setSavingSection('basicInfo')
                  updateMutation.mutate({ name: basicInfo.draft.name, description: basicInfo.draft.description }, {
                    onSuccess: () => { basicInfo.cancel(); setSavingSection(null) },
                    onError: () => setSavingSection(null),
                  })
                }}
                disabled={savingSection === 'basicInfo' || !basicInfo.draft.name.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {savingSection === 'basicInfo' ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={basicInfo.cancel}
                disabled={savingSection === 'basicInfo'}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{product.name}</p>
            <p className="text-sm text-gray-500 whitespace-pre-wrap">{product.description || <span className="italic opacity-40">No description</span>}</p>
          </div>
        )}
      </div>

      {/* Section: Pricing */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Pricing</h2>
          {!pricing.editing && (
            <button
              onClick={() => pricing.startEdit({ price: product.price, compare_price: product.compare_price })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {pricing.editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricing.draft.price}
                  onChange={(e) => pricing.setDraft({ ...pricing.draft, price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Compare-at Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricing.draft.compare_price ?? ''}
                  onChange={(e) => pricing.setDraft({ ...pricing.draft, compare_price: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSavingSection('pricing')
                  updateMutation.mutate({ price: pricing.draft.price, compare_price: pricing.draft.compare_price }, {
                    onSuccess: () => { pricing.cancel(); setSavingSection(null) },
                    onError: () => setSavingSection(null),
                  })
                }}
                disabled={savingSection === 'pricing'}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {savingSection === 'pricing' ? 'Saving…' : 'Save'}
              </button>
              <button onClick={pricing.cancel} disabled={savingSection === 'pricing'}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 text-sm">
            <span className="font-semibold text-gray-900">₹{product.price.toFixed(2)}</span>
            {product.compare_price != null && (
              <span className="line-through text-gray-400">₹{product.compare_price.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {/* Section: Stock & Category */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Stock &amp; Category</h2>
          {!stock.editing && (
            <button
              onClick={() => stock.startEdit({ stock_count: product.stock_count, category: product.category })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {stock.editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Stock Count</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={stock.draft.stock_count}
                  onChange={(e) => stock.setDraft({ ...stock.draft, stock_count: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <input
                  value={stock.draft.category}
                  onChange={(e) => stock.setDraft({ ...stock.draft, category: e.target.value })}
                  placeholder="e.g. Rings"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSavingSection('stock')
                  updateMutation.mutate({ stock_count: stock.draft.stock_count, category: stock.draft.category }, {
                    onSuccess: () => { stock.cancel(); setSavingSection(null) },
                    onError: () => setSavingSection(null),
                  })
                }}
                disabled={savingSection === 'stock'}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {savingSection === 'stock' ? 'Saving…' : 'Save'}
              </button>
              <button onClick={stock.cancel} disabled={savingSection === 'stock'}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 text-sm text-gray-700">
            <span><span className="text-gray-400 text-xs">Stock</span> <strong>{product.stock_count}</strong></span>
            <span><span className="text-gray-400 text-xs">Category</span> <strong>{product.category || '—'}</strong></span>
          </div>
        )}
      </div>
    </div>
  )
}
