# Product Editor Consolidation + Order Events Design

**Date:** 2026-02-21

## Problem

Three issues:
1. Two product edit UIs exist — `AdminProducts.tsx` has a 480px slide-over with full form (variants, gallery, SEO, collections); `AdminProductEdit.tsx` is a separate full page with only 3 sections. Editing a product from the list opens the cramped sidebar, not the full page. Variant UX in the sidebar is especially cumbersome (no inline edit, only delete+re-add).
2. Order private notes overwrite each other — `internal_notes` is a single text blob. Each save destroys the previous note. No history.
3. Timeline action entries (Shipped, Payment received, Refunded) have no timestamps — state is derived from current order fields, not stored events.

## Solution

### Part 1: Product Editing Consolidation

**`AdminProducts.tsx`** becomes list-only:
- Remove the slide-over form and all associated state/mutations (form, editingId, selectedCollections, variantForm, createMutation, updateMutation, gallery/variant queries)
- "Add Product" button → navigate to `/admin/products/new`
- "Edit" row button → `<Link to="/admin/products/:id">`
- Keep: list table, filters, pagination, delete confirmation

**`App.tsx`**: add route `products/new` → `<AdminProductEdit />`

**`AdminProductEdit.tsx`** handles both create and edit:
- `id === 'new'` = create mode; `id` = numeric string = edit mode
- Create mode: show core sections only (no gallery/variants/collections — need an ID first). POST to create, redirect to `/admin/products/:newId` on success.
- Edit mode: all sections visible

**Sections added to `AdminProductEdit`** (using existing `useSection` hook):

| Section | Fields | Available |
|---|---|---|
| Basic Info | name, description | both |
| Primary Image | image_url (ImageUploader) | both |
| Pricing | price, compare_price | both |
| Stock & Details | stock_count, category, tags, status, product_type | both |
| SEO | seo_title, seo_description | both |
| Gallery | image grid + ImageUploader | edit only |
| Variants | list + add form + inline per-row edit | edit only |
| Collections | checkbox list | edit only |

**Variant inline edit**: each variant row has an "Edit" link. Clicking it expands the row into editable fields with Save/Cancel. Calls `PUT /api/admin/products/:id/variants/:variantId`.

### Part 2: Order Events

**DB migration `worker/migrations/0010_order_events.sql`:**
```sql
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data_json TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
```

**Backend `worker/src/routes/admin/orders.ts`:**
- `GET /:id` — fetch events (try/catch for missing table), return in response as `events` array
- `PUT /:id` — after update, insert events for each of `order_status`, `tracking_number`, `payment_status` included in payload
- `PATCH /:id/refund` — insert `{event_type: 'refund', data_json: '{}'}` event
- `POST /:id/notes` — new endpoint, insert `{event_type: 'note', data_json: {text}}`, return `{ok: true}`

**Event types and data shapes:**
```
status_change  → { to: "shipped" }
tracking_set   → { tracking_number: "1Z999..." }
payment_change → { to: "paid" }
refund         → {}
note           → { text: "Admin note text" }
```

**Frontend `AdminOrderDetail.tsx`:**
- Add `OrderEvent` interface `{id, event_type, data_json, created_at}`
- Add `events: OrderEvent[]` to `Order` interface
- Replace timeline's `privateNote` / `updateMutation({ internal_notes })` with `noteMutation` (POST `/:id/notes`). Textarea clears on success.
- Timeline: merge `order_events` and `order_emails` into a single chronological list between "Order placed" and the end. Each event type gets an icon colour + label + timestamp.
- Legacy: if `order.internal_notes` has text and `events` is empty, show it as a single "Note (legacy)" entry with purple dot and no timestamp.

## Decisions
- Notes are append-only — no edit or delete of past notes
- action timestamps only captured going forward (no backfill of existing orders)
- Variant "edit" replaces the delete-and-recreate workflow with inline editing
- Create mode for products shows all fields available at creation time; gallery/variants/collections unlock after the product ID exists
