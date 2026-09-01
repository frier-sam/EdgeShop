# UI Improvements Design — EdgeShop
**Date:** 2026-02-21
**Approach:** Approach B — Thin shared component library first, then upgrade all pages
**Constraint:** Polish and enhance existing UI. No redesign, no new colour palette, no layout changes.

---

## Problem Statement

Six identified pain points in the current UI:
1. Page transitions feel abrupt — content pops in
2. Cart drawer animation is not smooth
3. Admin tables are hard to scan — no hover states, no sticky headers
4. Loading states are missing — blank screens during data fetches
5. Form inputs use wrong types — everything is `<input type="text">` even for enumerable/boolean values
6. Forms are monotone — no visual grouping or section labels

---

## Solution: Shared Component Library + Targeted Fixes

Build 6 reusable components in `frontend/src/components/`, then apply them across admin pages and storefront. One consistent change propagates everywhere.

---

## Section 1 — Shared Components

All files go in `frontend/src/components/`. All use existing Tailwind classes only — no new design tokens or colours.

### `Skeleton.tsx`
Animated shimmer placeholder for loading states.
- `<Skeleton className="h-4 w-32" />` — inline block with pulse animation
- `<SkeletonTable rows={5} cols={6} />` — full table row placeholder
- CSS: `animate-pulse bg-gray-200 rounded`

### `SelectField.tsx`
Styled `<select>` wrapper with label and optional error.
- Props: `label`, `name`, `value`, `onChange`, `options: {value, label}[]`, `required?`, `error?`
- Styled to match existing admin form inputs (same border, padding, focus ring)

### `ToggleField.tsx`
On/off toggle switch for boolean settings.
- Props: `label`, `description?`, `checked`, `onChange`
- Renders as a pill toggle (CSS-only, no JS library)
- Styled with existing gray/green Tailwind classes

### `FormSection.tsx`
Titled grouping wrapper for form fields.
- Props: `title`, `description?`, `children`
- Renders: `<h3>` heading + `border-b` divider + content area
- Adds visual breathing room between logical form groups

### `DataTable.tsx`
Table component with sticky header and hover rows.
- Props: `columns: {key, label, width?}[]`, `children` (rows)
- Sticky `<thead>` with `sticky top-0 bg-white z-10 shadow-sm`
- Row hover: `hover:bg-gray-50 transition-colors`
- Consistent column structure

### `PageTransition.tsx`
Fade + slide wrapper for route-level transitions.
- Wraps route children with CSS keyframe animation
- `opacity 0→1` + `translateY(6px)→0`
- Duration: 200ms, ease-out
- Applied in `App.tsx` around each route element

---

## Section 2 — Page Transitions

**File:** `frontend/src/components/PageTransition.tsx`
**Applied in:** `frontend/src/App.tsx`

Wrap each `<Route element={...}>` with `<PageTransition>`:
```tsx
<Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
```

CSS keyframe:
```css
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## Section 3 — Cart Drawer Smoothing

**Files:** `frontend/src/themes/jewellery/CartDrawer.tsx`, `frontend/src/themes/artsCrafts/CartDrawer.tsx`

Current: visibility toggled abruptly (likely `hidden`/`block` or conditional render).

Fix:
- Drawer panel: `transform transition-transform duration-300 ease-in-out` + `translate-x-full` → `translate-x-0`
- Backdrop overlay: `transition-opacity duration-300` + `opacity-0` → `opacity-100`
- Keep component always mounted, toggle via transform (not unmount/remount)

---

## Section 4 — Skeleton Loading States

**File:** `frontend/src/components/Skeleton.tsx`

**Applied in:**

| Page | What gets a skeleton |
|------|----------------------|
| `AdminDashboard` | 4 stat cards while fetching |
| `AdminOrders` | 8 table rows while fetching |
| `AdminProducts` | 8 table rows while fetching |
| `AdminCustomers` | 8 table rows while fetching |
| `AdminDiscounts` | 8 table rows while fetching |
| `AdminBlog` | 8 table rows while fetching |
| `AdminReviews` | 8 table rows while fetching |
| `AdminShipping` | 8 table rows while fetching |
| `HomePage` | 8 product card skeletons while fetching |

Pattern: `if (isLoading) return <SkeletonTable rows={8} cols={colCount} />`

---

## Section 5 — Smart Form Inputs

**Files:** `frontend/src/components/SelectField.tsx`, `frontend/src/components/ToggleField.tsx`

### SelectField replacements

| Page | Field | Options |
|------|-------|---------|
| `AdminOrders` | Order status filter | placed / confirmed / shipped / delivered / cancelled |
| `AdminOrderDetail` | Order status | placed / confirmed / shipped / delivered / cancelled |
| `AdminOrderDetail` | Payment status | pending / paid / refunded |
| `AdminProducts` | Status filter | active / draft / archived |
| `AdminShipping` | Country | full country list (reuse existing `countryCodes.ts`) |
| `AdminSettings` | Currency | INR / USD / EUR / GBP |

### ToggleField replacements

| Page | Field |
|------|-------|
| `AdminSettings` | `cod_enabled` |
| `AdminSettings` | `announcement_enabled` |
| `AdminProductEdit` | Product active/draft quick toggle |

---

## Section 6 — Form Visual Grouping

**File:** `frontend/src/components/FormSection.tsx`

**Applied in:**

| Page | Sections |
|------|----------|
| `AdminSettings` | Store Info / Payments / Announcements |
| `AdminProductEdit` | Basic Info / Pricing & Stock / Images / SEO |
| `AdminAppearance` | Theme / Colours / Media |
| `AdminOrderDetail` | Customer / Shipping / Payment / Items |

No layout changes — only adds `<h3>` label and `border-b` separator above each group.

---

## Files Changed Summary

### New files (6)
- `frontend/src/components/Skeleton.tsx`
- `frontend/src/components/SelectField.tsx`
- `frontend/src/components/ToggleField.tsx`
- `frontend/src/components/FormSection.tsx`
- `frontend/src/components/DataTable.tsx`
- `frontend/src/components/PageTransition.tsx`

### Modified files
- `frontend/src/App.tsx` — add PageTransition wrappers
- `frontend/src/themes/jewellery/CartDrawer.tsx` — smooth animation
- `frontend/src/themes/artsCrafts/CartDrawer.tsx` — smooth animation
- `frontend/src/admin/pages/AdminDashboard.tsx` — skeleton loading
- `frontend/src/admin/pages/AdminOrders.tsx` — skeleton + SelectField for status filter
- `frontend/src/admin/pages/AdminOrderDetail.tsx` — FormSection + SelectField for statuses
- `frontend/src/admin/pages/AdminProducts.tsx` — skeleton + SelectField for status filter
- `frontend/src/admin/pages/AdminProductEdit.tsx` — FormSection + ToggleField
- `frontend/src/admin/pages/AdminCustomers.tsx` — skeleton loading
- `frontend/src/admin/pages/AdminDiscounts.tsx` — skeleton loading
- `frontend/src/admin/pages/AdminBlog.tsx` — skeleton loading
- `frontend/src/admin/pages/AdminReviews.tsx` — skeleton loading
- `frontend/src/admin/pages/AdminShipping.tsx` — skeleton + SelectField for country
- `frontend/src/admin/pages/AdminSettings.tsx` — FormSection + ToggleField + SelectField
- `frontend/src/admin/pages/AdminAppearance.tsx` — FormSection
- `frontend/src/pages/HomePage.tsx` — skeleton product card loading

---

## What This Is NOT

- Not a redesign — no new colours, no new fonts, no layout restructuring
- Not a new design system — only 6 focused components
- Not touching the theme system or theme components (except CartDrawer animation)
- Not adding third-party UI libraries

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Shared components over direct edits | Consistency across 21 admin pages; one fix propagates everywhere |
| CSS-only animations (no Framer Motion) | Zero new dependencies; Tailwind transitions are sufficient |
| Always-mounted CartDrawer (transform toggle) | Prevents re-render flash; drawer content retains scroll position |
| Skeleton over spinner | Reduces perceived load time; matches content shape |
| SelectField wraps native `<select>` | Accessible by default; no custom dropdown JS needed |
| ToggleField is CSS-only pill toggle | No JS library; matches existing Tailwind aesthetic |
