import { useState } from 'react'
import { adminFetch } from './lib/adminFetch'
import { showToast } from './Toast'
import Button from '../components/Button'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'
import type { ProductSize } from '../lib/types'
import type { SizeDraftRow } from './types'

function rowsFromSizes(sizes: ProductSize[]): SizeDraftRow[] {
  return sizes.map((s) => ({ key: `s${s.id}`, label: s.label, price_delta: s.price_delta, stock_count: s.stock_count }))
}

function newKey(): string {
  return `n${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

interface ProductSizesEditorProps {
  productId: number
  initialSizes: ProductSize[]
  /** Axis-1 display name (POD-V2.md §1.4) — "Size" by default, but this is
   *  the axis a visiting card merchant renames "Paper size" and a bottle
   *  merchant renames "Volume". Optional + defaulted so this component's
   *  behaviour for any caller that predates axis naming is unchanged. */
  axisLabel?: string
  onSaved: (sizes: ProductSize[]) => void
}

// Mirrors the server-side validation in worker/src/routes/admin/products.ts
// (PUT /:id/sizes) so the merchant sees an inline error instead of a raw 400.
function validateRows(rows: SizeDraftRow[]): string | null {
  const seen = new Set<string>()
  for (const r of rows) {
    const label = r.label.trim()
    if (!label) return 'Every size needs a label.'
    const key = label.toLowerCase()
    if (seen.has(key)) return `Duplicate size label: "${label}"`
    seen.add(key)
    if (!Number.isFinite(r.price_delta)) return `Price delta for "${label}" must be a number.`
    if (!Number.isFinite(r.stock_count) || r.stock_count < 0) return `Stock for "${label}" must be zero or more.`
  }
  return null
}

const ROW_INPUT_CLASSES =
  'h-11 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink transition-colors duration-fast ' +
  'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/30'

export default function ProductSizesEditor({ productId, initialSizes, axisLabel = 'Size', onSaved }: ProductSizesEditorProps) {
  const [rows, setRows] = useState<SizeDraftRow[]>(() => rowsFromSizes(initialSizes))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const axisLower = axisLabel.toLowerCase() || 'size'

  function updateRow(key: string, patch: Partial<SizeDraftRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((rs) => [...rs, { key: newKey(), label: '', price_delta: 0, stock_count: 0 }])
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key))
  }

  function moveRow(key: string, dir: -1 | 1) {
    setRows((rs) => {
      const idx = rs.findIndex((r) => r.key === key)
      const swapWith = idx + dir
      if (idx < 0 || swapWith < 0 || swapWith >= rs.length) return rs
      const next = [...rs]
      ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
      return next
    })
  }

  async function handleSave() {
    const validationError = validateRows(rows)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/sizes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sizes: rows.map((r) => ({ label: r.label.trim(), price_delta: r.price_delta, stock_count: r.stock_count })),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const data = await res.json() as { sizes: ProductSize[] }
      setRows(rowsFromSizes(data.sizes))
      onSaved(data.sizes)
      showToast('Sizes saved', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-ink">{axisLabel} options</h2>
        <Button type="button" variant="secondary" size="sm" onClick={addRow}>
          + Add {axisLower}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs italic text-ink-faint">
          No {axisLower} options — this is a single-SKU product. Stock is tracked on Basics instead.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1 text-[11px] uppercase tracking-wide text-ink-faint sm:grid">
            <span>Label</span>
            <span>Price delta (₹)</span>
            <span>Stock</span>
            <span></span>
          </div>
          {rows.map((row, i) => (
            <div key={row.key} className="grid grid-cols-2 items-center gap-2 rounded-btn border border-line p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input
                value={row.label}
                onChange={(e) => updateRow(row.key, { label: e.target.value })}
                placeholder="S / M / L / XL"
                aria-label={`${axisLabel} label`}
                className={ROW_INPUT_CLASSES}
              />
              <input
                type="number"
                step="0.01"
                value={row.price_delta}
                onChange={(e) => updateRow(row.key, { price_delta: parseFloat(e.target.value) || 0 })}
                aria-label="Price delta"
                className={ROW_INPUT_CLASSES}
              />
              <input
                type="number"
                min="0"
                step="1"
                value={row.stock_count}
                onChange={(e) => updateRow(row.key, { stock_count: parseInt(e.target.value, 10) || 0 })}
                aria-label="Stock count"
                className={ROW_INPUT_CLASSES}
              />
              <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                <IconButton variant="ghost" size="sm" onClick={() => moveRow(row.key, -1)} disabled={i === 0} aria-label="Move up">
                  <Icon name="keyboard_arrow_up" size={18} />
                </IconButton>
                <IconButton variant="ghost" size="sm" onClick={() => moveRow(row.key, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                  <Icon name="keyboard_arrow_down" size={18} />
                </IconButton>
                <IconButton variant="ghost" size="sm" onClick={() => removeRow(row.key)} aria-label={`Remove ${axisLower}`} className="text-danger hover:bg-danger-soft">
                  <Icon name="delete" size={16} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
        Save {axisLower} options
      </Button>
    </div>
  )
}
