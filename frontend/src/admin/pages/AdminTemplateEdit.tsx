// POD-V2.md §6.4 / §11 Phase 4.3 — authoring a design template. THE KEY
// DECISION THIS FILE MUST NOT UNDO: there is no second canvas editor here.
// The admin picks a reference product purely to borrow a real print area,
// then this mounts the shopper's own CustomizerEditor in an admin mode
// (`templateMode`) — one editor, one design format, one renderer, so a
// template can never render differently from the design it becomes.
//
// CustomizerEditor is lazy-loaded exactly like CustomizePage.tsx does for
// the shopper route, so Fabric (~90KB gz) never reaches the main admin
// bundle just because this page exists — pinned by
// __tests__/adminBundleComposition.test.ts.
//
// Route placement (App.tsx): this page is deliberately a SIBLING of
// /admin, not nested inside AdminLayout's <Outlet/>. CustomizerEditor's
// root is a hard `h-[100dvh]` — a real full-viewport tool, not a
// `h-full` box — so nesting it under AdminLayout's padded, sidebar'd
// <main> would either clip it or force a double-scroll page. The
// shopper's own /customize/:productId route has exactly the same shape
// for exactly the same reason. Because this route sits outside
// AdminLayout, it re-implements two jobs it would otherwise inherit for
// free: the auth-redirect guard, and mounting a <ToastContainer/> so
// showToast() (used by the save flow below, and by every other admin
// page) has somewhere to render — Toast.tsx's listener bus is global, but
// nothing subscribes to it unless a <ToastContainer/> is actually mounted
// somewhere in the current tree.
//
// Three-step flow, all in local state (nothing here is worth a route
// param beyond ?collection_id=):
//   1. 'pick'    — search/browse customizable products, choose one.
//   2. 'confirm' — name the template, see exactly what it's authored
//                  against and at what shape (§6.2's letterbox-not-
//                  stretch fitting is what makes "not tied to it" true),
//                  before any Fabric code has even downloaded.
//   3. 'draw'    — the bare lazy CustomizerEditor, full-bleed, no chrome
//                  of ours layered on top (see the h-[100dvh] note above).
import { useEffect, useState, lazy, Suspense } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { fetchJsonWith } from '../../lib/api'
import { showToast, ToastContainer } from '../Toast'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import AdminPageHeader from '../AdminPageHeader'
import Field from '../../components/Field'
import Button from '../../components/Button'
import { SkeletonCards } from '../../components/Skeleton'
import { describeAspectRatio } from './AdminTemplates'
import type { TemplateCollection } from './AdminTemplates'
import type { ProductDetail, ProductSide } from '../../lib/types'

const CustomizerEditor = lazy(() => import('../../editor/CustomizerEditor'))

function FullScreenLoader() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-paper">
      <p className="text-sm text-ink-soft">Loading the design editor…</p>
    </div>
  )
}

// Row shape from GET /api/admin/products (list) — kept local, same reason
// AdminProducts.tsx keeps its own AdminProductRow instead of importing
// lib/types's shopper-facing ProductSummary.
interface PickableProduct {
  id: number
  name: string
  category: string
  is_customizable: number
  /** From the list query's EXISTS subquery: has at least one customizable side with a real (non-zero) print rect. */
  has_print_area: number
  front_image: string | null
}

/**
 * The side actually drawn against (§6.3 — a template is single-side).
 *
 * The side a template will be drawn against, or null if this product has
 * none usable.
 *
 * "Usable" deliberately means more than `customizable` being set: a side can
 * be flagged customizable while its normalized print rect is still the 0x0
 * default (POD-V2.md §6.4). Accepting one of those would mount the editor on
 * a zero-sized plane — a blank, unusable canvas with no error to explain it —
 * so a print area with real width and height is part of the test.
 */
export function firstCustomizableSide(product: ProductDetail): ProductSide | null {
  return (product.sides ?? []).find((s) => !!s.customizable && s.print_w > 0 && s.print_h > 0) ?? null
}

/** The payload the editor agent's `templateMode.onSave` hands back (POD-V2.md §6.4's contract). Deliberately loosely typed here (`unknown` for the Fabric JSON) rather than importing CustomizerEditor's real `FabricSnapshot` type — this file must import NOTHING from editor/** at module scope, or Fabric stops being lazy. `React.lazy`'s inferred component type still checks this object literal structurally against the real `TemplateModeConfig` at the JSX call site below, so a contract mismatch still fails `tsc -b`. */
interface TemplateSavePayload {
  design_json: unknown
  canvas_w: number
  canvas_h: number
  preview: Blob
}

export default function AdminTemplateEdit() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Mirrors AdminLayout.tsx's own guard — this route sits outside that
  // layout (see header comment), so it needs its own copy.
  const adminToken = useAdminAuthStore((s) => s.adminToken)
  useEffect(() => {
    if (!adminToken) navigate('/admin/login', { replace: true })
  }, [adminToken, navigate])

  const rawCollectionId = searchParams.get('collection_id')
  const collectionId = rawCollectionId ? Number(rawCollectionId) : NaN
  const validCollectionId = Number.isInteger(collectionId) && collectionId > 0

  // Same query key AdminTemplates.tsx uses for its own collections list —
  // arriving here via its "+ Add template" button hits a warm cache and
  // costs nothing extra; a direct URL visit just fetches it fresh.
  const { data: collectionsData } = useQuery<{ collections: TemplateCollection[] }>({
    queryKey: ['admin-template-collections'],
    queryFn: () => fetchJsonWith(adminFetch, '/api/admin/template-collections'),
    enabled: validCollectionId,
  })
  const collection = collectionsData?.collections.find((c) => c.id === collectionId) ?? null

  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [name, setName] = useState('')
  const [tags, setTags] = useState('')
  const [nameError, setNameError] = useState('')
  const [referenceProduct, setReferenceProduct] = useState<ProductDetail | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: PickableProduct[]; pages: number }>({
    queryKey: ['admin-products-picker', q, page],
    queryFn: () => fetchJsonWith(adminFetch, '/api/admin/products?' + new URLSearchParams({ ...(q && { q }), page: String(page) })),
    enabled: !referenceProduct,
  })
  // Any customizable product is a valid reference (§6.4) — the template
  // isn't filed under this product's category, only under the
  // collection's, so no category filtering happens here.
  // Offer only products that can ACTUALLY be drawn on. `is_customizable`
  // alone still lets through products whose print area was never set up,
  // which used to render a card that always failed on click — the worker's
  // list query now reports `has_print_area` per row so they can be excluded
  // here instead. The click-time check in `selectProduct` stays as a
  // backstop for a stale list.
  const candidates = (productsData?.products ?? []).filter((p) => !!p.is_customizable && !!p.has_print_area)
  const totalPages = productsData?.pages ?? 1

  const pickMutation = useMutation({
    mutationFn: (productId: number) => fetchJsonWith<ProductDetail>(adminFetch, `/api/admin/products/${productId}`),
    onSuccess: (product) => {
      if (!firstCustomizableSide(product)) {
        showToast('That product has no customizable print area — pick another one.', 'error')
        return
      }
      setReferenceProduct(product)
    },
    onError: () => showToast('Failed to load that product', 'error'),
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: TemplateSavePayload) => {
      const res = await adminFetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection_id: collectionId,
          name: name.trim(),
          // Matches designApi.ts's createDesign: the JSON body carries
          // design_json as a STRING (the column is TEXT), not a nested
          // object.
          design_json: JSON.stringify(payload.design_json),
          canvas_w: payload.canvas_w,
          canvas_h: payload.canvas_h,
          ...(tags.trim() ? { tags: tags.trim() } : {}),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Failed to save the template')
      }
      // POST /api/admin/templates responds { template: <shaped row> } (see
      // routes/admin/templates.ts's fetchTemplateShaped), not a bare
      // { id } — the id needed for the preview PUT below lives one level
      // in.
      const created = (await res.json()) as { template?: { id?: number } }
      const templateId = created.template?.id
      if (!templateId) throw new Error('The template was saved, but no id came back — check the collection before trying again.')

      const previewRes = await adminFetch(`/api/admin/templates/${templateId}/preview`, {
        method: 'PUT',
        headers: { 'Content-Type': payload.preview.type || 'image/webp' },
        body: payload.preview,
      })
      if (!previewRes.ok) {
        throw new Error('The template saved, but its preview image failed to upload. Open the collection and check it.')
      }
    },
    onSuccess: () => {
      showToast('Template saved', 'success')
      navigate('/admin/templates')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  if (!adminToken) return null
  if (!validCollectionId) return <Navigate to="/admin/templates" replace />

  function handlePick(productId: number) {
    pickMutation.mutate(productId)
  }

  function handleConfirm() {
    if (!name.trim()) { setNameError('Give this template a name.'); return }
    setNameError('')
    setConfirmed(true)
  }

  // ── Step 3: draw — bare, full-bleed, no chrome of ours (see header note) ──
  if (referenceProduct && confirmed) {
    return (
      <>
        <Suspense fallback={<FullScreenLoader />}>
          <CustomizerEditor
            product={referenceProduct}
            initialSize={null}
            initialDesign={null}
            templateMode={{
              onSave: (payload) => saveMutation.mutateAsync(payload),
              saving: saveMutation.isPending,
              // Without these the header's back control would use the shopper
              // default: navigate to the reference product's PUBLIC page,
              // labelled with that product's name. Both are wrong here — it
              // strands the merchant on the storefront mid-task, and the label
              // implies the template belongs to that product when the entire
              // point is that it doesn't.
              onExit: () => navigate('/admin/templates'),
              exitLabel: 'Design templates',
            }}
          />
        </Suspense>
        <ToastContainer />
      </>
    )
  }

  // ── Step 2: confirm — legibility requirement (POD-V2.md §11 Phase 4.3):
  // the merchant sees exactly what print area they're about to draw
  // against, its shape, and that the template will follow them (fitted,
  // never stretched) onto whatever product a shopper actually applies it
  // to, before a single line has been drawn. ──
  if (referenceProduct && !confirmed) {
    const side = firstCustomizableSide(referenceProduct)
    const aspect = side ? describeAspectRatio(side.print_w * side.image_w, side.print_h * side.image_h) : 'Unknown shape'
    return (
      <div className="mx-auto min-h-screen max-w-2xl bg-paper px-4 pb-8 sm:px-6">
        <AdminPageHeader title="Ready to draw" backTo="/admin/templates" />
        <button
          type="button"
          onClick={() => setReferenceProduct(null)}
          className="mb-4 text-xs font-medium text-ink-faint transition-colors duration-fast hover:text-ink-soft"
        >
          ← Choose a different product
        </button>
        <p className="mb-6 text-sm text-ink-soft">
          You'll draw inside <strong className="font-semibold text-ink">"{referenceProduct.name}"</strong>'s print area. This
          template isn't locked to that product — when a shopper applies it to their own item, it's resized to fit that item's
          print area without stretching. If the shapes don't match closely, it leaves a small border instead of distorting the
          artwork.
        </p>
        <div className="mb-6 flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-btn bg-surface-2">
            {side?.image_url && (
              <img src={side.image_url} alt={referenceProduct.name} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{referenceProduct.name}</p>
            <p className="text-xs text-ink-faint">Print area shape: {aspect}</p>
          </div>
        </div>
        <div className="mb-6 space-y-4">
          <Field label="Template name" value={name} onChange={(e) => setName(e.target.value)} error={nameError} placeholder="e.g. Bold Birthday" />
          <Field
            label="Tags (optional)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="birthday, bold, red"
            hint="Comma-separated words shoppers can search for."
          />
        </div>
        <Button variant="primary" onClick={handleConfirm}>Start drawing →</Button>
        <ToastContainer />
      </div>
    )
  }

  // ── Step 1: pick a reference product ──
  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-paper px-4 pb-8 sm:px-6">
      <AdminPageHeader title="New template" backTo="/admin/templates" />
      <p className="mb-6 text-sm text-ink-soft">
        {collection ? `For the "${collection.name}" collection. ` : ''}
        Pick any customizable product to draw against — you're only borrowing its print area, the template itself will work on
        any matching product.
      </p>

      <Field
        label="Search products"
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setPage(1) }}
        placeholder="Search by name…"
        containerClassName="mb-4 max-w-sm"
      />

      {productsLoading ? (
        <SkeletonCards count={4} />
      ) : candidates.length === 0 ? (
        <div className="rounded-card border border-line bg-surface py-12 text-center text-ink-faint">
          <p className="mb-3">No customizable products found.</p>
          <Button as={Link} to="/admin/products" variant="secondary" size="sm">Go to products</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {candidates.map((p) => (
            <div key={p.id} className="space-y-2 rounded-card border border-line bg-surface p-3 shadow-card">
              <div className="aspect-square overflow-hidden rounded-btn bg-surface-2">
                {p.front_image && <img src={p.front_image} alt={p.name} className="h-full w-full object-cover" />}
              </div>
              <p className="truncate text-sm font-medium text-ink">{p.name}</p>
              <p className="truncate text-xs text-ink-faint">{p.category}</p>
              <Button
                variant="secondary" size="sm" fullWidth
                loading={pickMutation.isPending && pickMutation.variables === p.id}
                onClick={() => handlePick(p.id)}
              >
                Use this product
              </Button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>← Prev</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next →</Button>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  )
}
