# Shop Page, Phone Country Code & Admin Product Edit — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/shop` all-items page, mandatory phone with country-code selector in checkout (defaulting to a store-wide country setting), and a per-section inline-edit admin page for products.

**Architecture:** All four tasks are frontend-only except Task 1 (migration) and Task 2 (worker allowed-list). The `countryCodes.ts` utility is shared between AdminSettings and CheckoutPage. ShopPage follows the exact same structure as `HomePage.tsx`. AdminProductEdit is a new nested admin route that reuses `adminFetch` and `PUT /api/admin/products/:id`.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Tailwind CSS v4, Hono (worker), Cloudflare D1.

**Design doc:** `docs/plans/2026-02-21-shop-phone-admin-edit-design.md`

---

## Task 1: D1 migration — seed `default_country_code`

**Files:**
- Create: `worker/migrations/0009_default_country.sql`

**Step 1:** Create the migration file

```sql
-- worker/migrations/0009_default_country.sql
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_country_code', '+91');
```

**Step 2:** Apply locally

```bash
cd /Users/sam/Documents/per/edgeshop/worker
npx wrangler d1 execute edgeshop-db --local --file=migrations/0009_default_country.sql
```

Expected output: `Executed SQL file successfully` (or similar wrangler confirmation).

**Step 3:** Commit

```bash
git add worker/migrations/0009_default_country.sql
git commit -m "feat: seed default_country_code setting (+91) in D1"
```

---

## Task 2: Worker — allow `default_country_code` in settings PUT

**Files:**
- Modify: `worker/src/routes/settings.ts` (line 32–49, the `allowed` array)

**Step 1:** Open `worker/src/routes/settings.ts`. Find the `allowed` array inside the `settings.put('/')` handler. Add `'default_country_code'` to it.

Current last entry is `'admin_email_notifications'`. Add after it:

```typescript
    // v2 email notification
    'admin_email_notifications',
    // store locale
    'default_country_code',
```

**Step 2:** Verify TypeScript compiles

```bash
cd /Users/sam/Documents/per/edgeshop/worker
npx tsc --noEmit
```

Expected: no errors.

**Step 3:** Commit

```bash
git add worker/src/routes/settings.ts
git commit -m "feat: allow default_country_code in settings PUT"
```

---

## Task 3: Shared utility — `countryCodes.ts`

This file is used by both AdminSettings (Task 4) and CheckoutPage (Task 5).

**Files:**
- Create: `frontend/src/utils/countryCodes.ts`

**Step 1:** Create the file with a full country list sorted by name

```typescript
// frontend/src/utils/countryCodes.ts

export interface CountryCode {
  name: string
  code: string // dial code, e.g. "+91"
}

// Full ISO 3166-1 list with ITU dial codes, sorted alphabetically by name
export const COUNTRY_CODES: CountryCode[] = [
  { name: 'Afghanistan', code: '+93' },
  { name: 'Albania', code: '+355' },
  { name: 'Algeria', code: '+213' },
  { name: 'Andorra', code: '+376' },
  { name: 'Angola', code: '+244' },
  { name: 'Antigua and Barbuda', code: '+1-268' },
  { name: 'Argentina', code: '+54' },
  { name: 'Armenia', code: '+374' },
  { name: 'Australia', code: '+61' },
  { name: 'Austria', code: '+43' },
  { name: 'Azerbaijan', code: '+994' },
  { name: 'Bahamas', code: '+1-242' },
  { name: 'Bahrain', code: '+973' },
  { name: 'Bangladesh', code: '+880' },
  { name: 'Barbados', code: '+1-246' },
  { name: 'Belarus', code: '+375' },
  { name: 'Belgium', code: '+32' },
  { name: 'Belize', code: '+501' },
  { name: 'Benin', code: '+229' },
  { name: 'Bhutan', code: '+975' },
  { name: 'Bolivia', code: '+591' },
  { name: 'Bosnia and Herzegovina', code: '+387' },
  { name: 'Botswana', code: '+267' },
  { name: 'Brazil', code: '+55' },
  { name: 'Brunei', code: '+673' },
  { name: 'Bulgaria', code: '+359' },
  { name: 'Burkina Faso', code: '+226' },
  { name: 'Burundi', code: '+257' },
  { name: 'Cambodia', code: '+855' },
  { name: 'Cameroon', code: '+237' },
  { name: 'Canada', code: '+1' },
  { name: 'Cape Verde', code: '+238' },
  { name: 'Central African Republic', code: '+236' },
  { name: 'Chad', code: '+235' },
  { name: 'Chile', code: '+56' },
  { name: 'China', code: '+86' },
  { name: 'Colombia', code: '+57' },
  { name: 'Comoros', code: '+269' },
  { name: 'Congo (Brazzaville)', code: '+242' },
  { name: 'Congo (Kinshasa)', code: '+243' },
  { name: 'Costa Rica', code: '+506' },
  { name: "Côte d'Ivoire", code: '+225' },
  { name: 'Croatia', code: '+385' },
  { name: 'Cuba', code: '+53' },
  { name: 'Cyprus', code: '+357' },
  { name: 'Czech Republic', code: '+420' },
  { name: 'Denmark', code: '+45' },
  { name: 'Djibouti', code: '+253' },
  { name: 'Dominica', code: '+1-767' },
  { name: 'Dominican Republic', code: '+1-809' },
  { name: 'Ecuador', code: '+593' },
  { name: 'Egypt', code: '+20' },
  { name: 'El Salvador', code: '+503' },
  { name: 'Equatorial Guinea', code: '+240' },
  { name: 'Eritrea', code: '+291' },
  { name: 'Estonia', code: '+372' },
  { name: 'Eswatini', code: '+268' },
  { name: 'Ethiopia', code: '+251' },
  { name: 'Fiji', code: '+679' },
  { name: 'Finland', code: '+358' },
  { name: 'France', code: '+33' },
  { name: 'Gabon', code: '+241' },
  { name: 'Gambia', code: '+220' },
  { name: 'Georgia', code: '+995' },
  { name: 'Germany', code: '+49' },
  { name: 'Ghana', code: '+233' },
  { name: 'Greece', code: '+30' },
  { name: 'Grenada', code: '+1-473' },
  { name: 'Guatemala', code: '+502' },
  { name: 'Guinea', code: '+224' },
  { name: 'Guinea-Bissau', code: '+245' },
  { name: 'Guyana', code: '+592' },
  { name: 'Haiti', code: '+509' },
  { name: 'Honduras', code: '+504' },
  { name: 'Hungary', code: '+36' },
  { name: 'Iceland', code: '+354' },
  { name: 'India', code: '+91' },
  { name: 'Indonesia', code: '+62' },
  { name: 'Iran', code: '+98' },
  { name: 'Iraq', code: '+964' },
  { name: 'Ireland', code: '+353' },
  { name: 'Israel', code: '+972' },
  { name: 'Italy', code: '+39' },
  { name: 'Jamaica', code: '+1-876' },
  { name: 'Japan', code: '+81' },
  { name: 'Jordan', code: '+962' },
  { name: 'Kazakhstan', code: '+7' },
  { name: 'Kenya', code: '+254' },
  { name: 'Kiribati', code: '+686' },
  { name: 'Kuwait', code: '+965' },
  { name: 'Kyrgyzstan', code: '+996' },
  { name: 'Laos', code: '+856' },
  { name: 'Latvia', code: '+371' },
  { name: 'Lebanon', code: '+961' },
  { name: 'Lesotho', code: '+266' },
  { name: 'Liberia', code: '+231' },
  { name: 'Libya', code: '+218' },
  { name: 'Liechtenstein', code: '+423' },
  { name: 'Lithuania', code: '+370' },
  { name: 'Luxembourg', code: '+352' },
  { name: 'Madagascar', code: '+261' },
  { name: 'Malawi', code: '+265' },
  { name: 'Malaysia', code: '+60' },
  { name: 'Maldives', code: '+960' },
  { name: 'Mali', code: '+223' },
  { name: 'Malta', code: '+356' },
  { name: 'Marshall Islands', code: '+692' },
  { name: 'Mauritania', code: '+222' },
  { name: 'Mauritius', code: '+230' },
  { name: 'Mexico', code: '+52' },
  { name: 'Micronesia', code: '+691' },
  { name: 'Moldova', code: '+373' },
  { name: 'Monaco', code: '+377' },
  { name: 'Mongolia', code: '+976' },
  { name: 'Montenegro', code: '+382' },
  { name: 'Morocco', code: '+212' },
  { name: 'Mozambique', code: '+258' },
  { name: 'Myanmar', code: '+95' },
  { name: 'Namibia', code: '+264' },
  { name: 'Nauru', code: '+674' },
  { name: 'Nepal', code: '+977' },
  { name: 'Netherlands', code: '+31' },
  { name: 'New Zealand', code: '+64' },
  { name: 'Nicaragua', code: '+505' },
  { name: 'Niger', code: '+227' },
  { name: 'Nigeria', code: '+234' },
  { name: 'North Korea', code: '+850' },
  { name: 'North Macedonia', code: '+389' },
  { name: 'Norway', code: '+47' },
  { name: 'Oman', code: '+968' },
  { name: 'Pakistan', code: '+92' },
  { name: 'Palau', code: '+680' },
  { name: 'Panama', code: '+507' },
  { name: 'Papua New Guinea', code: '+675' },
  { name: 'Paraguay', code: '+595' },
  { name: 'Peru', code: '+51' },
  { name: 'Philippines', code: '+63' },
  { name: 'Poland', code: '+48' },
  { name: 'Portugal', code: '+351' },
  { name: 'Qatar', code: '+974' },
  { name: 'Romania', code: '+40' },
  { name: 'Russia', code: '+7' },
  { name: 'Rwanda', code: '+250' },
  { name: 'Saint Kitts and Nevis', code: '+1-869' },
  { name: 'Saint Lucia', code: '+1-758' },
  { name: 'Saint Vincent and the Grenadines', code: '+1-784' },
  { name: 'Samoa', code: '+685' },
  { name: 'San Marino', code: '+378' },
  { name: 'São Tomé and Príncipe', code: '+239' },
  { name: 'Saudi Arabia', code: '+966' },
  { name: 'Senegal', code: '+221' },
  { name: 'Serbia', code: '+381' },
  { name: 'Seychelles', code: '+248' },
  { name: 'Sierra Leone', code: '+232' },
  { name: 'Singapore', code: '+65' },
  { name: 'Slovakia', code: '+421' },
  { name: 'Slovenia', code: '+386' },
  { name: 'Solomon Islands', code: '+677' },
  { name: 'Somalia', code: '+252' },
  { name: 'South Africa', code: '+27' },
  { name: 'South Korea', code: '+82' },
  { name: 'South Sudan', code: '+211' },
  { name: 'Spain', code: '+34' },
  { name: 'Sri Lanka', code: '+94' },
  { name: 'Sudan', code: '+249' },
  { name: 'Suriname', code: '+597' },
  { name: 'Sweden', code: '+46' },
  { name: 'Switzerland', code: '+41' },
  { name: 'Syria', code: '+963' },
  { name: 'Taiwan', code: '+886' },
  { name: 'Tajikistan', code: '+992' },
  { name: 'Tanzania', code: '+255' },
  { name: 'Thailand', code: '+66' },
  { name: 'Timor-Leste', code: '+670' },
  { name: 'Togo', code: '+228' },
  { name: 'Tonga', code: '+676' },
  { name: 'Trinidad and Tobago', code: '+1-868' },
  { name: 'Tunisia', code: '+216' },
  { name: 'Turkey', code: '+90' },
  { name: 'Turkmenistan', code: '+993' },
  { name: 'Tuvalu', code: '+688' },
  { name: 'Uganda', code: '+256' },
  { name: 'Ukraine', code: '+380' },
  { name: 'United Arab Emirates', code: '+971' },
  { name: 'United Kingdom', code: '+44' },
  { name: 'United States', code: '+1' },
  { name: 'Uruguay', code: '+598' },
  { name: 'Uzbekistan', code: '+998' },
  { name: 'Vanuatu', code: '+678' },
  { name: 'Vatican City', code: '+39' },
  { name: 'Venezuela', code: '+58' },
  { name: 'Vietnam', code: '+84' },
  { name: 'Yemen', code: '+967' },
  { name: 'Zambia', code: '+260' },
  { name: 'Zimbabwe', code: '+263' },
]
```

**Step 2:** No tests needed — pure static data. Just verify TypeScript compiles:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend
npx tsc --noEmit
```

Expected: no errors.

**Step 3:** Commit

```bash
git add frontend/src/utils/countryCodes.ts
git commit -m "feat: add countryCodes utility (full ITU dial code list)"
```

---

## Task 4: AdminSettings — Default Country dropdown

**Files:**
- Modify: `frontend/src/admin/pages/AdminSettings.tsx`

**Step 1:** Add `default_country_code` to the form state initial value (inside the `useState` call around line 23). Add it to the object:

```typescript
    default_country_code: '+91',
```

**Step 2:** Add the import at the top of the file (after existing imports):

```typescript
import { COUNTRY_CODES } from '../../utils/countryCodes'
```

**Step 3:** Inside the Store Information card (`<div className="bg-white ...">` that contains Store Name and Currency Code), add a new row below the existing `grid grid-cols-1 sm:grid-cols-2` div. Place this after that grid div and before the COD checkbox:

```tsx
            <div>
              <label className="block text-xs text-gray-500 mb-1">Default Country (phone dial code)</label>
              <select
                value={form.default_country_code}
                onChange={(e) => setForm({ ...form, default_country_code: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code + c.name} value={c.code}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Pre-selected dial code on the checkout phone field.</p>
            </div>
```

**Step 4:** Verify TypeScript compiles and no visual regressions:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend
npx tsc --noEmit
```

Expected: no errors.

**Step 5:** Commit

```bash
git add frontend/src/admin/pages/AdminSettings.tsx
git commit -m "feat: default country dial code selector in admin settings"
```

---

## Task 5: CheckoutPage — mandatory phone + country code selector

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx`

**Step 1:** Add `COUNTRY_CODES` import after existing imports:

```typescript
import { COUNTRY_CODES } from '../utils/countryCodes'
```

**Step 2:** Add `country_code` to the `form` state (the `useState` around line 37). The new field goes alongside the existing phone field:

```typescript
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    country_code: '+91',           // <-- add this line
    shipping_address: '',
    shipping_city: '',
    shipping_state: '',
    shipping_pincode: '',
    shipping_country: 'India',
  })
```

**Step 3:** After the settings query (around line 60), add a `useEffect` that initialises `country_code` from settings once loaded. Add it after the existing currency/codEnabled lines, before the `useEffect` for shipping:

```typescript
  useEffect(() => {
    if (settings?.default_country_code) {
      setForm(f => ({ ...f, country_code: settings.default_country_code! }))
    }
  }, [settings?.default_country_code])
```

**Step 4:** Find the Phone field block (currently around line 268–272). Replace the entire `<div>` containing the Phone label and input with a two-column layout:

**Replace this:**
```tsx
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input type="tel" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
              </div>
```

**With this:**
```tsx
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone *</label>
                <div className="flex gap-2">
                  <select
                    value={form.country_code}
                    onChange={(e) => setForm({ ...form, country_code: e.target.value })}
                    className="border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:border-gray-500 w-28 shrink-0"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code + c.name} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="tel"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    placeholder="98765 43210"
                    className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                  />
                </div>
              </div>
```

**Step 5:** Update the `handleSubmit` function. Inside the `fetch('/api/checkout', ...)` body JSON, change `...form` to spread form with the phone concatenated. Find the `body: JSON.stringify({` block and replace the `...form` spread:

**Replace:**
```typescript
        body: JSON.stringify({
          ...form,
          payment_method: paymentMethod,
```

**With:**
```typescript
        body: JSON.stringify({
          ...form,
          customer_phone: form.country_code + form.customer_phone,
          payment_method: paymentMethod,
```

**Step 6:** Also update the Razorpay modal prefill to use the combined number (around line 185–190). Find the `prefill:` block:

**Replace:**
```typescript
        prefill: {
          name: form.customer_name,
          email: form.customer_email,
          contact: form.customer_phone,
        },
```

**With:**
```typescript
        prefill: {
          name: form.customer_name,
          email: form.customer_email,
          contact: form.country_code + form.customer_phone,
        },
```

**Step 7:** Verify TypeScript compiles:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend
npx tsc --noEmit
```

Expected: no errors.

**Step 8:** Commit

```bash
git add frontend/src/pages/CheckoutPage.tsx
git commit -m "feat: mandatory phone with country dial code selector in checkout"
```

---

## Task 6: ShopPage — all-items storefront page

**Files:**
- Create: `frontend/src/pages/ShopPage.tsx`

**Step 1:** Create the file. It follows the exact same structure as `HomePage.tsx` but adds category filter chips and a sort dropdown. The API supports `?category=X` natively; sort is done client-side.

```tsx
// frontend/src/pages/ShopPage.tsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

interface Product {
  id: number
  name: string
  price: number
  compare_price?: number | null
  image_url: string
  images?: string[]
  stock_count: number
  category: string
}

interface ProductsData {
  products: Product[]
  total: number
  page: number
  limit: number
  pages: number
}

type SortKey = 'newest' | 'price_asc' | 'price_desc'

export default function ShopPage() {
  const { theme, isLoading: themeLoading, navItems, footerData, settings } = useTheme()
  const cartOpen = useCartStore((s) => s.isCartOpen)
  const openCart = useCartStore((s) => s.openCart)
  const closeCart = useCartStore((s) => s.closeCart)
  const addItem = useCartStore((s) => s.addItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const items = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems)
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [sort, setSort] = useState<SortKey>('newest')

  const storeName = settings.store_name ?? 'EdgeShop'
  const currency = settings.currency === 'INR' ? '₹' : (settings.currency ?? '₹')

  // Fetch all products for category chips (limit=48, page=1, no category filter)
  const { data: allProductsData } = useQuery<ProductsData>({
    queryKey: ['products-all-categories'],
    queryFn: () => fetch('/api/products?limit=48').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  // Fetch filtered + paginated products
  const { data: productsData, isLoading: productsLoading } = useQuery<ProductsData>({
    queryKey: ['shop-products', page, selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '48' })
      if (selectedCategory) params.set('category', selectedCategory)
      return fetch(`/api/products?${params}`).then((r) => r.json())
    },
    staleTime: 60 * 1000,
  })

  // Derive unique category list from the first page fetch
  const categories = useMemo<string[]>(() => {
    const all = allProductsData?.products ?? []
    const unique = Array.from(new Set(all.map((p) => p.category).filter(Boolean)))
    return unique.sort()
  }, [allProductsData])

  // Client-side sort of current page
  const products = useMemo<Product[]>(() => {
    const list = [...(productsData?.products ?? [])]
    if (sort === 'price_asc') list.sort((a, b) => a.price - b.price)
    if (sort === 'price_desc') list.sort((a, b) => b.price - a.price)
    // 'newest' is the default API order (created_at DESC) — no sort needed
    return list
  }, [productsData, sort])

  function handleCategoryClick(cat: string) {
    setSelectedCategory(cat)
    setPage(1)
  }

  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const { Header, Footer, ProductGrid, CartDrawer } = theme.components

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={openCart}
        navItems={navItems}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page title */}
        <h1
          className="text-2xl font-semibold mb-6"
          style={{ color: 'var(--color-primary)' }}
        >
          All Products
          {productsData && (
            <span className="ml-3 text-sm font-normal opacity-50">
              ({productsData.total})
            </span>
          )}
        </h1>

        {/* Filter + sort bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2 flex-1">
              <button
                onClick={() => handleCategoryClick('')}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  selectedCategory === ''
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-bg)]'
                    : 'border-[var(--color-accent)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    selectedCategory === cat
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-bg)]'
                      : 'border-[var(--color-accent)] text-[var(--color-primary)] hover:border-[var(--color-primary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-xs border rounded px-2 py-1.5 focus:outline-none shrink-0"
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)', backgroundColor: 'var(--color-bg)' }}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
          </select>
        </div>

        {/* Product grid */}
        {productsLoading ? (
          <p className="text-sm opacity-50 py-16 text-center" style={{ color: 'var(--color-primary)' }}>
            Loading products…
          </p>
        ) : products.length === 0 ? (
          <p className="text-sm opacity-50 py-16 text-center" style={{ color: 'var(--color-primary)' }}>
            No products found.
          </p>
        ) : (
          <ProductGrid
            products={products}
            currency={currency}
            onAddToCart={(productId) => {
              const product = products.find((p) => p.id === productId)
              if (!product) return
              addItem({
                product_id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                image_url: product.image_url,
              })
            }}
          />
        )}

        {/* Pagination */}
        {productsData && productsData.pages > 1 && (
          <div className="flex items-center justify-center gap-4 py-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm border rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
            >
              ← Prev
            </button>
            <span className="text-sm opacity-50" style={{ color: 'var(--color-primary)' }}>
              Page {page} of {productsData.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(productsData.pages, p + 1))}
              disabled={page === productsData.pages}
              className="px-4 py-2 text-sm border rounded hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-accent)', color: 'var(--color-primary)' }}
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <Footer storeName={storeName} footerData={footerData} />
      <CartDrawer
        isOpen={cartOpen}
        items={items}
        currency={currency}
        onClose={closeCart}
        onUpdateQuantity={updateQuantity}
        onCheckout={() => { closeCart(); navigate('/checkout') }}
      />
    </div>
  )
}
```

**Step 2:** Verify TypeScript compiles:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend
npx tsc --noEmit
```

Expected: no errors.

**Step 3:** Commit

```bash
git add frontend/src/pages/ShopPage.tsx
git commit -m "feat: /shop all-items page with category filter and sort"
```

---

## Task 7: App.tsx — add `/shop` route + `/admin/products/:id` route

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1:** Add the ShopPage import near the other page imports (after `CollectionPage` import around line 36):

```typescript
import ShopPage from './pages/ShopPage'
```

**Step 2:** Add the AdminProductEdit import near the other admin page imports:

```typescript
import AdminProductEdit from './admin/pages/AdminProductEdit'
```

**Step 3:** Add the `/shop` route in the public Routes block (after the `/search` route, around line 63):

```tsx
            <Route path="/shop" element={<ShopPage />} />
```

**Step 4:** Add the `/admin/products/:id` route inside the `/admin` route block, after the existing `products` route (around line 71):

```tsx
              <Route path="products/:id" element={<AdminProductEdit />} />
```

**Step 5:** Verify TypeScript compiles (AdminProductEdit doesn't exist yet — this step will fail until Task 8 is done. Skip the compile check until after Task 8):

```bash
cd /Users/sam/Documents/per/edgeshop/frontend
npx tsc --noEmit
```

**Step 6:** Commit (even though AdminProductEdit is pending — TypeScript import will fail; commit only App.tsx after Task 8 is done instead. Combine this commit with Task 8 commit.)

---

## Task 8: AdminNavigation — update "All Products" quick-link to `/shop`

**Files:**
- Modify: `frontend/src/admin/pages/AdminNavigation.tsx`

**Step 1:** Find the quick-fill links array inside the `{itemType === 'link' && (` block (around line 202). It currently has:

```typescript
                    { label: 'All Products', href: '/search' },
```

Replace that entry with:

```typescript
                    { label: 'Shop', href: '/shop' },
```

**Step 2:** Commit (combine with App.tsx from Task 7):

```bash
git add frontend/src/App.tsx frontend/src/admin/pages/AdminNavigation.tsx
git commit -m "feat: add /shop route and update admin nav quick-link"
```

---

## Task 9: AdminProductEdit — per-section inline edit admin page

**Files:**
- Create: `frontend/src/admin/pages/AdminProductEdit.tsx`

**Step 1:** Create the file:

```tsx
// frontend/src/admin/pages/AdminProductEdit.tsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'

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
}

// Generic section editor — controls edit/save/cancel for one section
function useSection<T extends Record<string, unknown>>(initial: T) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<T>(initial)

  function startEdit(current: T) {
    setDraft(current)
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
  }

  return { editing, draft, setDraft, startEdit, cancel }
}

export default function AdminProductEdit() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () =>
      fetch(`/api/products/${id}`).then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      }),
    enabled: !!id,
  })

  // One useMutation shared — called with different field subsets per section
  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Product>) =>
      adminFetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json() as { error?: string }
          throw new Error(err.error ?? 'Update failed')
        }
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product', id] })
      showToast('Saved', 'success')
    },
    onError: (err: Error) => {
      showToast(err.message, 'error')
    },
  })

  // Section state — basic info
  const basicInfo = useSection({ name: '', description: '' })
  // Section state — pricing
  const pricing = useSection({ price: 0, compare_price: null as number | null })
  // Section state — stock + category
  const stock = useSection({ stock_count: 0, category: '' })

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>
  if (error || !product) return <p className="text-sm text-red-500">Product not found.</p>

  const saving = updateMutation.isPending

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/admin/products" className="text-xs text-gray-400 hover:text-gray-700 mb-1 inline-block">
            ← Back to Products
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
        </div>
        <a
          href={`/product/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-3 py-1.5 mt-5"
        >
          View on storefront ↗
        </a>
      </div>

      {/* Section: Basic Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Basic Info</h2>
          {!basicInfo.editing && (
            <button
              onClick={() => basicInfo.startEdit({ name: product.name, description: product.description })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {basicInfo.editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                value={basicInfo.draft.name}
                onChange={(e) => basicInfo.setDraft({ ...basicInfo.draft, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                rows={4}
                value={basicInfo.draft.description}
                onChange={(e) => basicInfo.setDraft({ ...basicInfo.draft, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-y"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!basicInfo.draft.name.trim()) return
                  updateMutation.mutate({ name: basicInfo.draft.name, description: basicInfo.draft.description }, {
                    onSuccess: () => basicInfo.cancel(),
                  })
                }}
                disabled={saving || !basicInfo.draft.name.trim()}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={basicInfo.cancel}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{product.name}</p>
            <p className="text-sm text-gray-500 whitespace-pre-wrap">{product.description || <span className="italic opacity-40">No description</span>}</p>
          </div>
        )}
      </div>

      {/* Section: Pricing */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-800">Pricing</h2>
          {!pricing.editing && (
            <button
              onClick={() => pricing.startEdit({ price: product.price, compare_price: product.compare_price })}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:border-gray-500 text-gray-600 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {pricing.editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricing.draft.price}
                  onChange={(e) => pricing.setDraft({ ...pricing.draft, price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Compare-at Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricing.draft.compare_price ?? ''}
                  onChange={(e) => pricing.setDraft({ ...pricing.draft, compare_price: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Optional"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateMutation.mutate({ price: pricing.draft.price, compare_price: pricing.draft.compare_price }, {
                    onSuccess: () => pricing.cancel(),
                  })
                }}
                disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={pricing.cancel} disabled={saving}
                className="px-4 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-4 text-sm">
            <span className="font-semibold text-gray-900">{product.price.toFixed(2)}</span>
            {product.compare_price && (
              <span className="line-through text-gray-400">{product.compare_price.toFixed(2)}</span>
            )}
          </div>
        )}
      </div>

      {/* Section: Stock & Category */}
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
                  updateMutation.mutate({ stock_count: stock.draft.stock_count, category: stock.draft.category }, {
                    onSuccess: () => stock.cancel(),
                  })
                }}
                disabled={saving}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={stock.cancel} disabled={saving}
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
    </div>
  )
}
```

**Step 2:** Verify TypeScript compiles:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend
npx tsc --noEmit
```

Expected: no errors.

**Step 3:** Add an "Edit" link button to `AdminProducts.tsx` so the admin can navigate to this page. Find where product rows are rendered in `AdminProducts.tsx` and add a link alongside existing action buttons. This is an optional quality-of-life step — search for the product table row actions (look for "Delete" or "Edit" buttons per product row) and add a `<Link to={`/admin/products/${product.id}`}>Detail</Link>` button.

**Step 4:** Commit

```bash
git add frontend/src/admin/pages/AdminProductEdit.tsx frontend/src/admin/pages/AdminProducts.tsx
git commit -m "feat: admin product edit page with per-section inline editing"
```

---

## Task 10: Final compile + smoke test

**Step 1:** Full TypeScript compile:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx tsc --noEmit
cd /Users/sam/Documents/per/edgeshop/worker && npx tsc --noEmit
```

Expected: no errors in either.

**Step 2:** Run existing frontend tests:

```bash
cd /Users/sam/Documents/per/edgeshop/frontend && npx vitest run
```

Expected: all pass (new files have no new tests, existing tests unaffected).

**Step 3:** Apply migration to local dev D1 if not already done:

```bash
cd /Users/sam/Documents/per/edgeshop/worker
npx wrangler d1 execute edgeshop-db --local --file=migrations/0009_default_country.sql
```

**Step 4:** Final commit (if any outstanding files):

```bash
git add -p
git commit -m "chore: finalize shop/phone/admin-edit feature"
```

---

## Key Decisions Log

| Decision | Rationale |
|---|---|
| `useSection` custom hook for edit state | Each section needs its own `editing + draft` state; a small helper avoids repeating 3×`useState` per section |
| ShopPage fetches categories from first-page load (no separate API) | No `/api/categories` endpoint exists; first 48 products cover categories for small stores |
| Sort done client-side on current page | Public products API has no sort param; client-side sort is correct for one page of results |
| Phone combined at submit time (not on change) | `country_code` state stays separate until the actual API call; Razorpay prefill gets same combined value |
| `default_country_code` stored as dial string (e.g. `+91`) | No mapping needed at runtime — value used directly in the `<select value=...>` |
| AdminProductEdit uses public `/api/products/:id` for reading | Same data as storefront; no admin-only read endpoint needed |
| App.tsx commit deferred to after AdminProductEdit exists | Avoids a broken TypeScript build state in a commit |
