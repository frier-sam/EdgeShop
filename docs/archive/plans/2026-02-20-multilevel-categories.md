# Multi-Level Category Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unlimited-depth category nesting to collections, update CSV import to create the hierarchy, and update the navigation editor to show a tree picker.

**Architecture:** Add `parent_id` to the `collections` table (adjacency list). Backend uses SQLite recursive CTE to load the full tree in one query, returning a flat array with a `depth` field that the frontend uses for indentation. CSV import walks the category path left-to-right and creates missing collections. Navigation picker uses indented `<option>` elements.

**Tech Stack:** Cloudflare D1 (SQLite with recursive CTEs), Hono v4, React 18, TanStack Query v5, TypeScript

---

## Task 1: DB migration — add parent_id to collections

**Files:**
- Create: `worker/migrations/0004_category_hierarchy.sql`

**Step 1: Create the migration file**

```sql
-- worker/migrations/0004_category_hierarchy.sql
ALTER TABLE collections ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES collections(id) ON DELETE SET NULL;
```

**Step 2: Apply locally for development**

```bash
cd worker
npx wrangler d1 execute edgeshop-db --local --file=migrations/0004_category_hierarchy.sql
```

Expected: `🌀 Executing on local database edgeshop-db` with no errors.

**Step 3: Verify**

```bash
npx wrangler d1 execute edgeshop-db --local --command="PRAGMA table_info(collections)"
```

Expected: output includes a row with `name = parent_id`.

**Step 4: Commit**

```bash
git add worker/migrations/0004_category_hierarchy.sql
git commit -m "feat: add parent_id to collections for hierarchy support"
```

---

## Task 2: Update worker types + admin collections route

**Files:**
- Modify: `worker/src/types.ts` — add `parent_id` to Collection interface
- Modify: `worker/src/routes/admin/collections.ts` — recursive CTE list, accept parent_id in POST/PUT

**Step 1: Update `worker/src/types.ts`**

Find the `Collection` interface (around line 40) and add `parent_id`:

```typescript
export interface Collection {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
  parent_id: number | null
  created_at: string
}
```

**Step 2: Replace `worker/src/routes/admin/collections.ts` entirely**

```typescript
import { Hono } from 'hono'
import type { Env } from '../../index'

interface CollectionRow {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
  parent_id: number | null
  depth: number
  created_at: string
}

const adminCollections = new Hono<{ Bindings: Env }>()

// List all collections as a tree (recursive CTE returns flat array with depth)
adminCollections.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`
    WITH RECURSIVE tree AS (
      SELECT *, 0 AS depth FROM collections WHERE parent_id IS NULL
      UNION ALL
      SELECT col.*, tree.depth + 1
      FROM collections col
      JOIN tree ON col.parent_id = tree.id
    )
    SELECT * FROM tree ORDER BY depth ASC, sort_order ASC, name ASC
  `).all<CollectionRow>()
  return c.json({ collections: results })
})

// Create a collection
adminCollections.post('/', async (c) => {
  const body = await c.req.json<{
    name: string
    slug: string
    description?: string
    image_url?: string
    sort_order?: number
    seo_title?: string
    seo_description?: string
    parent_id?: number | null
  }>()
  if (!body.name || !body.slug) return c.json({ error: 'name and slug are required' }, 400)
  const result = await c.env.DB.prepare(`
    INSERT INTO collections (name, slug, description, image_url, sort_order, seo_title, seo_description, parent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.name, body.slug,
    body.description ?? '', body.image_url ?? '',
    body.sort_order ?? 0,
    body.seo_title ?? '', body.seo_description ?? '',
    body.parent_id ?? null
  ).run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// Update a collection
adminCollections.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const body = await c.req.json<Record<string, unknown>>()
  const allowed = ['name', 'slug', 'description', 'image_url', 'sort_order', 'seo_title', 'seo_description', 'parent_id']
  const entries = Object.entries(body).filter(([k]) => allowed.includes(k))
  if (!entries.length) return c.json({ error: 'Nothing to update' }, 400)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const result = await c.env.DB.prepare(`UPDATE collections SET ${fields} WHERE id = ?`)
    .bind(...entries.map(([, v]) => v), id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Collection not found' }, 404)
  return c.json({ ok: true })
})

// Delete a collection
adminCollections.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (isNaN(id)) return c.json({ error: 'Invalid id' }, 400)
  const result = await c.env.DB.prepare('DELETE FROM collections WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Collection not found' }, 404)
  return c.json({ ok: true })
})

// Assign products to collection
adminCollections.put('/:id/products', async (c) => {
  const collectionId = Number(c.req.param('id'))
  if (isNaN(collectionId)) return c.json({ error: 'Invalid id' }, 400)
  const { product_ids } = await c.req.json<{ product_ids: number[] }>()
  if (!Array.isArray(product_ids)) return c.json({ error: 'product_ids array is required' }, 400)
  await c.env.DB.prepare('DELETE FROM product_collections WHERE collection_id = ?')
    .bind(collectionId).run()
  if (product_ids.length > 0) {
    const stmts = product_ids.map(pid =>
      c.env.DB.prepare('INSERT OR IGNORE INTO product_collections (product_id, collection_id) VALUES (?, ?)')
        .bind(pid, collectionId)
    )
    await c.env.DB.batch(stmts)
  }
  return c.json({ ok: true })
})

export default adminCollections
```

**Step 3: Verify worker builds**

```bash
cd worker && npx wrangler dev --local &
# Wait 5 seconds, then:
curl http://localhost:8787/api/admin/collections
```

Expected: `{"collections":[...]}` with each item having a `depth` field.

Kill the dev server with `Ctrl+C`.

**Step 4: Commit**

```bash
git add worker/src/types.ts worker/src/routes/admin/collections.ts
git commit -m "feat: collections admin route uses recursive CTE, accepts parent_id"
```

---

## Task 3: Update public collections route — add breadcrumb

**Files:**
- Modify: `worker/src/routes/collections.ts`

**Step 1: Replace `worker/src/routes/collections.ts` entirely**

```typescript
import { Hono } from 'hono'
import type { Env } from '../index'
import type { Collection, Product } from '../types'

const collections = new Hono<{ Bindings: Env }>()

// List all collections (flat, no depth — used for storefront dropdowns)
collections.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM collections ORDER BY sort_order ASC, name ASC'
  ).all<Collection>()
  return c.json({ collections: results })
})

// Get a collection with its products + breadcrumb
collections.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const collection = await c.env.DB.prepare(
    'SELECT * FROM collections WHERE slug = ?'
  ).bind(slug).first<Collection>()
  if (!collection) return c.json({ error: 'Not found' }, 404)

  const { results: products } = await c.env.DB.prepare(`
    SELECT p.* FROM products p
    JOIN product_collections pc ON pc.product_id = p.id
    WHERE pc.collection_id = ? AND p.status = 'active'
    ORDER BY p.created_at DESC
  `).bind(collection.id).all<Product>()

  // Build breadcrumb by walking up parent chain
  const breadcrumb: Array<{ name: string; slug: string }> = []
  let current: Collection | null = collection
  while (current) {
    breadcrumb.unshift({ name: current.name, slug: current.slug })
    if (current.parent_id) {
      current = await c.env.DB.prepare('SELECT * FROM collections WHERE id = ?')
        .bind(current.parent_id).first<Collection>() ?? null
    } else {
      break
    }
  }

  return c.json({ collection, products, breadcrumb })
})

export default collections
```

**Step 2: Commit**

```bash
git add worker/src/routes/collections.ts
git commit -m "feat: collection page returns breadcrumb array"
```

---

## Task 4: Rewrite AdminCollections.tsx with tree UI

**Files:**
- Modify: `frontend/src/admin/pages/AdminCollections.tsx`

**Step 1: Replace the entire file**

The key changes from the old flat table:
- `Collection` interface gets `parent_id: number | null` and `depth: number`
- Flat table → indented list (each row padded `16 + depth * 20` px)
- "+ Child" button per row pre-fills `parent_id` in create modal
- Create/edit modal has a **Parent** picker (indented select, excludes self+descendants)
- Uses `showToast` for feedback

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'

interface Collection {
  id: number
  name: string
  slug: string
  description: string
  image_url: string
  sort_order: number
  seo_title: string
  seo_description: string
  parent_id: number | null
  depth: number
}

interface Product {
  id: number
  name: string
  price: number
  status: string
}

type ModalMode = 'create' | 'edit' | null

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  image_url: '',
  sort_order: 0,
  seo_title: '',
  seo_description: '',
  parent_id: null as number | null,
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function getDescendantIds(collections: Collection[], id: number): Set<number> {
  const result = new Set<number>()
  const queue = [id]
  while (queue.length) {
    const current = queue.shift()!
    for (const col of collections) {
      if (col.parent_id === current) {
        result.add(col.id)
        queue.push(col.id)
      }
    }
  }
  return result
}

export default function AdminCollections() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<Collection | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [assignCollection, setAssignCollection] = useState<Collection | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set())

  const { data, isLoading } = useQuery<{ collections: Collection[] }>({
    queryKey: ['admin-collections'],
    queryFn: () => fetch('/api/admin/collections').then(r => r.json()),
  })

  const { data: productsData } = useQuery<{ products: Product[] }>({
    queryKey: ['admin-products'],
    queryFn: () => fetch('/api/admin/products').then(r => r.json()),
    enabled: !!assignCollection,
  })

  const { data: collectionDetail } = useQuery<{ collection: Collection; products: Product[] }>({
    queryKey: ['collection-detail', assignCollection?.id],
    queryFn: () => fetch(`/api/collections/${assignCollection!.slug}`).then(r => r.json()),
    enabled: !!assignCollection,
  })

  const saveMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const url = editing ? `/api/admin/collections/${editing.id}` : '/api/admin/collections'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      showToast(editing ? 'Collection updated' : 'Collection created', 'success')
      closeModal()
    },
    onError: () => showToast('Failed to save collection', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/admin/collections/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      setDeleteId(null)
      showToast('Collection deleted', 'success')
    },
    onError: () => showToast('Failed to delete', 'error'),
  })

  const assignMutation = useMutation({
    mutationFn: async ({ id, product_ids }: { id: number; product_ids: number[] }) => {
      const res = await fetch(`/api/admin/collections/${id}/products`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids }),
      })
      if (!res.ok) throw new Error('Failed to assign products')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-collections'] })
      if (assignCollection) qc.invalidateQueries({ queryKey: ['collection-detail', assignCollection.id] })
      showToast('Products assigned', 'success')
      closeAssignModal()
    },
    onError: () => showToast('Failed to assign products', 'error'),
  })

  function openCreate(parentId: number | null = null) {
    setEditing(null)
    setForm({ ...emptyForm, parent_id: parentId })
    setSlugManuallyEdited(false)
    setModal('create')
  }

  function openEdit(col: Collection) {
    setEditing(col)
    setForm({
      name: col.name,
      slug: col.slug,
      description: col.description ?? '',
      image_url: col.image_url ?? '',
      sort_order: col.sort_order ?? 0,
      seo_title: col.seo_title ?? '',
      seo_description: col.seo_description ?? '',
      parent_id: col.parent_id,
    })
    setSlugManuallyEdited(true)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setForm(emptyForm)
    setSlugManuallyEdited(false)
  }

  function openAssign(col: Collection) {
    setAssignCollection(col)
    setSelectedProductIds(new Set())
  }

  function closeAssignModal() {
    setAssignCollection(null)
    setSelectedProductIds(new Set())
  }

  function handleNameChange(value: string) {
    setForm(f => ({
      ...f,
      name: value,
      slug: slugManuallyEdited ? f.slug : toSlug(value),
    }))
  }

  function toggleProduct(id: number) {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    if (assignCollection && collectionDetail) {
      setSelectedProductIds(new Set((collectionDetail.products ?? []).map((p: Product) => p.id)))
    }
  }, [assignCollection?.id, collectionDetail])

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  const collections = data?.collections ?? []
  const allProducts = productsData?.products ?? []
  const excludedIds = editing
    ? new Set([editing.id, ...getDescendantIds(collections, editing.id)])
    : new Set<number>()
  const parentOptions = collections.filter(c => !excludedIds.has(c.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Collections</h1>
        <button
          onClick={() => openCreate(null)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Collection
        </button>
      </div>
      <p className="text-sm text-gray-500">Collections support unlimited nesting. Use "+ Child" to add sub-collections.</p>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        {collections.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No collections yet. Create your first collection.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {collections.map(col => (
              <div
                key={col.id}
                className="flex items-center gap-2 py-2.5 pr-4 hover:bg-gray-50"
                style={{ paddingLeft: `${16 + col.depth * 20}px` }}
              >
                {col.depth > 0 && <span className="text-gray-300 shrink-0 text-xs select-none">└</span>}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900">{col.name}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">/collections/{col.slug}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs">
                  <button
                    onClick={() => openAssign(col)}
                    className="text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5"
                  >
                    Products
                  </button>
                  <button
                    onClick={() => openCreate(col.id)}
                    className="text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-0.5"
                  >
                    + Child
                  </button>
                  <button onClick={() => openEdit(col)} className="text-blue-600 hover:text-blue-800 px-1">Edit</button>
                  {deleteId === col.id ? (
                    <>
                      <button
                        onClick={() => deleteMutation.mutate(col.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setDeleteId(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setDeleteId(col.id)} className="text-red-400 hover:text-red-600 px-1">Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {modal === 'create' ? 'New Collection' : 'Edit Collection'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); saveMutation.mutate(form) }}
              className="px-6 py-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Parent Collection</label>
                <select
                  value={form.parent_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none"
                >
                  <option value="">— Root level (no parent)</option>
                  {parentOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {'—'.repeat(c.depth + 1)} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => handleNameChange(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                    placeholder="Summer Sale"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Slug *</label>
                  <input
                    required
                    value={form.slug}
                    onChange={e => { setSlugManuallyEdited(true); setForm(f => ({ ...f, slug: e.target.value })) }}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
                    placeholder="summer-sale"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Image URL</label>
                  <input
                    value={form.image_url}
                    onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SEO Title</label>
                  <input
                    value={form.seo_title}
                    onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">SEO Description</label>
                  <input
                    value={form.seo_description}
                    onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save Collection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Products Modal */}
      {assignCollection && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h2 className="font-semibold text-gray-900">Products in "{assignCollection.name}"</h2>
              <button onClick={closeAssignModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!productsData ? (
                <p className="text-sm text-gray-400">Loading products…</p>
              ) : allProducts.length === 0 ? (
                <p className="text-sm text-gray-400">No products found.</p>
              ) : (
                <ul className="space-y-2">
                  {allProducts.map(product => (
                    <li key={product.id}>
                      <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.has(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-800 flex-1">{product.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex justify-between items-center">
              <span className="text-xs text-gray-400">{selectedProductIds.size} selected</span>
              <div className="flex gap-2">
                <button onClick={closeAssignModal} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                <button
                  disabled={assignMutation.isPending}
                  onClick={() => assignMutation.mutate({ id: assignCollection.id, product_ids: Array.from(selectedProductIds) })}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {assignMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify in browser**

Start dev servers (`cd worker && npx wrangler dev` in one terminal, `cd frontend && npm run dev` in another). Navigate to `/admin/collections`. Verify:
- Collections list shows with indentation (depth × 20px)
- "+ Child" button opens modal with correct parent pre-selected
- Parent picker in modal shows indented options
- Edit modal excludes self and descendants from parent picker

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminCollections.tsx
git commit -m "feat: admin collections UI with tree view and parent picker"
```

---

## Task 5: Update AdminImport.tsx — hierarchical category creation

**Files:**
- Modify: `frontend/src/admin/pages/AdminImport.tsx`

**Changes needed:**
1. `ImportedProduct.category: string` → `categoryPath: string[]`
2. `parseWooCommerce` splits WooCommerce `"Clothing > Men's > T-Shirts"` on ` > `
3. `parseShopify` and `parseGeneric` wrap single category in array
4. Add `resolveCategory` function that walks the path, creates missing collections
5. `importProducts` pre-fetches collections, calls `resolveCategory`, assigns product to leaf collection

**Step 1: Update `ImportedProduct` interface**

Change `category: string` to `categoryPath: string[]`:

```typescript
interface ImportedProduct {
  name: string
  description: string
  price: number
  compare_price: number | null
  image_url: string
  stock_count: number
  categoryPath: string[]   // was: category: string
  tags: string
  status: 'active' | 'draft'
  seo_title: string
  seo_description: string
  variants: Array<{
    name: string
    options_json: string
    price: number
    stock_count: number
    sku: string
  }>
}
```

**Step 2: Update `parseShopify` — wrap category in array**

Find the line:
```typescript
category: get('Product Category') || get('Type'),
```
Replace with:
```typescript
categoryPath: (() => { const c = get('Product Category') || get('Type'); return c ? [c] : [] })(),
```

**Step 3: Update `parseWooCommerce` — split on ` > ` and handle multiple categories**

Find in `parseWooCommerce`:
```typescript
    // Categories: pipe or comma separated, take first
    const catRaw = get('categories')
    const category = catRaw.split(/[|,]/)[0].trim()
```
Replace with:
```typescript
    // Categories: pipe-separated list; take first entry, then split on " > " for hierarchy
    const catRaw = get('categories')
    const firstCat = catRaw.split('|')[0].trim()
    const categoryPath = firstCat ? firstCat.split(' > ').map(s => s.trim()).filter(Boolean) : []
```

And in the `products.push(...)` call, replace `category,` with `categoryPath,`.

**Step 4: Update `parseGeneric` — wrap category in array**

Find:
```typescript
      category: categoryCol >= 0 ? row[categoryCol].trim() : '',
```
Replace with:
```typescript
      categoryPath: (() => { const c = categoryCol >= 0 ? row[categoryCol].trim() : ''; return c ? [c] : [] })(),
```

**Step 5: Add `resolveCategory` function** — add this before the `importProducts` function:

```typescript
interface CollectionCache {
  id: number
  slug: string
}

async function resolveCategory(
  path: string[],
  existingCollections: Array<{ id: number; name: string; slug: string; parent_id: number | null }>,
  cache: Map<string, CollectionCache>
): Promise<number | null> {
  if (!path.length) return null
  let parentId: number | null = null
  let parentSlug = ''

  for (const segment of path) {
    const cacheKey = `${parentId ?? 'root'}:${segment.toLowerCase()}`
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!
      parentId = cached.id
      parentSlug = cached.slug
      continue
    }
    // Check existing collections (loaded once at start of import)
    const existing = existingCollections.find(
      c => c.name.toLowerCase() === segment.toLowerCase() && c.parent_id === parentId
    )
    if (existing) {
      cache.set(cacheKey, { id: existing.id, slug: existing.slug })
      parentId = existing.id
      parentSlug = existing.slug
      continue
    }
    // Create the collection
    const segSlug = segment.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const slug = parentSlug ? `${parentSlug}-${segSlug}` : segSlug
    const res = await fetch('/api/admin/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: segment, slug, parent_id: parentId }),
    })
    if (res.ok) {
      const { id } = await res.json() as { id: number }
      cache.set(cacheKey, { id, slug })
      parentId = id
      parentSlug = slug
    } else {
      // Slug conflict — try with timestamp suffix
      const slug2 = `${slug}-${Date.now()}`
      const res2 = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segment, slug: slug2, parent_id: parentId }),
      })
      if (!res2.ok) return parentId // Best effort: assign to last resolved level
      const { id } = await res2.json() as { id: number }
      cache.set(cacheKey, { id, slug: slug2 })
      parentId = id
      parentSlug = slug2
    }
  }
  return parentId
}
```

**Step 6: Update `importProducts` — pre-fetch collections, call resolveCategory, assign to collection**

Replace the entire `importProducts` function:

```typescript
async function importProducts(
  products: ImportedProduct[],
  onProgress: (done: number, errors: number) => void
): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0

  // Pre-fetch all existing collections for category resolution
  const collRes = await fetch('/api/admin/collections')
  const { collections: existingCollections = [] } = collRes.ok
    ? await collRes.json() as { collections: Array<{ id: number; name: string; slug: string; parent_id: number | null }> }
    : { collections: [] }
  const collectionCache = new Map<string, CollectionCache>()

  for (const p of products) {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: p.name,
          description: p.description,
          price: p.price,
          compare_price: p.compare_price,
          image_url: p.image_url,
          stock_count: p.stock_count,
          tags: p.tags,
          status: p.status,
          seo_title: p.seo_title,
          seo_description: p.seo_description,
          product_type: 'physical',
        }),
      })
      if (!res.ok) throw new Error('API error')
      const { id } = await res.json() as { id: number }

      // Assign to collection hierarchy
      if (p.categoryPath.length > 0) {
        const collectionId = await resolveCategory(p.categoryPath, existingCollections, collectionCache)
        if (collectionId !== null) {
          await fetch(`/api/admin/products/${id}/collections`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection_ids: [collectionId] }),
          })
        }
      }

      // Import variants
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          await fetch(`/api/admin/products/${id}/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(v),
          })
        }
      }

      imported++
    } catch {
      failed++
    }
    onProgress(imported + failed, failed)
  }

  return { imported, failed }
}
```

**Step 7: Update preview table — replace "Category" column**

In the preview table, find:
```tsx
<th className="text-left px-3 py-2 text-gray-500 font-medium hidden sm:table-cell">Category</th>
```
and the corresponding data cell:
```tsx
<td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{p.category || '—'}</td>
```

Replace both with:
```tsx
<th className="text-left px-3 py-2 text-gray-500 font-medium hidden sm:table-cell">Category</th>
```
```tsx
<td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{p.categoryPath.join(' > ') || '—'}</td>
```

**Step 8: Verify**

Import a WooCommerce CSV with categories like `"Clothing > Men's > T-Shirts"`. After import, check `/admin/collections` — should show `Clothing`, indented `Men's` under it, indented `T-Shirts` under that.

**Step 9: Commit**

```bash
git add frontend/src/admin/pages/AdminImport.tsx
git commit -m "feat: import creates hierarchical collections from category paths"
```

---

## Task 6: Update AdminNavigation.tsx — indented collection picker

**Files:**
- Modify: `frontend/src/admin/pages/AdminNavigation.tsx`

**Changes:**
1. Change the collections query to use `/api/admin/collections` (returns `depth` field)
2. Update the `Collection` type to include `depth`
3. Render indented options in the collection `<select>`

**Step 1: Update the collections query**

Find:
```typescript
  const { data: collectionsData } = useQuery<{ collections: Array<{ id: number; name: string; slug: string }> }>({
    queryKey: ['collections'],
    queryFn: () => fetch('/api/collections').then(r => r.json()),
  })
```

Replace with:
```typescript
  const { data: collectionsData } = useQuery<{ collections: Array<{ id: number; name: string; slug: string; depth: number }> }>({
    queryKey: ['admin-collections'],
    queryFn: () => fetch('/api/admin/collections').then(r => r.json()),
  })
```

**Step 2: Update the collection `<select>` to show indented tree**

Find:
```tsx
            {itemType === 'collection' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Collection</label>
                <select onChange={handleCollectionSelect} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a collection…</option>
                  {collectionsData?.collections.map(c => (
                    <option key={c.id} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
```

Replace with:
```tsx
            {itemType === 'collection' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Collection</label>
                <select onChange={handleCollectionSelect} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a collection…</option>
                  {collectionsData?.collections.map(c => (
                    <option key={c.id} value={c.slug}>
                      {'—'.repeat(c.depth)} {c.depth > 0 ? ' ' : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
```

**Step 3: Verify**

In the Navigation admin page, click "+ Add Item", select "Collection" type. The dropdown should show collections with `—` prefix for each level of depth.

**Step 4: Commit**

```bash
git add frontend/src/admin/pages/AdminNavigation.tsx
git commit -m "feat: navigation collection picker shows indented category tree"
```

---

## Final verification checklist

- [ ] Run migration: `npx wrangler d1 execute edgeshop-db --local --file=worker/migrations/0004_category_hierarchy.sql`
- [ ] Collections list shows tree with indentation
- [ ] "+ Child" button pre-fills parent in create modal
- [ ] Parent picker excludes self and descendants
- [ ] Delete on a parent: children become root (ON DELETE SET NULL)
- [ ] CSV import: WooCommerce `"A > B > C"` creates 3-level hierarchy
- [ ] CSV import: products assigned to leaf collection, visible in that collection's product list
- [ ] Navigation collection picker shows indented tree
- [ ] No TypeScript errors: `cd frontend && npx tsc --noEmit`
