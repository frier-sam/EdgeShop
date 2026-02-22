# UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the existing EdgeShop UI with skeleton loading states, smooth page transitions, toggle switches for booleans, a currency select field, and cart drawer easing improvements — all without redesigning anything.

**Architecture:** Six shared components added to `frontend/src/components/`. Each admin page's `Loading...` text replaced with a `<SkeletonTable>`. Routes in `App.tsx` wrapped in `<PageTransition>`. `AdminSettings` gets `ToggleField` + `SelectField` for currency. Cart drawers get improved easing.

**Tech Stack:** React 18, Tailwind CSS v4, existing project patterns (no new dependencies)

---

## Task 1: Skeleton component

**Files:**
- Create: `frontend/src/components/Skeleton.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/Skeleton.tsx

interface SkeletonProps {
  className?: string
}

/** Inline shimmer block. Usage: <Skeleton className="h-4 w-32" /> */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  )
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

/** Full table placeholder while data loads. */
export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header row */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 flex gap-4 border-b border-gray-100 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-4 flex-1 ${c === 0 ? 'max-w-[120px]' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface SkeletonCardProps {
  count?: number
}

/** Grid of skeleton cards for product grids / stat cards. */
export function SkeletonCards({ count = 4 }: SkeletonCardProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

interface SkeletonStatCardsProps {
  count?: number
}

/** Skeleton for dashboard stat cards. */
export function SkeletonStatCards({ count = 4 }: SkeletonStatCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Verify TypeScript — run**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors.

**Step 3: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/components/Skeleton.tsx
git commit -m "feat: add Skeleton, SkeletonTable, SkeletonCards, SkeletonStatCards components"
```

---

## Task 2: PageTransition component

**Files:**
- Modify: `frontend/src/index.css`
- Create: `frontend/src/components/PageTransition.tsx`

**Step 1: Add CSS keyframe to `frontend/src/index.css`**

Find the existing `frontend/src/index.css` and append this at the end:

```css
@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter {
  animation: pageEnter 200ms ease-out both;
}
```

**Step 2: Create `frontend/src/components/PageTransition.tsx`**

```tsx
// frontend/src/components/PageTransition.tsx

interface PageTransitionProps {
  children: React.ReactNode
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="page-enter">
      {children}
    </div>
  )
}
```

**Step 3: Apply PageTransition to all storefront routes in `frontend/src/App.tsx`**

Add the import at the top:
```tsx
import PageTransition from './components/PageTransition'
```

Wrap each storefront `element` prop (not admin routes — admin already has its own layout):
```tsx
<Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
<Route path="/product/:id" element={<PageTransition><ProductPage /></PageTransition>} />
<Route path="/checkout" element={<PageTransition><CheckoutPage /></PageTransition>} />
<Route path="/order-success" element={<PageTransition><OrderSuccessPage /></PageTransition>} />
<Route path="/pages/:slug" element={<PageTransition><StaticPage /></PageTransition>} />
<Route path="/account/login" element={<PageTransition><LoginPage /></PageTransition>} />
<Route path="/account/register" element={<PageTransition><RegisterPage /></PageTransition>} />
<Route path="/account/orders" element={<PageTransition><AccountOrdersPage /></PageTransition>} />
<Route path="/account/profile" element={<PageTransition><AccountProfilePage /></PageTransition>} />
<Route path="/account/forgot-password" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
<Route path="/account/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
<Route path="/collections/:slug" element={<PageTransition><CollectionPage /></PageTransition>} />
<Route path="/search" element={<PageTransition><SearchPage /></PageTransition>} />
<Route path="/shop" element={<PageTransition><ShopPage /></PageTransition>} />
<Route path="/blog" element={<PageTransition><BlogListPage /></PageTransition>} />
<Route path="/blog/:slug" element={<PageTransition><BlogPostPage /></PageTransition>} />
<Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
<Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
```

Also wrap each admin child route element:
```tsx
<Route path="dashboard" element={<PageTransition><AdminDashboard /></PageTransition>} />
<Route path="products" element={<PageTransition><AdminProducts /></PageTransition>} />
<Route path="products/new" element={<PageTransition><AdminProductEdit /></PageTransition>} />
<Route path="products/:id" element={<PageTransition><AdminProductEdit /></PageTransition>} />
<Route path="orders" element={<PageTransition><AdminOrders /></PageTransition>} />
<Route path="orders/:id" element={<PageTransition><AdminOrderDetail /></PageTransition>} />
<Route path="settings" element={<PageTransition><AdminSettings /></PageTransition>} />
<Route path="appearance" element={<PageTransition><AdminAppearance /></PageTransition>} />
<Route path="footer" element={<PageTransition><AdminFooter /></PageTransition>} />
<Route path="collections" element={<PageTransition><AdminCollections /></PageTransition>} />
<Route path="pages" element={<PageTransition><AdminPages /></PageTransition>} />
<Route path="navigation" element={<PageTransition><AdminNavigation /></PageTransition>} />
<Route path="discounts" element={<PageTransition><AdminDiscounts /></PageTransition>} />
<Route path="analytics" element={<PageTransition><AdminAnalytics /></PageTransition>} />
<Route path="blog" element={<PageTransition><AdminBlog /></PageTransition>} />
<Route path="shipping" element={<PageTransition><AdminShipping /></PageTransition>} />
<Route path="reviews" element={<PageTransition><AdminReviews /></PageTransition>} />
<Route path="import" element={<PageTransition><AdminImport /></PageTransition>} />
<Route path="customers" element={<PageTransition><AdminCustomers /></PageTransition>} />
<Route path="staff" element={<PageTransition><AdminStaff /></PageTransition>} />
```

**Step 4: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors.

**Step 5: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/index.css frontend/src/components/PageTransition.tsx frontend/src/App.tsx
git commit -m "feat: add page transition fade+slide animation on route changes"
```

---

## Task 3: ToggleField component

**Files:**
- Create: `frontend/src/components/ToggleField.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/ToggleField.tsx

interface ToggleFieldProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export default function ToggleField({ label, description, checked, onChange, disabled = false }: ToggleFieldProps) {
  return (
    <label className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {/* Toggle pill */}
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors duration-200 ${
            checked ? 'bg-gray-900' : 'bg-gray-300'
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      {/* Text */}
      <div>
        <span className="text-sm text-gray-700 leading-5">{label}</span>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )
}
```

**Step 2: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors.

**Step 3: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/components/ToggleField.tsx
git commit -m "feat: add ToggleField component (pill toggle switch)"
```

---

## Task 4: SelectField component

**Files:**
- Create: `frontend/src/components/SelectField.tsx`

**Step 1: Write the component**

```tsx
// frontend/src/components/SelectField.tsx

interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  name?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  required?: boolean
  hint?: string
  className?: string
}

export default function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required,
  hint,
  className = '',
}: SelectFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 bg-white appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}
```

**Step 2: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors.

**Step 3: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/components/SelectField.tsx
git commit -m "feat: add SelectField component (labelled select wrapper)"
```

---

## Task 5: Apply skeleton to AdminDashboard

**Files:**
- Modify: `frontend/src/admin/pages/AdminDashboard.tsx`

**Step 1: Add import at top of file**

Find the existing imports and add:
```tsx
import { SkeletonStatCards } from '../../components/Skeleton'
```

**Step 2: Replace the loading text**

Find:
```tsx
if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
```

Replace with:
```tsx
if (isLoading) return (
  <div className="space-y-6">
    <div className="h-7 w-32 bg-gray-200 rounded animate-pulse" />
    <SkeletonStatCards count={4} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
      <div className="bg-white rounded-lg border border-gray-200 h-64 animate-pulse" />
    </div>
  </div>
)
```

**Step 3: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```

**Step 4: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/admin/pages/AdminDashboard.tsx
git commit -m "feat: skeleton loading state for admin dashboard"
```

---

## Task 6: Apply skeleton to AdminOrders

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrders.tsx`

**Step 1: Add import**
```tsx
import { SkeletonTable } from '../../components/Skeleton'
```

**Step 2: Replace loading state**

Find:
```tsx
{isLoading ? (
  <p className="text-sm text-gray-400">Loading...</p>
) : orders.length === 0 ? (
```

Replace with:
```tsx
{isLoading ? (
  <SkeletonTable rows={8} cols={7} />
) : orders.length === 0 ? (
```

**Step 3: Verify TypeScript, then commit**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
git add frontend/src/admin/pages/AdminOrders.tsx
git commit -m "feat: skeleton loading state for admin orders table"
```

---

## Task 7: Apply skeleton to AdminProducts, AdminCustomers, AdminDiscounts, AdminBlog, AdminReviews, AdminShipping

These six pages all follow the same pattern. For each one:

1. Add import: `import { SkeletonTable } from '../../components/Skeleton'`
2. Find `if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>` (or similar)
3. Replace with `if (isLoading) return <SkeletonTable rows={8} cols={5} />`

**Files to modify (do all 6 in one pass):**
- `frontend/src/admin/pages/AdminProducts.tsx`
- `frontend/src/admin/pages/AdminCustomers.tsx`
- `frontend/src/admin/pages/AdminDiscounts.tsx`
- `frontend/src/admin/pages/AdminBlog.tsx`
- `frontend/src/admin/pages/AdminReviews.tsx`
- `frontend/src/admin/pages/AdminShipping.tsx`

**Note:** Some pages may use different variable names (`isLoading` from `useQuery`). Read each file briefly before editing to find the exact loading check. The pattern is always the same: a conditional return at the top of the component function body that shows text while `isLoading` is true.

**Step 1: Edit all 6 files** (add import + replace loading text as above)

**Step 2: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors.

**Step 3: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/admin/pages/AdminProducts.tsx \
        frontend/src/admin/pages/AdminCustomers.tsx \
        frontend/src/admin/pages/AdminDiscounts.tsx \
        frontend/src/admin/pages/AdminBlog.tsx \
        frontend/src/admin/pages/AdminReviews.tsx \
        frontend/src/admin/pages/AdminShipping.tsx
git commit -m "feat: skeleton loading states for all admin table pages"
```

---

## Task 8: Apply skeleton to AdminSettings and AdminAnalytics

**Files:**
- Modify: `frontend/src/admin/pages/AdminSettings.tsx`
- Modify: `frontend/src/admin/pages/AdminAnalytics.tsx`

**AdminSettings:**

Add import:
```tsx
import { Skeleton } from '../../components/Skeleton'
```

Find:
```tsx
if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>
```

Replace with:
```tsx
if (isLoading) return (
  <div className="max-w-2xl space-y-6">
    <Skeleton className="h-7 w-24" />
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    ))}
  </div>
)
```

**AdminAnalytics:** Add the same `SkeletonTable` import and replace its loading state similarly.

**Step 1: Edit both files**

**Step 2: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/admin/pages/AdminSettings.tsx frontend/src/admin/pages/AdminAnalytics.tsx
git commit -m "feat: skeleton loading states for settings and analytics pages"
```

---

## Task 9: Apply ToggleField and SelectField to AdminSettings

**Files:**
- Modify: `frontend/src/admin/pages/AdminSettings.tsx`

**Step 1: Add imports**

Add to existing imports:
```tsx
import ToggleField from '../../components/ToggleField'
import SelectField from '../../components/SelectField'
```

**Step 2: Replace Currency `<input type="text">` with SelectField**

Find:
```tsx
<div>
  <label className="block text-xs text-gray-500 mb-1">Currency Code</label>
  <input
    value={form.currency}
    onChange={(e) => setForm({ ...form, currency: e.target.value })}
    placeholder="INR"
    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
  />
</div>
```

Replace with:
```tsx
<SelectField
  label="Currency"
  value={form.currency}
  onChange={(v) => setForm({ ...form, currency: v })}
  options={[
    { value: 'INR', label: 'INR — Indian Rupee (₹)' },
    { value: 'USD', label: 'USD — US Dollar ($)' },
    { value: 'EUR', label: 'EUR — Euro (€)' },
    { value: 'GBP', label: 'GBP — British Pound (£)' },
    { value: 'AED', label: 'AED — UAE Dirham (د.إ)' },
    { value: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
  ]}
/>
```

**Step 3: Replace COD checkbox with ToggleField**

Find:
```tsx
<label className="flex items-center gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={form.cod_enabled === 'true'}
    onChange={(e) => setForm({ ...form, cod_enabled: e.target.checked ? 'true' : 'false' })}
    className="w-4 h-4 rounded border-gray-300"
  />
  <span className="text-sm text-gray-700">Enable Cash on Delivery</span>
</label>
```

Replace with:
```tsx
<ToggleField
  label="Enable Cash on Delivery"
  description="Allow customers to pay on delivery at checkout."
  checked={form.cod_enabled === 'true'}
  onChange={(checked) => setForm({ ...form, cod_enabled: checked ? 'true' : 'false' })}
/>
```

**Step 4: Replace Announcement Bar enabled checkbox with ToggleField**

Find:
```tsx
<label className="flex items-center gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={form.announcement_bar_enabled === 'true'}
    onChange={(e) => setForm({ ...form, announcement_bar_enabled: e.target.checked ? 'true' : 'false' })}
    className="w-4 h-4 rounded border-gray-300"
  />
  <span className="text-sm text-gray-700">Enable Announcement Bar</span>
</label>
```

Replace with:
```tsx
<ToggleField
  label="Enable Announcement Bar"
  description="Show a banner at the top of your storefront."
  checked={form.announcement_bar_enabled === 'true'}
  onChange={(checked) => setForm({ ...form, announcement_bar_enabled: checked ? 'true' : 'false' })}
/>
```

**Step 5: Replace Email Notifications checkbox with ToggleField**

Find:
```tsx
<label className="flex items-center gap-3 cursor-pointer">
  <input
    type="checkbox"
    checked={form.admin_email_notifications === 'true'}
    onChange={(e) => setForm({ ...form, admin_email_notifications: e.target.checked ? 'true' : 'false' })}
    className="w-4 h-4 rounded border-gray-300"
  />
  <span className="text-sm text-gray-700">Send email to store email when a new order is placed</span>
</label>
```

Replace with:
```tsx
<ToggleField
  label="New order email notifications"
  description="Send an email to your store address each time a new order is placed."
  checked={form.admin_email_notifications === 'true'}
  onChange={(checked) => setForm({ ...form, admin_email_notifications: checked ? 'true' : 'false' })}
/>
```

**Step 6: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: No new errors.

**Step 7: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/admin/pages/AdminSettings.tsx
git commit -m "feat: replace checkboxes with ToggleField and currency input with SelectField in settings"
```

---

## Task 10: Skeleton loading on HomePage product grid

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`

**Step 1: Add import**
```tsx
import { SkeletonCards } from '../components/Skeleton'
```

**Step 2: Add a skeleton for when products are loading**

Find the section where `products` is used — currently it renders an empty grid when products haven't loaded. Find the `<ProductGrid>` call and add a loading check:

Find (after `const products = productsData?.products ?? []`):
```tsx
const { data: productsData } = useQuery<ProductsData>({
  queryKey: ['products', page],
  queryFn: () => fetch(`/api/products?page=${page}&limit=12`).then((r) => r.json()),
  staleTime: 60 * 1000,
})
```

Add `isLoading` to the destructure:
```tsx
const { data: productsData, isLoading: productsLoading } = useQuery<ProductsData>({
  queryKey: ['products', page],
  queryFn: () => fetch(`/api/products?page=${page}&limit=12`).then((r) => r.json()),
  staleTime: 60 * 1000,
})
```

**Step 3: Wrap ProductGrid with a loading check**

Find:
```tsx
<ProductGrid
  products={products}
  currency={currency}
  onAddToCart={...}
/>
```

Replace with:
```tsx
{productsLoading ? (
  <div className="max-w-6xl mx-auto px-4 py-8">
    <SkeletonCards count={8} />
  </div>
) : (
  <ProductGrid
    products={products}
    currency={currency}
    onAddToCart={(productId) => {
      const product = products.find((p) => p.id === productId)
      if (!product) return
      addItem({ product_id: product.id, name: product.name, price: product.price, quantity: 1, image_url: product.image_url })
    }}
  />
)}
```

**Step 4: Verify TypeScript**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
```

**Step 5: Commit**
```bash
cd /Users/sam/Documents/per/edgeshop
git add frontend/src/pages/HomePage.tsx
git commit -m "feat: skeleton loading for homepage product grid"
```

---

## Task 11: Improve CartDrawer easing in both themes

The cart drawers already have `transition-transform duration-300 ease-out`. The `ease-out` curve decelerates on entry but also on exit, which can feel abrupt when closing. Changing to `ease-in-out` makes both open and close feel smooth.

**Files:**
- Modify: `frontend/src/themes/jewellery/CartDrawer.tsx`
- Modify: `frontend/src/themes/artsCrafts/CartDrawer.tsx`

**In both files, find:**
```tsx
className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
```

**Replace `ease-out` with `ease-in-out`:**
```tsx
className={`fixed right-0 top-0 h-full w-full sm:w-96 z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
```

This is the only change to the CartDrawer files. Do not change any other class.

**Verify TypeScript, then commit:**
```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit 2>&1 | head -30
git add frontend/src/themes/jewellery/CartDrawer.tsx frontend/src/themes/artsCrafts/CartDrawer.tsx
git commit -m "fix: smoother cart drawer easing (ease-out → ease-in-out)"
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| No new dependencies | All animations use CSS keyframes + Tailwind classes |
| `ease-in-out` for cart | Feels symmetrically smooth on both open and close |
| `SkeletonCards` uses `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` | Matches existing product grid breakpoints |
| `ToggleField` uses `sr-only` checkbox | Accessible by default; keyboard + screen reader compatible |
| Currency stays as D1 string key | No backend changes needed; SelectField just restricts valid values |
| Admin routes also get PageTransition | Navigating between Products / Orders / Settings should also animate |
| `pageEnter` keyframe in index.css | No Tailwind config needed; works with Tailwind v4's CSS-first config |
