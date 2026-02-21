# Stock Validation & Import Image Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce stock limits at cart, checkout, and backend; add R2 image upload option to the CSV importer.

**Architecture:** CartItem gets an optional `stock_count` field that caps quantity at add time. CheckoutPage validates client-side before submission and surfaces backend stock errors clearly. Backend runs a batch stock query before creating any order. A new `POST /api/admin/upload/from-url` Worker endpoint fetches an external image URL and uploads it to R2; AdminImport gets a radio to choose keep-URLs vs upload-to-R2.

**Tech Stack:** React 18, Zustand (persist), TanStack Query v5, Hono v4, Cloudflare D1, Cloudflare R2, TypeScript

---

### Task 1: Backend stock check before order creation

**Files:**
- Modify: `worker/src/routes/checkout.ts`

This adds a `validateStock()` helper called before both the COD INSERT and the Razorpay order API call. If any item has insufficient stock it returns `400 { error: 'stock_error', items: [...] }` immediately.

**Step 1: Add the validateStock helper and wire it up**

Open `worker/src/routes/checkout.ts`. The file currently has no stock check.

Add this helper function after the `getCustomerIdFromHeader` function (around line 28, before `checkout.post`):

```typescript
async function validateStock(
  db: D1Database,
  items: OrderItem[]
): Promise<Array<{ id: number; name: string; available: number }> | null> {
  if (!items.length) return null
  const ids = items.map(i => i.product_id)
  const placeholders = ids.map(() => '?').join(', ')
  const { results } = await db.prepare(
    `SELECT id, name, stock_count FROM products WHERE id IN (${placeholders})`
  ).bind(...ids).all<{ id: number; name: string; stock_count: number }>()

  const stockMap = new Map(results.map(r => [r.id, r]))
  const insufficient: Array<{ id: number; name: string; available: number }> = []

  for (const item of items) {
    const product = stockMap.get(item.product_id)
    if (product && item.quantity > product.stock_count) {
      insufficient.push({ id: product.id, name: product.name, available: product.stock_count })
    }
  }
  return insufficient.length > 0 ? insufficient : null
}
```

**Step 2: Call validateStock for COD flow**

Find the line `if (body.payment_method === 'cod') {` (around line 57). Immediately after that opening brace (before the INSERT statement), insert:

```typescript
  // Stock check — must happen before INSERT
  const stockIssues = await validateStock(c.env.DB, body.items)
  if (stockIssues) {
    return c.json({ error: 'stock_error', items: stockIssues }, 400)
  }
```

**Step 3: Call validateStock for Razorpay flow**

Find the Razorpay section (around line 191, `// Razorpay flow`). After the `razorpay_key_id`/`razorpay_key_secret` config check (after line 199 `return c.json({ error: 'Razorpay not configured' }, 503)`), insert:

```typescript
  // Stock check before creating Razorpay order
  const rzpStockIssues = await validateStock(c.env.DB, body.items)
  if (rzpStockIssues) {
    return c.json({ error: 'stock_error', items: rzpStockIssues }, 400)
  }
```

**Step 4: Verify the file compiles**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p worker/tsconfig.json 2>&1 | head -30`
Expected: no errors

**Step 5: Commit**

```bash
git add worker/src/routes/checkout.ts
git commit -m "feat: validate stock before order creation"
```

---

### Task 2: Add stock_count to CartItem type

**Files:**
- Modify: `frontend/src/themes/types.ts` (around line 73)

**Step 1: Add the field**

The `CartItem` interface currently is:

```typescript
export interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
}
```

Change it to:

```typescript
export interface CartItem {
  product_id: number
  name: string
  price: number
  quantity: number
  image_url: string
  stock_count?: number
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30`
Expected: no errors (the field is optional so all existing callers are fine)

**Step 3: Commit**

```bash
git add frontend/src/themes/types.ts
git commit -m "feat: add optional stock_count to CartItem type"
```

---

### Task 3: Cart store — enforce stock cap in addItem and updateQuantity

**Files:**
- Modify: `frontend/src/store/cartStore.ts`

The store currently accumulates quantity with no upper bound.

**Step 1: Update addItem**

Find the `addItem` implementation (around line 25). Replace:

```typescript
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === item.product_id)
          return {
            isCartOpen: true,
            items: existing
              ? state.items.map((i) =>
                  i.product_id === item.product_id
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i
                )
              : [...state.items, item],
          }
        }),
```

With:

```typescript
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === item.product_id)
          const maxQty = item.stock_count ?? Infinity
          return {
            isCartOpen: true,
            items: existing
              ? state.items.map((i) =>
                  i.product_id === item.product_id
                    ? {
                        ...i,
                        quantity: Math.min(i.quantity + item.quantity, maxQty),
                        stock_count: item.stock_count ?? i.stock_count,
                      }
                    : i
                )
              : [...state.items, { ...item, quantity: Math.min(item.quantity, maxQty) }],
          }
        }),
```

**Step 2: Update updateQuantity to respect stored stock_count**

Find the `updateQuantity` implementation (around line 39). Replace:

```typescript
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.product_id !== productId)
              : state.items.map((i) =>
                  i.product_id === productId ? { ...i, quantity } : i
                ),
        })),
```

With:

```typescript
      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.product_id !== productId)
              : state.items.map((i) =>
                  i.product_id === productId
                    ? { ...i, quantity: Math.min(quantity, i.stock_count ?? Infinity) }
                    : i
                ),
        })),
```

**Step 3: Verify**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30`
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/store/cartStore.ts
git commit -m "feat: cap cart quantity at stock_count in addItem and updateQuantity"
```

---

### Task 4: ProductPage — pass stock_count to addItem

**Files:**
- Modify: `frontend/src/pages/ProductPage.tsx` (around line 211)

**Step 1: Update handleAddToCart**

Find the `handleAddToCart` function (around line 211):

```typescript
  function handleAddToCart() {
    if (!product) return
    addItem({
      product_id: product.id,
      name: product.name,
      price: displayPrice,
      quantity: qty,
      image_url: displayImage,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }
```

Replace with:

```typescript
  function handleAddToCart() {
    if (!product) return
    addItem({
      product_id: product.id,
      name: product.name,
      price: displayPrice,
      quantity: qty,
      image_url: displayImage,
      stock_count: displayStock,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }
```

Note: `displayStock` is already computed at line 158 as `selectedVariant ? selectedVariant.stock_count : (product?.stock_count ?? 0)`.

**Step 2: Check the related quick-add at line 565**

There is a second `addItem` call in ProductPage around line 565 (related products quick-add). Find it and also add `stock_count`:

```typescript
onAddToCart={() => addItem({
  product_id: relProduct.id,
  name: relProduct.name,
  price: relProduct.price,
  quantity: 1,
  image_url: relProduct.image_url,
  stock_count: relProduct.stock_count,
})}
```

Check that the related product type has `stock_count` available at that point. If it doesn't (e.g., the related products API doesn't return stock), omit `stock_count` from that second call.

**Step 3: Verify**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30`
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/pages/ProductPage.tsx
git commit -m "feat: pass stock_count to cart when adding from product page"
```

---

### Task 5: CheckoutPage — client stock check + server stock_error handling

**Files:**
- Modify: `frontend/src/pages/CheckoutPage.tsx`

**Step 1: Add stockErrors state**

Find the existing state declarations (around line 60-68). Add after the `error` state:

```typescript
  const [stockErrors, setStockErrors] = useState<string[]>([])
```

**Step 2: Add client-side stock check in handleSubmit**

In `handleSubmit` (around line 162), after `setSubmitting(true)` and before the `try {` block, add:

```typescript
    // Client-side stock check
    const clientStockErrors = items
      .filter(item => item.stock_count !== undefined && item.quantity > item.stock_count)
      .map(item => `Only ${item.stock_count} available for "${item.name}"`)
    if (clientStockErrors.length > 0) {
      setStockErrors(clientStockErrors)
      setSubmitting(false)
      return
    }
    setStockErrors([])
```

**Step 3: Handle stock_error from server**

In the `if (!res.ok)` block (around line 187), change:

```typescript
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Checkout failed')
      }
```

To:

```typescript
      if (!res.ok) {
        const data = await res.json() as {
          error?: string
          items?: Array<{ id: number; name: string; available: number }>
        }
        if (data.error === 'stock_error' && data.items?.length) {
          setStockErrors(data.items.map(i => `Only ${i.available} available for "${i.name}"`))
          setSubmitting(false)
          return
        }
        throw new Error(data.error ?? 'Checkout failed')
      }
```

**Step 4: Render stockErrors in the JSX**

Find where `{error && <p ...>{error}</p>}` is rendered (line 408). Add the stockErrors list just before it:

```tsx
          {stockErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded px-4 py-3">
              <p className="text-sm font-medium text-red-700 mb-1">Some items are unavailable:</p>
              <ul className="text-sm text-red-600 list-disc list-inside space-y-0.5">
                {stockErrors.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded">{error}</p>}
```

**Step 5: Verify**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30`
Expected: no errors

**Step 6: Commit**

```bash
git add frontend/src/pages/CheckoutPage.tsx
git commit -m "feat: stock validation on checkout (client-side check + server error handling)"
```

---

### Task 6: Backend — upload image from URL to R2

**Files:**
- Modify: `worker/src/routes/admin/upload.ts`

This adds a new `POST /put-from-url` endpoint. The Worker fetches the external image URL, uploads to R2, and returns the R2 public URL.

**Step 1: Add the endpoint**

Open `worker/src/routes/admin/upload.ts`. After the existing `upload.put('/put', ...)` handler (around line 27, before `export default upload`), add:

```typescript
// Step 3 (alternative): Worker fetches an external URL and uploads to R2
upload.post('/put-from-url', async (c) => {
  const { url } = await c.req.json<{ url: string }>()
  if (!url || !url.startsWith('http')) {
    return c.json({ error: 'Invalid URL' }, 400)
  }

  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return c.json({ error: 'Failed to fetch image' }, 400)
  }
  if (!res.ok) {
    return c.json({ error: `Remote returned ${res.status}` }, 400)
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  }
  const urlExt = url.split('?')[0].split('.').pop()?.toLowerCase()
  const ext = extMap[contentType.split(';')[0].trim()] ?? (urlExt && extMap[`image/${urlExt}`] ? urlExt : 'jpg')

  const key = `products/${crypto.randomUUID()}.${ext}`
  await c.env.BUCKET.put(key, res.body!, {
    httpMetadata: { contentType: contentType.split(';')[0].trim() },
  })

  return c.json({ url: `${c.env.R2_PUBLIC_URL}/${key}` })
})
```

**Step 2: Verify the Worker route is already protected by requireAdmin**

Check `worker/src/index.ts` — the upload routes are mounted at `/api/admin/upload` which is under the `requireAdmin` middleware glob. Confirm that `app.use('/api/admin/*', requireAdmin)` (or equivalent) appears before the upload route registration.

If the admin middleware covers `/api/admin/*`, no changes needed.

**Step 3: Verify TypeScript**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p worker/tsconfig.json 2>&1 | head -30`
Expected: no errors

**Step 4: Commit**

```bash
git add worker/src/routes/admin/upload.ts
git commit -m "feat: add upload/put-from-url endpoint for importing images to R2"
```

---

### Task 7: AdminImport — image handling option and R2 upload loop

**Files:**
- Modify: `frontend/src/admin/pages/AdminImport.tsx`

**Step 1: Add imageHandling state**

Find the state declarations near line 377-383:

```typescript
  const [step, setStep] = useState<ImportStep>('upload')
  const [platform, setPlatform] = useState<Platform>('generic')
  const [products, setProducts] = useState<ImportedProduct[]>([])
  const [progress, setProgress] = useState({ done: 0, errors: 0, total: 0 })
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
```

Add after `const inputRef = useRef<HTMLInputElement>(null)`:

```typescript
  const [imageHandling, setImageHandling] = useState<'keep' | 'r2'>('keep')
  const [imageUploadProgress, setImageUploadProgress] = useState('')
```

**Step 2: Modify importProducts to support R2 upload**

Find the `importProducts` function signature (around line 305):

```typescript
async function importProducts(
  products: ImportedProduct[],
  onProgress: (done: number, errors: number) => void
): Promise<{ imported: number; failed: number }> {
```

Change to:

```typescript
async function importProducts(
  products: ImportedProduct[],
  onProgress: (done: number, errors: number) => void,
  imageHandling: 'keep' | 'r2' = 'keep',
  onImageProgress?: (msg: string) => void
): Promise<{ imported: number; failed: number }> {
```

Then inside the `for (const p of products)` loop (around line 319), just before the `adminFetch('/api/admin/products', ...)` call, add:

```typescript
      // Upload image to R2 if requested
      if (imageHandling === 'r2' && p.image_url) {
        try {
          onImageProgress?.(`Uploading image for "${p.name}"…`)
          const imgRes = await adminFetch('/api/admin/upload/put-from-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: p.image_url }),
          })
          if (imgRes.ok) {
            const { url } = await imgRes.json() as { url: string }
            p.image_url = url
          }
          // On failure: silently keep original URL (don't abort the product import)
        } catch {
          // Keep original URL
        }
      }
```

**Step 3: Update startImport to pass imageHandling**

Find `startImport` (around line 409):

```typescript
  async function startImport() {
    setProgress({ done: 0, errors: 0, total: products.length })
    setStep('importing')
    try {
      const res = await importProducts(products, (done, errors) => {
        setProgress({ done, errors, total: products.length })
      })
```

Change the `importProducts` call to:

```typescript
      const res = await importProducts(
        products,
        (done, errors) => {
          setProgress({ done, errors, total: products.length })
        },
        imageHandling,
        (msg) => setImageUploadProgress(msg)
      )
```

Also reset `imageUploadProgress` after done:

```typescript
      setResult(res)
      setStep('done')
      setImageUploadProgress('')
```

**Step 4: Add image handling radio in the preview step UI**

Find the preview step JSX (around line 480, `{step === 'preview' && (`). Inside the card, after the preview table (`</div>` for the table wrapper, before the `<div className="flex gap-3">` action buttons), add the radio group:

```tsx
            {/* Image handling option */}
            <div className="border border-gray-100 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-gray-700 mb-3">Image handling</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageHandling"
                    value="keep"
                    checked={imageHandling === 'keep'}
                    onChange={() => setImageHandling('keep')}
                    className="text-gray-900"
                  />
                  <span className="text-sm text-gray-700">Keep original image URLs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="imageHandling"
                    value="r2"
                    checked={imageHandling === 'r2'}
                    onChange={() => setImageHandling('r2')}
                    className="text-gray-900"
                  />
                  <span className="text-sm text-gray-700">Upload images to Cloudflare R2</span>
                  <span className="text-xs text-gray-400">(slower, but images are hosted on your store)</span>
                </label>
              </div>
            </div>
```

**Step 5: Show image upload progress during import**

Find the importing progress step JSX (around line 547, `{step === 'importing' && (`). Below the progress bar count line, add:

```tsx
          {imageUploadProgress && (
            <p className="text-xs text-gray-400 mt-1">{imageUploadProgress}</p>
          )}
```

**Step 6: Reset imageHandling when starting over**

Find the "Choose different file" button onClick (around line 529):

```typescript
onClick={() => { setStep('upload'); setProducts([]) }}
```

Change to:

```typescript
onClick={() => { setStep('upload'); setProducts([]); setImageHandling('keep') }}
```

Also in the "Import another file" button (around line 578):

```typescript
onClick={() => { setStep('upload'); setProducts([]); setResult(null) }}
```

Change to:

```typescript
onClick={() => { setStep('upload'); setProducts([]); setResult(null); setImageHandling('keep') }}
```

**Step 7: Verify**

Run: `cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json 2>&1 | head -30`
Expected: no errors

**Step 8: Commit**

```bash
git add frontend/src/admin/pages/AdminImport.tsx
git commit -m "feat: add R2 image upload option to product CSV importer"
```

---

## Manual Testing Checklist

### Stock Validation
1. Go to a product page with stock > 1. Set qty to max, click Add to Cart — quantity in cart should not exceed stock
2. Manually try to increment past stock in cart drawer — increment button should stop at stock count
3. In checkout with items that have `stock_count` set, confirm the order goes through (no false positives)
4. Simulate out-of-stock: set a product's stock to 0 in admin, try to add to cart — cart should show quantity: 0 (or prevent adding)
5. Use DevTools to set `item.stock_count` to 1 and `item.quantity` to 2 in localStorage; reload checkout — should show stock error before submit

### Import Images
1. Import a Shopify CSV with image URLs, select "Keep original URLs" — products created with original URLs
2. Import same file with "Upload to Cloudflare R2" — products created with R2 URLs (e.g. `https://...r2.dev/products/...`)
3. If an image URL returns 404, import should continue and keep original URL
