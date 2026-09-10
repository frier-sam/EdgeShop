// POD-V2.md §6 / §11 Phase 4.2 — the admin half of "browse designs".
// Category -> collections -> templates (§6.1's `template_collections` /
// `design_templates` tables). This page owns collections CRUD and, per
// collection, its templates' rename/delete/status — the actual drawing
// happens on AdminTemplateEdit.tsx (§6.4: authoring reuses the shopper's
// own customizer, never a second editor).
//
// Deliberately a card-based layout, not AdminProducts.tsx's table: a
// collection expands to a nested grid of template cards, and a `<table>`
// row has nowhere sane to put that.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { fetchJsonWith } from '../../lib/api'
import { showToast } from '../Toast'
import CategoryCombobox from '../CategoryCombobox'
import Field from '../../components/Field'
import Button from '../../components/Button'
import IconButton from '../../components/ui/IconButton'
import Icon from '../../components/ui/Icon'
import { Skeleton, SkeletonCards } from '../../components/Skeleton'

// ── Shapes (POD-V2.md §6.1) ──────────────────────────────────────────
// Defined locally rather than in ../../lib/types — AdminProducts.tsx does
// the same for its own list row rather than reusing lib/types's
// ProductSummary, and these two rows have no shopper-facing counterpart
// to share a type with anyway (templates never appear in lib/types; the
// storefront browse drawer, per §6.6, is Editor-owned Phase 4 work).
export interface TemplateCollection {
  id: number
  name: string
  category: string
  status: 'active' | 'draft'
  sort_order: number
}

export interface DesignTemplate {
  id: number
  collection_id: number
  name: string
  canvas_w: number
  canvas_h: number
  preview_url: string
  tags: string
  status: 'active' | 'draft'
  sort_order: number
  created_at: string
}

/**
 * Merchant-legible aspect-ratio description from raw dimensions
 * (POD-V2.md §6.2 — a category spans many print-area shapes, and §9
 * decision 8 aspect-filters templates when shoppers browse, so the shape
 * committed to at authoring time needs to be legible here too). A decimal
 * ratio + orientation word, not a reduced integer fraction (3:2, 16:9…) —
 * reducing an arbitrary float to a "nice" fraction needs a tolerance
 * search that buys nothing for a purely informational label.
 */
export function describeAspectRatio(w: number, h: number): string {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 'Unknown shape'
  const ratio = w / h
  const orientation = ratio > 1.05 ? 'Landscape' : ratio < 0.95 ? 'Portrait' : 'Square'
  return `${orientation}, ${ratio.toFixed(2)}:1`
}

// Shared by collection rows and template cards — same two-state status
// vocabulary products already use ('active' hides nothing, 'draft' keeps
// it out of the shopper-facing browse drawer without deleting it, same
// "hide, don't destroy" principle as the capability checkboxes in
// AdminProductEdit.tsx).
function MiniStatusSelect({ value, onChange }: { value: 'active' | 'draft'; onChange: (v: 'active' | 'draft') => void }) {
  return (
    <select
      aria-label="Status"
      value={value}
      onChange={(e) => onChange(e.target.value as 'active' | 'draft')}
      className="h-8 cursor-pointer rounded-btn border-0 bg-surface-2 px-2 text-xs font-semibold capitalize text-ink-soft transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <option value="active">Active</option>
      <option value="draft">Draft</option>
    </select>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <span className={`inline-flex shrink-0 transition-transform duration-fast ${open ? 'rotate-180' : ''}`}>
      <Icon name="expand_more" size={18} />
    </span>
  )
}

// ── Delete confirmation (mirrors AdminProducts.tsx's inline modal) ───
type DeleteTarget =
  | { kind: 'collection'; id: number; name: string }
  | { kind: 'template'; id: number; collectionId: number; name: string }

function ConfirmDeleteModal({ target, pending, onCancel, onConfirm }: { target: DeleteTarget; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 animate-fade-in bg-ink/40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-scale-in rounded-card bg-surface p-6 shadow-lift">
          <h3 className="mb-2 font-display font-semibold text-ink">
            {target.kind === 'collection' ? 'Delete collection?' : 'Delete template?'}
          </h3>
          <p className="mb-6 text-sm text-ink-soft">
            {target.kind === 'collection'
              ? `"${target.name}" and every template inside it will be removed. This cannot be undone.`
              : `"${target.name}" will be removed from its collection. This cannot be undone.`}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
            <Button variant="danger" fullWidth loading={pending} onClick={onConfirm}>Delete</Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── New collection ────────────────────────────────────────────────
function NewCollectionForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<'active' | 'draft'>('active')
  const [sortOrder, setSortOrder] = useState('0')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      adminFetch('/api/admin/template-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category: category.trim(), status, sort_order: parseInt(sortOrder, 10) || 0 }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? 'Failed to create collection')
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-template-collections'] })
      showToast('Collection created', 'success')
      onDone()
    },
    onError: (err: Error) => setError(err.message),
  })

  function handleSubmit() {
    if (!name.trim()) { setError('Give the collection a name.'); return }
    setError('')
    createMutation.mutate()
  }

  return (
    <div className="mb-6 space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display font-semibold text-ink">New collection</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Birthday" />
        <CategoryCombobox
          value={category}
          onChange={setCategory}
          hint="Leave blank to offer this collection across every category."
        />
        <Field
          label="Status" as="select" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'draft')}
          options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }]}
        />
        <Field label="Sort order" type="number" step="1" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button variant="primary" loading={createMutation.isPending} onClick={handleSubmit}>Create collection</Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ── One template card, inside an expanded collection ────────────────
function TemplateCard({ template, onRequestDelete }: { template: DesignTemplate; onRequestDelete: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(template.name)
  const [status, setStatus] = useState(template.status)
  const dirty = name.trim() !== template.name || status !== template.status

  const saveMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), status }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? 'Failed to save template')
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates', template.collection_id] })
      showToast('Template saved', 'success')
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-3 shadow-card">
      <div className="aspect-square overflow-hidden rounded-btn bg-surface-2">
        {template.preview_url ? (
          <img src={template.preview_url} alt={template.name} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-ink-faint">No preview yet</div>
        )}
      </div>
      <p className="text-[11px] text-ink-faint">{describeAspectRatio(template.canvas_w, template.canvas_h)}</p>
      <input
        aria-label="Template name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 w-full rounded-btn border border-line bg-surface px-2 text-sm text-ink transition-colors duration-fast focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <div className="flex items-center justify-between gap-2">
        <MiniStatusSelect value={status} onChange={setStatus} />
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" disabled={!dirty || !name.trim()} loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save
          </Button>
          <IconButton variant="ghost" size="sm" aria-label={`Delete ${template.name}`} className="text-danger hover:bg-danger/10" onClick={onRequestDelete}>
            <Icon name="delete" size={16} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

// ── The templates inside one expanded collection ─────────────────────
function TemplateGrid({ collectionId, onAddTemplate, onRequestDelete }: {
  collectionId: number
  onAddTemplate: () => void
  onRequestDelete: (t: DesignTemplate) => void
}) {
  const { data, isLoading } = useQuery<{ templates: DesignTemplate[] }>({
    queryKey: ['admin-templates', collectionId],
    queryFn: () => fetchJsonWith(adminFetch, `/api/admin/templates?collection_id=${collectionId}`),
  })
  const templates = data?.templates ?? []

  if (isLoading) return <SkeletonCards count={3} />

  if (templates.length === 0) {
    return (
      <div className="rounded-btn border border-dashed border-line py-8 text-center">
        <p className="mb-3 text-sm text-ink-faint">No templates in this collection yet.</p>
        <Button variant="secondary" size="sm" onClick={onAddTemplate}>+ Add template</Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} onRequestDelete={() => onRequestDelete(t)} />
      ))}
    </div>
  )
}

// ── One collection, with its templates nested below ───────────────────
function CollectionRow({ collection, onAddTemplate, onRequestDeleteCollection, onRequestDeleteTemplate }: {
  collection: TemplateCollection
  onAddTemplate: (collectionId: number) => void
  onRequestDeleteCollection: (c: TemplateCollection) => void
  onRequestDeleteTemplate: (t: DesignTemplate) => void
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  // Seeded once from the prop and never re-derived from a background
  // refetch — same rule ProductPriceBreaksEditor.tsx documents: this
  // component owns its draft from mount, so an in-progress rename
  // survives an unrelated save elsewhere on the page.
  const [name, setName] = useState(collection.name)
  const [category, setCategory] = useState(collection.category)
  const [status, setStatus] = useState(collection.status)
  const [sortOrder, setSortOrder] = useState(String(collection.sort_order))
  const [error, setError] = useState('')

  const dirty =
    name.trim() !== collection.name ||
    category.trim() !== collection.category ||
    status !== collection.status ||
    (parseInt(sortOrder, 10) || 0) !== collection.sort_order

  const saveMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/template-collections/${collection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), category: category.trim(), status, sort_order: parseInt(sortOrder, 10) || 0 }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = (await r.json().catch(() => ({}))) as { error?: string }
          throw new Error(err.error ?? 'Failed to save collection')
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-template-collections'] })
      showToast('Collection saved', 'success')
    },
    onError: (err: Error) => setError(err.message),
  })

  function handleSave() {
    if (!name.trim()) { setError('Give the collection a name.'); return }
    setError('')
    saveMutation.mutate()
  }

  return (
    <div className="mb-4 rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse collection' : 'Expand collection'}
          className="mt-2 shrink-0 rounded-btn p-1 text-ink-soft transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
        >
          <ChevronIcon open={expanded} />
        </button>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <CategoryCombobox value={category} onChange={setCategory} hint="Blank = every category." />
          <Field
            label="Status" as="select" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'draft')}
            options={[{ value: 'active', label: 'Active' }, { value: 'draft', label: 'Draft' }]}
          />
          <Field label="Sort order" type="number" step="1" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 self-center">
          <Button variant="secondary" size="sm" disabled={!dirty} loading={saveMutation.isPending} onClick={handleSave}>
            Save
          </Button>
          <IconButton
            variant="ghost" size="sm" aria-label={`Delete ${collection.name}`} className="text-danger hover:bg-danger/10"
            onClick={() => onRequestDeleteCollection(collection)}
          >
            <Icon name="delete" size={16} />
          </IconButton>
        </div>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-danger">{error}</p>}

      {expanded && (
        <div className="border-t border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wide text-ink-soft">Templates</h3>
            <Button variant="secondary" size="sm" onClick={() => onAddTemplate(collection.id)}>+ Add template</Button>
          </div>
          <TemplateGrid collectionId={collection.id} onAddTemplate={() => onAddTemplate(collection.id)} onRequestDelete={onRequestDeleteTemplate} />
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────
export default function AdminTemplates() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const { data, isLoading } = useQuery<{ collections: TemplateCollection[] }>({
    queryKey: ['admin-template-collections'],
    queryFn: () => fetchJsonWith(adminFetch, '/api/admin/template-collections'),
  })
  // Sorted client-side by the merchant's own sort_order (then name) —
  // §6.1 gives collections a sort_order column precisely so this ordering
  // is merchant-controlled, not creation order.
  const collections = [...(data?.collections ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))

  const deleteCollectionMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/template-collections/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Failed to delete collection')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-template-collections'] })
      showToast('Collection deleted', 'success')
      setDeleteTarget(null)
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: ({ id }: { id: number; collectionId: number }) =>
      adminFetch(`/api/admin/templates/${id}`, { method: 'DELETE' }).then((r) => {
        if (!r.ok) throw new Error('Failed to delete template')
      }),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-templates', variables.collectionId] })
      showToast('Template deleted', 'success')
      setDeleteTarget(null)
    },
    onError: (err: Error) => showToast(err.message, 'error'),
  })

  function handleConfirmDelete() {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'collection') {
      deleteCollectionMutation.mutate(deleteTarget.id)
    } else {
      deleteTemplateMutation.mutate({ id: deleteTarget.id, collectionId: deleteTarget.collectionId })
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-headline-md text-primary">Design templates</h1>
          <p className="mt-1 text-sm text-ink-soft">Ready-made designs shoppers can start from, grouped into collections by category.</p>
        </div>
        {!showNewCollection && (
          <Button variant="primary" onClick={() => setShowNewCollection(true)}>+ New collection</Button>
        )}
      </div>

      {showNewCollection && <NewCollectionForm onDone={() => setShowNewCollection(false)} />}

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-card border border-line bg-surface py-16 text-center text-ink-faint">
          <p className="mb-3">No collections yet</p>
          {!showNewCollection && (
            <Button variant="secondary" size="sm" onClick={() => setShowNewCollection(true)}>Create your first collection</Button>
          )}
        </div>
      ) : (
        collections.map((c) => (
          <CollectionRow
            key={c.id}
            collection={c}
            onAddTemplate={(collectionId) => navigate(`/admin/templates/new?collection_id=${collectionId}`)}
            onRequestDeleteCollection={(col) => setDeleteTarget({ kind: 'collection', id: col.id, name: col.name })}
            onRequestDeleteTemplate={(t) => setDeleteTarget({ kind: 'template', id: t.id, collectionId: t.collection_id, name: t.name })}
          />
        ))
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          target={deleteTarget}
          pending={deleteCollectionMutation.isPending || deleteTemplateMutation.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
