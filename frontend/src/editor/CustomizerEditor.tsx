import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './fonts.css'
import { loadFabric, type FabricModule, type FabricCanvas } from './fabric/loadFabric'
import { snapshotCanvas } from './fabric/canvas'
import { scanImageDpi, type ImageDpiInfo } from './fabric/selection'
import { isImageObject, isTextObject } from './fabric/objectTypes'
import { useEditorSettings } from './useEditorSettings'
import { useEditorObjects } from './useEditorObjects'
import EditorStage, { type SideSnapshot } from './EditorStage'
import ToolRail from './components/ToolRail'
import PropertiesPanel from './components/PropertiesPanel'
import SelectionActionBar from './components/SelectionActionBar'
import SideTabs from './components/SideTabs'
import PriceFooter, { type FooterSideFee } from './components/PriceFooter'
import { useIsMobile } from './components/useIsMobile'
import Sheet, { type SheetSnap } from '../components/ui/Sheet'
import Badge from '../components/ui/Badge'
import { DEFAULT_DESIGN_FONT, ensureFontsReady } from './fonts'
import { uploadArt, isAcceptedArtFile, UploadArtError } from './uploadArt'
import { sanitizeSvgFile } from './sanitizeSvg'
import { canonicalizeSideSnapshot, createDesign, uploadDesignPreview, DesignApiError } from './designApi'
import { renderSidePreview } from './preview'
import { scanCanonicalDpiIssues, sidesUsedFrom, type DesignJson } from './designSchema'
import { currencySymbol } from '../lib/storeConfig'
import { useSettings } from '../lib/useSettings'
import { useToastStore } from '../store/toastStore'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'
import type { ProductDetail, ProductSide } from '../lib/types'
import type { FetchedDesign } from './designApi'
import type { EditorMode, EditorSideName, SidesRuntimeState } from './types'

export interface CustomizerEditorProps {
  product: ProductDetail
  initialSize: string | null
  /** POD.md §7.3 — re-opening an existing design via `/customize/:productId?design=<id>` (from the cart's "Edit design" link or "My Designs"). Editing always saves as a NEW design row on add-to-cart (see designApi.ts / decisions log) — this only seeds the starting canvas state. */
  initialDesign?: FetchedDesign | null
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
 * two-layer stage (EditorStage), the object model / undo-redo
 * (useEditorObjects), the tool rail, the per-object properties panel, the
 * side tabs (each side's Fabric state is independent — §6.7), the live
 * price / preview footer (§6.7, §6.8), and — as of Phase 7 — the real
 * add-to-cart persistence sequence (§3.5, §7.2): save the design, render +
 * upload a flattened preview per designed side, then push a cart line.
 *
 * This component is itself lazy-loaded (see CustomizePage.tsx's
 * React.lazy) and is the only place in the app that imports Fabric or
 * fonts.css, so neither ships in the main bundle.
 */
export default function CustomizerEditor({ product, initialSize, initialDesign }: CustomizerEditorProps) {
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

  const objectsApi = useEditorObjects({ fabric, canvas, onContentChange: handleContentChange, getBleedSize })

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
   * POD.md §3.5 / §7.2 — the real add-to-cart sequence:
   *   1. Art is already uploaded (at drop time — see handlePickImage above),
   *      so there is nothing to re-upload here.
   *   2. Canonicalize both sides' current state (live canvas for the active
   *      side, EditorStage's cache for the inactive one) to the reference
   *      size — see designApi.ts / geometry.ts's computeReferenceGeometry.
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
      // ── Step 1/2: gather each side's live-truth {json,width,height} ──
      const perSide: Partial<Record<EditorSideName, { json: string; width: number; height: number }>> = {
        ...sideSnapshotsRef.current,
      }
      if (canvas) {
        // Bug 3b — PURE bleed size (bleedSizeRef), never getCanvasSize(canvas)
        // (which now includes the handle gutter) — canonicalizeSideSnapshot
        // rescales by ratio, so a gutter-inclusive width here would silently
        // shrink every object relative to what the shopper actually approved.
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
      const previewUrls: Partial<Record<EditorSideName, string>> = {}
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
        previewUrls[side] = url
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
      const previewUrl = previewUrls[sideOrder[0]] ?? Object.values(previewUrls)[0] ?? null
      const maxQty = sizeRow ? sizeRow.stock_count : product.stock_count

      addLine({
        product_id: product.id,
        name: product.name,
        size: sizeRow?.label ?? null,
        design_id: designId,
        preview_url: previewUrl,
        base_price: product.base_price,
        size_delta: sizeDelta,
        print_fees: printFees.map((f) => ({ side: f.side, fee: f.fee })),
        unit_price: unitPrice,
        quantity: 1,
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
          onClick={() => navigate(`/product/${product.id}`)}
          className="flex min-h-11 min-w-0 items-center gap-1.5 truncate text-sm font-medium text-ink-soft transition-colors duration-fast hover:text-ink"
        >
          <span aria-hidden className="shrink-0">←</span> <span className="truncate">{product.name}</span>
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
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">This product has no customizable side.</div>
          )}
          {!fabric && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper/80 backdrop-blur-[1px]">
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
    </div>
  )
}
