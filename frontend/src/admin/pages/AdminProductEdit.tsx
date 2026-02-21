import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import ImageUploader from '../ImageUploader'

interface Product {
  id: number
  name: string
  description: string
  price: number
  compare_price: number | null
  image_url: string | null
  stock_count: number
  category: string
  product_type: string
  status: string
  tags: string
  seo_title: string | null
  seo_description: string | null
}

interface GalleryImage {
  id: number
  url: string
  sort_order: number
}

interface ProductVariant {
  id: number
  product_id: number
  name: string
  options_json: string
  price: number
  stock_count: number
  image_url: string
  sku: string
}

interface Collection {
  id: number
  name: string
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
      fetch(`/api/products/${id}`).then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
    enabled: !!id && id !== 'new',
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

  const { data: galleryData, refetch: refetchGallery } = useQuery<{ images: GalleryImage[] }>({
    queryKey: ['product-gallery', id],
    queryFn: () => adminFetch(`/api/admin/products/${id}/images`).then(r => r.json()),
    enabled: !!id && id !== 'new',
  })
  const galleryImages = galleryData?.images ?? []

  const addGalleryMutation = useMutation({
    mutationFn: (url: string) =>
      adminFetch(`/api/admin/products/${id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, sort_order: galleryImages.length }),
      }).then(r => r.json()),
    onSuccess: () => refetchGallery(),
  })

  const removeGalleryMutation = useMutation({
    mutationFn: (imageId: number) =>
      adminFetch(`/api/admin/products/${id}/images/${imageId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => refetchGallery(),
  })

  const [editingVariantId, setEditingVariantId] = useState<number | null>(null)
  const [variantEditDraft, setVariantEditDraft] = useState({
    name: '', price: '', stock_count: '0', sku: '',
    options: [{ key: '', value: '' }] as { key: string; value: string }[],
  })
  const [variantAddForm, setVariantAddForm] = useState({
    name: '', price: '', stock_count: '0', sku: '',
    options: [{ key: '', value: '' }] as { key: string; value: string }[],
  })

  const { data: variantsData, refetch: refetchVariants } = useQuery<{ variants: ProductVariant[] }>({
    queryKey: ['product-variants', id],
    queryFn: () => adminFetch(`/api/admin/products/${id}/variants`).then(r => r.json()),
    enabled: !!id && id !== 'new',
  })
  const variants = variantsData?.variants ?? []

  const addVariantMutation = useMutation({
    mutationFn: (v: { name: string; options_json: string; price: number; stock_count: number; sku: string }) =>
      adminFetch(`/api/admin/products/${id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      }).then(r => r.json()),
    onSuccess: () => {
      refetchVariants()
      setVariantAddForm({ name: '', price: '', stock_count: '0', sku: '', options: [{ key: '', value: '' }] })
    },
  })

  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, ...fields }: { variantId: number; name: string; options_json: string; price: number; stock_count: number; sku: string }) =>
      adminFetch(`/api/admin/products/${id}/variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(r => r.json()),
    onSuccess: () => {
      refetchVariants()
      setEditingVariantId(null)
    },
  })

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: number) =>
      adminFetch(`/api/admin/products/${id}/variants/${variantId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => refetchVariants(),
  })

  const createMutation = useMutation({
    mutationFn: (fields: Omit<Product, 'id'>) =>
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
  const pricing = useSection({ price: 0, compare_price: null as number | null })
  // Section state — stock + category
  const stock = useSection({ stock_count: 0, category: '' })
  const image = useSection({ image_url: null as string | null })
  const details = useSection({ status: 'active', product_type: 'physical', tags: '' })
  const seo = useSection({ seo_title: '', seo_description: '' })

  const [savingSection, setSavingSection] = useState<'basicInfo' | 'pricing' | 'stock' | 'image' | 'details' | 'seo' | null>(null)

  const [createForm, setCreateForm] = useState({
    name: '', description: '', price: '', compare_price: '',
    image_url: '', stock_count: '0', category: '', tags: '',
    status: 'active', product_type: 'physical',
    seo_title: '', seo_description: '',
  })

  useEffect(() => {
    if (!product) return
    basicInfo.seed({ name: product.name, description: product.description })
    pricing.seed({ price: product.price, compare_price: product.compare_price })
    stock.seed({ stock_count: product.stock_count, category: product.category })
    image.seed({ image_url: product.image_url })
    details.seed({ status: product.status ?? 'active', product_type: product.product_type ?? 'physical', tags: product.tags ?? '' })
    seo.seed({ seo_title: product.seo_title ?? '', seo_description: product.seo_description ?? '' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product])

  const [selectedCollections, setSelectedCollections] = useState<number[]>([])
  const [collectionsSaved, setCollectionsSaved] = useState(false)

  const { data: allCollectionsData } = useQuery<{ collections: Collection[] }>({
    queryKey: ['collections'],
    queryFn: () => adminFetch('/api/collections').then(r => r.json()),
  })
  const allCollections = allCollectionsData?.collections ?? []

  const { data: productCollectionsData } = useQuery<{ collection_ids: number[] }>({
    queryKey: ['product-collections', id],
    queryFn: () => adminFetch(`/api/admin/products/${id}/collections`).then(r => r.json()),
    enabled: !!id && id !== 'new',
  })

  useEffect(() => {
    if (productCollectionsData?.collection_ids) {
      setSelectedCollections(productCollectionsData.collection_ids)
    }
  }, [productCollectionsData])

  const saveCollectionsMutation = useMutation({
    mutationFn: (ids: number[]) =>
      adminFetch(`/api/admin/products/${id}/collections`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection_ids: ids }),
      }).then(r => r.json()),
    onSuccess: () => {
      showToast('Collections saved', 'success')
      setCollectionsSaved(true)
      setTimeout(() => setCollectionsSaved(false), 2000)
    },
  })

  const isCreateMode = id === 'new'

  function parseOptions(options_json: string): { key: string; value: string }[] {
    try {
      const obj = JSON.parse(options_json) as Record<string, string>
      const entries = Object.entries(obj)
      return entries.length > 0 ? entries.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]
    } catch {
      return [{ key: '', value: '' }]
    }
  }

  function buildOptionsJson(options: { key: string; value: string }[]): string {
    const obj: Record<string, string> = {}
    options.forEach(o => { if (o.key.trim()) obj[o.key.trim()] = o.value.trim() })
    return JSON.stringify(obj)
  }

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
              <label className="block text-xs text-gray-500 mb-1">Price (₹) *</label>
              <input
                type="number" min="0" step="0.01"
                value={createForm.price}
                onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
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
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2">Primary Image</label>
            <ImageUploader
              existingUrl={createForm.image_url || undefined}
              onUploadComplete={(url) => setCreateForm(f => ({ ...f, image_url: url }))}
            />
          </div>
          <button
            onClick={() => {
              if (!createForm.name.trim() || createForm.price === '') return
              createMutation.mutate({
                name: createForm.name.trim(),
                description: createForm.description,
                price: parseFloat(createForm.price),
                compare_price: createForm.compare_price ? parseFloat(createForm.compare_price) : null,
                image_url: createForm.image_url || null,
                stock_count: parseInt(createForm.stock_count, 10) || 0,
                category: createForm.category,
                tags: createForm.tags,
                status: createForm.status,
                product_type: createForm.product_type,
                seo_title: createForm.seo_title || null,
                seo_description: createForm.seo_description || null,
              })
            }}
            disabled={createMutation.isPending || !createForm.name.trim() || createForm.price === ''}
            className="w-full py-2.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Creating…' : 'Create Product'}
          </button>
          <p className="text-xs text-gray-400 text-center">Gallery, variants and collections can be added after creating the product.</p>
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

      {/* Section: Primary Image */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Primary Image</h2>
          {!image.editing && (
            <button
              onClick={() => image.startEdit({ image_url: product.image_url })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {image.editing ? (
          <div className="space-y-4">
            <ImageUploader
              existingUrl={image.draft.image_url ?? undefined}
              onUploadComplete={(url) => image.setDraft({ image_url: url })}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSavingSection('image')
                  updateMutation.mutate({ image_url: image.draft.image_url }, {
                    onSuccess: () => { image.cancel(); setSavingSection(null) },
                    onError: () => setSavingSection(null),
                  })
                }}
                disabled={savingSection === 'image'}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {savingSection === 'image' ? 'Saving…' : 'Save'}
              </button>
              <button onClick={image.cancel} disabled={savingSection === 'image'}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-32 h-32 object-cover rounded border border-gray-200" />
            ) : (
              <p className="text-sm text-gray-400 italic">No image</p>
            )}
          </div>
        )}
      </div>

      {/* Section: Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Details</h2>
          {!details.editing && (
            <button
              onClick={() => details.startEdit({ status: product.status, product_type: product.product_type, tags: product.tags ?? '' })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {details.editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={details.draft.status}
                  onChange={(e) => details.setDraft({ ...details.draft, status: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                >
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Product Type</label>
                <select
                  value={details.draft.product_type}
                  onChange={(e) => details.setDraft({ ...details.draft, product_type: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tags</label>
              <input
                value={details.draft.tags}
                onChange={(e) => details.setDraft({ ...details.draft, tags: e.target.value })}
                placeholder="e.g. summer, sale"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSavingSection('details')
                  updateMutation.mutate({ status: details.draft.status, product_type: details.draft.product_type, tags: details.draft.tags }, {
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
            <span><span className="text-gray-400 text-xs">Type</span> <strong className="capitalize">{product.product_type}</strong></span>
            {product.tags && <span><span className="text-gray-400 text-xs">Tags</span> <strong>{product.tags}</strong></span>}
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

      {/* Section: Gallery */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-4">Gallery Images</h2>
        <p className="text-xs text-gray-400 mb-3">Additional images shown on the product page.</p>
        {galleryImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {galleryImages.map(img => (
              <div key={img.id} className="relative w-20 h-20 group/thumb">
                <img src={img.url} alt="" className="w-full h-full object-cover rounded border border-gray-200" />
                <button
                  type="button"
                  onClick={() => removeGalleryMutation.mutate(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <ImageUploader onUploadComplete={(url) => addGalleryMutation.mutate(url)} />
      </div>

      {/* Section: Variants */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium text-gray-800 mb-1">Variants</h2>
        <p className="text-xs text-gray-400 mb-4">
          Use variants for options like size or colour. Each variant has its own price, stock, and SKU.
        </p>

        {/* Existing variants */}
        {variants.length > 0 && (
          <div className="space-y-2 mb-4">
            {variants.map(v => {
              const isEditingThis = editingVariantId === v.id
              if (isEditingThis) {
                return (
                  <div key={v.id} className="border border-gray-300 rounded-lg p-3 space-y-2.5 bg-gray-50">
                    <input
                      placeholder="Variant name"
                      value={variantEditDraft.name}
                      onChange={e => setVariantEditDraft(d => ({ ...d, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                    />
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-400">Options</p>
                      {variantEditDraft.options.map((opt, idx) => (
                        <div key={idx} className="flex gap-1.5">
                          <input
                            placeholder="Option (Size)"
                            value={opt.key}
                            onChange={e => setVariantEditDraft(d => {
                              const opts = [...d.options]; opts[idx] = { ...opts[idx], key: e.target.value }; return { ...d, options: opts }
                            })}
                            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none"
                          />
                          <input
                            placeholder="Value (M)"
                            value={opt.value}
                            onChange={e => setVariantEditDraft(d => {
                              const opts = [...d.options]; opts[idx] = { ...opts[idx], value: e.target.value }; return { ...d, options: opts }
                            })}
                            className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none"
                          />
                          {variantEditDraft.options.length > 1 && (
                            <button type="button" onClick={() => setVariantEditDraft(d => ({ ...d, options: d.options.filter((_, i) => i !== idx) }))} className="text-red-400 text-xs px-1">×</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setVariantEditDraft(d => ({ ...d, options: [...d.options, { key: '', value: '' }] }))} className="text-xs text-gray-400 hover:text-gray-600">+ Add option</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Price *</label>
                        <input type="number" min="0" step="0.01" value={variantEditDraft.price}
                          onChange={e => setVariantEditDraft(d => ({ ...d, price: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Stock</label>
                        <input type="number" min="0" value={variantEditDraft.stock_count}
                          onChange={e => setVariantEditDraft(d => ({ ...d, stock_count: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">SKU</label>
                        <input value={variantEditDraft.sku}
                          onChange={e => setVariantEditDraft(d => ({ ...d, sku: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!variantEditDraft.name.trim() || variantEditDraft.price === '' || updateVariantMutation.isPending}
                        onClick={() => updateVariantMutation.mutate({
                          variantId: v.id,
                          name: variantEditDraft.name.trim(),
                          options_json: buildOptionsJson(variantEditDraft.options),
                          price: parseFloat(variantEditDraft.price),
                          stock_count: parseInt(variantEditDraft.stock_count, 10) || 0,
                          sku: variantEditDraft.sku.trim(),
                        })}
                        className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50"
                      >
                        {updateVariantMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingVariantId(null)} className="px-3 py-1.5 border border-gray-300 text-xs rounded hover:bg-gray-50">Cancel</button>
                    </div>
                  </div>
                )
              }
              const parsedOpts = parseOptions(v.options_json)
              return (
                <div key={v.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800">{v.name}</p>
                    <p className="text-xs text-gray-400">
                      {parsedOpts.filter(o => o.key.trim()).map(o => `${o.key}: ${o.value}`).join(' · ')}
                      {v.sku && ` · SKU: ${v.sku}`}
                    </p>
                    <p className="text-xs text-gray-600">₹{v.price} · {v.stock_count} in stock</p>
                  </div>
                  <div className="flex gap-2 ml-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingVariantId(v.id)
                        setVariantEditDraft({ name: v.name, price: String(v.price), stock_count: String(v.stock_count), sku: v.sku, options: parseOptions(v.options_json) })
                      }}
                      className="text-blue-500 hover:text-blue-700 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVariantMutation.mutate(v.id)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add variant form */}
        <div className="border border-gray-200 rounded-lg p-3 space-y-2.5">
          <p className="text-xs text-gray-500 font-medium">Add Variant</p>
          <input
            placeholder="Variant name (e.g. Small / Red)"
            value={variantAddForm.name}
            onChange={e => setVariantAddForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-gray-500"
          />
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400">Options (e.g. Size → M)</p>
            {variantAddForm.options.map((opt, idx) => (
              <div key={idx} className="flex gap-1.5">
                <input
                  placeholder="Option (Size)"
                  value={opt.key}
                  onChange={e => setVariantAddForm(f => { const opts = [...f.options]; opts[idx] = { ...opts[idx], key: e.target.value }; return { ...f, options: opts } })}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                />
                <input
                  placeholder="Value (M)"
                  value={opt.value}
                  onChange={e => setVariantAddForm(f => { const opts = [...f.options]; opts[idx] = { ...opts[idx], value: e.target.value }; return { ...f, options: opts } })}
                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                />
                {variantAddForm.options.length > 1 && (
                  <button type="button" onClick={() => setVariantAddForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))} className="text-red-400 text-xs px-1">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setVariantAddForm(f => ({ ...f, options: [...f.options, { key: '', value: '' }] }))} className="text-xs text-gray-400 hover:text-gray-600">+ Add option</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Price *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={variantAddForm.price}
                onChange={e => setVariantAddForm(f => ({ ...f, price: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Stock</label>
              <input type="number" min="0" placeholder="0" value={variantAddForm.stock_count}
                onChange={e => setVariantAddForm(f => ({ ...f, stock_count: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SKU</label>
              <input placeholder="SKU-001" value={variantAddForm.sku}
                onChange={e => setVariantAddForm(f => ({ ...f, sku: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none" />
            </div>
          </div>
          <button
            type="button"
            disabled={!variantAddForm.name.trim() || variantAddForm.price === '' || addVariantMutation.isPending}
            onClick={() => addVariantMutation.mutate({
              name: variantAddForm.name.trim(),
              options_json: buildOptionsJson(variantAddForm.options),
              price: parseFloat(variantAddForm.price),
              stock_count: parseInt(variantAddForm.stock_count, 10) || 0,
              sku: variantAddForm.sku.trim(),
            })}
            className="w-full py-1.5 bg-gray-800 text-white text-xs rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {addVariantMutation.isPending ? 'Adding…' : 'Add Variant'}
          </button>
        </div>
      </div>

      {/* Section: Collections */}
      {allCollections.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-gray-800">Collections</h2>
            <button
              onClick={() => saveCollectionsMutation.mutate(selectedCollections)}
              disabled={saveCollectionsMutation.isPending}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {collectionsSaved ? 'Saved ✓' : saveCollectionsMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {allCollections.map(col => (
              <label key={col.id} className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={selectedCollections.includes(col.id)}
                  onChange={() => setSelectedCollections(prev =>
                    prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id]
                  )}
                  className="w-3.5 h-3.5 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{col.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
