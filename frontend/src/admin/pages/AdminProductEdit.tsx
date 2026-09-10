import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import { fetchJson, fetchJsonWith } from '../../lib/api'
import AdminPageHeader from '../AdminPageHeader'
import ProductPreviewWorkspace from '../ProductPreviewWorkspace'
import ProductSideCard from '../ProductSideCard'
import ProductSizesEditor from '../ProductSizesEditor'
import ProductVariantsEditor from '../ProductVariantsEditor'
import ProductPriceBreaksEditor from '../ProductPriceBreaksEditor'
import CategoryCombobox from '../CategoryCombobox'
import { PRODUCT_PRESETS, type ProductPreset } from '../productPresets'
import Field from '../../components/Field'
import Button from '../../components/Button'
import SegmentedControl from '../../components/ui/SegmentedControl'
import Icon from '../../components/ui/Icon'
import type { IconName } from '../../components/ui/iconNames'
import { Skeleton } from '../../components/Skeleton'
import type { ProductDetail, ProductSide, ProductSize, ProductVariant, ProductPriceBreak } from '../../lib/types'

const DEFAULT_PRINT_FEE_FALLBACK = 99
const MAX_HIGHLIGHTS_LENGTH = 2000
const MAX_HIGHLIGHTS_LINES = 8

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
  // POD-V2.md §1.1 / §5 — axis names and the bulk-order floor. Kept on the
  // same BasicsDraft/PATCH round trip as everything else on this section;
  // there is no separate save action for these three fields.
  axis1_label: string
  axis2_label: string
  min_order_qty: string
  // POD-UI4.md §4.1 / D.7 — newline-separated bullet lines for the
  // storefront's "Key Features" box. Same round trip as every other
  // Basics field — no separate save action.
  highlights: string
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
    // `|| default` (not `??`) on purpose: an empty string is exactly as
    // unset as a missing column while the worker agent's migration is
    // still landing (POD-V2.md §1.1 says these columns default to "Size"
    // / "Colour" in the schema itself — this mirrors that default on the
    // client for the transition window and for any pre-migration row).
    axis1_label: p.axis1_label || 'Size',
    axis2_label: p.axis2_label || 'Colour',
    min_order_qty: String(p.min_order_qty ?? 1),
    highlights: p.highlights ?? '',
  }
}

// ── Preset → draft-row conversion (POD-V2.md §1.2 / §11 Phase 1.6) ──────
// A freshly-created product has no saved sizes/variants/price_breaks yet
// (those only exist once their own PUT has been called at least once), so
// a preset's prefilled rows can't be persisted at creation time — there's
// nothing to attach them to until the product row exists. Instead they
// ride along as router state (see CreateProductForm's onSuccess) and get
// converted here into the exact shape ProductSizesEditor/
// ProductVariantsEditor/ProductPriceBreaksEditor already expect as
// "initial" rows. The negative `id`s are never sent anywhere — each
// editor only uses `id` to build its own local React list key
// (`rowsFromSizes` etc.) and strips it entirely from the save payload —
// so a fabricated placeholder id is exactly as safe here as a real one.
function presetInitialSizes(preset: ProductPreset): ProductSize[] {
  return preset.axis1Rows.map((r, i) => ({ id: -(i + 1), product_id: 0, label: r.label, price_delta: 0, stock_count: 0, sort_order: i }))
}
function presetInitialVariants(preset: ProductPreset): ProductVariant[] {
  return preset.axis2Rows.map((r, i) => ({ id: -(i + 1), label: r.label, swatch_hex: r.swatch_hex, sort_order: i }))
}
function presetInitialPriceBreaks(preset: ProductPreset): ProductPriceBreak[] {
  return preset.priceBreakRows.map((r, i) => ({ id: -(i + 1), min_qty: r.min_qty, unit_price: r.unit_price }))
}

interface SectionToggle {
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}

// POD-UI4.md §5 D.5 (A6) — the single card/header primitive reused for
// Basics AND every one of the four capability blocks (axis 1, axis 2,
// bulk pricing, customization). Without a `toggle` it's a plain bordered
// card with an (optional) icon-prefixed title — Basics still uses it that
// way. WITH a `toggle`, the header becomes the comp's OPTION CARD: an
// icon tile + title + one-line description (`toggle.hint`) + checkbox in
// a single `rounded-btn border` row, `border-2 border-primary` when
// enabled — and the card styling moves to the child (every block's child
// — ProductSizesEditor, ProductVariantsEditor, ProductPriceBreaksEditor,
// the Sides group — already draws its own bordered card), so a toggled
// block never nests two borders.
//
// unticking a block hides it but MUST NOT delete its rows: the child is
// ALWAYS mounted, both when checked and unchecked. Only a CSS class
// (`hidden`) changes — this exact div, with no other classes ever added
// to it, is what admin/pages/__tests__/AdminProductEdit.test.tsx asserts
// on directly (`wrapper.className` toBe `''`/`'hidden'`). This is not a
// style nicety — the row editors below seed their internal draft state
// once from props at mount and never resync it (deliberately, so a
// background refetch can't clobber an in-progress edit); if this wrapper
// unmounted the child on uncheck, that draft — and, before the first
// save, a preset's prefilled rows — would be gone the moment the merchant
// re-ticked the box. Rows are only ever actually removed by the row-level
// "remove" button inside each editor, followed by that editor's own Save.
export function Section({
  title,
  toggle,
  icon,
  children,
}: {
  title: string
  toggle?: SectionToggle
  icon?: IconName
  children: React.ReactNode
}) {
  if (!toggle) {
    return (
      <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-display font-semibold text-ink">
          {icon && <Icon name={icon} size={20} className="text-ink-soft" />}
          {title}
        </h2>
        {children}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer items-center gap-4 rounded-btn p-4 transition-colors duration-fast ${
          toggle.checked ? 'border-2 border-primary' : 'border border-line hover:bg-surface-2'
        }`}
      >
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm ${
            toggle.checked ? 'bg-primary-container text-on-primary' : 'bg-surface-3 text-ink-soft'
          }`}
        >
          {icon && <Icon name={icon} size={22} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">{title}</span>
          {toggle.hint && <span className="mt-0.5 block text-xs font-normal text-ink-soft">{toggle.hint}</span>}
        </span>
        <input
          type="checkbox"
          checked={toggle.checked}
          onChange={(e) => toggle.onChange(e.target.checked)}
          className="h-5 w-5 shrink-0 rounded border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        />
      </label>
      <div className={toggle.checked ? '' : 'hidden'}>{children}</div>
    </div>
  )
}

// POD-V2.md §1.2 — presets are offered on the NEW product screen only.
// Picking one only sets local `CreateProductForm` state (axis names +
// is_customizable) plus, for the row prefills a not-yet-created product
// has nowhere to store, a bundle forwarded to the edit page via router
// state once the product exists (see the onSuccess handler below). No
// network call of its own, no new route.
function PresetPicker({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const selected = PRODUCT_PRESETS.find((p) => p.id === selectedId) ?? null
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-soft">Start from a preset (optional)</span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={selectedId === null ? 'primary' : 'secondary'} size="sm" onClick={() => onSelect(null)}>
          Blank
        </Button>
        {PRODUCT_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant={selectedId === preset.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onSelect(preset.id)}
          >
            {preset.name}
          </Button>
        ))}
      </div>
      {selected && <p className="mt-1.5 text-xs text-ink-soft">{selected.blurb}</p>}
    </div>
  )
}

// ── Create mode ────────────────────────────────────────────────────
function CreateProductForm() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [presetId, setPresetId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', description: '', base_price: '', compare_price: '',
    stock_count: '0', category: '', status: 'active' as 'active' | 'draft', is_customizable: false,
    axis1_label: 'Size', axis2_label: 'Colour',
  })

  function applyPreset(id: string | null) {
    setPresetId(id)
    const preset = id ? PRODUCT_PRESETS.find((p) => p.id === id) ?? null : null
    if (!preset) return
    // §1.2: "ticks some checkboxes, sets the two axis names" — deliberately
    // never touches name/description/price/category/stock, which stay
    // whatever the merchant already typed.
    setForm((f) => ({ ...f, is_customizable: preset.is_customizable, axis1_label: preset.axis1_label, axis2_label: preset.axis2_label }))
  }

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
      const preset = presetId ? PRODUCT_PRESETS.find((p) => p.id === presetId) ?? null : null
      // Row prefills only — everything else the preset set (axis names,
      // is_customizable) already round-tripped through the create POST
      // above and comes back from GET /api/admin/products/:id normally.
      navigate(`/admin/products/${data.id}`, preset ? { state: { pendingPreset: preset } } : undefined)
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AdminPageHeader title="New Product" backTo="/admin/products" />
      <Section title="Basics" icon="info">
        <PresetPicker selectedId={presetId} onSelect={applyPreset} />
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
          <CategoryCombobox value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} />
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-soft">Status</span>
            <SegmentedControl
              aria-label="Status"
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'draft', label: 'Draft' },
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Axis 1 name"
            value={form.axis1_label}
            onChange={(e) => setForm((f) => ({ ...f, axis1_label: e.target.value }))}
            hint='e.g. "Size", "Paper size", "Volume"'
          />
          <Field
            label="Axis 2 name"
            value={form.axis2_label}
            onChange={(e) => setForm((f) => ({ ...f, axis2_label: e.target.value }))}
            hint='e.g. "Colour", "Finish", "Cap colour"'
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
              axis1_label: form.axis1_label.trim() || 'Size',
              axis2_label: form.axis2_label.trim() || 'Colour',
            })
          }}
        >
          Create product
        </Button>
        <p className="text-center text-xs text-ink-faint">Mockups, print areas, options and bulk pricing can be added after creating the product.</p>
      </Section>
    </div>
  )
}

// ── Edit mode ──────────────────────────────────────────────────────
function EditProductForm({ id }: { id: string }) {
  const numericId = Number(id)
  const qc = useQueryClient()
  const location = useLocation()
  // Only present on the one navigation straight from CreateProductForm's
  // preset picker — reloading this page or navigating back to it later
  // carries no router state, so pendingPreset naturally becomes null and
  // this block of logic never fires again for this product. That's
  // exactly the "offered on a NEW product only" requirement (§1.2).
  const pendingPreset = (location.state as { pendingPreset?: ProductPreset } | null)?.pendingPreset ?? null

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
  // POD-V2.md §11 Phase 1.3 — each capability block's checked state. Seeded
  // once (see the effect below) from either the incoming preset or
  // whether the product already has saved rows on that axis — never
  // resynced afterwards, so the merchant's own toggling during this
  // editing session is never overwritten by a background refetch.
  const [axis1Enabled, setAxis1Enabled] = useState<boolean | null>(null)
  const [axis2Enabled, setAxis2Enabled] = useState<boolean | null>(null)
  const [bulkEnabled, setBulkEnabled] = useState<boolean | null>(null)

  // POD-V2.md §1 — what a capability checkbox IS, and what it deliberately
  // is not. It is a DISCLOSURE control, derived from whether the block has
  // any rows, held in local state and never persisted. It is NOT a stored
  // "this product has colours" capability flag.
  //
  // That distinction is load-bearing for Phase 2 (the storefront picker):
  // the source of truth for whether a product offers an axis is **whether
  // it has rows**, never a separate boolean. A stored flag could disagree
  // with the data it describes — "no colours" sitting next to three colour
  // rows — and then every consumer has to decide which one is lying. So the
  // storefront reads the rows, and to stop offering an axis the merchant
  // deletes them.
  //
  // The consequences, both intended: unticking hides the block without
  // deleting anything (data loss must never be a side effect of collapsing
  // a section), and because the state is derived, a reload re-ticks a block
  // that still has rows.
  //
  // Seed the editable Basics draft (and the three block toggles) once
  // when the product first loads — not on every refetch, so in-progress
  // edits survive a sides/sizes/variants/price-breaks save elsewhere on
  // the page (which invalidates the same ['product', id] query). All four
  // setState calls below land in the same React 18 batch, so basics and
  // the toggles become non-null together on the very next render.
  useEffect(() => {
    if (!product) return
    setBasics((b) => b ?? basicsFromProduct(product))
    setAxis1Enabled((v) => (v !== null ? v : pendingPreset ? pendingPreset.enableAxis1 : (product.sizes ?? []).length > 0))
    setAxis2Enabled((v) => (v !== null ? v : pendingPreset ? pendingPreset.enableAxis2 : (product.variants ?? []).length > 0))
    setBulkEnabled((v) => (v !== null ? v : pendingPreset ? pendingPreset.enableBulk : (product.price_breaks ?? []).length > 0))
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
    const minOrderQty = parseInt(basics.min_order_qty, 10)
    if (!Number.isFinite(minOrderQty) || minOrderQty < 1) { setBasicsError('Minimum order quantity must be a whole number of 1 or more.'); return }
    const axis1Label = basics.axis1_label.trim() || 'Size'
    const axis2Label = basics.axis2_label.trim() || 'Colour'
    // POD-UI4.md D.7 — the worker itself rejects >2000 chars with a 400
    // (normalizeHighlights in worker/src/routes/admin/products.ts); this
    // is a courtesy that catches the same case before a round trip and
    // surfaces it through the exact same basicsError paragraph every
    // other Basics field already uses.
    const highlightsTrimmed = basics.highlights.trim()
    if (highlightsTrimmed.length > MAX_HIGHLIGHTS_LENGTH) {
      setBasicsError(`Key features must be ${MAX_HIGHLIGHTS_LENGTH} characters or fewer.`)
      return
    }
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
      axis1_label: axis1Label,
      axis2_label: axis2Label,
      min_order_qty: minOrderQty,
      highlights: highlightsTrimmed,
    })
  }

  if (isLoading || !basics) return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Skeleton className="h-7 w-48" />
      <div className="space-y-3 rounded-card border border-line bg-surface p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
  if (error || !product) return <p className="text-sm text-danger">Product not found.</p>

  const sizes = product.sizes ?? []
  const variants = product.variants ?? []
  const priceBreaks = product.price_breaks ?? []
  const sides = product.sides ?? []
  const frontSide = sides.find((s) => s.side === 'front') ?? null
  const backSide = sides.find((s) => s.side === 'back') ?? null
  const hasSizes = sizes.length > 0
  const showBackCard = !!backSide || addingBack
  const highlightsLineCount = basics.highlights.split('\n').filter((l) => l.trim() !== '').length
  const highlightsCharCount = basics.highlights.trim().length

  function updateSidesCache(saved: ProductSide) {
    qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => {
      if (!old) return old
      const others = (old.sides ?? []).filter((s) => s.side !== saved.side)
      return { ...old, sides: [...others, saved].sort((a, b) => a.sort_order - b.sort_order) }
    })
  }

  function removeSideFromCache(side: 'front' | 'back') {
    qc.setQueryData<ProductDetail | undefined>(['product', id], (old) =>
      old ? { ...old, sides: (old.sides ?? []).filter((s) => s.side !== side) } : old
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={product.name}
        backTo="/admin/products"
        status={{ label: product.status === 'active' ? 'Active' : 'Draft', tone: product.status === 'active' ? 'success' : 'neutral' }}
        actions={
          <Button
            as="a"
            href={`/product/${product.slug ?? id}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="sm"
            rightIcon={<Icon name="open_in_new" size={16} />}
          >
            View on storefront
          </Button>
        }
      />

      {/* Two-pane editor (POD-UI4.md §5 D.3/A3): a scrolling config column,
          and — on xl — a sticky preview workspace as a right rail; below
          xl it stacks underneath instead of crushing a 420px column onto
          a phone. */}
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          {/* 1. Basics */}
          <Section title="Basics" icon="info">
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
              <CategoryCombobox value={basics.category} onChange={(v) => setBasics({ ...basics, category: v })} />
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-soft">Status</span>
                <SegmentedControl
                  aria-label="Status"
                  value={basics.status}
                  onChange={(v) => setBasics({ ...basics, status: v })}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'draft', label: 'Draft' },
                  ]}
                />
              </div>
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
            {/* POD-V2.md §1.1/§1.4 — every option label downstream (row labels
                in the axis-1 and axis-2 blocks, and eventually the storefront
                picker in Phase 2) reads these two fields. Never parsed,
                never validated against a unit — free text, on purpose. */}
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Axis 1 name"
                value={basics.axis1_label}
                onChange={(e) => setBasics({ ...basics, axis1_label: e.target.value })}
                hint='e.g. "Size", "Paper size", "Volume"'
              />
              <Field
                label="Axis 2 name"
                value={basics.axis2_label}
                onChange={(e) => setBasics({ ...basics, axis2_label: e.target.value })}
                hint='e.g. "Colour", "Finish", "Cap colour"'
              />
            </div>
            <Field
              label="Minimum order quantity"
              type="number" min="1" step="1"
              value={basics.min_order_qty}
              onChange={(e) => setBasics({ ...basics, min_order_qty: e.target.value })}
              hint="A bulk-priced product can require a minimum purchase (e.g. 100 cards). 1 = no minimum."
            />
            {!hasSizes && (
              <Field
                label="Stock count"
                type="number" min="0" step="1"
                value={basics.stock_count}
                onChange={(e) => setBasics({ ...basics, stock_count: e.target.value })}
                hint="This product has no sizes, so stock is tracked here directly."
              />
            )}
            {/* POD-UI4.md §4.1 / D.7 — the storefront's "Key Features" box,
                rendered only when non-empty (lib/types.ts's ProductDetail
                already documents that). Line/char counts are a client-side
                courtesy; the worker is the actual 2000-char authority. */}
            <Field
              label="Key features"
              as="textarea"
              rows={4}
              value={basics.highlights}
              onChange={(e) => setBasics({ ...basics, highlights: e.target.value })}
              hint={`Each line becomes one bullet on the product page. Aim for ${MAX_HIGHLIGHTS_LINES} lines or fewer (currently ${highlightsLineCount}) and ${MAX_HIGHLIGHTS_LENGTH} characters (currently ${highlightsCharCount}).`}
            />
            {basicsError && <p className="text-xs text-danger">{basicsError}</p>}
            <Button loading={basicsMutation.isPending} onClick={handleSaveBasics}>
              Save basics
            </Button>
          </Section>

          {/* 2. Axis 1 — the pre-existing sizes editor, now behind a capability
              checkbox and reading its header/row labels from axis1_label. */}
          {/* The heading IS the merchant's own axis name (POD-V2.md §1.1). "Axis 1"
              is our word, not theirs — a card merchant should read "Paper size" and
              a bottle merchant "Volume", which is the whole point of the axis being
              nameable. The generic word only survives in the hint. */}
          <Section
            title={basics.axis1_label || 'Size'}
            icon="straighten"
            toggle={{
              checked: axis1Enabled ?? false,
              onChange: (v) => setAxis1Enabled(v),
              hint: 'The primary option axis. Carries stock and an optional per-option price delta.',
            }}
          >
            <ProductSizesEditor
              productId={numericId}
              initialSizes={pendingPreset ? presetInitialSizes(pendingPreset) : sizes}
              axisLabel={basics.axis1_label || 'Size'}
              onSaved={(newSizes) => {
                qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => (old ? { ...old, sizes: newSizes } : old))
              }}
            />
          </Section>

          {/* 3. Axis 2 — colour / finish / material (POD-V2.md §3). No price,
              no stock; swatches are optional (§3.1). */}
          <Section
            title={basics.axis2_label || 'Colour'}
            icon="palette"
            toggle={{
              checked: axis2Enabled ?? false,
              onChange: (v) => setAxis2Enabled(v),
              hint: 'A second, price-free option axis. No stock, no price delta; swatches are optional, so "Matte / Glossy" is a complete option set.',
            }}
          >
            <ProductVariantsEditor
              productId={numericId}
              initialVariants={pendingPreset ? presetInitialVariants(pendingPreset) : variants}
              axisLabel={basics.axis2_label || 'Colour'}
              onSaved={(newVariants) => {
                qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => (old ? { ...old, variants: newVariants } : old))
              }}
            />
          </Section>

          {/* 4. Bulk pricing (POD-V2.md §5) — absolute, all-in quantity tiers. */}
          <Section
            title="Bulk pricing"
            icon="savings"
            toggle={{
              checked: bulkEnabled ?? false,
              onChange: (v) => setBulkEnabled(v),
              hint: 'Quantity price tiers — the tier price replaces base price + printing above that quantity, it does not add to them.',
            }}
          >
            <ProductPriceBreaksEditor
              productId={numericId}
              initialPriceBreaks={pendingPreset ? presetInitialPriceBreaks(pendingPreset) : priceBreaks}
              sides={sides}
              onSaved={(newBreaks) => {
                qc.setQueryData<ProductDetail | undefined>(['product', id], (old) => (old ? { ...old, price_breaks: newBreaks } : old))
              }}
            />
          </Section>

          {/* 5. Customization — mockups and print areas, gated on the same
              is_customizable flag Basics already saves. Unticking hides this
              whole block (still without deleting any uploaded mockup or
              print-area data — see Section's comment). The live preview
              itself has moved into the workspace pane on the right. */}
          <Section
            title="Customization"
            icon="design_services"
            toggle={{
              checked: basics.is_customizable,
              onChange: (v) => setBasics({ ...basics, is_customizable: v }),
              hint: 'Lets a customer print their own design on this product. Controls mockups and print areas below — saved together with Basics.',
            }}
          >
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
          </Section>
        </div>

        {/* Preview workspace (POD-UI4.md §5 D.3/D.4/A3/A4/A5) — sticky right
            rail on xl, stacked below the config column on smaller widths.
            Reads the SAVED product row (`sides`, `product.base_price`),
            never the unsaved draft, so a chip never claims "ready" before
            Save has actually run. */}
        <div className="w-full shrink-0 xl:sticky xl:top-24 xl:w-[380px]">
          <ProductPreviewWorkspace
            sides={sides}
            basePrice={product.base_price}
            axis1Enabled={axis1Enabled ?? false}
            axis2Enabled={axis2Enabled ?? false}
            bulkEnabled={bulkEnabled ?? false}
            customizationEnabled={basics.is_customizable}
          />
        </div>
      </div>
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
