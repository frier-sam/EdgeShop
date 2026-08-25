// frontend/src/admin/OrderDesignPanel.tsx
//
// POD.md §4.2 — one order line item's design panel: size/quantity/price,
// the flattened preview per designed side (from `preview_json` — already
// stored at add-to-cart, POD.md §5.6), a print-dimensions + effective-DPI
// readout, and a "Download print file" button per side. The readout is
// computed by printMath.ts alone (no Fabric needed to just show numbers);
// only clicking Download lazy-loads Fabric and actually rasterizes.
import { useState } from 'react'
import type { EditorSideName } from '../editor/types'
import type { StoredSideSnapshot } from '../editor/designSchema'
import { computePrintDims } from './print/printMath'
import { triggerBlobDownload, printFileName } from './print/downloadPrintFiles'
import { renderOrderSide } from './print/orderPrintFiles'
import type { AdminOrderLineItem, AdminOrderSideGeometry } from './types'
import Button from '../components/Button'

interface Props {
  orderId: string
  lineIndex: number
  item: AdminOrderLineItem
  printDpi: number
}

interface RenderableSide {
  geo: AdminOrderSideGeometry
  snapshot: StoredSideSnapshot
}

const SIDE_LABEL: Record<string, string> = { front: 'Front', back: 'Back' }

export default function OrderDesignPanel({ orderId, lineIndex, item, printDpi }: Props) {
  const [downloadingSide, setDownloadingSide] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const renderableSides: RenderableSide[] = item.design
    ? item.sides
        .map((geo) => {
          const snapshot = item.design!.design_json[geo.side as EditorSideName]
          return snapshot ? { geo, snapshot } : null
        })
        .filter((x): x is RenderableSide => x !== null)
    : []

  async function handleDownload(geo: AdminOrderSideGeometry, snapshot: StoredSideSnapshot) {
    setError(null)
    setDownloadingSide(geo.side)
    try {
      const result = await renderOrderSide(orderId, { lineIndex, side: geo.side as EditorSideName, snapshot, printWidthIn: geo.print_width_in }, printDpi)
      triggerBlobDownload(result.blob, printFileName(orderId, lineIndex, geo.side))
    } catch {
      setError('Could not render this print file. Please try again.')
    } finally {
      setDownloadingSide(null)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">{item.name}</p>
          <p className="text-xs text-ink-soft">
            {item.size ? `Size ${item.size} · ` : ''}Qty {item.quantity} · &#8377;{item.unit_price.toFixed(2)} each
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-ink">&#8377;{item.line_total.toFixed(2)}</p>
      </div>

      {!item.design && (
        <p className="text-xs text-ink-faint">Plain item — no custom design on this line.</p>
      )}

      {item.design && renderableSides.length === 0 && (
        <p className="text-xs text-warning">
          This design's stored artwork is missing or the product side it was drawn on no longer exists — a print file cannot be rendered.
        </p>
      )}

      {renderableSides.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {renderableSides.map(({ geo, snapshot }) => {
            const dims = computePrintDims(snapshot.canvasWidth, snapshot.canvasHeight, geo.print_width_in, printDpi)
            const previewUrl = item.design!.preview_json[geo.side]
            const isDownloading = downloadingSide === geo.side
            return (
              <div key={geo.side} className="flex gap-3 rounded-btn border border-line p-3">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`${item.name} — ${SIDE_LABEL[geo.side] ?? geo.side}`}
                    className="h-16 w-16 shrink-0 rounded-btn border border-line bg-surface-2 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-btn border border-line bg-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink">{SIDE_LABEL[geo.side] ?? geo.side}</p>
                  <p className="text-xs text-ink-soft">
                    {dims.widthIn.toFixed(2)}&Prime; &times; {dims.heightIn.toFixed(2)}&Prime;
                  </p>
                  <p className="text-xs text-ink-soft">
                    {dims.pixelWidth} &times; {dims.pixelHeight}px
                  </p>
                  <p className={`text-xs ${dims.clamped ? 'font-medium text-warning' : 'text-ink-soft'}`}>
                    {Math.round(dims.effectiveDpi)} DPI{dims.clamped ? ' (reduced — file would exceed a safe canvas size)' : ''}
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-1.5"
                    loading={isDownloading}
                    onClick={() => handleDownload(geo, snapshot)}
                  >
                    Download print file
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}
