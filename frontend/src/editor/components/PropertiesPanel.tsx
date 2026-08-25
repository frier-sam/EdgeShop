import { useEffect, useState } from 'react'
import type { FabricCanvas, FabricObject } from '../fabric/loadFabric'
import { DESIGN_FONTS } from '../fonts'
import { dpiSeverity, type DpiSeverity } from '../geometry'
import ColorSwatchRow from './ColorSwatchRow'
import SegmentedControl from '../../components/ui/SegmentedControl'

interface CommonActions {
  onDuplicate: () => void
  onDelete: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onBringToFront: () => void
  onSendToBack: () => void
  onCenter: () => void
}

export interface PropertiesPanelProps extends CommonActions {
  canvas: FabricCanvas | null
  selected: FabricObject | null
  onCommit: () => void
  /** DPI of the selected object, if it's a raster image (POD.md §6.5). */
  imageDpi: number | null
}

// Fabric v6 runtime `.type` values are lowercase (verified against the
// installed fabric@6.9.1 source — FabricObject's `type` getter does
// `this.constructor.type.toLowerCase()`, and IText further maps that to
// 'i-text'). NOT the PascalCase ('IText'/'Image'/'Rect') the pre-overhaul
// code compared against, which meant these branches never matched and
// the entire per-type controls set (text/image/shape) silently never
// rendered — the real, deeper cause behind Finding #1's "cramped strip";
// colour wasn't just hard to reach, its controls weren't mounting at all.
const TEXT_TYPE = 'i-text'
const IMAGE_TYPE = 'image'
const RECT_TYPE = 'rect'
const LINE_TYPE = 'line'
const SHAPE_TYPES = ['rect', 'circle', 'triangle', 'polygon', 'line']

type TabKey = 'style' | 'text' | 'arrange'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-btn border border-line bg-surface px-2.5 h-11 text-sm text-ink transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30'
const colorInputCls = 'h-11 w-full cursor-pointer rounded-btn border border-line bg-surface transition-transform duration-fast active:scale-[0.98]'
const btnCls =
  'flex h-11 items-center justify-center rounded-btn border border-line bg-surface text-xs font-medium text-ink transition-[background-color,border-color,transform] duration-fast active:scale-[0.97] hover:border-ink/30 disabled:opacity-40'
const toggleBtnCls = (active: boolean) =>
  `flex h-11 w-11 items-center justify-center rounded-btn border text-sm font-semibold transition-colors duration-fast ${
    active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink hover:border-ink/30'
  }`

function DpiBadge({ dpi }: { dpi: number }) {
  const severity: DpiSeverity = dpiSeverity(dpi)
  if (severity === 'ok') return null
  const isBlock = severity === 'block'
  return (
    <div
      className={`mb-3 rounded-btn px-3 py-2 text-xs font-medium ${
        isBlock ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent-dark'
      }`}
    >
      {isBlock ? (
        <>Too low-resolution to print well (~{Math.round(dpi)} DPI). Use a larger image or shrink this one.</>
      ) : (
        <>This image may look blurry when printed (~{Math.round(dpi)} DPI). 150+ DPI recommended.</>
      )}
    </div>
  )
}

/** POD.md §6.7 acceptance / POD-UI.md §3 C1 — layer order, duplicate and delete, grouped into their own "Arrange" tab. */
function ArrangeSection(props: CommonActions) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button className={btnCls} onClick={props.onCenter}>
        Center
      </button>
      <button className={btnCls} onClick={props.onDuplicate}>
        Duplicate
      </button>
      <button className={btnCls} onClick={props.onBringForward}>
        Forward
      </button>
      <button className={btnCls} onClick={props.onSendBackward}>
        Backward
      </button>
      <button className={btnCls} onClick={props.onBringToFront}>
        To front
      </button>
      <button className={btnCls} onClick={props.onSendToBack}>
        To back
      </button>
      <button className={`${btnCls} col-span-2 border-danger/40 text-danger hover:border-danger`} onClick={props.onDelete}>
        Delete
      </button>
    </div>
  )
}

/** Opacity applies to every object type — lives in the Style tab regardless of what's selected. */
function OpacityRow({ selected, onCommit }: { selected: FabricObject; onCommit: () => void }) {
  const obj = selected as unknown as { opacity: number; set: (p: Record<string, unknown>) => void }
  const [opacity, setOpacity] = useState(obj.opacity ?? 1)

  useEffect(() => {
    setOpacity(obj.opacity ?? 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <Row label={`Opacity (${Math.round(opacity * 100)}%)`}>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={opacity}
        className="w-full accent-accent"
        onChange={(e) => {
          const v = Number(e.target.value)
          setOpacity(v)
          obj.set({ opacity: v })
          onCommit()
        }}
      />
    </Row>
  )
}

/** POD.md §6.4 — text tool controls: font family, size, weight/italic, alignment, letter-spacing. Colour lives in Style (see ColorRow), not here. */
function TextControls({ selected, onCommit }: { selected: FabricObject; onCommit: () => void }) {
  const obj = selected as unknown as {
    fontFamily: string
    fontSize: number
    fontWeight: string | number
    fontStyle: string
    textAlign: string
    charSpacing: number
    set: (props: Record<string, unknown>) => void
  }
  const [fontFamily, setFontFamily] = useState(obj.fontFamily)
  const [fontSize, setFontSize] = useState(obj.fontSize)
  const [bold, setBold] = useState(obj.fontWeight === 700 || obj.fontWeight === 'bold')
  const [italic, setItalic] = useState(obj.fontStyle === 'italic')
  const [align, setAlign] = useState(obj.textAlign || 'center')
  const [spacing, setSpacing] = useState(obj.charSpacing ?? 0)

  useEffect(() => {
    setFontFamily(obj.fontFamily)
    setFontSize(obj.fontSize)
    setBold(obj.fontWeight === 700 || obj.fontWeight === 'bold')
    setItalic(obj.fontStyle === 'italic')
    setAlign(obj.textAlign || 'center')
    setSpacing(obj.charSpacing ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <div>
      <Row label="Font">
        <select
          className={inputCls}
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value)
            obj.set({ fontFamily: e.target.value })
            onCommit()
          }}
        >
          {DESIGN_FONTS.map((f) => (
            <option key={f.family} value={f.family}>
              {f.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Size">
        <input
          type="range"
          min={12}
          max={200}
          value={fontSize}
          className="w-full accent-accent"
          onChange={(e) => {
            const v = Number(e.target.value)
            setFontSize(v)
            obj.set({ fontSize: v })
            onCommit()
          }}
        />
      </Row>
      <Row label="Weight & style">
        <div className="flex gap-2">
          <button
            className={toggleBtnCls(bold)}
            aria-pressed={bold}
            aria-label="Bold"
            onClick={() => {
              const next = !bold
              setBold(next)
              obj.set({ fontWeight: next ? 700 : 400 })
              onCommit()
            }}
          >
            B
          </button>
          <button
            className={toggleBtnCls(italic)}
            aria-pressed={italic}
            aria-label="Italic"
            onClick={() => {
              const next = !italic
              setItalic(next)
              obj.set({ fontStyle: next ? 'italic' : 'normal' })
              onCommit()
            }}
          >
            I
          </button>
        </div>
      </Row>
      <Row label="Alignment">
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              aria-label={`Align ${a}`}
              aria-pressed={align === a}
              className={toggleBtnCls(align === a)}
              onClick={() => {
                setAlign(a)
                obj.set({ textAlign: a })
                onCommit()
              }}
            >
              {a === 'left' ? '⟸' : a === 'center' ? '≡' : '⟹'}
            </button>
          ))}
        </div>
      </Row>
      <Row label={`Letter spacing (${spacing})`}>
        <input
          type="range"
          min={-100}
          max={800}
          value={spacing}
          className="w-full accent-accent"
          onChange={(e) => {
            const v = Number(e.target.value)
            setSpacing(v)
            obj.set({ charSpacing: v })
            onCommit()
          }}
        />
      </Row>
    </div>
  )
}

/** POD.md §6.5 — image controls: flip (remove-background is explicitly out of scope; opacity lives in Style's shared OpacityRow). */
function ImageControls({ selected, onCommit }: { selected: FabricObject; onCommit: () => void }) {
  const obj = selected as unknown as { flipX: boolean; flipY: boolean; set: (p: Record<string, unknown>) => void }
  return (
    <Row label="Flip">
      <div className="flex gap-2">
        <button className={toggleBtnCls(obj.flipX)} aria-label="Flip horizontal" onClick={() => { obj.set({ flipX: !obj.flipX }); onCommit() }}>
          ↔
        </button>
        <button className={toggleBtnCls(obj.flipY)} aria-label="Flip vertical" onClick={() => { obj.set({ flipY: !obj.flipY }); onCommit() }}>
          ↕
        </button>
      </div>
    </Row>
  )
}

/** POD.md §6.6 — shape controls beyond the shared colour row: stroke colour + width, corner radius (rect only). */
function ShapeExtraControls({ selected, onCommit }: { selected: FabricObject; onCommit: () => void }) {
  const obj = selected as unknown as {
    type: string
    stroke: string | null
    strokeWidth: number
    rx?: number
    set: (p: Record<string, unknown>) => void
  }
  const isLine = obj.type === LINE_TYPE
  const [stroke, setStroke] = useState(String(obj.stroke ?? ''))
  const [strokeWidth, setStrokeWidth] = useState(obj.strokeWidth ?? 0)
  const [radius, setRadius] = useState(obj.rx ?? 0)

  useEffect(() => {
    setStroke(String(obj.stroke ?? ''))
    setStrokeWidth(obj.strokeWidth ?? 0)
    setRadius(obj.rx ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <div>
      {/* A line's only colour IS its stroke — already covered by the shared
          colour row above, so no separate stroke-colour picker here. */}
      {!isLine && (
        <Row label="Stroke colour">
          <input
            type="color"
            value={stroke || '#101014'}
            className={colorInputCls}
            onChange={(e) => {
              setStroke(e.target.value)
              obj.set({ stroke: e.target.value, strokeWidth: strokeWidth || 2 })
              if (!strokeWidth) setStrokeWidth(2)
              onCommit()
            }}
          />
        </Row>
      )}
      <Row label={`Stroke width (${strokeWidth})`}>
        <input
          type="range"
          min={0}
          max={30}
          value={strokeWidth}
          className="w-full accent-accent"
          onChange={(e) => {
            const v = Number(e.target.value)
            setStrokeWidth(v)
            obj.set({ strokeWidth: v })
            onCommit()
          }}
        />
      </Row>
      {obj.type === RECT_TYPE && (
        <Row label={`Corner radius (${radius})`}>
          <input
            type="range"
            min={0}
            max={100}
            value={radius}
            className="w-full accent-accent"
            onChange={(e) => {
              const v = Number(e.target.value)
              setRadius(v)
              obj.set({ rx: v, ry: v })
              onCommit()
            }}
          />
        </Row>
      )}
    </div>
  )
}

/**
 * POD-UI.md §3 Workstream C1 — the headline fix. Rendered as the FIRST
 * thing in both the mobile properties `Sheet` and the desktop rail (see
 * CustomizerEditor.tsx), so colour is one tap away from selection: no
 * scrolling, no tab switch. `primaryColor` is lifted up here (rather than
 * living inside TextControls/ShapeExtraControls' own local state, as it
 * did pre-overhaul) specifically so a tap on a swatch here and a tap on
 * the Style tab's larger colour picker always agree — both write through
 * the same setter.
 */
export default function PropertiesPanel({ selected, onCommit, imageDpi, ...actions }: PropertiesPanelProps) {
  const [tab, setTab] = useState<TabKey>('style')
  const [primaryColor, setPrimaryColorState] = useState('#101014')

  const type = selected?.type
  const isText = type === TEXT_TYPE
  const isImage = type === IMAGE_TYPE
  const isShape = !!type && SHAPE_TYPES.includes(type) && !isImage
  const isLine = type === LINE_TYPE
  const isColorable = isText || isShape // text/shape fill, or line stroke — never image

  useEffect(() => {
    setTab('style')
    if (!selected) return
    const obj = selected as unknown as { fill?: string | null; stroke?: string | null }
    const next = isLine ? obj.stroke : obj.fill
    if (typeof next === 'string') setPrimaryColorState(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-soft">
        Select an object on the canvas to edit it, or add something from the toolbar.
      </div>
    )
  }

  const applyPrimaryColor = (hex: string) => {
    const obj = selected as unknown as { set: (p: Record<string, unknown>) => void }
    obj.set(isLine ? { stroke: hex } : { fill: hex })
    setPrimaryColorState(hex)
    onCommit()
  }

  const tabs: { value: TabKey; label: string }[] = [
    { value: 'style', label: 'Style' },
    ...(isText ? [{ value: 'text' as const, label: 'Text' }] : []),
    { value: 'arrange', label: 'Arrange' },
  ]
  const activeTab = tabs.some((t) => t.value === tab) ? tab : 'style'

  return (
    <div className="flex flex-col gap-4 p-4">
      {isColorable && (
        <ColorSwatchRow value={primaryColor} onChange={applyPrimaryColor} label={isLine ? 'Colour' : isText ? 'Text colour' : 'Fill colour'} />
      )}

      <SegmentedControl options={tabs} value={activeTab} onChange={setTab} aria-label="Object properties" className="w-full" />

      <div>
        {activeTab === 'style' && (
          <div>
            {isImage && imageDpi !== null && <DpiBadge dpi={imageDpi} />}
            {isColorable && (
              <Row label={isLine ? 'Colour' : isText ? 'Text colour' : 'Fill'}>
                <input type="color" value={primaryColor} className={colorInputCls} onChange={(e) => applyPrimaryColor(e.target.value)} />
              </Row>
            )}
            {isShape && <ShapeExtraControls selected={selected} onCommit={onCommit} />}
            <OpacityRow selected={selected} onCommit={onCommit} />
            {isImage && <ImageControls selected={selected} onCommit={onCommit} />}
          </div>
        )}
        {activeTab === 'text' && isText && <TextControls selected={selected} onCommit={onCommit} />}
        {activeTab === 'arrange' && <ArrangeSection {...actions} />}
      </div>
    </div>
  )
}
