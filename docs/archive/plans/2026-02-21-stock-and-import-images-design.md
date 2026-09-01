# Stock Validation & Import Image Upload Design

**Date:** 2026-02-21
**Features:** Cart/Checkout Stock Validation + Import Image Upload to R2
**Status:** Approved

---

## Overview

Two independent features:
1. **Stock Validation** — Enforce stock limits at three layers: cart add, checkout page, and backend pre-order check.
2. **Import Image Upload** — When importing products via CSV, allow merchant to choose between keeping external image URLs or uploading images to Cloudflare R2.

---

## Feature 1: Stock Validation

### Problem

Stock is already displayed on product pages, but:
- Cart allows adding quantities beyond available stock
- Checkout has no pre-submit client check
- Backend creates orders without validating stock first (only decrements after)

### Architecture

**Layer 1 — Cart add**
- `CartItem` interface gets `stock_count?: number` field
- `addItem(product, qty, stock_count?)` caps new quantity at `Math.min(qty, stock_count)`
- Increment button in cart is disabled when `item.quantity >= item.stock_count`
- ProductPage passes `product.stock_count` to `addItem`

**Layer 2 — Checkout page (client)**
- Before submitting, validate each cart item's `quantity` against its `stock_count`
- If any item exceeds stock, show per-item inline error and block submission
- Error format: "Only X available for [Product Name]"

**Layer 3 — Backend pre-order check**
- In `checkout.ts`, before any INSERT or Razorpay order creation:
  ```sql
  SELECT id, name, stock_count FROM products WHERE id IN (?)
  ```
- Compare each cart item quantity to available stock
- If insufficient: return `400 { error: 'stock_error', items: [{ id, name, available }] }`
- CheckoutPage handles `stock_error` response: shows per-item error messages

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Store `stock_count` on CartItem | Avoids re-fetching product data at checkout; cart already has all product fields |
| Client-side check before backend | Better UX — instant feedback without network round-trip |
| Backend check is authoritative | Race conditions (two users buying last item simultaneously) can only be caught server-side |
| Return structured error with item details | Frontend can surface specific messages rather than generic "out of stock" |

---

## Feature 2: Import Image Upload to R2

### Problem

AdminImport stores `image_url` directly from CSV as an external URL. These URLs can break (CDN changes, domain expiry). Merchants want to host images on their own Cloudflare R2.

### Architecture

**New backend endpoint:** `POST /api/admin/upload-image-from-url`
- Accepts `{ url: string }`
- Worker fetches the external URL using `fetch()`
- Uploads to R2 via `env.R2.put(key, body, { httpMetadata })`
- Returns `{ url: string }` — the public R2 URL
- Protected by `requireAdmin`

**AdminImport UI change:**
- Add image handling radio in the review/preview step:
  - **Keep original URLs** (default) — no change from current behaviour
  - **Upload to Cloudflare R2** — fetch + upload each image before saving product
- When "Upload to R2" selected and import is started:
  - For each product with a non-empty `image_url`: call upload endpoint, replace `image_url` with returned R2 URL
  - Show per-product progress: "Uploading images... (3 / 12)"
  - Failed uploads fall back to original URL (log warning, continue)
- R2 key format: `products/<uuid>.<ext>` (same as manual uploads)

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| Worker fetches external URL | Browser can't fetch cross-origin images; Worker has no CORS restrictions |
| Fallback to original URL on upload failure | Import shouldn't abort if one image 404s; merchant can fix later |
| Default is "Keep URLs" | Backwards-compatible; not all merchants want R2 |
| Synchronous per-image upload | Simpler than queues; Workers can handle sequential fetch+upload; progress is visible |

---

## Files Changed

### Stock Validation
- `frontend/src/store/cartStore.ts` — add `stock_count` to CartItem, cap in addItem/increment
- `frontend/src/pages/ProductPage.tsx` — pass stock_count to addItem
- `frontend/src/pages/CheckoutPage.tsx` — client stock check + handle stock_error response
- `worker/src/routes/checkout.ts` — pre-order batch stock check

### Import Image Upload
- `worker/src/routes/admin/products.ts` — add `POST /upload-image-from-url` endpoint
- `worker/src/index.ts` — verify route is mounted (likely already under admin products)
- `frontend/src/admin/pages/AdminImport.tsx` — add image handling radio + R2 upload loop
