import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './fonts.css'
import { loadFabric, type FabricModule, type FabricCanvas } from './fabric/loadFabric'
import { getCanvasSize } from './fabric/canvas'
import { scanImageDpi, type ImageDpiInfo } from './fabric/selection'
import { useEditorSettings } from './useEditorSettings'
import { useEditorObjects } from './useEditorObjects'
import EditorStage from './EditorStage'
import ToolRail from './components/ToolRail'
import PropertiesPanel from './components/PropertiesPanel'
import SideTabs from './components/SideTabs'
import PriceFooter, { type FooterSideFee } from './components/PriceFooter'
import { DEFAULT_DESIGN_FONT, ensureFontsReady } from './fonts'
import { uploadArt, isAcceptedArtFile, UploadArtError } from './uploadArt'
import { sanitizeSvgFile } from './sanitizeSvg'
import { currencySymbol } from '../lib/storeConfig'
import { useSettings } from '../lib/useSettings'
import { useToastStore } from '../store/toastStore'
import type { ProductDetail, ProductSide } from '../lib/types'
import type { EditorMode, EditorSideName, SidesRuntimeState } from './types'

export interface CustomizerEditorProps {
  product: ProductDetail
  initialSize: string | null
}

const SIDE_LABEL: Record<EditorSideName, string> = { front: 'Front', back: 'Back' }

/**
 * POD.md §6 — the customizer. Orchestrates the lazy Fabric module, the
 * two-layer stage (EditorStage), the object model / undo-redo
 * (useEditorObjects), the tool rail, the per-object properties panel, the
 * side tabs (each side's Fabric state is independent — §6.7), and the
 * live price / preview footer (§6.7, §6.8).
 *
 * This component is itself lazy-loaded (see CustomizePage.tsx's
 * React.lazy) and is the only place in the app that imports Fabric or
 * fonts.css, so neither ships in the main bundle.
 */
export default function CustomizerEditor({ product, initialSize }: CustomizerEditorProps) {
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)
  const { currency: storeCurrency } = useSettings()
  const currency = currencySymbol(storeCurrency)
  const { settings } = useEditorSettings()

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

  const [activeSide, setActiveSide] = useState<EditorSideName>(sideOrder[0] ?? 'front')
  const [mode, setMode] = useState<EditorMode>('edit')
  const [canvas, setCanvas] = useState<FabricCanvas | null>(null)
  const [sidesState, setSidesState] = useState<SidesRuntimeState>({})
  const [uploading, setUploading] = useState(false)
  const [imageDpiInfos, setImageDpiInfos] = useState<ImageDpiInfo[]>([])

  const activeSideRow = sidesByName[activeSide]

  const rescanDpi = useCallback(
    (liveCanvas: FabricCanvas | null, side: EditorSideName) => {
      const row = sidesByName[side]
      if (!liveCanvas || !row) {
        setImageDpiInfos([])
        return
      }
      const { width } = getCanvasSize(liveCanvas)
      setImageDpiInfos(scanImageDpi(liveCanvas, width, row.print_width_in))
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

  const objectsApi = useEditorObjects({ fabric, canvas, onContentChange: handleContentChange })

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

  // POD.md §5.1 — block below 100 DPI. This scans the currently-active
  // side's live canvas; a full cross-side check against persisted
  // design_json belongs to the real add-to-cart flow in Phase 7, once
  // designs are actually persisted.
  const blockingDpiIssue = imageDpiInfos.some((i) => i.severity === 'block')

  async function handlePreview() {
    if (canvas) {
      const families = Array.from(
        new Set(
          canvas
            .getObjects()
            .filter((o) => o.type === 'IText')
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
      const { url, usedFallback } = await uploadArt(blob, file.name, settings.maxArtUploadMb)
      await objectsApi.addImage(url, { isVectorAsset: isVector, sourceUrl: url })
      if (usedFallback) {
        addToast('Added — art uploads go live in a later phase, using it locally for now.', 'info')
      }
    } catch (err) {
      addToast(err instanceof UploadArtError ? err.message : 'That upload failed. Please try again.', 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleAddToCart() {
    // >>> PHASE 7 TODO (POD.md §3.5, §7.1, §7.2): upload any not-yet-uploaded
    // >>> art (normally already done at drop time — see uploadArt.ts), render
    // >>> a flattened ~1000px preview per designed side, POST /api/designs to
    // >>> get a design_id, PUT the previews to R2, then push a cartStore line
    // >>> keyed `${product_id}:${size}:${design_id}` (POD.md §7.2). For now we
    // >>> just serialize what Phase 7 will need and log it.
    const design = {
      version: 1,
      product_id: product.id,
      size: sizeRow?.label ?? null,
      front: sidesState.front?.json ? JSON.parse(sidesState.front.json) : { objects: [] },
      back: sidesState.back?.json ? JSON.parse(sidesState.back.json) : { objects: [] },
    }
    // eslint-disable-next-line no-console
    console.log('[Phase 7 TODO] onAddToCart — design_json ready for persistence:', design)
    addToast('Design captured. Cart + checkout persistence lands in Phase 7.')
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
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 sm:px-6">
        <button
          onClick={() => navigate(`/product/${product.id}`)}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> {product.name}
        </button>
        <SideTabs sides={sideOrder} activeSide={activeSide} onChange={setActiveSide} state={sidesState} />
        <span className="w-16 shrink-0 text-right text-xs uppercase tracking-wide text-ink-soft md:w-24">
          {mode === 'preview' ? 'Preview' : 'Editing'}
        </span>
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

        <div className="relative min-h-0 flex-1">
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
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-soft">This product has no customizable side.</div>
          )}
          {!fabric && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/70">
              <p className="text-sm text-ink-soft">Loading design tools…</p>
            </div>
          )}
        </div>

        {mode === 'edit' && (
          <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-line md:block">
            <PropertiesPanel {...propertiesPanelProps} />
          </div>
        )}
      </div>

      {mode === 'edit' && (
        <>
          {objectsApi.selected && (
            <div className="max-h-56 shrink-0 overflow-y-auto border-t border-line md:hidden">
              <PropertiesPanel {...propertiesPanelProps} />
            </div>
          )}
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
        </>
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
      />
    </div>
  )
}
