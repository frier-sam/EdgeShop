import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import { fetchJson, fetchJsonWith } from '../../lib/api'
import ProductSideCard from '../ProductSideCard'
import ProductSizesEditor from '../ProductSizesEditor'
import Field from '../../components/Field'
import Button from '../../components/Button'
import { Skeleton } from '../../components/Skeleton'
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display font-semibold text-ink">{title}</h2>
      {children}
    </div>
  )
}

// ── Preview check (POD.md §4.4 point 4) ──────────────────────────────
// Sample text dropped into the print area over the front mockup so a
// merchant can sanity-check placement before publishing. Deliberately a
// plain absolutely-positioned DOM overlay — no canvas library (that's
// Phase 6's job).
function PreviewCheck({ front }: { front: ProductSide }) {
  return (
    <Section title="Preview check">
      <p className="-mt-2 text-xs text-ink-faint">Sample text dropped into the saved print area — a rough sanity check, not the real editor.</p>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-btn bg-surface-2"
        style={{ aspectRatio: `${front.image_w} / ${front.image_h}` }}
      >
        <img src={front.image_url} alt="Front mockup" className="absolute inset-0 h-full w-full object-fill" />
        <div
          className="absolute flex items-center justify-center overflow-hidden p-1"
          style={{
            left: `${front.print_x * 100}%`,
            top: `${front.print_y * 100}%`,
            width: `${front.print_w * 100}%`,
            height: `${front.print_h * 100}%`,
          }}
        >
          <span className="rounded bg-white/80 px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight text-ink sm:text-sm">
            Your Design Here
          </span>
        </div>
      </div>
    </Section>
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
        <Link to="/admin/products" className="mb-1 inline-block text-xs text-ink-faint transition-colors duration-fast hover:text-ink">
          ← Back to Products
        </Link>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">New Product</h1>
      </div>
      <Section title="Basics">
        <Field
          label="Name"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Field
          label="Description"
          as="textarea"
          rows={3}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Base price (₹)"
            required
            type="number" min="0" step="0.01"
            value={form.base_price}
            onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
          />
          <Field
            label="Stock"
            type="number" min="0"
            value={form.stock_count}
            onChange={(e) => setForm((f) => ({ ...f, stock_count: e.target.value }))}
            hint="Only used if the product ends up with no sizes."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
          <Field
            label="Status"
            as="select"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'draft' }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
            ]}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={form.is_customizable}
            onChange={(e) => setForm((f) => ({ ...f, is_customizable: e.target.checked }))}
            className="h-4 w-4 rounded border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          />
          <span className="text-sm text-ink">Customizable (customer can print their own design on this product)</span>
        </label>
        <Button
          fullWidth
          size="lg"
          loading={createMutation.isPending}
          disabled={!form.name.trim() || form.base_price === ''}
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
        >
          Create product
        </Button>
        <p className="text-center text-xs text-ink-faint">Mockups, print areas and sizes can be added after creating the product.</p>
      </Section>
    </div>
  )
}

// ── Edit mode ──────────────────────────────────────────────────────
function EditProductForm({ id }: { id: string }) {
  const numericId = Number(id)
  const qc = useQueryClient()

  const { data: product, isLoading, error } = useQuery<ProductDetail>({
    queryKey: ['product', id],
    queryFn: () => fetchJsonWith<ProductDetail>(adminFetch, `/api/admin/products/${id}`),
  })

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['public-settings'],
    queryFn: () => fetchJson<Record<string, string>>('/api/settings'),
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

  if (isLoading || !basics) return (
    <div className="max-w-2xl space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="space-y-3 rounded-card border border-line bg-surface p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
  if (error || !product) return <p className="text-sm text-danger">Product not found.</p>

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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/products" className="mb-1 inline-block text-xs text-ink-faint transition-colors duration-fast hover:text-ink">
            ← Back to Products
          </Link>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">{product.name}</h1>
        </div>
        <a
          href={`/product/${product.slug ?? id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-btn border border-line px-3 py-1.5 text-xs text-ink-soft transition-colors duration-fast hover:border-ink-faint hover:text-ink"
        >
          View on storefront ↗
        </a>
      </div>

      {/* 1. Basics */}
      <Section title="Basics">
        <Field
          label="Name"
          required
          value={basics.name}
          onChange={(e) => setBasics({ ...basics, name: e.target.value })}
        />
        <Field
          label="Slug"
          value={basics.slug}
          onChange={(e) => setBasics({ ...basics, slug: e.target.value })}
          placeholder={product.slug ?? ''}
        />
        <Field
          label="Description"
          as="textarea"
          rows={4}
          value={basics.description}
          onChange={(e) => setBasics({ ...basics, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Category"
            value={basics.category}
            onChange={(e) => setBasics({ ...basics, category: e.target.value })}
          />
          <Field
            label="Status"
            as="select"
            value={basics.status}
            onChange={(e) => setBasics({ ...basics, status: e.target.value as 'active' | 'draft' })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Base price (₹)"
            required
            type="number" min="0" step="0.01"
            value={basics.base_price}
            onChange={(e) => setBasics({ ...basics, base_price: e.target.value })}
          />
          <Field
            label="Compare-at price"
            type="number" min="0" step="0.01"
            value={basics.compare_price}
            onChange={(e) => setBasics({ ...basics, compare_price: e.target.value })}
            placeholder="Optional"
          />
        </div>
        {!hasSizes && (
          <Field
            label="Stock count"
            type="number" min="0" step="1"
            value={basics.stock_count}
            onChange={(e) => setBasics({ ...basics, stock_count: e.target.value })}
            hint="This product has no sizes, so stock is tracked here directly."
          />
        )}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={basics.is_customizable}
            onChange={(e) => setBasics({ ...basics, is_customizable: e.target.checked })}
            className="h-4 w-4 rounded border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          />
          <span className="text-sm text-ink">Customizable</span>
        </label>
        {basicsError && <p className="text-xs text-danger">{basicsError}</p>}
        <Button loading={basicsMutation.isPending} onClick={handleSaveBasics}>
          Save basics
        </Button>
      </Section>

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
        <h2 className="px-1 font-display font-semibold text-ink">Sides</h2>
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
            className="w-full rounded-card border border-dashed border-line py-3 text-center text-sm text-ink-soft transition-colors duration-fast hover:border-ink-faint hover:text-ink"
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
