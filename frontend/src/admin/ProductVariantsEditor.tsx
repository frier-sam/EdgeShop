// POD-V2.md §3 — axis 2 (colour / finish / material). Modelled closely on
// ProductSizesEditor.tsx: same client-side row-keying (`key`, never sent to
// the API), same "validate locally before hitting the server" shape, same
// save/dirty handling (rows come from `initialVariants` once via the
// parent's own `useState` seed — this component owns its own local
// `rows` state from mount and never re-derives it from a refetch, so an
// in-progress edit survives an unrelated save elsewhere on the page).
//
// Differs from ProductSizesEditor in exactly the ways §3.1/§3.3 call for:
// no price_delta (axis 2 never touches pricing), no stock_count (stock
// stays on axis 1 only), and one extra column — an OPTIONAL swatch. The
// optionality is the whole point (§3.1): "Matte" / "Glossy" has no
// colour, so a plain labelled pill has to be a first-class, unremarkable
// state, not a degraded one. `swatch_hex` is sent as `null`, never `''`
// or omitted, when the merchant hasn't picked a colour for that option.
import { useState } from 'react'
import { adminFetch } from './lib/adminFetch'
import { showToast } from './Toast'
import Button from '../components/Button'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'
import type { ProductVariant } from '../lib/types'
import type { VariantDraftRow } from './types'

function rowsFromVariants(variants: ProductVariant[]): VariantDraftRow[] {
  return variants.map((v) => ({ key: `v${v.id}`, label: v.label, swatch_hex: v.swatch_hex }))
}

function newKey(): string {
  return `n${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

// A neutral starting colour for the moment a merchant flips a row from
// "no colour" to "has a colour" — deliberately not white/black so it's
// visibly a placeholder they still need to pick, not an already-chosen one.
const DEFAULT_SWATCH = '#9B9BA6'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

// Mirrors the server-side validation the worker agent is adding to PUT
// /:id/variants (opaque non-empty labels, unique per product) — see the
// API contract in this phase's task brief. swatch_hex itself needs no
// format check beyond "null or a 6-digit hex": it only ever comes from a
// native <input type="color">, which cannot produce anything else.
export function validateVariantRows(rows: VariantDraftRow[]): string | null {
  const seen = new Set<string>()
  for (const r of rows) {
    const label = r.label.trim()
    if (!label) return 'Every option needs a label.'
    const key = label.toLowerCase()
    if (seen.has(key)) return `Duplicate option label: "${label}"`
    seen.add(key)
    if (r.swatch_hex !== null && !HEX_RE.test(r.swatch_hex)) {
      return `Swatch colour for "${label}" must be a valid hex colour or unset.`
    }
  }
  return null
}

const ROW_INPUT_CLASSES =
  'h-11 w-full rounded-btn border border-line bg-surface px-3 text-sm text-ink transition-colors duration-fast ' +
  'focus:outline-none focus:border-ink focus:ring-2 focus:ring-accent/30'

interface ProductVariantsEditorProps {
  productId: number
  initialVariants: ProductVariant[]
  /** Axis-2 display name (POD-V2.md §1.4) — "Colour" by default, but a
   *  card merchant renamed it "Finish", a bottle merchant "Cap colour". */
  axisLabel: string
  onSaved: (variants: ProductVariant[]) => void
}

export default function ProductVariantsEditor({ productId, initialVariants, axisLabel, onSaved }: ProductVariantsEditorProps) {
  const [rows, setRows] = useState<VariantDraftRow[]>(() => rowsFromVariants(initialVariants))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateRow(key: string, patch: Partial<VariantDraftRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((rs) => [...rs, { key: newKey(), label: '', swatch_hex: null }])
  }

  // Rows are only ever removed here, from an explicit click — never as a
  // side effect of the capability checkbox in AdminProductEdit.tsx being
  // unticked. That checkbox only toggles this whole component's CSS
  // visibility; this component keeps mounted and its `rows` state intact
  // either way, which is what makes "hide, then re-show without
  // retyping" work (POD-V2.md §11 Phase 1.3).
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

  function toggleSwatch(key: string, hasColour: boolean) {
    updateRow(key, { swatch_hex: hasColour ? DEFAULT_SWATCH : null })
  }

  async function handleSave() {
    const validationError = validateVariantRows(rows)
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSaving(true)
    try {
      const res = await adminFetch(`/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: rows.map((r, i) => ({ label: r.label.trim(), swatch_hex: r.swatch_hex, sort_order: i })),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Save failed')
      }
      const data = (await res.json()) as { variants: ProductVariant[] }
      setRows(rowsFromVariants(data.variants))
      onSaved(data.variants)
      showToast(`${axisLabel} options saved`, 'success')
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
          + Add {axisLabel.toLowerCase() || 'option'}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs italic text-ink-faint">
          No {axisLabel.toLowerCase() || 'options'} yet — this product has a single option on this axis.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_auto_auto] gap-2 px-1 text-[11px] uppercase tracking-wide text-ink-faint sm:grid">
            <span>Label</span>
            <span>Swatch</span>
            <span></span>
          </div>
          {rows.map((row, i) => {
            const hasSwatch = row.swatch_hex !== null
            return (
              <div
                key={row.key}
                className="grid grid-cols-2 items-center gap-2 rounded-btn border border-line p-2 sm:grid-cols-[1fr_auto_auto]"
              >
                <input
                  value={row.label}
                  onChange={(e) => updateRow(row.key, { label: e.target.value })}
                  placeholder="Navy / Matte / Steel"
                  aria-label={`${axisLabel} label`}
                  className={`col-span-2 sm:col-span-1 ${ROW_INPUT_CLASSES}`}
                />
                {/* Swatch column — deliberately two independent controls
                    rather than one "colour or blank" field, so "no colour"
                    reads as a clicked choice, not an unfinished one
                    (POD-V2.md §3.1). A round rounded-pill swatch previews
                    the actual colour — the same shape §2.4 calls for on
                    the storefront's own colour swatches — instead of
                    leaning on a native colour input's inconsistent
                    browser-default look. */}
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      checked={hasSwatch}
                      onChange={(e) => toggleSwatch(row.key, e.target.checked)}
                      className="h-4 w-4 rounded border-line text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                    />
                    Has colour
                  </label>
                  {hasSwatch ? (
                    <input
                      type="color"
                      value={row.swatch_hex ?? DEFAULT_SWATCH}
                      onChange={(e) => updateRow(row.key, { swatch_hex: e.target.value })}
                      aria-label={`${axisLabel} swatch colour`}
                      className="h-9 w-9 shrink-0 cursor-pointer appearance-none rounded-pill border-2 border-line bg-surface p-0"
                    />
                  ) : (
                    // POD-V2.md §3.1's substrate-agnostic requirement in
                    // visual form: "no colour" degrades to a plain labelled
                    // row, not a broken/empty swatch shape.
                    <span className="text-xs italic text-ink-faint">No colour</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                  <IconButton variant="ghost" size="sm" onClick={() => moveRow(row.key, -1)} disabled={i === 0} aria-label="Move up">
                    <Icon name="keyboard_arrow_up" size={18} />
                  </IconButton>
                  <IconButton variant="ghost" size="sm" onClick={() => moveRow(row.key, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                    <Icon name="keyboard_arrow_down" size={18} />
                  </IconButton>
                  <IconButton variant="ghost" size="sm" onClick={() => removeRow(row.key)} aria-label={`Remove ${axisLabel.toLowerCase()}`} className="text-danger hover:bg-danger-soft">
                    <Icon name="delete" size={16} />
                  </IconButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <Button type="button" variant="primary" loading={saving} onClick={handleSave}>
        Save {axisLabel.toLowerCase() || 'options'}
      </Button>
    </div>
  )
}
