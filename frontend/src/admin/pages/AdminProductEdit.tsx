import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import ProductSideCard from '../ProductSideCard'
import ProductSizesEditor from '../ProductSizesEditor'
import type { ProductDetail, ProductSide, ProductSize } from '../../lib/types'

const DEFAULT_PRINT_FEE_FALLBACK = 99

interface BasicsDraft {
  name: string
  slug: string
  description: string
  category: string
  status: 'active' | 'draft'
  base_price: string
  compare_price: string
  stock_count: string
  is_customizable: boolean
}

function basicsFromProduct(p: ProductDetail): BasicsDraft {
  return {
    name: p.name,
    slug: p.slug ?? '',
    description: p.description ?? '',
    category: p.category ?? '',
    status: p.status,
    base_price: String(p.base_price),
    compare_price: p.compare_price != null ? String(p.compare_price) : '',
    stock_count: String(p.stock_count),
    is_customizable: !!p.is_customizable,
  }
}

// ── Preview check (POD.md §4.4 point 4) ──────────────────────────────
// Sample text dropped into the print area over the front mockup so a
// merchant can sanity-check placement before publishing. Deliberately a
// plain absolutely-positioned DOM overlay — no canvas library (that's
// Phase 6's job).
function PreviewCheck({ front }: { front: ProductSide }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <h2 className="font-medium text-gray-800">Preview check</h2>
      <p className="text-xs text-gray-400">Sample text dropped into the saved print area — a rough sanity check, not the real editor.</p>
      <div
        className="relative w-full max-w-sm rounded overflow-hidden bg-gray-100"
        style={{ aspectRatio: `${front.image_w} / ${front.image_h}` }}
      >
        <img src={front.image_url} alt="Front mockup" className="absolute inset-0 w-full h-full object-fill" />
        <div
          className="absolute flex items-center justify-center overflow-hidden p-1"
          style={{
            left: `${front.print_x * 100}%`,
            top: `${front.print_y * 100}%`,
            width: `${front.print_w * 100}%`,
            height: `${front.print_h * 100}%`,
          }}
        >
          <span className="text-[10px] sm:text-sm font-bold text-gray-900 bg-white/80 px-1.5 py-0.5 rounded text-center leading-tight">
            Your Design Here
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Create mode ────────────────────────────────────────────────────
function CreateProductForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '', description: '', base_price: '', compare_price: '',
    stock_count: '0', category: '', status: 'active' as 'active' | 'draft', is_customizable: false,
  })

  const createMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
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
      showToast('Product created — now add mockups and sizes', 'success')
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      navigate(`/admin/products/${data.id}`)
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

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
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Base Price (₹) *</label>
            <input
              type="number" min="0" step="0.01"
              value={form.base_price}
              onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock</label>
            <input
              type="number" min="0"
              value={form.stock_count}
              onChange={(e) => setForm((f) => ({ ...f, stock_count: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Only used if the product ends up with no sizes.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'draft' }))}
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
            checked={form.is_customizable}
            onChange={(e) => setForm((f) => ({ ...f, is_customizable: e.target.checked }))}
            className="w-3.5 h-3.5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Customizable (customer can print their own design on this product)</span>
        </label>
        <button
          onClick={() => {
            if (!form.name.trim() || form.base_price === '') return
            createMutation.mutate({
              name: form.name.trim(),
              description: form.description,
              base_price: parseFloat(form.base_price),
              compare_price: form.compare_price ? parseFloat(form.compare_price) : null,
              stock_count: parseInt(form.stock_count, 10) || 0,
              category: form.category,
              status: form.status,
              is_customizable: form.is_customizable ? 1 : 0,
            })
          }}
          disabled={createMutation.isPending || !form.name.trim() || form.base_price === ''}
          className="w-full py-2.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Creating…' : 'Create Product'}
        </button>
        <p className="text-xs text-gray-400 text-center">Mockups, print areas and sizes can be added after creating the product.</p>
      </div>
    </div>
  )
}

// ── Edit mode ──────────────────────────────────────────────────────
function EditProductForm({ id }: { id: string }) {
  const numericId = Number(id)
  const qc = useQueryClient()

  const { data: product, isLoading, error } = useQuery<ProductDetail>({
    queryKey: ['product', id],
    queryFn: () =>
      adminFetch(`/api/admin/products/${id}`).then(async (r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json() as Promise<ProductDetail>
      }),
  })

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['public-settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })
  const defaultPrintFee = settings?.default_print_fee ? parseFloat(settings.default_print_fee) : DEFAULT_PRINT_FEE_FALLBACK

  const [basics, setBasics] = useState<BasicsDraft | null>(null)
  const [basicsError, setBasicsError] = useState('')
  const [addingBack, setAddingBack] = useState(false)

  // Seed the editable Basics draft once when the product first loads —
  // not on every refetch, so in-progress edits survive a sides/sizes save
  // elsewhere on the page (which invalidates the same query).
  useEffect(() => {
    if (product) setBasics((b) => b ?? basicsFromProduct(product))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])

  const basicsMutation = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      adminFetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json() as { error?: string }
          throw new Error(err.error ?? 'Save failed')
        }
      }),
    onSuccess: (_data, fields) => {
      qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => (old ? { ...old, ...fields } as ProductDetail : old))
      showToast('Basics saved', 'success')
    },
    onError: (err: Error) => setBasicsError(err.message),
  })

  function handleSaveBasics() {
    if (!basics) return
    if (!basics.name.trim()) { setBasicsError('Name is required.'); return }
    const basePrice = parseFloat(basics.base_price)
    if (!Number.isFinite(basePrice) || basePrice < 0) { setBasicsError('Base price must be a non-negative number.'); return }
    const comparePrice = basics.compare_price ? parseFloat(basics.compare_price) : null
    if (comparePrice != null && (!Number.isFinite(comparePrice) || comparePrice < 0)) { setBasicsError('Compare-at price must be a non-negative number.'); return }
    const stockCount = parseInt(basics.stock_count, 10) || 0
    setBasicsError('')
    basicsMutation.mutate({
      name: basics.name.trim(),
      slug: basics.slug,
      description: basics.description,
      category: basics.category,
      status: basics.status,
      base_price: basePrice,
      compare_price: comparePrice,
      stock_count: stockCount,
      is_customizable: basics.is_customizable ? 1 : 0,
    })
  }

  if (isLoading || !basics) return <p className="text-sm text-gray-400">Loading…</p>
  if (error || !product) return <p className="text-sm text-red-500">Product not found.</p>

  const frontSide = product.sides.find((s) => s.side === 'front') ?? null
  const backSide = product.sides.find((s) => s.side === 'back') ?? null
  const hasSizes = product.sizes.length > 0
  const showBackCard = !!backSide || addingBack

  function updateSidesCache(saved: ProductSide) {
    qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => {
      if (!old) return old
      const others = old.sides.filter((s) => s.side !== saved.side)
      return { ...old, sides: [...others, saved].sort((a, b) => a.sort_order - b.sort_order) }
    })
  }

  function removeSideFromCache(side: 'front' | 'back') {
    qc.setQueryData<ProductDetail | undefined>(['product', id], (old) =>
      old ? { ...old, sides: old.sides.filter((s) => s.side !== side) } : old
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
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

      {/* 1. Basics */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="font-medium text-gray-800">Basics</h2>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name *</label>
          <input
            value={basics.name}
            onChange={(e) => setBasics({ ...basics, name: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Slug</label>
          <input
            value={basics.slug}
            onChange={(e) => setBasics({ ...basics, slug: e.target.value })}
            placeholder={product.slug ?? ''}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            rows={4}
            value={basics.description}
            onChange={(e) => setBasics({ ...basics, description: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-y"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <input
              value={basics.category}
              onChange={(e) => setBasics({ ...basics, category: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={basics.status}
              onChange={(e) => setBasics({ ...basics, status: e.target.value as 'active' | 'draft' })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Base Price (₹) *</label>
            <input
              type="number" min="0" step="0.01"
              value={basics.base_price}
              onChange={(e) => setBasics({ ...basics, base_price: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Compare-at Price</label>
            <input
              type="number" min="0" step="0.01"
              value={basics.compare_price}
              onChange={(e) => setBasics({ ...basics, compare_price: e.target.value })}
              placeholder="Optional"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>
        {!hasSizes && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Stock Count</label>
            <input
              type="number" min="0" step="1"
              value={basics.stock_count}
              onChange={(e) => setBasics({ ...basics, stock_count: e.target.value })}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">This product has no sizes, so stock is tracked here directly.</p>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={basics.is_customizable}
            onChange={(e) => setBasics({ ...basics, is_customizable: e.target.checked })}
            className="w-3.5 h-3.5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Customizable</span>
        </label>
        {basicsError && <p className="text-xs text-red-500">{basicsError}</p>}
        <button
          onClick={handleSaveBasics}
          disabled={basicsMutation.isPending}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {basicsMutation.isPending ? 'Saving…' : 'Save basics'}
        </button>
      </div>

      {/* 2. Sizes */}
      <ProductSizesEditor
        productId={numericId}
        initialSizes={product.sizes}
        onSaved={(sizes) => {
          qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => (old ? { ...old, sizes } : old))
        }}
      />

      {/* 3. Sides */}
      <div className="space-y-4">
        <h2 className="font-medium text-gray-800 px-1">Sides</h2>
        <ProductSideCard
          productId={numericId}
          side="front"
          data={frontSide}
          defaultPrintFee={defaultPrintFee}
          productIsCustomizable={basics.is_customizable}
          onSaved={updateSidesCache}
          onRemoved={() => removeSideFromCache('front')}
        />
        {showBackCard ? (
          <ProductSideCard
            productId={numericId}
            side="back"
            data={backSide}
            defaultPrintFee={defaultPrintFee}
            productIsCustomizable={basics.is_customizable}
            frontSide={frontSide}
            removable
            onSaved={updateSidesCache}
            onRemoved={() => { removeSideFromCache('back'); setAddingBack(false) }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingBack(true)}
            className="text-sm px-4 py-2 border border-dashed border-gray-300 rounded hover:border-gray-500 text-gray-500 transition-colors w-full text-center"
          >
            + Add back side
          </button>
        )}
      </div>

      {/* 4. Preview check */}
      {frontSide && basics.is_customizable && !!frontSide.customizable && frontSide.print_w > 0 && frontSide.print_h > 0 && (
        <PreviewCheck front={frontSide} />
      )}
    </div>
  )
}

export default function AdminProductEdit() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  // Keyed on `id` so switching products (or create → edit after creation)
  // always starts from clean local state instead of stale drafts.
  return id === 'new' ? <CreateProductForm key="new" /> : <EditProductForm key={id} id={id} />
}
