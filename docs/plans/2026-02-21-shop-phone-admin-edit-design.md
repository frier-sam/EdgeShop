# Design: Shop Page, Phone Country Code & Admin Product Edit

**Date:** 2026-02-21
**Status:** Approved

---

## Overview

Four related features:

1. **`/shop` page** — dedicated all-items storefront page (distinct from search)
2. **Default Country in Settings** — admin can set a store default country/dial code
3. **Checkout Phone + Country Code** — mandatory phone with country code selector defaulting to store setting
4. **Admin Product Edit page** — `/admin/products/:id` with per-section inline editing

---

## Feature 1: `/shop` — All Items Page

### Goal
A dedicated page showing all products, distinct from `/search` (which requires a query string and uses FTS5). Accessible from navigation.

### Behavior
- Route: `/shop`
- Fetches all products from `/api/products` (existing endpoint, returns full list)
- Renders via active theme's `Header`, `ProductGrid`, `Footer`, `CartDrawer` components
- **Category filter chips** — derived from unique `category` values in the fetched product list; "All" chip always present; clicking a chip filters the displayed grid client-side
- **Sort dropdown** — Newest (default), Price: Low→High, Price: High→Low; client-side sort
- Loading/empty/error states handled cleanly

### Files
- Create: `frontend/src/pages/ShopPage.tsx`
- Modify: `frontend/src/App.tsx` — add `<Route path="/shop" element={<ShopPage />} />`
- Modify: `frontend/src/admin/pages/AdminNavigation.tsx` — update quick-fill link from `{ label: 'All Products', href: '/search' }` to `{ label: 'Shop', href: '/shop' }`

---

## Feature 2: Default Country in Admin Settings

### Goal
Let the merchant pick their store's default country once in Settings. This drives the pre-selected phone dial code in checkout.

### Data
- New settings key: `default_country_code` (string, e.g. `"+91"`)
- Stored in D1 `settings` table via existing `PUT /api/settings`
- Public `GET /api/settings` already returns all non-sensitive keys — no change needed there
- Seeded with `+91` (India) as the default

### Files
- Create: `worker/migrations/0006_default_country.sql` — `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_country_code', '+91')`
- Modify: `worker/src/routes/settings.ts` — add `'default_country_code'` to the `allowed` array in `PUT /`
- Modify: `frontend/src/admin/pages/AdminSettings.tsx` — add "Default Country" `<select>` in the Store Information section; options sourced from shared `countryCodes.ts`; saves `default_country_code`

---

## Feature 3: Checkout Phone + Country Code

### Goal
Phone number is mandatory. A country dial code selector precedes the phone input. The selector defaults to the store's `default_country_code` setting.

### Data flow
- `countryCodes.ts` exports `COUNTRY_CODES: Array<{ name: string; code: string }>` (full ~250-entry list, sorted by name)
- `CheckoutPage` adds `country_code: string` to form state
- On settings load: `country_code` initialises from `settings.default_country_code ?? '+91'`
- Profile pre-fill still works (name, email, raw phone — country code stays from settings)
- On submit: `customer_phone` sent as `form.country_code + form.customer_phone` (e.g. `"+919876543210"`)

### UI
- Phone row: `[Country code <select>] [Phone number <input>]` in a 2-column grid
- Phone input: `required`, label "Phone *", `type="tel"`, `placeholder="98765 43210"`
- Country code select: shows `code — name` (e.g. `+91 — India`), full list

### Files
- Create: `frontend/src/utils/countryCodes.ts`
- Modify: `frontend/src/pages/CheckoutPage.tsx`

---

## Feature 4: Admin Product Edit (`/admin/products/:id`)

### Goal
Admin can view and edit a product's details directly from an admin page, section by section, without navigating away.

### Behavior
- Route: `/admin/products/:id` (nested under `AdminLayout`)
- Fetches product from `/api/products/:id` (existing public endpoint)
- Page header: product name, "← Back to Products" link, "View on storefront →" link
- **Three editable sections**, each independent:

  | Section | Fields |
  |---|---|
  | Basic Info | `name` (text input), `description` (textarea) |
  | Pricing | `price` (number), `compare_price` (number, optional) |
  | Stock & Category | `stock_count` (number), `category` (text) |

- Each section has an **Edit** button (pencil icon or text)
- Clicking Edit replaces the read-only display with form fields + **Save** + **Cancel** buttons
- Save calls `PUT /api/admin/products/:id` with only that section's fields
- On success: invalidates `['product', id]` query, shows toast, exits edit mode for that section
- On cancel: reverts to read-only, no API call
- Only one section editable at a time (or multiple independently — simpler to allow all independently)

### Files
- Create: `frontend/src/admin/pages/AdminProductEdit.tsx`
- Modify: `frontend/src/App.tsx` — add `<Route path="products/:id" element={<AdminProductEdit />} />` inside the `/admin` route block

---

## Key Decisions

| Decision | Rationale |
|---|---|
| `/shop` uses client-side filter/sort | All products fit in one API call at small-merchant scale; avoids new query params on the existing endpoint |
| `default_country_code` stored as dial string e.g. `"+91"` | No mapping layer needed at runtime; stored value is used directly in the checkout select |
| Phone concatenated as `country_code + number` on submit | Single `customer_phone` column in D1; format is unambiguous for display and Razorpay prefill |
| Admin edit uses public `/api/products/:id` for read | Same data, no separate admin read endpoint needed |
| Admin edit uses existing `PUT /api/admin/products/:id` for write | No new backend work; endpoint already accepts partial updates |
| Sections editable independently | Each section has its own dirty state; avoids a single large form submit |
| Migration seeds `+91` default | India-centric default matches project's Razorpay (INR) setup; merchant can change it immediately |
