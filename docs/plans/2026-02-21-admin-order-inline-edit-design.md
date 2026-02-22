# Admin Order Detail — Section-Level Inline Editing

**Date:** 2026-02-21

## Problem

The current `AdminOrderDetail` page has a Save button next to every individual field (9+ buttons). This clutters the UI and makes the page feel noisy.

## Goal

- Each section has a single "Edit" button in its header.
- Clicking "Edit" enables all inputs in that section.
- A single "Save" button at the bottom of the section saves all fields in one API call.
- Customer email and phone are permanently read-only (no editing allowed).

## Approach

Per-section `isEditing` boolean. Four sections become editable:

| Section | Editable fields | Read-only fields |
|---|---|---|
| Customer | `customer_name` | `customer_email`, `customer_phone` |
| Shipping Address | `shipping_address`, `shipping_city`, `shipping_state`, `shipping_pincode`, `shipping_country` | — |
| Payment | `payment_status` | `payment_method`, Razorpay IDs |
| Admin Actions | `order_status`, `tracking_number` | — |

The Timeline / Private Note section keeps its current textarea + "Save note" pattern unchanged.

## State Changes

Add four booleans to component state:

```ts
const [editingCustomer, setEditingCustomer] = useState(false)
const [editingShipping, setEditingShipping] = useState(false)
const [editingPayment, setEditingPayment] = useState(false)
const [editingAdminActions, setEditingAdminActions] = useState(false)
```

## UX Behaviour

**View mode (default):** Fields render as plain `<p>` / `<span>` text. Section header shows a small "Edit" button on the right.

**Edit mode:** Fields render as `<input>` / `<select>`. "Edit" button is hidden. A "Save" button appears at the bottom of the section.

**On Save:** `updateMutation.mutate({ ...all fields in section })` fires. On success, `setEditingX(false)`.

**Email & Phone:** Always rendered as plain text — no input wrapper, no edit capability.

## Files Changed

- `frontend/src/admin/pages/AdminOrderDetail.tsx` — only file touched.

## Decision

No Cancel button (user preference) — simpler UI, fewer states to manage.
