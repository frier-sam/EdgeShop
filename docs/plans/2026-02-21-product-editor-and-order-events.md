# Product Editor Consolidation + Order Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate two product edit UIs into one full-page editor with variants/gallery/collections, and add an order_events system for timestamped timeline entries and append-only private notes.

**Architecture:** Part 1 strips the AdminProducts slide-over and migrates all editing to AdminProductEdit (which gains new sections using the existing useSection hook). Part 2 adds an order_events DB table; the backend inserts events on admin actions; the frontend renders them in the timeline and replaces the single-text note with an append-only note mutation.

**Tech Stack:** React + TypeScript + TanStack Query + Tailwind CSS (frontend), Hono + Cloudflare D1 (backend), existing `adminFetch` helper, existing `ImageUploader` component, existing `useSection` hook in AdminProductEdit.

---

### Task 1: Add /admin/products/new route

**Files:**
- Modify: `frontend/src/App.tsx:74`

**Step 1: Read App.tsx**

**Step 2: Add the new route**

In `App.tsx`, the existing route is:
```tsx
<Route path="products/:id" element={<AdminProductEdit />} />
```

Add the `new` route BEFORE the `:id` route (React Router matches in order):
```tsx
<Route path="products/new" element={<AdminProductEdit />} />
<Route path="products/:id" element={<AdminProductEdit />} />
```

**Step 3: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```
Expected: no errors.

**Step 4: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/App.tsx && git commit -m "feat(admin-products): add /admin/products/new route"
```

---

### Task 2: Strip AdminProducts.tsx to list-only

**Files:**
- Modify: `frontend/src/admin/pages/AdminProducts.tsx`

**Context:** This file currently has a 480px slide-over form for create/edit. We keep only the list, filters, pagination, and delete confirmation. Edit navigates to the full-page editor.

**Step 1: Read the file**

**Step 2: Replace the entire file content**

The new file retains: product list table, filters (search, status, collection, tag), pagination, delete confirmation modal. Everything related to the slide-over form, variants, gallery, collections editing, and create/update mutations is removed.

```tsx
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
```

**Step 3: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```
Expected: no errors.

**Step 4: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminProducts.tsx && git commit -m "refactor(admin-products): strip to list-only, remove slide-over form"
```

---

### Task 3: Extend AdminProductEdit — product interface + Image + Status/Details + SEO sections

**Files:**
- Modify: `frontend/src/admin/pages/AdminProductEdit.tsx`

**Context:** The current file has 3 sections: Basic Info, Pricing, Stock & Category. We need to extend the Product interface to include all fields, add the Image section, expand Stock & Category to include `tags`/`status`/`product_type`, and add the SEO section. All use the existing `useSection` hook.

**Step 1: Read the file**

**Step 2: Extend the Product interface** — replace the existing one:
```tsx
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
  tags: string
  seo_title: string | null
  seo_description: string | null
}
```

**Step 3: Add imports** — add `ImageUploader` import at the top:
```tsx
import ImageUploader from '../ImageUploader'
```

**Step 4: Add new section state variables** — after the existing `const stock = useSection(...)` line, add:
```tsx
const image = useSection({ image_url: '' })
const details = useSection({ status: 'active', product_type: 'physical', tags: '', category: '' })
const seo = useSection({ seo_title: '', seo_description: '' })
```

**Step 5: Expand the `savingSection` type**:
```tsx
const [savingSection, setSavingSection] = useState<'basicInfo' | 'pricing' | 'stock' | 'image' | 'details' | 'seo' | null>(null)
```

**Step 6: Replace the existing `stock` section JSX** — find the `{/* Section: Stock & Category */}` block and replace it with a narrower section (stock + category only), then add Image, Details, and SEO sections after it.

Replace the existing Stock & Category section with (stock_count + category only):
```tsx
{/* Section: Stock */}
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
```

**Step 7: Add the Image section** — insert after the stock section:
```tsx
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
        existingUrl={image.draft.image_url}
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
```

**Step 8: Add the Details section** (status, product_type, tags) — insert after image section:
```tsx
{/* Section: Details */}
<div className="bg-white rounded-lg border border-gray-200 p-5">
  <div className="flex items-center justify-between mb-4">
    <h2 className="font-medium text-gray-800">Details</h2>
    {!details.editing && (
      <button
        onClick={() => details.startEdit({ status: product.status, product_type: product.product_type, tags: product.tags ?? '', category: product.category })}
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
```

**Step 9: Add the SEO section** — insert after details section:
```tsx
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
```

**Step 10: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 11: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminProductEdit.tsx && git commit -m "feat(admin-product-edit): add image, details, seo sections"
```

---

### Task 4: Add create mode to AdminProductEdit

**Files:**
- Modify: `frontend/src/admin/pages/AdminProductEdit.tsx`

**Context:** When `id === 'new'`, skip the product query, show a create form with basic fields, POST to create, then redirect to the product's edit page.

**Step 1: Read the file**

**Step 2: Add `useNavigate` import** — add `useNavigate` to the react-router-dom import:
```tsx
import { useParams, Link, useNavigate } from 'react-router-dom'
```

**Step 3: Add `createMutation`** — add after the existing `updateMutation`:
```tsx
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
    navigate(`/admin/products/${data.id}`)
  },
  onError: (err: Error) => {
    showToast(err.message, 'error')
  },
})
```

**Step 4: Add `navigate` hook** — add at top of the component function (after `const { id } = useParams`):
```tsx
const navigate = useNavigate()
```

**Step 5: Add create-mode state** — add after the existing section state:
```tsx
const [createForm, setCreateForm] = useState({
  name: '', description: '', price: '', compare_price: '',
  image_url: '', stock_count: '0', category: '', tags: '',
  status: 'active', product_type: 'physical',
  seo_title: '', seo_description: '',
})
```

**Step 6: Add create-mode early return** — place this block right before the `if (isLoading)` check:
```tsx
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
            existingUrl={createForm.image_url}
            onUploadComplete={(url) => setCreateForm(f => ({ ...f, image_url: url }))}
          />
        </div>
        <button
          onClick={() => {
            if (!createForm.name.trim() || !createForm.price) return
            createMutation.mutate({
              name: createForm.name.trim(),
              description: createForm.description,
              price: parseFloat(createForm.price),
              compare_price: createForm.compare_price ? parseFloat(createForm.compare_price) : null,
              image_url: createForm.image_url,
              stock_count: parseInt(createForm.stock_count, 10) || 0,
              category: createForm.category,
              tags: createForm.tags,
              status: createForm.status,
              product_type: createForm.product_type,
              seo_title: createForm.seo_title || null,
              seo_description: createForm.seo_description || null,
            })
          }}
          disabled={createMutation.isPending || !createForm.name.trim() || !createForm.price}
          className="w-full py-2.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Creating…' : 'Create Product'}
        </button>
        <p className="text-xs text-gray-400 text-center">Gallery, variants and collections can be added after creating the product.</p>
      </div>
    </div>
  )
}
```

**Step 7: Fix `enabled` on the product query** — the query currently uses `enabled: !!id`. Change it to also exclude create mode:
```tsx
enabled: !!id && id !== 'new',
```

**Step 8: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 9: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminProductEdit.tsx && git commit -m "feat(admin-product-edit): add create mode with redirect on success"
```

---

### Task 5: Add Gallery section to AdminProductEdit

**Files:**
- Modify: `frontend/src/admin/pages/AdminProductEdit.tsx`

**Context:** Gallery images are uploaded via ImageUploader and listed in a grid with delete buttons. Available in edit mode only. Uses the `/api/admin/products/:id/images` endpoint.

**Step 1: Read the file**

**Step 2: Add types** — add after the `Product` interface:
```tsx
interface GalleryImage {
  id: number
  url: string
  sort_order: number
}
```

**Step 3: Add gallery queries and mutations** — add after the `updateMutation` (inside the component, before return):
```tsx
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
```

**Step 4: Add Gallery section JSX** — add after the SEO section, inside the `<div className="max-w-2xl space-y-6">` wrapper:
```tsx
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
```

**Step 5: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 6: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminProductEdit.tsx && git commit -m "feat(admin-product-edit): add gallery section"
```

---

### Task 6: Add Variants section with inline edit to AdminProductEdit

**Files:**
- Modify: `frontend/src/admin/pages/AdminProductEdit.tsx`

**Context:** Variants are listed with name, options, price, stock, SKU. Each row has an Edit link that expands inline. There's an Add Variant form at the bottom of the section. Uses `/api/admin/products/:id/variants`.

**Step 1: Read the file**

**Step 2: Add types** — add after `GalleryImage`:
```tsx
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
```

**Step 3: Add variant state variables** — inside the component, after the gallery state:
```tsx
const [editingVariantId, setEditingVariantId] = useState<number | null>(null)
const [variantEditDraft, setVariantEditDraft] = useState({
  name: '', price: '', stock_count: '0', sku: '',
  options: [{ key: '', value: '' }] as { key: string; value: string }[],
})
const [variantAddForm, setVariantAddForm] = useState({
  name: '', price: '', stock_count: '0', sku: '',
  options: [{ key: '', value: '' }] as { key: string; value: string }[],
})
```

**Step 4: Add variant queries and mutations** — add after the gallery mutations:
```tsx
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
```

**Step 5: Add a helper to build options array from options_json string** — add before the return statement:
```tsx
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
```

**Step 6: Add Variants section JSX** — add after the Gallery section:
```tsx
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
                  disabled={!variantEditDraft.name.trim() || !variantEditDraft.price || updateVariantMutation.isPending}
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
        let opts: Record<string, string> = {}
        try { opts = JSON.parse(v.options_json) } catch {}
        return (
          <div key={v.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800">{v.name}</p>
              <p className="text-xs text-gray-400">
                {Object.entries(opts).map(([k, val]) => `${k}: ${val}`).join(' · ')}
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
      disabled={!variantAddForm.name.trim() || !variantAddForm.price || addVariantMutation.isPending}
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
```

**Step 7: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 8: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminProductEdit.tsx && git commit -m "feat(admin-product-edit): add variants section with inline edit"
```

---

### Task 7: Add Collections section to AdminProductEdit

**Files:**
- Modify: `frontend/src/admin/pages/AdminProductEdit.tsx`

**Step 1: Add types** — add after `ProductVariant`:
```tsx
interface Collection {
  id: number
  name: string
  slug: string
}
```

**Step 2: Add collections state and queries** — inside component, after variant mutations:
```tsx
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
```

**Step 3: Add Collections section JSX** — add after the Variants section:
```tsx
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
```

**Step 4: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 5: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminProductEdit.tsx && git commit -m "feat(admin-product-edit): add collections section"
```

---

### Task 8: DB migration — order_events table

**Files:**
- Create: `worker/migrations/0010_order_events.sql`

**Step 1: Create the migration file**:
```sql
-- Migration: add order_events table for timestamped admin actions and private notes
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
```

**Step 2: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add worker/migrations/0010_order_events.sql && git commit -m "feat(db): add order_events migration"
```

---

### Task 9: Backend — GET events, POST notes, refund event

**Files:**
- Modify: `worker/src/routes/admin/orders.ts`

**Context:** Three changes: GET /:id returns events, PATCH /:id/refund inserts a refund event, new POST /:id/notes endpoint.

**Step 1: Read the file**

**Step 2: In `GET /:id`**, add events fetching. After the `emails` try/catch block (around line 44), add:
```ts
let events: Array<{ id: number; event_type: string; data_json: string; created_at: string }> = []
try {
  const { results } = await c.env.DB.prepare(
    'SELECT id, event_type, data_json, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC'
  ).bind(id).all<{ id: number; event_type: string; data_json: string; created_at: string }>()
  events = results
} catch {
  // order_events table may not exist yet (migration pending) — return empty list
}
return c.json({ ...order, emails, events })
```

**Step 3: In `PATCH /:id/refund`**, add event insertion. After the `UPDATE orders SET payment_status = 'refunded'` line and before `return c.json({ ok: true })`:
```ts
await c.env.DB.prepare(
  "INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'refund', '{}')"
).bind(id).run().catch(() => {})
```

**Step 4: Add `POST /:id/notes`** — add before `export default adminOrders`:
```ts
adminOrders.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  let text: string
  try {
    const body = await c.req.json<{ text: string }>()
    text = (body.text ?? '').trim()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  if (!text) return c.json({ error: 'text is required' }, 400)

  const order = await c.env.DB.prepare('SELECT id FROM orders WHERE id = ?').bind(id).first()
  if (!order) return c.json({ error: 'Order not found' }, 404)

  await c.env.DB.prepare(
    "INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'note', ?)"
  ).bind(id, JSON.stringify({ text })).run()

  return c.json({ ok: true })
})
```

**Step 5: Verify TypeScript compiles (worker)**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p worker/tsconfig.json
```
Expected: no errors.

**Step 6: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add worker/src/routes/admin/orders.ts && git commit -m "feat(api): order events — GET returns events, POST notes, refund event"
```

---

### Task 10: Backend — PUT inserts events on status/tracking/payment changes

**Files:**
- Modify: `worker/src/routes/admin/orders.ts:49-86`

**Context:** The existing `PUT /:id` updates order fields. We now also insert `order_events` rows for any of `order_status`, `tracking_number`, `payment_status` included in the payload.

**Step 1: In `PUT /:id`**, after `if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)` and before `return c.json({ ok: true })`, add:

```ts
// Insert timeline events for relevant field changes (non-fatal)
const eventStmts: ReturnType<typeof c.env.DB.prepare>[] = []
for (const [k, v] of entries) {
  if (k === 'order_status') {
    eventStmts.push(
      c.env.DB.prepare("INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'status_change', ?)")
        .bind(id, JSON.stringify({ to: v }))
    )
  } else if (k === 'tracking_number') {
    eventStmts.push(
      c.env.DB.prepare("INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'tracking_set', ?)")
        .bind(id, JSON.stringify({ tracking_number: v }))
    )
  } else if (k === 'payment_status') {
    eventStmts.push(
      c.env.DB.prepare("INSERT INTO order_events (order_id, event_type, data_json) VALUES (?, 'payment_change', ?)")
        .bind(id, JSON.stringify({ to: v }))
    )
  }
}
if (eventStmts.length > 0) {
  await c.env.DB.batch(eventStmts).catch(() => {})
}
```

**Step 2: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p worker/tsconfig.json
```

**Step 3: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add worker/src/routes/admin/orders.ts && git commit -m "feat(api): insert order_events on status/tracking/payment changes"
```

---

### Task 11: Frontend — order events timeline + append-only notes

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx`

**Context:** Replace the single `privateNote`/`internal_notes` pattern with an append-only `noteMutation`. Add `OrderEvent` type. Render events in timeline with timestamps. Legacy `internal_notes` shown as fallback.

**Step 1: Read the file**

**Step 2: Add `OrderEvent` interface** — add after the `EmailLog` interface:
```tsx
interface OrderEvent {
  id: number
  event_type: string
  data_json: string
  created_at: string
}
```

**Step 3: Add `events` to `Order` interface** — add inside the `Order` interface:
```tsx
events?: OrderEvent[]
```

**Step 4: Add `noteMutation`** — add after `updateMutation`:
```tsx
const [noteText, setNoteText] = useState('')

const noteMutation = useMutation({
  mutationFn: async (text: string) => {
    const r = await adminFetch(`/api/admin/orders/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!r.ok) throw new Error('Failed to save note')
    return r.json()
  },
  onSuccess: () => {
    setNoteText('')
    qc.invalidateQueries({ queryKey: ['admin-order', id] })
  },
})
```

**Step 5: Remove `privateNote` state** — find and delete:
```tsx
const [privateNote, setPrivateNote] = useState('')
```
And in the `useEffect` seed block, remove:
```tsx
setPrivateNote(order.internal_notes ?? '')
```

**Step 6: Remove the `internal_notes` from the refundMutation call** — find `refundMutation.mutate({ notes: privateNote })` and change to:
```tsx
refundMutation.mutate({ notes: '' })
```

**Step 7: Replace the Timeline section's private note input block** — find the `{/* Private note input */}` div (lines ~517-533) and replace with:
```tsx
{/* Append note */}
<div className="mb-5">
  <textarea
    value={noteText}
    onChange={e => setNoteText(e.target.value)}
    rows={2}
    placeholder="Add a private note (only visible to admins)…"
    className="w-full text-sm border border-gray-300 rounded px-3 py-2 text-gray-700 resize-none focus:outline-none focus:border-gray-500"
  />
  <button
    onClick={() => {
      if (noteText.trim()) noteMutation.mutate(noteText.trim())
    }}
    disabled={noteMutation.isPending || !noteText.trim()}
    className="mt-1.5 px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {noteMutation.isPending ? 'Saving…' : 'Add note'}
  </button>
</div>
```

**Step 8: Replace the entire timeline events block** — find `{/* Timeline events */}` and replace the whole `<div className="relative pl-5 space-y-4">` block with:

```tsx
{/* Timeline events */}
<div className="relative pl-5 space-y-4">
  <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200" />

  {/* Order placed — always first */}
  <div className="relative">
    <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-gray-400 border-2 border-white" />
    <p className="text-xs font-medium text-gray-700">Order placed</p>
    <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
  </div>

  {/* Legacy: payment received (no event = webhook payment, no timestamp) */}
  {order.payment_status === 'paid' && !(order.events ?? []).some(e => e.event_type === 'payment_change') && (
    <div className="relative">
      <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
      <p className="text-xs font-medium text-gray-700">Payment received</p>
      <p className="text-xs text-gray-400 capitalize">{order.payment_method}</p>
    </div>
  )}

  {/* Legacy: tracking set (no event = set before events table existed) */}
  {order.tracking_number && !(order.events ?? []).some(e => e.event_type === 'tracking_set') && (
    <div className="relative">
      <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-yellow-400 border-2 border-white" />
      <p className="text-xs font-medium text-gray-700">Shipped</p>
      <p className="text-xs text-gray-400">Tracking: {order.tracking_number}</p>
    </div>
  )}

  {/* Legacy: refunded (no event) */}
  {order.payment_status === 'refunded' && !(order.events ?? []).some(e => e.event_type === 'refund') && (
    <div className="relative">
      <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-white" />
      <p className="text-xs font-medium text-gray-700">Refunded</p>
    </div>
  )}

  {/* Legacy: internal_notes text (old orders before events table) */}
  {order.internal_notes && (order.events ?? []).length === 0 && (
    <div className="relative">
      <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-purple-400 border-2 border-white" />
      <p className="text-xs font-medium text-gray-700">Private note</p>
      <p className="text-xs text-gray-500 whitespace-pre-line mt-0.5">{order.internal_notes}</p>
    </div>
  )}

  {/* order_events entries — sorted by created_at (already ordered by backend) */}
  {(order.events ?? []).map(event => {
    let data: Record<string, string> = {}
    try { data = JSON.parse(event.data_json) } catch {}

    if (event.event_type === 'status_change') return (
      <div key={event.id} className="relative">
        <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-indigo-400 border-2 border-white" />
        <p className="text-xs font-medium text-gray-700 capitalize">Status → {data.to}</p>
        <p className="text-xs text-gray-400">{formatDate(event.created_at)}</p>
      </div>
    )
    if (event.event_type === 'tracking_set') return (
      <div key={event.id} className="relative">
        <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-yellow-400 border-2 border-white" />
        <p className="text-xs font-medium text-gray-700">Shipped</p>
        <p className="text-xs text-gray-400">Tracking: {data.tracking_number} · {formatDate(event.created_at)}</p>
      </div>
    )
    if (event.event_type === 'payment_change') return (
      <div key={event.id} className="relative">
        <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
        <p className="text-xs font-medium text-gray-700 capitalize">Payment {data.to}</p>
        <p className="text-xs text-gray-400">{formatDate(event.created_at)}</p>
      </div>
    )
    if (event.event_type === 'refund') return (
      <div key={event.id} className="relative">
        <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-orange-400 border-2 border-white" />
        <p className="text-xs font-medium text-gray-700">Refunded</p>
        <p className="text-xs text-gray-400">{formatDate(event.created_at)}</p>
      </div>
    )
    if (event.event_type === 'note') return (
      <div key={event.id} className="relative">
        <div className="absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full bg-purple-400 border-2 border-white" />
        <p className="text-xs font-medium text-gray-700">Private note</p>
        <p className="text-xs text-gray-500 whitespace-pre-line mt-0.5">{data.text}</p>
        <p className="text-xs text-gray-400">{formatDate(event.created_at)}</p>
      </div>
    )
    return null
  })}

  {/* Email events */}
  {(order.emails ?? []).map(email => (
    <div key={email.id} className="relative">
      <div className={`absolute -left-3.5 mt-0.5 w-3 h-3 rounded-full border-2 border-white ${email.status === 'failed' ? 'bg-red-400' : 'bg-blue-400'}`} />
      <p className="text-xs font-medium text-gray-700 capitalize">
        {email.type.replace(/_/g, ' ')}
        {email.status === 'failed' && <span className="ml-1 text-red-500">(failed)</span>}
      </p>
      <p className="text-xs text-gray-400">
        To: {email.recipient} · {new Date(email.sent_at * 1000).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  ))}
</div>
```

**Step 9: Verify TypeScript compiles**
```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```
Expected: no errors. If there are errors about `privateNote` still referenced, find and remove those references.

**Step 10: Run tests**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx vitest run
```
Expected: all passing.

**Step 11: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop && git add frontend/src/admin/pages/AdminOrderDetail.tsx && git commit -m "feat(admin-order): append-only notes, timestamped event timeline"
```

---

## Verification Checklist

After all tasks:

- [ ] `npx tsc --noEmit -p frontend/tsconfig.json` — no errors
- [ ] `npx tsc --noEmit -p worker/tsconfig.json` — no errors
- [ ] `cd frontend && npx vitest run` — all passing
- [ ] `/admin/products` list — "Edit" navigates to full page, "Add Product" navigates to `/admin/products/new`, no slide-over
- [ ] `/admin/products/new` — create form works, redirects to `/admin/products/:id` on save
- [ ] `/admin/products/:id` — all sections present: Basic Info, Pricing, Stock, Image, Details, SEO, Gallery, Variants, Collections
- [ ] Variants: existing variants can be edited inline (Edit → change → Save), added, removed
- [ ] Order timeline: "Add note" appends new entry (doesn't overwrite), textarea clears after save
- [ ] Order timeline: saving order status / tracking number shows new event entry with timestamp
- [ ] Legacy orders: `internal_notes` text shown as single legacy note, hardcoded payment/shipped/refunded entries still show for old data
