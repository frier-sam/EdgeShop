# Multi-Level Category Hierarchy Design

**Date:** 2026-02-20

## Goal

Add unlimited-depth category (collection) hierarchy to EdgeShop, with CSV import awareness and navigation editor integration.

## Approach

**Adjacency List + SQLite Recursive CTE**

Add a single `parent_id` column to the `collections` table. SQLite's `WITH RECURSIVE` loads the full tree in one query. Backward-compatible: existing collections get `parent_id = NULL` and remain root-level.

---

## Database

**Migration:** `worker/migrations/0004_category_hierarchy.sql`

```sql
ALTER TABLE collections ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES collections(id) ON DELETE SET NULL;
```

**Tree query (recursive CTE):**
```sql
WITH RECURSIVE tree AS (
  SELECT *, 0 AS depth FROM collections WHERE parent_id IS NULL
  UNION ALL
  SELECT c.*, t.depth + 1 FROM collections c JOIN tree t ON c.parent_id = t.id
)
SELECT * FROM tree ORDER BY depth, sort_order, name
```

---

## Backend API

### Admin routes (`worker/src/routes/admin/collections.ts`)

- `GET /api/admin/collections` — uses recursive CTE, returns flat array with `depth` and `parent_id` fields
- `POST /api/admin/collections` — accepts optional `parent_id`
- `PUT /api/admin/collections/:id` — `parent_id` added to allowed fields (reparenting)
- `DELETE /api/admin/collections/:id` — unchanged (ON DELETE SET NULL handles children becoming root)

### Public routes (`worker/src/routes/collections.ts`)

- `GET /api/collections` — unchanged (flat list for storefront/nav)
- `GET /api/collections/:slug` — add `breadcrumb` array: walk parent chain up to root, return `[{name, slug}, ...]`

---

## Admin Collections UI (`frontend/src/admin/pages/AdminCollections.tsx`)

Replace flat table with indented tree list:

```
Clothing                              [+ Child] [Edit] [Delete]
  ├── Men's                           [+ Child] [Edit] [Delete]
  │     └── T-Shirts                  [+ Child] [Edit] [Delete]
  └── Women's                         [+ Child] [Edit] [Delete]
Jewellery                             [+ Child] [Edit] [Delete]
[+ Add Root Category]
```

- Indent rows by `depth × 20px`
- "New Collection" creates root category (`parent_id = null`)
- "+ Child" button pre-fills `parent_id` in create modal
- Edit modal: **Parent** dropdown listing all collections except self and own descendants (cycle prevention)
- Delete: warn if collection has children

---

## CSV Import (`frontend/src/admin/pages/AdminImport.tsx`)

**WooCommerce:** `Category` column uses `>` separator — e.g. `"Clothing > Men's > T-Shirts"`

**Shopify:** `Type` field is a single level — e.g. `"Clothing"`

**Import logic:**
1. Parse category path (split on ` > ` for WooCommerce, plain string for Shopify/Generic)
2. Walk path left-to-right, `GET or POST` each level with correct `parent_id`
3. Cache created/found collections by `name+parent_id` key within the import session
4. Assign product to the **leaf** (most specific) collection

---

## Navigation Editor (`frontend/src/admin/pages/AdminNavigation.tsx`)

When type = **Collection**, replace the flat `<select>` with an indented select using `—` prefix per depth level:

```
Select a collection…
  Clothing
  — Men's
  — — T-Shirts
  — Women's
  Jewellery
  — Rings
```

Selecting any node fills Label and URL as before. Navigation item hierarchy remains independent from collection hierarchy.

---

## Files to change

| File | Change |
|------|--------|
| `worker/migrations/0004_category_hierarchy.sql` | New migration — add `parent_id` |
| `worker/src/routes/admin/collections.ts` | Recursive CTE list, accept `parent_id` in POST/PUT |
| `worker/src/routes/collections.ts` | Add `breadcrumb` to `/:slug` response |
| `frontend/src/admin/pages/AdminCollections.tsx` | Tree UI, parent picker, child button |
| `frontend/src/admin/pages/AdminImport.tsx` | Parse category paths, create hierarchy during import |
| `frontend/src/admin/pages/AdminNavigation.tsx` | Indented collection tree picker |
