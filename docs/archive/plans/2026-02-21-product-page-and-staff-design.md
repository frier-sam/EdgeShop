# Design: Richer Product Page + Staff/Admin Auth System

Date: 2026-02-21

---

## Feature 1: Richer Product Page

### Problem
The product detail page (`/product/:id`) renders without the theme Header or Footer, has no gallery image strip, and has no related-products section — leaving the page feeling sparse and disconnected from the rest of the storefront.

### Solution

**Header + Footer:** Render the theme's `Header` and `Footer` components on the product page (same ones used on HomePage). Cart drawer and cart store integration stays identical to the homepage.

**Gallery strip:** The `product_images` table already exists. Show gallery thumbnails as a row of small square images below the main product image. Clicking a thumbnail swaps the main image. The currently-selected variant image takes priority over the gallery when a variant is selected.

**Recommended products ("You May Also Like"):** At the bottom of the page, fetch up to 4 products from the same `category` via `/api/products?category=X&limit=4&exclude=<currentId>`. Render them using the theme's `ProductCard` component. The API needs a `limit` and `exclude` query param added.

### Files affected
- `frontend/src/pages/ProductPage.tsx` — add Header/Footer, gallery strip, recommended section
- `worker/src/routes/products.ts` — add `limit` and `exclude` query params to GET `/api/products`

---

## Feature 2: Staff / Admin Auth System

### Problem
The admin panel is currently protected only by Cloudflare Access (network-level). There is no app-level concept of admin users, so it's impossible to have different staff members with different access levels managed from within the app.

### Solution

**Approach:** Promote existing customer accounts to staff. Customers are the user identity; role is just an attribute.

### Schema (migration 0008)

```sql
ALTER TABLE customers ADD COLUMN role TEXT NOT NULL DEFAULT 'customer';
-- values: 'customer' | 'staff' | 'super_admin'

ALTER TABLE customers ADD COLUMN permissions_json TEXT NOT NULL DEFAULT '{}';
-- e.g. {"products":true,"orders":true,"customers":false,...}
```

### Super Admin Bootstrap
On `POST /api/auth/register`: if `SELECT COUNT(*) FROM customers` = 0, set the new customer's role to `super_admin`. First account registered is automatically the super admin. No manual DB seeding needed.

### JWT Changes
JWT payload gains two new fields:
```json
{ "sub": 1, "email": "...", "role": "super_admin", "permissions": { "products": true, ... } }
```

### Worker Middleware
New `requireAdmin(c, next)` middleware: reads `Authorization: Bearer <token>`, verifies JWT, checks `role` is `staff` or `super_admin`. Returns 401 if missing/invalid. Applied to all `/api/admin/*` routes.

New `requireSuperAdmin(c, next)`: same but only allows `super_admin`. Applied to staff management endpoints.

### New API Routes
- `GET /api/admin/staff` — list all staff + super_admin accounts with their permissions
- `PUT /api/admin/staff/:id` — set role (`staff` | `customer`) and `permissions_json` for a customer. Super admin only.

### Admin Login
- New page: `/admin/login` — email + password form
- Calls `POST /api/auth/login` (same endpoint as storefront). Response includes `role` and `permissions`.
- If role is not `staff` or `super_admin` → show "Access denied" error
- Token stored in `adminAuthStore` (Zustand, persisted to localStorage under `admin_token`)

### Admin Frontend Changes
- `AdminLayout`: if no admin token → redirect to `/admin/login`. Show logged-in name + logout button in sidebar.
- Nav sections filtered by permissions (super_admin sees all 10 sections; staff sees only permitted ones)
- New page `/admin/staff`: super_admin only, lists staff accounts, per-section permission toggles, promote/demote button

### Permissions Sections (10)
`products` · `orders` · `customers` · `discounts` · `reviews` · `analytics` · `content` · `appearance` · `shipping` · `settings`

Each maps to nav sections:
- `products` → Products, Collections, Import
- `content` → Pages, Navigation, Footer, Blog
- All others map 1:1

---

## Key Decisions
- Reuse customer auth (`/api/auth/login`) for admin login — no separate staff login endpoint needed
- Permissions stored as JSON blob in customers row — simple, no extra table; stale JWTs are acceptable at this scale (staff re-login picks up new permissions)
- `super_admin` is immutable from within the app — can't be demoted via the staff UI (requires direct DB change)
- Worker admin middleware is additive — Cloudflare Access can still sit in front as an extra layer if desired
