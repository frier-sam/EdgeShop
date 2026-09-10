// frontend/src/editor/templatesApi.ts
//
// POD-V2.md §6 / §11 Phase 4 tasks 4.5-4.6 — thin fetch wrapper for
// `GET /api/templates?category=&aspect=&all=0|1`, the browse endpoint for
// design templates. Mirrors designApi.ts's shape (plain fetch, a dedicated
// Error subclass, no react-query) since it lives beside it and answers the
// same kind of question — "what does the server say a design looks like".
//
// The worker route itself (worker/src/routes/templates.ts or similar) is
// owned by a different agent — this file only speaks the documented
// response shape and does not implement or assume anything about how the
// server computes it.
//
// `design_json` here is already-parsed JSON, not a JSON string — the same
// convention `GET /api/designs/:id` uses (designApi.ts's `FetchedDesign`):
// the server parses `design_templates.design_json` before responding, so
// nothing on this side needs a second `JSON.parse`.
import type { FabricSnapshot } from './fabric/rescaleSnapshot'

export class TemplatesApiError extends Error {}

export interface TemplateSummary {
  id: number
  name: string
  /**
   * The template's own art layer, expressed in its own `canvas_w x
   * canvas_h` coordinate space (POD-V2.md §6.1's `design_templates` table).
   * Never loaded straight into a live canvas — always run through
   * `fitSnapshotToCanvas` first (fabric/fitSnapshot.ts, §6.2) against the
   * target side's actual bleed size, since a template's own canvas size is
   * essentially never the same shape as the product it's being applied to.
   */
  design_json: FabricSnapshot
  canvas_w: number
  canvas_h: number
  /** ~400px WebP art-only thumbnail (templatePreview.ts) — what browse cards render; no Fabric work happens until a card is actually picked. */
  preview_url: string
  /** Free-text, space/comma-separated — searched client-side alongside `name` (TemplateDrawer.tsx). */
  tags: string
}

export interface TemplateCollection {
  id: number
  name: string
  templates: TemplateSummary[]
}

export interface FetchTemplatesResult {
  collections: TemplateCollection[]
}

export interface FetchTemplatesParams {
  /** The active product's category. `design_templates`' collections use `''` to mean "every category" — that matching is the server's job, this just passes the value through. */
  category: string
  /**
   * The TARGET print area's bleed-rect aspect ratio (width / height), used
   * by the server to aspect-filter collections (POD-V2.md §12 decision 8)
   * so a landscape card design doesn't show up as a browse option for a
   * tall bottle wrap. Callers should pass CustomizerEditor's live bleed
   * size (`bleedSizeRef`/`onBleedSizeChange`) — POD-UI3.md §4.1 guarantee 3
   * (the flat stage's aspect ratio always equals the canonical reference
   * geometry's) means that ratio is exactly the one the server needs, with
   * no separate geometry call required just to compute it.
   */
  aspect: number
  /** "Show all shapes" escape hatch (§12 decision 8) — bypasses the server's aspect-compatibility filter instead of only ever letterboxing what it already decided to show. */
  all?: boolean
}

/**
 * `GET /api/templates?category=&aspect=&all=0|1` — collections (each with
 * its own templates) for the "Designs" browse drawer. `aspect` is omitted
 * from the query when it isn't a finite positive number (e.g. the caller
 * asked before the stage has ever laid out) so the server's own default
 * behaviour decides rather than this sending a meaningless `0`.
 */
export async function fetchTemplates({ category, aspect, all = false }: FetchTemplatesParams): Promise<FetchTemplatesResult> {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (Number.isFinite(aspect) && aspect > 0) params.set('aspect', String(aspect))
  if (all) params.set('all', '1')

  const res = await fetch(`/api/templates?${params.toString()}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as { error?: string })
    throw new TemplatesApiError(data.error ?? `Failed to load designs (${res.status})`)
  }
  return (await res.json()) as FetchTemplatesResult
}
