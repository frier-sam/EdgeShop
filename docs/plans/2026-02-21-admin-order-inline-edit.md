# Admin Order Detail — Section-Level Inline Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace per-field Save buttons in AdminOrderDetail with section-level Edit/Save pattern; make email and phone permanently read-only.

**Architecture:** Single file change to `AdminOrderDetail.tsx`. Add four `isEditing` booleans (one per editable section). Each section renders plain text in view mode and inputs in edit mode. One Save button per section calls `updateMutation` with all fields in that section at once.

**Tech Stack:** React, TypeScript, TanStack Query, Tailwind CSS

---

### Task 1: Add section-editing state and helper

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx:96-127`

**Step 1: Add the four isEditing booleans after the existing field state declarations (around line 107)**

Locate the block starting with `const [orderStatus, setOrderStatus] = useState('')` and add after the last state declaration (before `const seeded = useRef(false)`):

```tsx
const [editingCustomer, setEditingCustomer] = useState(false)
const [editingShipping, setEditingShipping] = useState(false)
const [editingPayment, setEditingPayment] = useState(false)
const [editingAdminActions, setEditingAdminActions] = useState(false)
```

**Step 2: Verify the file still compiles**

```bash
cd /Users/sam/Documents/per/edgeshop && npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "refactor(admin-order): add section isEditing state booleans"
```

---

### Task 2: Refactor Customer section

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx:218-269`

**Context:** The Customer section currently has three inputs each with their own Save button. Email and Phone should become permanently read-only. Name gets an Edit/Save pattern.

**Step 1: Replace the entire Customer `<section>` block (lines 218–269) with this:**

```tsx
{/* Customer info */}
<section className="bg-white rounded-lg border border-gray-200 p-4">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-gray-700">Customer</h2>
    {!editingCustomer && (
      <button
        onClick={() => setEditingCustomer(true)}
        className="text-xs text-gray-500 hover:text-gray-800 underline"
      >
        Edit
      </button>
    )}
  </div>
  <div className="space-y-3">
    <div>
      <label className="block text-xs text-gray-400 mb-1">Name</label>
      {editingCustomer ? (
        <input
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
        />
      ) : (
        <p className="text-sm text-gray-800">{order.customer_name}</p>
      )}
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1">Email</label>
      <p className="text-sm text-gray-800">{order.customer_email}</p>
    </div>
    <div>
      <label className="block text-xs text-gray-400 mb-1">Phone</label>
      <p className="text-sm text-gray-800">{order.customer_phone ?? '—'}</p>
    </div>
  </div>
  {editingCustomer && (
    <div className="mt-4 flex justify-end">
      <button
        onClick={() => {
          updateMutation.mutate({ customer_name: customerName })
          setEditingCustomer(false)
        }}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updateMutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )}
</section>
```

**Step 2: Verify compilation**

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "refactor(admin-order): customer section — edit/save pattern, email+phone read-only"
```

---

### Task 3: Refactor Shipping Address section

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx:271-355`

**Context:** The Shipping section has 5 fields each with their own ✓ button. Replace with single Edit/Save.

**Step 1: Replace the entire Shipping Address `<section>` block (lines 272–355) with:**

```tsx
{/* Shipping address */}
<section className="bg-white rounded-lg border border-gray-200 p-4">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-gray-700">Shipping Address</h2>
    {!editingShipping && (
      <button
        onClick={() => setEditingShipping(true)}
        className="text-xs text-gray-500 hover:text-gray-800 underline"
      >
        Edit
      </button>
    )}
  </div>
  {editingShipping ? (
    <div className="space-y-2">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Address Line</label>
        <input
          value={shippingAddress}
          onChange={e => setShippingAddress(e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">City</label>
          <input
            value={shippingCity}
            onChange={e => setShippingCity(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">State</label>
          <input
            value={shippingState}
            onChange={e => setShippingState(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Pincode</label>
          <input
            value={shippingPincode}
            onChange={e => setShippingPincode(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Country</label>
          <input
            value={shippingCountry}
            onChange={e => setShippingCountry(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-800 focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>
    </div>
  ) : (
    <div className="text-sm text-gray-800 space-y-0.5">
      <p>{order.shipping_address}</p>
      <p>
        {[order.shipping_city, order.shipping_state, order.shipping_pincode]
          .filter(Boolean)
          .join(', ')}
      </p>
      <p>{order.shipping_country}</p>
    </div>
  )}
  {editingShipping && (
    <div className="mt-4 flex justify-end">
      <button
        onClick={() => {
          updateMutation.mutate({
            shipping_address: shippingAddress,
            shipping_city: shippingCity,
            shipping_state: shippingState,
            shipping_pincode: shippingPincode,
            shipping_country: shippingCountry,
          })
          setEditingShipping(false)
        }}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updateMutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )}
</section>
```

**Step 2: Verify compilation**

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: No errors.

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "refactor(admin-order): shipping section — single edit/save"
```

---

### Task 4: Refactor Payment section

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx:357-397`

**Context:** Payment section has a select + Save inline. Replace with Edit/Save pattern. Method and Razorpay IDs remain read-only always.

**Step 1: Replace the entire Payment `<section>` block with:**

```tsx
{/* Payment info */}
<section className="bg-white rounded-lg border border-gray-200 p-4">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold text-gray-700">Payment</h2>
    {!editingPayment && (
      <button
        onClick={() => setEditingPayment(true)}
        className="text-xs text-gray-500 hover:text-gray-800 underline"
      >
        Edit
      </button>
    )}
  </div>
  <dl className="space-y-2 text-sm">
    <div className="flex gap-2 items-center">
      <dt className="text-gray-400 w-32 shrink-0">Method</dt>
      <dd className="text-gray-900 capitalize">{order.payment_method}</dd>
    </div>
    <div className="flex gap-2 items-center">
      <dt className="text-gray-400 w-32 shrink-0">Status</dt>
      <dd>
        {editingPayment ? (
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700 focus:outline-none focus:border-gray-500"
          >
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        ) : (
          <StatusBadge label={order.payment_status} />
        )}
      </dd>
    </div>
    {order.razorpay_order_id && (
      <div className="flex gap-2">
        <dt className="text-gray-400 w-32 shrink-0">Razorpay Order</dt>
        <dd className="text-gray-700 font-mono text-xs break-all">{order.razorpay_order_id}</dd>
      </div>
    )}
    {order.razorpay_payment_id && (
      <div className="flex gap-2">
        <dt className="text-gray-400 w-32 shrink-0">Razorpay Payment</dt>
        <dd className="text-gray-700 font-mono text-xs break-all">{order.razorpay_payment_id}</dd>
      </div>
    )}
  </dl>
  {editingPayment && (
    <div className="mt-4 flex justify-end">
      <button
        onClick={() => {
          updateMutation.mutate({ payment_status: paymentStatus })
          setEditingPayment(false)
        }}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updateMutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )}
</section>
```

**Step 2: Verify compilation**

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "refactor(admin-order): payment section — edit/save pattern"
```

---

### Task 5: Refactor Admin Actions section

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx:564-636`

**Context:** Admin Actions section has inline Save buttons for Order Status and Tracking Number. Replace with Edit/Save. Refund action stays separate (it's a destructive action, not a field edit).

**Step 1: Replace the Admin Actions `<section>` block with:**

```tsx
{/* Admin actions */}
<section className="bg-white rounded-lg border border-gray-200 p-4 space-y-5">
  <div className="flex items-center justify-between">
    <h2 className="text-sm font-semibold text-gray-700">Admin Actions</h2>
    {!editingAdminActions && (
      <button
        onClick={() => setEditingAdminActions(true)}
        className="text-xs text-gray-500 hover:text-gray-800 underline"
      >
        Edit
      </button>
    )}
  </div>

  {updateMutation.isError && (
    <p className="text-xs text-red-500">Update failed. Please try again.</p>
  )}

  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-32 shrink-0">Order Status</label>
      {editingAdminActions ? (
        <select
          value={orderStatus}
          onChange={(e) => setOrderStatus(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ) : (
        <StatusBadge label={order.order_status} />
      )}
    </div>
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 w-32 shrink-0">Tracking Number</label>
      {editingAdminActions ? (
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="e.g. 1Z999AA10123456784"
          className="text-sm border border-gray-300 rounded px-2 py-1.5 text-gray-700 w-64"
        />
      ) : (
        <span className="text-sm text-gray-800">{order.tracking_number ?? '—'}</span>
      )}
    </div>
  </div>

  {editingAdminActions && (
    <div className="flex justify-end">
      <button
        onClick={() => {
          updateMutation.mutate({
            order_status: orderStatus,
            tracking_number: trackingNumber,
          })
          setEditingAdminActions(false)
        }}
        disabled={updateMutation.isPending}
        className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {updateMutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )}

  {/* Refund — destructive action, stays separate */}
  {order.payment_status !== 'refunded' && (
    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
      <label className="text-sm text-gray-600 w-32 shrink-0">Refund</label>
      <button
        onClick={() => {
          if (window.confirm('Mark this order as refunded? This cannot be undone.')) {
            refundMutation.mutate({ notes: privateNote })
          }
        }}
        disabled={refundMutation.isPending}
        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {refundMutation.isPending ? 'Refunding...' : 'Mark as Refunded'}
      </button>
      {refundMutation.isError && (
        <p className="text-xs text-red-500">Refund failed. Please try again.</p>
      )}
    </div>
  )}
</section>
```

**Step 2: Verify compilation**

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

**Step 3: Commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "refactor(admin-order): admin actions section — edit/save pattern"
```

---

### Task 6: Remove unused state variables

**Files:**
- Modify: `frontend/src/admin/pages/AdminOrderDetail.tsx`

**Context:** After the refactor, `customerEmail` and `customerPhone` state variables are no longer used in any input (email/phone are now always read-only). Remove them.

**Step 1: Delete these two lines from the state declarations (around lines 101–102):**

```tsx
const [customerEmail, setCustomerEmail] = useState('')
const [customerPhone, setCustomerPhone] = useState('')
```

**Step 2: Delete these two lines from the `useEffect` seed block:**

```tsx
setCustomerEmail(order.customer_email)
setCustomerPhone(order.customer_phone ?? '')
```

**Step 3: Verify compilation (this will catch any remaining usages)**

```bash
npx tsc --noEmit -p frontend/tsconfig.json
```

Expected: No errors. If there are "cannot find name" errors, the previous tasks left stale references — fix them.

**Step 4: Final commit**

```bash
git add frontend/src/admin/pages/AdminOrderDetail.tsx
git commit -m "refactor(admin-order): remove unused email/phone state vars"
```

---

## Verification Checklist

After all tasks:

- [ ] `npx tsc --noEmit -p frontend/tsconfig.json` passes with no errors
- [ ] In browser: Customer section shows Name/Email/Phone as plain text by default; clicking "Edit" shows Name input, Email/Phone remain plain text; Save updates name
- [ ] Shipping section: shows address lines as plain text; "Edit" shows all 5 inputs; Save sends one API call
- [ ] Payment section: shows status badge; "Edit" shows dropdown; Save updates payment status
- [ ] Admin Actions: shows order status badge + tracking; "Edit" shows both inputs; Save updates both
- [ ] Refund button is still present and functional
- [ ] Timeline / Private Note section is unchanged
- [ ] No stray per-field Save buttons remain
