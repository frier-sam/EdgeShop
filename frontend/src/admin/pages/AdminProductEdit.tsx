import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'

interface Product {
  id: number
  name: string
  slug: string | null
  description: string
  base_price: number
  compare_price: number | null
  category: string
  status: 'active' | 'draft'
  is_customizable: number
  stock_count: number
  seo_title: string | null
  seo_description: string | null
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

  function seed(current: T) {
    setDraft(current)
  }

  return { editing, draft, setDraft, startEdit, cancel, seed }
}

export default function AdminProductEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () =>
      adminFetch(`/api/admin/products/${id}`).then(async (r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json() as Promise<Product>
      }),
    enabled: !!id && id !== 'new',
  })

  // One useMutation shared — called with different field subsets per section
  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Product>) =>
      adminFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
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

  const createMutation = useMutation({
    mutationFn: (fields: Omit<Product, 'id' | 'slug'>) =>
      adminFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json() as { error?: string }
          throw new Error(err.error ?? 'Create failed')
        }
        return r.json() as Promise<{ id: number }>
      }),
    onSuccess: (data) => {
      showToast('Product created', 'success')
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      navigate(`/admin/products/${data.id}`)
    },
    onError: (err: Error) => {
      showToast(err.message, 'error')
    },
  })

  // Section state — basic info
  const basicInfo = useSection({ name: '', description: '' })
  // Section state — pricing
  const pricing = useSection({ base_price: 0, compare_price: null as number | null })
  // Section state — stock + category
  const stock = useSection({ stock_count: 0, category: '' })
  const details = useSection({ status: 'active', is_customizable: 0 })
  const seo = useSection({ seo_title: '', seo_description: '' })

  const [savingSection, setSavingSection] = useState<'basicInfo' | 'pricing' | 'stock' | 'details' | 'seo' | null>(null)

  const [createForm, setCreateForm] = useState({
    name: '', description: '', base_price: '', compare_price: '',
    stock_count: '0', category: '', status: 'active', is_customizable: false,
    seo_title: '', seo_description: '',
  })

  useEffect(() => {
    if (!product) return
    basicInfo.seed({ name: product.name, description: product.description })
    pricing.seed({ base_price: product.base_price, compare_price: product.compare_price })
    stock.seed({ stock_count: product.stock_count, category: product.category })
    details.seed({ status: product.status ?? 'active', is_customizable: product.is_customizable ?? 0 })
    seo.seed({ seo_title: product.seo_title ?? '', seo_description: product.seo_description ?? '' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  const isCreateMode = id === 'new'

  if (isCreateMode) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <Link to="/admin/products" className="text-xs text-gray-400 hover:text-gray-700 mb-1 inline-block">
            ← Back to Products
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">New Product</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea
              rows={3}
              value={createForm.description}
              onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Base Price (₹) *</label>
              <input
                type="number" min="0" step="0.01"
                value={createForm.base_price}
                onChange={e => setCreateForm(f => ({ ...f, base_price: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stock</label>
              <input
                type="number" min="0"
                value={createForm.stock_count}
                onChange={e => setCreateForm(f => ({ ...f, stock_count: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">Only used if the product has no sizes.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <input
                value={createForm.category}
                onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={createForm.status}
                onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createForm.is_customizable}
              onChange={e => setCreateForm(f => ({ ...f, is_customizable: e.target.checked }))}
              className="w-3.5 h-3.5 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Customizable (customer can print their own design on this product)</span>
          </label>
          <button
            onClick={() => {
              if (!createForm.name.trim() || createForm.base_price === '') return
              createMutation.mutate({
                name: createForm.name.trim(),
                description: createForm.description,
                base_price: parseFloat(createForm.base_price),
                compare_price: createForm.compare_price ? parseFloat(createForm.compare_price) : null,
                stock_count: parseInt(createForm.stock_count, 10) || 0,
                category: createForm.category,
                status: createForm.status as 'active' | 'draft',
                is_customizable: createForm.is_customizable ? 1 : 0,
                seo_title: createForm.seo_title || null,
                seo_description: createForm.seo_description || null,
              })
            }}
            disabled={createMutation.isPending || !createForm.name.trim() || createForm.base_price === ''}
            className="w-full py-2.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Product'}
          </button>
          <p className="text-xs text-gray-400 text-center">Mockups, print areas and sizes can be added after creating the product.</p>
        </div>
      </div>
    )
  }

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
          href={`/product/${product.slug ?? id}`}
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
              onClick={() => pricing.startEdit({ base_price: product.base_price, compare_price: product.compare_price })}
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
                <label className="block text-xs text-gray-500 mb-1">Base Price *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricing.draft.base_price}
                  onChange={(e) => pricing.setDraft({ ...pricing.draft, base_price: parseFloat(e.target.value) || 0 })}
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
                  updateMutation.mutate({ base_price: pricing.draft.base_price, compare_price: pricing.draft.compare_price }, {
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
            <span className="font-semibold text-gray-900">₹{product.base_price.toFixed(2)}</span>
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
                <p className="text-[11px] text-gray-400 mt-1">Only used if the product has no sizes.</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <input
                  value={stock.draft.category}
                  onChange={(e) => stock.setDraft({ ...stock.draft, category: e.target.value })}
                  placeholder="e.g. Apparel"
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

      {/* Section: Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Details</h2>
          {!details.editing && (
            <button
              onClick={() => details.startEdit({ status: product.status, is_customizable: product.is_customizable })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {details.editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={details.draft.status}
                onChange={(e) => details.setDraft({ ...details.draft, status: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!details.draft.is_customizable}
                onChange={(e) => details.setDraft({ ...details.draft, is_customizable: e.target.checked ? 1 : 0 })}
                className="w-3.5 h-3.5 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Customizable</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSavingSection('details')
                  updateMutation.mutate({ status: details.draft.status as 'active' | 'draft', is_customizable: details.draft.is_customizable }, {
                    onSuccess: () => { details.cancel(); setSavingSection(null) },
                    onError: () => setSavingSection(null),
                  })
                }}
                disabled={savingSection === 'details'}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {savingSection === 'details' ? 'Saving…' : 'Save'}
              </button>
              <button onClick={details.cancel} disabled={savingSection === 'details'}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            <span><span className="text-gray-400 text-xs">Status</span> <strong className="capitalize">{product.status}</strong></span>
            <span><span className="text-gray-400 text-xs">Customizable</span> <strong>{product.is_customizable ? 'Yes' : 'No'}</strong></span>
          </div>
        )}
      </div>

      {/* Section: SEO */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">SEO</h2>
          {!seo.editing && (
            <button
              onClick={() => seo.startEdit({ seo_title: product.seo_title ?? '', seo_description: product.seo_description ?? '' })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {seo.editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">SEO Title</label>
              <input
                value={seo.draft.seo_title}
                onChange={(e) => seo.setDraft({ ...seo.draft, seo_title: e.target.value })}
                placeholder={product.name}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">SEO Description</label>
              <textarea
                rows={2}
                value={seo.draft.seo_description}
                onChange={(e) => seo.setDraft({ ...seo.draft, seo_description: e.target.value })}
                placeholder="Brief description for search engines (max 160 chars)"
                maxLength={160}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSavingSection('seo')
                  updateMutation.mutate({ seo_title: seo.draft.seo_title, seo_description: seo.draft.seo_description }, {
                    onSuccess: () => { seo.cancel(); setSavingSection(null) },
                    onError: () => setSavingSection(null),
                  })
                }}
                disabled={savingSection === 'seo'}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {savingSection === 'seo' ? 'Saving…' : 'Save'}
              </button>
              <button onClick={seo.cancel} disabled={savingSection === 'seo'}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-sm text-gray-700">
            <p><span className="text-gray-400 text-xs">Title</span> {product.seo_title || <span className="italic text-gray-400">Not set</span>}</p>
            <p><span className="text-gray-400 text-xs">Description</span> {product.seo_description || <span className="italic text-gray-400">Not set</span>}</p>
          </div>
        )}
      </div>

      {/* Mockups, print areas and sizes are managed from a dedicated editor
          coming in a later phase (POD.md Phase 4) — not yet built. */}
    </div>
  )
}
