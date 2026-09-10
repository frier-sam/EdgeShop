import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './fonts.css'
import { loadFabric, type FabricModule, type FabricCanvas } from './fabric/loadFabric'
import { snapshotCanvas, restoreCanvas } from './fabric/canvas'
import { fitSnapshotToCanvas } from './fabric/fitSnapshot'
import { snapshotHasArt, type FabricSnapshot } from './fabric/rescaleSnapshot'
import { scanImageDpi, type ImageDpiInfo } from './fabric/selection'
import { isImageObject, isTextObject } from './fabric/objectTypes'
import { useEditorSettings } from './useEditorSettings'
import { useEditorObjects } from './useEditorObjects'
import EditorStage, { type SideSnapshot } from './EditorStage'
import PreviewStage from './components/PreviewStage'
import ToolRail from './components/ToolRail'
import TemplateDrawer from './components/TemplateDrawer'
import PropertiesPanel from './components/PropertiesPanel'
import SelectionActionBar from './components/SelectionActionBar'
import SideTabs from './components/SideTabs'
import PriceFooter, { type FooterSideFee } from './components/PriceFooter'
import { useIsMobile } from './components/useIsMobile'
import Sheet, { type SheetSnap } from '../components/ui/Sheet'
import Badge from '../components/ui/Badge'
import Button from '../components/Button'
import { DEFAULT_DESIGN_FONT, ensureFontsReady } from './fonts'
import { uploadArt, isAcceptedArtFile, UploadArtError } from './uploadArt'
import { sanitizeSvgFile } from './sanitizeSvg'
import { canonicalizeSideSnapshot, createDesign, uploadDesignPreview, DesignApiError } from './designApi'
import { renderSidePreview } from './preview'
import { renderTemplatePreview } from './templatePreview'
import type { TemplateSummary } from './templatesApi'
import { scanCanonicalDpiIssues, sidesUsedFrom, type DesignJson } from './designSchema'
import { currencySymbol } from '../lib/storeConfig'
import { useSettings } from '../lib/useSettings'
import { useToastStore } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import type { ProductDetail, ProductSide } from '../lib/types'
import type { FetchedDesign } from './designApi'
import type { EditorMode, EditorSideName, SidesRuntimeState } from './types'

/**
 * POD-V2.md §6.4 / §11 Phase 4 task 4.3 — the admin authoring-mode contract.
 * "Do not build a template editor": the admin agent mounts this exact same
 * component against a reference product (borrowed for a real print area),
 * and this is the ONLY thing that differs — the footer shows a single save
 * action instead of price/Preview/Add to cart, and nothing cart-related
 * renders or runs (no line is ever pushed, no design row is ever POSTed to
 * `/api/designs`).
 */
export interface TemplateModeConfig {
  /** Fired by "Save as template" with the ACTIVE side's snapshot at its live bleed size, plus an art-only preview (renderTemplatePreview). Templates are single-side (POD-V2.md §6.3) — only the currently active side is ever saved, never the whole `DesignJson`. */
  onSave: (payload: { design_json: FabricSnapshot; canvas_w: number; canvas_h: number; preview: Blob }) => Promise<void>
  saving?: boolean
  /** Defaults to "Save as template". */
  saveLabel?: string
  /**
   * Where the header's back control goes. Defaults to `navigate(-1)`.
   *
   * Required as an escape hatch because the default back target — the
   * reference product's public shopper page — is actively wrong here: the
   * merchant is authoring a template, not shopping, and dropping them onto
   * the storefront mid-task is a dead end.
   */
  onExit?: () => void
  /**
   * Label for that back control. Defaults to "Back".
   *
   * Deliberately NOT the product name, which is what the shopper flow
   * shows. In template mode the product is only a borrowed print area, so
   * labelling the exit with its name would assert exactly the thing this
   * flow has to disprove — that the template belongs to that product.
   */
  exitLabel?: string
}

export interface CustomizerEditorProps {
  product: ProductDetail
  initialSize: string | null
  /**
   * POD-UI4.md §5 C.10 / §4.2 — axis 2's label, threaded through from
   * `?variant=` the same way `initialSize` is threaded from `?size=`. This
   * is the ONE permitted change in this file this round: it flows straight
   * into the `addLine` call below and touches nothing else — the editor
   * itself stays exactly as option-2-unaware as POD-V2.md §4 requires
   * ("the editor never learns that axis 2 exists").
   */
  initialVariant?: string | null
  /** POD.md §7.3 — re-opening an existing design via `/customize/:productId?design=<id>` (from the cart's "Edit design" link or "My Designs"). Editing always saves as a NEW design row on add-to-cart (see designApi.ts / decisions log) — this only seeds the starting canvas state. */
  initialDesign?: FetchedDesign | null
  /** POD-V2.md §6.4 — set only by the admin's template-authoring mount. See TemplateModeConfig. */
  templateMode?: TemplateModeConfig
}

const SIDE_LABEL: Record<EditorSideName, string> = { front: 'Front', back: 'Back' }

// Bug 2 requirement 3 — when the mobile properties Sheet IS opened
// deliberately, the object must stay visible/manipulable: the stage
// SHRINKS by exactly the sheet's own height (rather than the sheet
// overlaying the canvas) so EditorStage's existing ResizeObserver-driven
// geometry recompute re-lays-out the design to fit fully above it — the
// same, already-print-safe machinery a window resize goes through.
// These match the Sheet's own peek/full heights below exactly, so the two
// never drift apart.
const MOBILE_SHEET_PEEK = '42vh'
const MOBILE_SHEET_FULL = '88vh'

/**
 * POD.md §6 / §7 — the customizer. Orchestrates the lazy Fabric module, the
 * design stage (EditorStage), the object model / undo-redo
 * (useEditorObjects), the tool rail, the per-object properties panel, the
 * side tabs (each side's Fabric state is independent — §6.7), the live
 * price / preview footer (§6.7, §6.8), and — as of Phase 7 — the real
 * add-to-cart persistence sequence (§3.5, §7.2): save the design, render +
 * upload a flattened preview per designed side, then push a cart line.
 *
 * POD-UI3.md §3.2 — THE TWO MODES ARE NOW TWO DIFFERENT THINGS. `edit`
 * shows EditorStage's live Fabric canvas on a flat white plane; `preview`
 * covers that stage with an opaque, RENDERED composite image
 * (PreviewStage.tsx) produced by `preview.ts`'s `renderSidePreview` — the
 * very same function whose output is uploaded to R2 at add-to-cart. So the
 * pixels the shopper approves and the pixels in their cart, order line and
 * confirmation email are the same bytes by construction, not by two
 * rendering paths happening to agree. §3.3 records why a cheaper
 * CSS-blend-mode overlay over the live canvas cannot work at all.
 *
 * Preview mode therefore does NOTHING to the live canvas: EditorStage stays
 * mounted and laid out beneath the overlay (it owns the one Fabric instance
 * and the per-side snapshot cache — unmounting it would destroy the
 * shopper's design), Fabric interactivity is off, and useEditorObjects'
 * window keybindings are gated off via `interactive` (§4.5). The design is
 * immutable for the whole duration of a preview session, which is what
 * makes the frozen snapshot in `previewDesignRef` below correct.
 *
 * This component is itself lazy-loaded (see CustomizePage.tsx's
 * React.lazy) and is the only place in the app that imports Fabric or
 * fonts.css, so neither ships in the main bundle.
 */
export default function CustomizerEditor({ product, initialSize, initialVariant, initialDesign, templateMode }: CustomizerEditorProps) {
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)
  const { currency: storeCurrency } = useSettings()
  const currency = currencySymbol(storeCurrency)
  const { settings } = useEditorSettings()
  const token = useAuthStore((s) => s.token)
  const addLine = useCartStore((s) => s.addLine)
  const openCart = useCartStore((s) => s.openCart)

  const [fabric, setFabric] = useState<FabricModule | null>(null)
  useEffect(() => {
    let alive = true
    loadFabric().then((mod) => {
      if (alive) setFabric(mod)
    })
    return () => {
      alive = false
    }
  }, [])

  const customizableSides = useMemo(
    () => (product.sides ?? []).filter((s): s is ProductSide & { side: EditorSideName } => !!s.customizable),
    [product.sides]
  )
  const sideOrder = useMemo(() => customizableSides.map((s) => s.side), [customizableSides])
  const sidesByName = useMemo(() => {
    const map: Partial<Record<EditorSideName, ProductSide>> = {}
    for (const s of customizableSides) map[s.side] = s
    return map
  }, [customizableSides])

  // If re-opening an existing design, start on a side it actually has
  // art on; otherwise the first customizable side, as before.
  const initialActiveSide = useMemo<EditorSideName>(() => {
    if (initialDesign) {
      const firstUsed = sideOrder.find((s) => initialDesign.sides_used.includes(s))
      if (firstUsed) return firstUsed
    }
    return sideOrder[0] ?? 'front'
  }, [initialDesign, sideOrder])

  const [activeSide, setActiveSide] = useState<EditorSideName>(initialActiveSide)
  const [mode, setMode] = useState<EditorMode>('edit')
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null)
  // Seeded from initialDesign so the price footer and side tabs show the
  // right fees/badges immediately, even for the side that isn't active yet.
  const [sidesState, setSidesState] = useState<SidesRuntimeState>(() => {
    if (!initialDesign) return {}
    const state: SidesRuntimeState = {}
    for (const side of ['front', 'back'] as EditorSideName[]) {
      const snap = initialDesign.design_json[side]
      if (snap) state[side] = { json: JSON.stringify(snap), objectCount: snap.objects?.length ?? 0 }
    }
    return state
  })
  const [uploading, setUploading] = useState(false)
  const [imageDpiInfos, setImageDpiInfos] = useState<ImageDpiInfo[]>([])
  const [addingToCart, setAddingToCart] = useState(false)
  const [addingToCartStatus, setAddingToCartStatus] = useState('')

  // ── POD-UI3.md §4.7 — preview-mode composite state ──────────────────
  // `previewUrls` is the render CACHE, keyed by side: entering preview
  // renders only the active side, tabbing to the other side renders that
  // one on demand, and both are kept so tabbing back is instant.
  // `previewRendering`/`previewError` are per-SESSION (a session = one
  // uninterrupted stay in preview mode), which is why PreviewStage gives
  // a cached image precedence over both.
  const [previewUrls, setPreviewUrls] = useState<Partial<Record<EditorSideName, string>>>({})
  const [previewRendering, setPreviewRendering] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // EditorStage's own per-side cache, seeded from initialDesign, kept
  // updated via onSnapshotCached — see designApi.ts's canonicalizeSideSnapshot
  // for why we need each side's {json,width,height} rather than just json.
  const initialStageSnapshots = useMemo<Partial<Record<EditorSideName, SideSnapshot>>>(() => {
    if (!initialDesign) return {}
    const out: Partial<Record<EditorSideName, SideSnapshot>> = {}
    for (const side of ['front', 'back'] as EditorSideName[]) {
      const snap = initialDesign.design_json[side]
      if (snap) out[side] = { json: JSON.stringify(snap), width: snap.canvasWidth, height: snap.canvasHeight }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const sideSnapshotsRef = useRef<Partial<Record<EditorSideName, SideSnapshot>>>(initialStageSnapshots)
  const handleSnapshotCached = useCallback((side: EditorSideName, snapshot: SideSnapshot) => {
    sideSnapshotsRef.current[side] = snapshot
  }, [])

  // Bug 3b (canvasGutter.ts) — the active side's PURE bleed-rect pixel
  // size, kept in sync by EditorStage's onBleedSizeChange. Everywhere
  // below that used to read `getCanvasSize(canvas)` (or `canvas.getWidth
  // ()/getHeight()`) as a stand-in for "the bleed rect's size" now reads
  // this instead, since the live canvas element is now gutter-inclusive.
  const bleedSizeRef = useRef({ width: 0, height: 0 })
  const handleBleedSizeChange = useCallback((width: number, height: number) => {
    bleedSizeRef.current = { width, height }
  }, [])
  const getBleedSize = useCallback(() => bleedSizeRef.current, [])

  // ── POD-V2.md §6.6/§6.7 — the "browse ready-made designs" drawer ────
  // `applyingTemplate` guards the async fit+load below against a fast
  // double-tap racing two applies onto the same side (see
  // handleApplyTemplate) and disables every card in the drawer while it's
  // true (TemplateDrawer's own `applying` prop).
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const handleOpenDesigns = useCallback(() => setTemplateDrawerOpen(true), [])

  // ── POD-UI3.md §4.7 — the preview object-URL lifecycle ──────────────
  // Three lifecycle refs, each guarding a different failure mode (a fourth,
  // `previewDesignRef`, is a separate concern — see below). All refs and
  // not state because every one of them has to be readable and writable
  // from an async continuation and from an unmount cleanup, i.e. from
  // places where a closed-over state value is by definition stale.
  //
  // `previewObjectUrlsRef` mirrors `previewUrls` and is the authoritative
  // list of URLs we still owe a `revokeObjectURL` for. React state can't
  // do that job: teardown happens in a cleanup function that must see
  // every URL created since it was registered, including ones written
  // after its closure was captured.
  //
  // `previewGenRef` is a session generation counter, bumped on every exit
  // from preview mode AND on unmount. Every in-flight render captures it
  // and re-checks it after its `await`; a mismatch means the shopper left
  // preview (or the component died) while the render was in flight, so the
  // render revokes the URL it just minted and writes no state. Without it
  // a slow render resolving after "Back to editing" would both leak a blob
  // and repopulate the cache we had just deliberately cleared — the cache
  // whose emptiness is the ONLY thing guaranteeing the next preview
  // reflects the shopper's latest edits.
  //
  // `previewInFlightRef` dedupes concurrent renders of the same side and
  // is what `previewRendering` is derived from, so two sides rendering at
  // once can't have the first to finish clear the spinner for the second.
  const previewObjectUrlsRef = useRef<Partial<Record<EditorSideName, string>>>({})
  const previewGenRef = useRef(0)
  const previewInFlightRef = useRef<Set<EditorSideName>>(new Set())
  // The canonical design captured ONCE when a preview session starts — see
  // `previewSessionDesign` below for why it must not be re-derived per side.
  const previewDesignRef = useRef<DesignJson | null>(null)

  const activeSideRow = sidesByName[activeSide]

  const rescanDpi = useCallback(
    (liveCanvas: FabricCanvas | null, side: EditorSideName) => {
      const row = sidesByName[side]
      if (!liveCanvas || !row) {
        setImageDpiInfos([])
        return
      }
      setImageDpiInfos(scanImageDpi(liveCanvas, bleedSizeRef.current.width, row.print_width_in))
    },
    [sidesByName]
  )

  const handleContentChange = useCallback(
    (count: number, json: string) => {
      setSidesState((prev) => ({ ...prev, [activeSide]: { json, objectCount: count } }))
      rescanDpi(canvas, activeSide)
    },
    [activeSide, canvas, rescanDpi]
  )

  // POD-UI3.md §4.5 — `interactive` gates the hook's window-level
  // keybindings. In preview mode the live canvas sits behind an opaque
  // rendered image, so a Cmd+Z there would mutate a design the shopper
  // cannot see.
  const objectsApi = useEditorObjects({
    fabric,
    canvas,
    onContentChange: handleContentChange,
    getBleedSize,
    interactive: mode === 'edit',
  })

  // POD-UI.md §3 Workstream C1/C2, revised for Bug 2 — mobile gets a
  // compact, ALWAYS-visible action bar the instant something is selected
  // (SelectionActionBar, rendered below) carrying delete/duplicate/layer/
  // colour, plus an explicit "Edit" control that opens the full bottom
  // Sheet on demand. The Sheet no longer auto-opens on selection: doing
  // so used to cover the canvas (including the very selection handles
  // needed to move/resize/rotate the object, and left no reachable
  // delete) — a design flaw in auto-opening a bottom sheet over a canvas
  // editor, not a coding slip. Desktop keeps an always-open right rail
  // with the same PropertiesPanel content. `useIsMobile` (a real
  // matchMedia listener, not a CSS-hidden wrapper) matters here because
  // Sheet has side effects — body scroll lock, focus trap, Escape handler —
  // that must not fire on desktop just because the sheet is visually hidden.
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek')

  // Closing the sheet no longer deselects — the whole point of Bug 2's
  // fix is that the object stays selected (and manipulable, and one tap
  // from delete via the action bar) whether or not the sheet is open.
  // Deselecting elsewhere (tapping empty canvas, Escape, etc.) is what
  // should close the sheet, not the other way around.
  useEffect(() => {
    if (!objectsApi.selected) setSheetOpen(false)
  }, [objectsApi.selected])

  // Preload the default design font as soon as the customizer mounts, so
  // the first "Add text" doesn't show a flash of the fallback font.
  useEffect(() => {
    void ensureFontsReady([DEFAULT_DESIGN_FONT])
  }, [])

  const sizeRow = useMemo(() => (product.sizes ?? []).find((s) => s.label === initialSize) ?? null, [product.sizes, initialSize])

  const selectedDpi = useMemo(() => {
    if (!objectsApi.selected) return null
    return imageDpiInfos.find((i) => i.object === objectsApi.selected)?.dpi ?? null
  }, [objectsApi.selected, imageDpiInfos])

  // POD.md §5.1 — non-blocking "may look blurry" indicator while editing,
  // scoped to the currently-active side's live canvas. The authoritative,
  // both-sides hard block lives in handleAddToCart below (scanCanonicalDpiIssues),
  // which is the real Phase 7 boundary the Phase 6 decisions log deferred to.
  const blockingDpiIssue = imageDpiInfos.some((i) => i.severity === 'block')

  /**
   * POD-UI3.md §4.7 — the single "what has the shopper actually designed?"
   * reader, shared by preview mode and add-to-cart so the two can never
   * drift. Gathers every side's live truth and canonicalizes it to the
   * reference coordinate space (designApi.ts / geometry.ts's
   * `computeReferenceGeometry`), returning a `DesignJson` that only carries
   * sides which actually have art.
   *
   * The active side comes from the LIVE canvas; every other side comes from
   * EditorStage's snapshot cache (`sideSnapshotsRef`, kept fresh by
   * `onSnapshotCached` on every swap-out) — which is why this needs no
   * forced side switch to see both sides.
   *
   * Bug 3b — the active side's width/height MUST be `bleedSizeRef.current`,
   * the PURE bleed-rect size, never `getCanvasSize(canvas)`: the live canvas
   * element is deliberately grown by `HANDLE_GUTTER_PX` on every side for
   * handle room (canvasGutter.ts), and `canonicalizeSideSnapshot` rescales
   * by the ratio of the size it is handed to the reference size — so a
   * gutter-inclusive width here would silently shrink every object relative
   * to what the shopper approved, in the preview AND in the print file.
   */
  const buildCanonicalDesign = useCallback((): DesignJson => {
    const perSide: Partial<Record<EditorSideName, { json: string; width: number; height: number }>> = {
      ...sideSnapshotsRef.current,
    }
    if (canvas) {
      perSide[activeSide] = { json: snapshotCanvas(canvas), width: bleedSizeRef.current.width, height: bleedSizeRef.current.height }
    }

    const design: DesignJson = { version: 1 }
    for (const side of sideOrder) {
      const row = sidesByName[side]
      const live = perSide[side]
      if (!row || !live) continue
      const canonical = canonicalizeSideSnapshot(
        live.json,
        live.width,
        live.height,
        row.image_w,
        row.image_h,
        { x: row.print_x, y: row.print_y, w: row.print_w, h: row.print_h },
        settings.printBleedPercent,
        settings.printSafePercent
      )
      if (canonical.objects && canonical.objects.length > 0) {
        design[side] = canonical
      }
    }
    return design
  }, [canvas, activeSide, sideOrder, sidesByName, settings.printBleedPercent, settings.printSafePercent])

  /**
   * POD-UI3.md §4.7 — the design a preview session renders from, captured
   * once at the moment the session starts and reused for every side.
   *
   * This is not an optimization, it is the fix for a real ordering bug.
   * Tabbing sides while in preview changes `sideKey`, which makes
   * EditorStage swap the live canvas's contents — and that swap is `async`
   * (`await restoreCanvas`). Child effects run before parent effects, so by
   * the time this component's render effect fires, EditorStage has already
   * cached the OUTGOING side but has not yet finished loading the incoming
   * one: `buildCanonicalDesign()` at that instant would attribute the old
   * side's objects to the newly active side and preview the wrong artwork.
   *
   * Capturing once sidesteps that entirely, and is sound because the design
   * is IMMUTABLE for a whole preview session: Fabric interactivity is off,
   * the tool rail / properties panel / action bar are all unmounted, and
   * useEditorObjects' keybindings are gated by `interactive` (§4.5). There
   * is no path by which the canvas can change between entering preview and
   * leaving it.
   */
  function previewSessionDesign(): DesignJson {
    if (!previewDesignRef.current) previewDesignRef.current = buildCanonicalDesign()
    return previewDesignRef.current
  }

  /**
   * Renders one side's composite to an object URL and files it in the
   * cache. Called for the active side on entering preview, by the effect
   * below when the shopper tabs to a side that isn't cached yet, and by
   * PreviewStage's retry button.
   *
   * A side with no art is NOT special-cased: `renderSidePreview` already
   * treats an undefined snapshot as "mockup only" (preview.ts), so an empty
   * side correctly previews as the plain product photo.
   */
  async function renderPreviewSide(side: EditorSideName) {
    const row = sidesByName[side]
    if (!fabric || !row) return
    if (previewInFlightRef.current.has(side)) return

    const gen = previewGenRef.current
    previewInFlightRef.current.add(side)
    setPreviewRendering(true)
    setPreviewError(null)
    try {
      const design = previewSessionDesign()
      const blob = await renderSidePreview({
        fabric,
        mockupUrl: row.image_url,
        mockupNaturalW: row.image_w,
        mockupNaturalH: row.image_h,
        printRect: { x: row.print_x, y: row.print_y, w: row.print_w, h: row.print_h },
        bleedPercent: settings.printBleedPercent,
        safePercent: settings.printSafePercent,
        snapshot: design[side],
      })
      const url = URL.createObjectURL(blob)
      if (gen !== previewGenRef.current) {
        // The shopper went back to editing (or navigated away) while this
        // render was in flight. Revoke immediately — this URL has never
        // been handed to anything, and the teardown that bumped the
        // generation has already run, so nothing else will ever revoke it.
        // Writing state here would also repopulate the cache that teardown
        // just cleared, making the NEXT preview show pre-edit pixels.
        URL.revokeObjectURL(url)
        return
      }
      previewObjectUrlsRef.current[side] = url
      setPreviewUrls((prev) => ({ ...prev, [side]: url }))
    } catch {
      if (gen !== previewGenRef.current) return
      setPreviewError('We could not render this preview. Please try again.')
    } finally {
      // Only the current session owns the in-flight set / spinner flag; a
      // stale render must not clear a marker a NEW session has since added
      // for the same side (teardown already emptied the set for it).
      if (gen === previewGenRef.current) {
        previewInFlightRef.current.delete(side)
        setPreviewRendering(previewInFlightRef.current.size > 0)
      }
    }
  }

  // Latest-ref so the effect below can start a render without taking
  // `renderPreviewSide`'s (per-render, unstable) identity as a dependency —
  // which would otherwise re-fire it on unrelated re-renders.
  const renderPreviewSideRef = useRef(renderPreviewSide)
  renderPreviewSideRef.current = renderPreviewSide

  // POD-UI3.md §4.7 — lazy, per-side, cached. Only ever renders a side that
  // isn't in the cache yet, so entering preview costs one render and
  // tabbing back and forth costs none. A failed side stays failed until
  // retry: this effect's dependencies don't change on failure, so it can't
  // spin.
  //
  // `fabric` is a dependency because `renderPreviewSide` needs the module
  // and bails out without it: a shopper can reach Preview before the lazy
  // Fabric chunk has landed, and this is what picks the render back up the
  // moment it does instead of leaving a spinner with nothing behind it.
  useEffect(() => {
    if (mode !== 'preview') return
    if (previewUrls[activeSide]) return
    void renderPreviewSideRef.current(activeSide)
  }, [mode, activeSide, previewUrls, fabric])

  // POD-UI3.md §4.7 — leaving preview mode ends the session: bump the
  // generation (so anything still in flight discards itself), drop the
  // captured design, revoke every URL and empty the cache. Clearing the
  // cache is the whole reason a subsequent preview reflects the shopper's
  // latest edits rather than a composite rendered before them.
  useEffect(() => {
    if (mode === 'preview') return
    previewGenRef.current += 1
    previewInFlightRef.current.clear()
    previewDesignRef.current = null
    const held = Object.values(previewObjectUrlsRef.current).filter((u): u is string => !!u)
    previewObjectUrlsRef.current = {}
    // Guarded so the mount-time run of this effect (mode starts as 'edit')
    // doesn't hand React a fresh `{}` and trigger a pointless re-render.
    if (held.length > 0) {
      for (const url of held) URL.revokeObjectURL(url)
      setPreviewUrls({})
    }
    setPreviewError(null)
    setPreviewRendering(false)
  }, [mode])

  // POD-UI3.md §4.7 — the same teardown on unmount (navigating away while
  // still in preview). Bumping the generation here matters as much as the
  // revoking does: a render resolving after this component is gone would
  // otherwise park its blob in a ref nothing will ever read again, which is
  // a leak for the lifetime of the document.
  useEffect(() => {
    return () => {
      previewGenRef.current += 1
      for (const url of Object.values(previewObjectUrlsRef.current)) {
        if (url) URL.revokeObjectURL(url)
      }
      previewObjectUrlsRef.current = {}
    }
  }, [])

  async function handlePreview() {
    if (canvas) {
      const families = Array.from(
        new Set(
          canvas
            .getObjects()
            // Classification goes through fabric/objectTypes.ts (see its
            // header for why a raw `.type === 'i-text'` isn't safe alone).
            .filter((o) => isTextObject(o))
            .map((o) => (o as unknown as { fontFamily?: string }).fontFamily)
            .filter((f): f is string => !!f)
        )
      )
      await ensureFontsReady(families)
    }
    setMode('preview')
    // Kick the active side's render off from HERE, not just from the effect
    // above, so the capture in `previewSessionDesign` happens in this
    // handler — with the live canvas settled on the active side — rather
    // than after some later effect pass. The effect still covers tabbing to
    // the other side; `previewInFlightRef` keeps the two paths from
    // double-rendering the same side.
    void renderPreviewSide(activeSide)
  }

  async function handlePickImage(file: File) {
    if (!isAcceptedArtFile(file)) {
      addToast('Please choose a PNG, JPG, WebP or SVG file.', 'error')
      return
    }
    if (file.size > settings.maxArtUploadMb * 1024 * 1024) {
      addToast(`That file is larger than the ${settings.maxArtUploadMb}MB limit.`, 'error')
      return
    }

    setUploading(true)
    try {
      let blob: Blob = file
      let isVector = false
      const looksLikeSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
      if (looksLikeSvg) {
        // POD.md §5.9 — sanitize BEFORE it ever reaches the upload endpoint.
        const result = await sanitizeSvgFile(file)
        if (!result.ok) {
          addToast('That SVG could not be read.', 'error')
          return
        }
        blob = new Blob([result.svg], { type: 'image/svg+xml' })
        isVector = true
      }
      // Art is always uploaded for real now (POD.md §7.1's /api/uploads/art
      // exists) — the Phase 6 404-fallback that returned a local blob: URL
      // is gone (see uploadArt.ts). design_json can only ever reference a
      // same-origin /img/uploads/... URL from here on.
      const { url } = await uploadArt(blob, file.name, settings.maxArtUploadMb)
      await objectsApi.addImage(url, { isVectorAsset: isVector, sourceUrl: url })
    } catch (err) {
      addToast(err instanceof UploadArtError ? err.message : 'That upload failed. Please try again.', 'error')
    } finally {
      setUploading(false)
    }
  }

  /**
   * POD-V2.md §6.5/§6.7 — apply a picked template to the ACTIVE side.
   * `fitSnapshotToCanvas` maps the template's own `canvas_w x canvas_h`
   * coordinate space onto `bleedSizeRef.current` — the live PURE bleed size
   * (never `canvas.getWidth()`, which is gutter-inclusive — see
   * `bleedSizeRef`'s own comment above) — so the result is already
   * positioned correctly for the live canvas's current coordinate space
   * with no further rescale needed before `restoreCanvas`.
   *
   * `restoreCanvas` -> `canvas.loadFromJSON` REPLACES the canvas's existing
   * contents wholesale (Vistaprint behaviour, §6.5) — the same call
   * EditorStage's own side-swap uses to restore a cached side, and it does
   * so with no separate `clear()` needed (see that component's header
   * comment). Bracketing it with `suspendHistory` mutes the flurry of
   * `object:added` events `loadFromJSON` fires for a multi-object template
   * — the same bracketing EditorStage uses around its own side-swap
   * restore — so the whole replace lands as ONE history entry rather than
   * one per object.
   *
   * The bracket is closed with `resumeHistoryAsOneEntry`, NOT the
   * `resumeAndReseedHistory` a side swap uses, and the difference is
   * functional. Reseeding wipes the undo stack, which is correct for a
   * side swap but would make applying a template IRREVERSIBLE — since a
   * template replaces the side's contents wholesale, one mis-tap on a
   * template card would destroy the shopper's work with no way back.
   * Keeping the stack means a single Cmd+Z returns to the pre-apply
   * state, which is what §6.5's "as a single undo entry, so it's
   * recoverable" actually requires.
   */
  async function handleApplyTemplate(template: TemplateSummary) {
    if (!canvas || applyingTemplate) return
    const bleed = bleedSizeRef.current
    if (bleed.width <= 0 || bleed.height <= 0) return

    setApplyingTemplate(true)
    try {
      const fitted = fitSnapshotToCanvas(template.design_json, template.canvas_w, template.canvas_h, bleed.width, bleed.height)
      objectsApi.suspendHistory()
      await restoreCanvas(canvas, JSON.stringify(fitted))
      objectsApi.resumeHistoryAsOneEntry()
      setTemplateDrawerOpen(false)
    } catch {
      addToast('Could not apply that design. Please try again.', 'error')
    } finally {
      setApplyingTemplate(false)
    }
  }

  /**
   * POD-V2.md §6.4 — "Save as template", the admin authoring mode's only
   * action (see `TemplateModeConfig`). Captures the ACTIVE side's live
   * canvas exactly as it is — deliberately NOT run through
   * `canonicalizeSideSnapshot`/`computeReferenceGeometry` the way
   * add-to-cart does, because a template has no fixed "reference size" of
   * its own to canonicalize toward: it gets uniformly re-fit
   * (`fitSnapshotToCanvas`) into whatever product it's later applied to
   * regardless, so `bleedSizeRef.current` — the live bleed size
   * CustomizerEditor already tracks for exactly this kind of read — is just
   * as valid a coordinate space to persist as any other, and skips a
   * rescale step that would buy nothing.
   */
  async function handleSaveAsTemplate() {
    if (!templateMode || !fabric || !canvas || templateMode.saving) return
    const { width, height } = bleedSizeRef.current
    if (width <= 0 || height <= 0) return

    const design_json = JSON.parse(snapshotCanvas(canvas)) as FabricSnapshot
    if (!snapshotHasArt(design_json)) {
      addToast('Add some artwork before saving this template.', 'error')
      return
    }

    try {
      const preview = await renderTemplatePreview(fabric, design_json, width, height)
      await templateMode.onSave({ design_json, canvas_w: width, canvas_h: height, preview })
    } catch {
      addToast('Could not save this template. Please try again.', 'error')
    }
  }

  /**
   * POD.md §3.5 / §7.2 — the real add-to-cart sequence:
   *   1. Art is already uploaded (at drop time — see handlePickImage above),
   *      so there is nothing to re-upload here.
   *   2. Canonicalize both sides' current state (live canvas for the active
   *      side, EditorStage's cache for the inactive one) to the reference
   *      size — `buildCanonicalDesign` above, shared with preview mode
   *      (POD-UI3.md §4.7) so the two can't drift.
   *   3. POST /api/designs -> design_id.
   *   4. Render + PUT a flattened preview per designed side.
   *   5. Push a CartLine with the correct unit_price/print_fees/preview_url.
   *   6. Navigate to the product page and open the cart.
   * Any failure at step 3 or 4 aborts BEFORE the cart line is pushed, so a
   * shopper never ends up with a cart line pointing at a missing preview.
   */
  async function handleAddToCart() {
    if (!fabric || addingToCart) return

    setAddingToCart(true)
    setAddingToCartStatus('Saving your design…')
    try {
      // ── Step 1/2: gather each side's design, canonicalized ──
      // Deliberately the SAME frozen capture the previews were rendered
      // from (`previewSessionDesign`, POD-UI3.md §4.7), not a fresh
      // `buildCanonicalDesign()` read of the live canvas. Two reasons, and
      // the second is a correctness fix, not a preference:
      //
      //  1. "What you previewed is what you buy" becomes true by
      //     construction: the design row, the uploaded previews and the
      //     images the shopper actually approved all come from one object.
      //  2. A fresh live read here is racy in exactly the way
      //     `previewSessionDesign` documents. Switching sides makes
      //     EditorStage swap the canvas's contents behind an `await
      //     restoreCanvas`; a shopper who taps a side tab in preview and
      //     hits Add to cart before that settles would have the OUTGOING
      //     side's objects snapshotted and attributed to the newly-active
      //     side — the wrong artwork on the wrong side, all the way
      //     through to the print file. The frozen capture predates any
      //     such swap, so it cannot observe a half-loaded canvas.
      //
      // This is NOT the blob cache §4.7 rejects. That was about reusing
      // rendered WebP bytes for the R2 upload, whose cache key (canonical
      // JSON + mockup + settings) is a real correctness surface. This
      // reuses the canonical `DesignJson` itself, captured in this same
      // preview session, during which the design provably cannot change
      // (Fabric interactivity off, tool rail and properties panel
      // unmounted, keybindings gated by `interactive`).
      //
      // Falls back to a live read if no session captured one, so the
      // function stays correct even if "Add to cart" ever becomes
      // reachable outside preview mode.
      const design = previewSessionDesign()

      const sidesUsed = sidesUsedFrom(design, sideOrder)
      if (sidesUsed.length === 0) {
        addToast('Add some artwork to at least one side before adding to cart.', 'error')
        return
      }

      // Authoritative both-sides DPI gate (POD.md §5.1 — block below 100
      // DPI), superseding the active-side-only live scan.
      const dpiIssues = scanCanonicalDpiIssues(
        design,
        sideOrder.map((side) => ({ side, print_width_in: sidesByName[side]!.print_width_in }))
      )
      const blocking = dpiIssues.find((i) => i.severity === 'block')
      if (blocking) {
        addToast(`The image on the ${SIDE_LABEL[blocking.side].toLowerCase()} is too low-resolution to print well. Use a larger image.`, 'error')
        return
      }

      // ── Step 3: persist the design ──
      const designId = await createDesign(product.id, design, sidesUsed, token)

      // ── Step 4: render + upload a preview per designed side ──
      setAddingToCartStatus('Rendering previews…')
      // Named apart from the `previewUrls` render cache above (POD-UI3.md
      // §4.7): these are PERSISTED R2 URLs for the cart line, not
      // short-lived blob: URLs, and nothing revokes them.
      const uploadedPreviewUrls: Partial<Record<EditorSideName, string>> = {}
      for (const side of sidesUsed) {
        const row = sidesByName[side]
        if (!row) continue
        setAddingToCartStatus(`Uploading ${SIDE_LABEL[side].toLowerCase()} preview…`)
        const blob = await renderSidePreview({
          fabric,
          mockupUrl: row.image_url,
          mockupNaturalW: row.image_w,
          mockupNaturalH: row.image_h,
          printRect: { x: row.print_x, y: row.print_y, w: row.print_w, h: row.print_h },
          bleedPercent: settings.printBleedPercent,
          safePercent: settings.printSafePercent,
          snapshot: design[side],
        })
        const url = await uploadDesignPreview(designId, side, blob, token)
        uploadedPreviewUrls[side] = url
      }

      // ── Step 5: push the cart line — only now that everything above succeeded ──
      const printFees: FooterSideFee[] = sidesUsed
        .map((side) => {
          const row = sidesByName[side]
          return row ? { side, label: SIDE_LABEL[side], fee: row.print_fee } : null
        })
        .filter((f): f is FooterSideFee => !!f)
      const sizeDelta = sizeRow?.price_delta ?? 0
      const unitPrice = product.base_price + sizeDelta + printFees.reduce((sum, f) => sum + f.fee, 0)
      const previewUrl = uploadedPreviewUrls[sideOrder[0]] ?? Object.values(uploadedPreviewUrls)[0] ?? null
      const maxQty = sizeRow ? sizeRow.stock_count : product.stock_count
      // POD-V2.md §5 / POD-UI4.md §4.1 — start at the merchant's purchase
      // floor, not a flat 1. `computeLine` rejects a line below
      // `min_order_qty` with `below_min_order_qty`, so hardcoding 1 here
      // would hand a shopper who just spent minutes designing something an
      // un-checkoutable cart on any customizable product whose merchant set
      // a minimum — recoverable only by guessing that the cart drawer's
      // stepper is what unblocks them. The plain (non-customizable) path
      // already floors quantity this way on the product page.
      //
      // Deliberately NOT clamped against `maxQty` here: if stock is genuinely
      // below the minimum the merchant demands, that is a real conflict in
      // the merchant's own data, and `addLine`'s existing clamp plus the
      // server's rejection surface it honestly rather than silently shipping
      // a quantity nobody asked for.
      const initialQty = Math.max(1, product.min_order_qty)

      addLine({
        product_id: product.id,
        name: product.name,
        size: sizeRow?.label ?? null,
        variant: initialVariant ?? null,
        design_id: designId,
        preview_url: previewUrl,
        base_price: product.base_price,
        size_delta: sizeDelta,
        print_fees: printFees.map((f) => ({ side: f.side, fee: f.fee })),
        unit_price: unitPrice,
        quantity: initialQty,
        max_qty: maxQty,
      })

      addToast('Added to cart')
      openCart()
      navigate(`/product/${product.id}`)
    } catch (err) {
      addToast(err instanceof DesignApiError ? err.message : 'Could not add this design to your cart. Please try again.', 'error')
    } finally {
      setAddingToCart(false)
      setAddingToCartStatus('')
    }
  }

  // POD-V2.md §6.6 — the active side's live bleed-rect aspect ratio, fed to
  // TemplateDrawer/templatesApi.ts's `aspect` param. Recomputed on every
  // render (never memoized against `bleedSizeRef` — it's a ref, not state)
  // which is fine: this value only actually needs to be fresh at the
  // instant the drawer opens, and it's cheap to compute.
  const templateAspect = bleedSizeRef.current.height > 0 ? bleedSizeRef.current.width / bleedSizeRef.current.height : 0

  const feeSides: FooterSideFee[] = customizableSides.map((s) => ({
    side: s.side as EditorSideName,
    label: SIDE_LABEL[s.side as EditorSideName],
    fee: s.print_fee,
  }))

  const propertiesPanelProps = {
    canvas,
    selected: objectsApi.selected,
    onCommit: objectsApi.commitChange,
    imageDpi: selectedDpi,
    onDuplicate: objectsApi.duplicateSelected,
    onDelete: objectsApi.deleteSelected,
    onBringForward: objectsApi.bringForward,
    onSendBackward: objectsApi.sendBackward,
    onBringToFront: objectsApi.bringToFront,
    onSendToBack: objectsApi.sendToBack,
    onCenter: objectsApi.centerSelected,
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-paper">
      <header className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-6">
        <button
          onClick={() => {
            // In template mode the shopper's back target (the reference
            // product's public page) is the wrong destination AND its name is
            // the wrong label — see TemplateModeConfig.onExit / .exitLabel.
            if (templateMode) {
              if (templateMode.onExit) templateMode.onExit()
              else navigate(-1)
              return
            }
            navigate(`/product/${product.id}`)
          }}
          className="flex min-h-11 min-w-0 items-center gap-1.5 truncate text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink"
        >
          <span aria-hidden className="shrink-0">←</span>{' '}
          <span className="truncate">{templateMode ? (templateMode.exitLabel ?? 'Back') : product.name}</span>
        </button>
        <SideTabs sides={sideOrder} activeSide={activeSide} onChange={setActiveSide} state={sidesState} className="shrink-0" />
        <Badge variant={mode === 'preview' ? 'accent' : 'neutral'} className="shrink-0 uppercase tracking-wide">
          {mode === 'preview' ? 'Preview' : 'Editing'}
        </Badge>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {mode === 'edit' && (
          <div className="hidden md:block">
            <ToolRail
              onOpenDesigns={handleOpenDesigns}
              onAddText={() => objectsApi.addText(DEFAULT_DESIGN_FONT)}
              onPickImage={handlePickImage}
              onAddShape={(kind) => objectsApi.addShape(kind)}
              onUndo={objectsApi.undo}
              onRedo={objectsApi.redo}
              canUndo={objectsApi.canUndo}
              canRedo={objectsApi.canRedo}
              uploading={uploading}
            />
          </div>
        )}

        {/* POD-UI.md §3 C2 — the stage is the only flexible element in this
            row: on mobile the properties panel no longer lives in-flow here
            (it moved to an overlay Sheet below), so the stage claims the
            full remaining viewport height instead of being squeezed by a
            224px strip.
            Bug 2 requirement 3 — while the Sheet is open on mobile, this
            container's bottom padding reserves exactly the Sheet's own
            height (peek or full, whichever it's currently snapped to), so
            the stage — and EditorStage's own ResizeObserver-driven layout
            inside it — shrinks to fit fully above the Sheet instead of the
            Sheet overlaying (and hiding) the canvas. Closing the Sheet
            drops the padding and the stage animates back to full size. */}
        <div
          className="relative min-h-0 flex-1 transition-[padding-bottom] duration-base ease-out-soft"
          style={isMobile && sheetOpen ? { paddingBottom: sheetSnap === 'full' ? MOBILE_SHEET_FULL : MOBILE_SHEET_PEEK } : undefined}
        >
          {activeSideRow ? (
            <EditorStage
              fabric={fabric}
              sideKey={activeSide}
              mockupUrl={activeSideRow.image_url}
              imageNaturalW={activeSideRow.image_w}
              imageNaturalH={activeSideRow.image_h}
              printRect={{ x: activeSideRow.print_x, y: activeSideRow.print_y, w: activeSideRow.print_w, h: activeSideRow.print_h }}
              bleedPercent={settings.printBleedPercent}
              safePercent={settings.printSafePercent}
              mode={mode}
              onCanvasReady={setCanvas}
              onObjectCountChange={(side, count) =>
                setSidesState((prev) => ({ ...prev, [side]: { json: prev[side]?.json ?? null, objectCount: count } }))
              }
              onBeforeSideSwap={objectsApi.suspendHistory}
              onAfterSideSwap={objectsApi.resumeAndReseedHistory}
              initialSnapshots={initialStageSnapshots}
              onSnapshotCached={handleSnapshotCached}
              onBleedSizeChange={handleBleedSizeChange}
              objectCount={objectsApi.objectCount}
              onOpenDesigns={handleOpenDesigns}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">This product has no customizable side.</div>
          )}

          {/* POD-UI3.md §4.6 — preview mode is an OVERLAY, a SIBLING of
              EditorStage inside this same relative container, never a
              replacement for it. EditorStage owns the single Fabric canvas
              instance and the per-side snapshot cache that keeps front and
              back independent; conditionally unmounting it on mode change
              would dispose that canvas and destroy the shopper's design.
              So it stays mounted and laid out underneath, and this simply
              covers it opaquely. */}
          {mode === 'preview' && activeSideRow && (
            <PreviewStage
              imageUrl={previewUrls[activeSide] ?? null}
              rendering={previewRendering}
              error={previewError}
              onRetry={() => void renderPreviewSide(activeSide)}
            />
          )}

          {/* `z-30` so this stays visible ABOVE the preview overlay (z-20):
              a shopper can tap Preview before the lazy Fabric chunk has
              landed, and "Loading design tools…" is the honest thing to
              show them until it has. */}
          {!fabric && (
            <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-paper/80 backdrop-blur-[1px]">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
              <p className="text-sm text-ink-soft">Loading design tools…</p>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-line bg-surface md:block">
            <PropertiesPanel {...propertiesPanelProps} />
          </div>
        )}
      </div>

      {/* Bug 2 — the compact, always-reachable action bar: rendered the
          instant something is selected on mobile, WITHOUT opening the full
          Sheet, so a freshly inserted object's handles are never covered
          and delete/duplicate/reorder/colour are one tap away. Sits above
          the tool rail in document order (below in the JSX = lower on
          screen in this flex-col layout puts the rail BELOW this bar). */}
      {isMobile && mode === 'edit' && objectsApi.selected && (
        <SelectionActionBar
          selected={objectsApi.selected}
          onDelete={objectsApi.deleteSelected}
          onDuplicate={objectsApi.duplicateSelected}
          onBringForward={objectsApi.bringForward}
          onSendBackward={objectsApi.sendBackward}
          onCommit={objectsApi.commitChange}
          onOpenSheet={() => setSheetOpen(true)}
        />
      )}

      {mode === 'edit' && (
        <div className="md:hidden">
          <ToolRail
            onOpenDesigns={handleOpenDesigns}
            onAddText={() => objectsApi.addText(DEFAULT_DESIGN_FONT)}
            onPickImage={handlePickImage}
            onAddShape={(kind) => objectsApi.addShape(kind)}
            onUndo={objectsApi.undo}
            onRedo={objectsApi.redo}
            canUndo={objectsApi.canUndo}
            canRedo={objectsApi.canRedo}
            uploading={uploading}
          />
        </div>
      )}

      {/* POD-UI.md §3 C1, revised for Bug 2 — this Sheet now opens ONLY on
          deliberate request (the action bar's "Edit" button above), never
          automatically on selection: auto-opening used to cover the very
          canvas/handles a shopper needed to manipulate the object they'd
          just selected. `useIsMobile` (not a CSS breakpoint) still gates
          whether this ever mounts open, so the Sheet's body-scroll-lock/
          focus-trap side effects never fire on desktop. Closing it does
          NOT deselect — the object stays selected (and reachable via the
          action bar) either way. */}
      {isMobile && mode === 'edit' && (
        <Sheet
          open={sheetOpen && !!objectsApi.selected}
          onClose={() => setSheetOpen(false)}
          onSnapChange={setSheetSnap}
          initialSnap="peek"
          peekHeight={MOBILE_SHEET_PEEK}
          fullHeight={MOBILE_SHEET_FULL}
          title={isTextObject(objectsApi.selected) ? 'Text' : isImageObject(objectsApi.selected) ? 'Image' : 'Shape'}
        >
          <PropertiesPanel {...propertiesPanelProps} />
        </Sheet>
      )}

      {/* POD-V2.md §6.4 — template-authoring mode's ENTIRE footprint on this
          component's render: a single save action, no price, no Preview, no
          Add to cart. `PriceFooter` itself is untouched (owned by neither
          this task's file list nor edited here) — this just doesn't render
          it when `templateMode` is set. */}
      {templateMode ? (
        <div className="flex items-center justify-end gap-3 border-t border-line bg-surface px-4 py-3 sm:px-6">
          <Button variant="primary" size="lg" loading={templateMode.saving} onClick={handleSaveAsTemplate}>
            {templateMode.saveLabel ?? 'Save as template'}
          </Button>
        </div>
      ) : (
        <PriceFooter
          currency={currency}
          basePrice={product.base_price}
          sizeLabel={sizeRow?.label ?? null}
          sizeDelta={sizeRow?.price_delta ?? 0}
          sides={feeSides}
          sidesState={sidesState}
          mode={mode}
          onPreview={handlePreview}
          onBackToEdit={() => setMode('edit')}
          onAddToCart={handleAddToCart}
          blockingDpiIssue={blockingDpiIssue}
          addingToCart={addingToCart}
          addingToCartStatus={addingToCartStatus}
        />
      )}

      <TemplateDrawer
        open={templateDrawerOpen}
        category={product.category}
        aspect={templateAspect}
        onClose={() => setTemplateDrawerOpen(false)}
        onApply={handleApplyTemplate}
        applying={applyingTemplate}
      />
    </div>
  )
}
