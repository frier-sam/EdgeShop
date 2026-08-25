import { useEffect, useState } from 'react'
import type { FabricCanvas, FabricObject } from '../fabric/loadFabric'
import { DESIGN_FONTS } from '../fonts'
import { dpiSeverity, type DpiSeverity } from '../geometry'

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

const TEXT_TYPE = 'IText'
const IMAGE_TYPE = 'Image'
const RECT_TYPE = 'Rect'
const SHAPE_TYPES = ['Rect', 'Circle', 'Triangle', 'Polygon', 'Line']

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-2.5 h-9 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30'
const btnCls =
  'flex h-9 items-center justify-center rounded-lg border border-line bg-surface text-xs font-medium text-ink transition-colors hover:border-ink disabled:opacity-40'
const toggleBtnCls = (active: boolean) =>
  `flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
    active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink hover:border-ink'
  }`

function DpiBadge({ dpi }: { dpi: number }) {
  const severity: DpiSeverity = dpiSeverity(dpi)
  if (severity === 'ok') return null
  const isBlock = severity === 'block'
  return (
    <div
      className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
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

function CommonActionsRow(props: CommonActions) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 border-b border-line pb-4">
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

/** POD.md §6.4 — text tool controls: font family, size, colour, bold/italic, alignment, letter-spacing. */
function TextControls({ selected, onCommit }: { selected: FabricObject; onCommit: () => void }) {
  const obj = selected as unknown as {
    fontFamily: string
    fontSize: number
    fill: string
    fontWeight: string | number
    fontStyle: string
    textAlign: string
    charSpacing: number
    set: (props: Record<string, unknown>) => void
  }
  const [fontFamily, setFontFamily] = useState(obj.fontFamily)
  const [fontSize, setFontSize] = useState(obj.fontSize)
  const [fill, setFill] = useState(String(obj.fill ?? '#1a1512'))
  const [bold, setBold] = useState(obj.fontWeight === 700 || obj.fontWeight === 'bold')
  const [italic, setItalic] = useState(obj.fontStyle === 'italic')
  const [align, setAlign] = useState(obj.textAlign || 'center')
  const [spacing, setSpacing] = useState(obj.charSpacing ?? 0)

  useEffect(() => {
    setFontFamily(obj.fontFamily)
    setFontSize(obj.fontSize)
    setFill(String(obj.fill ?? '#1a1512'))
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
      <Row label="Colour">
        <input
          type="color"
          value={fill}
          className="h-9 w-full cursor-pointer rounded-lg border border-line bg-surface"
          onChange={(e) => {
            setFill(e.target.value)
            obj.set({ fill: e.target.value })
            onCommit()
          }}
        />
      </Row>
      <Row label="Style">
        <div className="flex gap-2">
          <button
            className={toggleBtnCls(bold)}
            aria-pressed={bold}
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

/** POD.md §6.5 — image controls: opacity, flip (remove-background is explicitly out of scope). */
function ImageControls({ selected, onCommit, dpi }: { selected: FabricObject; onCommit: () => void; dpi: number | null }) {
  const obj = selected as unknown as { opacity: number; flipX: boolean; flipY: boolean; set: (p: Record<string, unknown>) => void }
  const [opacity, setOpacity] = useState(obj.opacity ?? 1)

  useEffect(() => {
    setOpacity(obj.opacity ?? 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <div>
      {dpi !== null && <DpiBadge dpi={dpi} />}
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
      <Row label="Flip">
        <div className="flex gap-2">
          <button
            className={toggleBtnCls(obj.flipX)}
            onClick={() => {
              obj.set({ flipX: !obj.flipX })
              onCommit()
            }}
          >
            ↔
          </button>
          <button
            className={toggleBtnCls(obj.flipY)}
            onClick={() => {
              obj.set({ flipY: !obj.flipY })
              onCommit()
            }}
          >
            ↕
          </button>
        </div>
      </Row>
    </div>
  )
}

/** POD.md §6.6 — shape controls: fill, stroke colour + width, corner radius (rect only). */
function ShapeControls({ selected, onCommit }: { selected: FabricObject; onCommit: () => void }) {
  const obj = selected as unknown as {
    type: string
    fill: string
    stroke: string | null
    strokeWidth: number
    rx?: number
    ry?: number
    set: (p: Record<string, unknown>) => void
  }
  const [fill, setFill] = useState(String(obj.fill ?? '#c2410c'))
  const [stroke, setStroke] = useState(String(obj.stroke ?? ''))
  const [strokeWidth, setStrokeWidth] = useState(obj.strokeWidth ?? 0)
  const [radius, setRadius] = useState(obj.rx ?? 0)

  useEffect(() => {
    setFill(String(obj.fill ?? '#c2410c'))
    setStroke(String(obj.stroke ?? ''))
    setStrokeWidth(obj.strokeWidth ?? 0)
    setRadius(obj.rx ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const isLine = obj.type === 'Line'

  return (
    <div>
      {!isLine && (
        <Row label="Fill">
          <input
            type="color"
            value={fill}
            className="h-9 w-full cursor-pointer rounded-lg border border-line bg-surface"
            onChange={(e) => {
              setFill(e.target.value)
              obj.set({ fill: e.target.value })
              onCommit()
            }}
          />
        </Row>
      )}
      <Row label="Stroke colour">
        <input
          type="color"
          value={stroke || '#1a1512'}
          className="h-9 w-full cursor-pointer rounded-lg border border-line bg-surface"
          onChange={(e) => {
            setStroke(e.target.value)
            obj.set({ stroke: e.target.value, strokeWidth: strokeWidth || 2 })
            if (!strokeWidth) setStrokeWidth(2)
            onCommit()
          }}
        />
      </Row>
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

export default function PropertiesPanel({ selected, onCommit, imageDpi, ...actions }: PropertiesPanelProps) {
  if (!selected) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-soft">
        Select an object on the canvas to edit it, or add something from the toolbar.
      </div>
    )
  }

  const type = selected.type

  return (
    <div className="p-4">
      <CommonActionsRow {...actions} />
      {type === TEXT_TYPE && <TextControls selected={selected} onCommit={onCommit} />}
      {type === IMAGE_TYPE && <ImageControls selected={selected} onCommit={onCommit} dpi={imageDpi} />}
      {SHAPE_TYPES.includes(type) && type !== IMAGE_TYPE && <ShapeControls selected={selected} onCommit={onCommit} />}
    </div>
  )
}
