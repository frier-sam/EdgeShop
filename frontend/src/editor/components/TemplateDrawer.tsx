import { useEffect, useMemo, useState } from 'react'
import { fetchTemplates, TemplatesApiError, type TemplateCollection, type TemplateSummary } from '../templatesApi'
import IconButton from '../../components/ui/IconButton'
import Skeleton from '../../components/ui/Skeleton'

export interface TemplateDrawerProps {
  open: boolean
  /** The active product's category — see templatesApi.ts's FetchTemplatesParams. */
  category: string
  /** The active side's live bleed-rect aspect ratio (width/height) — see templatesApi.ts's FetchTemplatesParams. */
  aspect: number
  onClose: () => void
  /** Fired when a card is picked. The drawer does not apply the template itself — that needs the live Fabric canvas, which lives in CustomizerEditor. */
  onApply: (template: TemplateSummary) => void
  /** True while a picked template's fit+load is in flight — disables further picks so a fast double-tap can't race two applies onto the same side. */
  applying?: boolean
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="1" y1="1" x2="11" y2="11" />
      <line x1="11" y1="1" x2="1" y2="11" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

const SKELETON_ROWS = 2
const SKELETON_CARDS = 3

/**
 * POD-V2.md §6.6 / §11 Phase 4 tasks 4.5-4.6 — the "browse ready-made
 * designs" drawer. Collections render as rows (a heading + a horizontally
 * scrolling strip of cards), search filters over `name`+`tags` CLIENT-SIDE
 * (the documented endpoint contract takes `category`/`aspect`/`all` only —
 * no free-text query param — so, like Header.tsx's product search, this
 * fetches once per (category, aspect, "show all shapes") combination and
 * filters what's already in memory), and cards show only `preview_url`: one
 * small image per template, zero Fabric work until something is actually
 * picked (§6.6).
 *
 * A conventional right-edge slide-in panel (own component, not the shared
 * `Sheet` primitive) for the same reason CartDrawer.tsx gives — `Sheet` is a
 * bottom-anchored mobile pattern with drag-to-dismiss; a browse panel reads
 * better as a fixed-width rail at every viewport width.
 */
export default function TemplateDrawer({ open, category, aspect, onClose, onApply, applying = false }: TemplateDrawerProps) {
  const [collections, setCollections] = useState<TemplateCollection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showAllShapes, setShowAllShapes] = useState(false)
  // Bumped by the error state's "Try again" button to force a re-fetch
  // without duplicating the fetch effect's body.
  const [reloadToken, setReloadToken] = useState(0)

  // A fresh browse session each time the drawer opens — a search typed (or
  // "show all shapes" left on) last time shouldn't linger invisibly behind
  // the next open.
  useEffect(() => {
    if (open) {
      setQuery('')
      setShowAllShapes(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    fetchTemplates({ category, aspect, all: showAllShapes })
      .then((res) => {
        if (alive) setCollections(res.collections)
      })
      .catch((err) => {
        if (alive) setError(err instanceof TemplatesApiError ? err.message : 'Could not load designs. Please try again.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, category, aspect, showAllShapes, reloadToken])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return collections
    return collections
      .map((c) => ({
        ...c,
        templates: c.templates.filter((t) => t.name.toLowerCase().includes(q) || t.tags.toLowerCase().includes(q)),
      }))
      .filter((c) => c.templates.length > 0)
  }, [collections, query])

  const totalCount = useMemo(() => collections.reduce((n, c) => n + c.templates.length, 0), [collections])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-ink/40 transition-opacity duration-base ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Designs"
        data-testid="template-drawer"
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-paper shadow-lift transition-transform duration-base ease-out-soft sm:w-96 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Designs</h2>
          <IconButton variant="ghost" size="sm" aria-label="Close designs" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>

        <div className="flex flex-col gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2 rounded-btn border border-line bg-surface px-3.5">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search designs…"
              aria-label="Search designs"
              className="h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>

          {/* "Show all shapes" — bypasses the server's default aspect-compatibility
              filter (POD-V2.md §12 decision 8) so a design authored for a very
              different shape isn't PERMANENTLY unreachable, just hidden by default. */}
          <button
            type="button"
            role="switch"
            aria-checked={showAllShapes}
            onClick={() => setShowAllShapes((v) => !v)}
            className="flex items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-fast hover:border-ink/30"
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-fast ${
                showAllShapes ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`h-3 w-3 rounded-full bg-surface shadow-card transition-transform duration-fast ${
                  showAllShapes ? 'translate-x-3' : 'translate-x-0'
                }`}
              />
            </span>
            Show all shapes
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="space-y-6" aria-hidden="true">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <div key={i}>
                  <Skeleton shape="text" width="40%" className="mb-2" />
                  <div className="flex gap-3">
                    {Array.from({ length: SKELETON_CARDS }).map((_, j) => (
                      <Skeleton key={j} shape="rect" width={112} height={112} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-ink-soft">{error}</p>
              <button
                type="button"
                onClick={() => setReloadToken((n) => n + 1)}
                className="text-sm font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && totalCount === 0 && (
            <p className="py-10 text-center text-sm text-ink-soft">No designs are available for this product yet.</p>
          )}

          {!loading && !error && totalCount > 0 && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-soft">No designs match &ldquo;{query}&rdquo;.</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-6">
              {filtered.map((collection) => (
                <section key={collection.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{collection.name}</h3>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {collection.templates.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        disabled={applying}
                        onClick={() => onApply(template)}
                        className="w-28 shrink-0 rounded-card border border-line bg-surface p-2 text-left shadow-card transition-[border-color,opacity] duration-fast hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="aspect-square overflow-hidden rounded-btn bg-surface-2">
                          {template.preview_url ? (
                            <img src={template.preview_url} alt={template.name} loading="lazy" className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-faint">No preview</div>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-medium text-ink">{template.name}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
