// POD-V2.md §7 — category is (and stays) free text on `products.category`,
// so this is a suggestions layer over the existing public
// `GET /api/categories`, not a real foreign key. A native
// `<datalist>`-backed input rather than a hand-rolled dropdown: it's free
// keyboard/a11y behaviour, and — the reason it's specified over the
// hand-rolled alternative — it still lets this component render its own
// warning paragraph underneath, which a plain <select> could not do while
// also allowing free text.
//
// The caveat this exists for (§7): categories are free text and, from
// Phase 4, `template_collections.category` is keyed by that exact text.
// "Visiting Card" vs "Visiting Cards" is a silent, un-erroring split — a
// collection filed under one spelling never appears for products filed
// under the other. This warning is the whole mitigation for now (the
// "robust" fix — promoting category to a real table — is explicitly
// deferred in §7). Non-blocking: a genuinely new category is a completely
// valid thing to type, so this never prevents saving, it only asks the
// merchant to double-check.
import { useId } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchJson } from '../lib/api'
import Field from '../components/Field'

interface CategoriesResponse {
  categories: { name: string; count: number; image: string | null }[]
}

interface CategoryComboboxProps {
  value: string
  onChange: (value: string) => void
  label?: string
  hint?: string
}

export default function CategoryCombobox({ value, onChange, label = 'Category', hint }: CategoryComboboxProps) {
  const listId = useId()

  // Public endpoint (routes/categories.ts is mounted outside /api/admin/*)
  // — plain fetchJson, no admin bearer token needed. Long staleTime: this
  // is a suggestions list, not data the page depends on for correctness,
  // and it changes only as often as products' categories do.
  const { data } = useQuery<CategoriesResponse>({
    queryKey: ['categories'],
    queryFn: () => fetchJson<CategoriesResponse>('/api/categories'),
    staleTime: 5 * 60 * 1000,
  })
  const names = data?.categories.map((c) => c.name) ?? []

  const trimmed = value.trim()
  // Case-insensitive match on purpose: "Visiting Card" vs "visiting card"
  // is the same category to a human merchant, even though the underlying
  // column is a case-sensitive TEXT compare elsewhere (routes/products.ts
  // filters with `p.category = ?`). The warning is about catching a
  // genuine typo, not policing capitalization the merchant intended.
  const isUnknown = trimmed !== '' && names.length > 0 && !names.some((n) => n.toLowerCase() === trimmed.toLowerCase())

  return (
    <div>
      <Field
        label={label}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. T-shirts"
        hint={isUnknown ? undefined : hint}
        autoComplete="off"
      />
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {/* Informational, NOT a warning. Typing a new category is a supported
          action — offering existing ones and still accepting new text is the
          entire point of this control — so it must not be styled or worded as
          a mistake. It stays useful because design collections are matched to
          categories by name, so consistent spelling does matter; that reason
          is given in the merchant's own terms. Never cite an internal plan
          document in copy a shop owner reads. */}
      {isUnknown && (
        <p className="mt-1.5 text-xs text-ink-soft">
          New category — "{trimmed}" will be created when you save. Design collections are matched to categories by name, so keep
          the spelling consistent with the collections you set up.
        </p>
      )}
    </div>
  )
}
