// POD-UI4.md §5 D.3/D.4 (A3/A4/A5) — the comp's two-pane editor's right
// half: a mockup canvas on a dot-grid ground, a front/back segmented
// toggle (only offered when both sides actually exist), a print-area
// grid-overlay toggle, and the live readiness status bar.
//
// Deliberately a plain absolutely-positioned DOM overlay, same as the
// PreviewCheck it replaces and PrintAreaSelector's own rect — no canvas
// library here (POD-UI4.md is explicit that boundary is deliberate: the
// shopper-facing customizer owns the real editing surface). No zoom
// control either (§3.4 A5 defers it for the same reason).
import { useState } from 'react'
import SegmentedControl from '../components/ui/SegmentedControl'
import IconButton from '../components/ui/IconButton'
import Icon from '../components/ui/Icon'
import type { ProductSide } from '../lib/types'
import { mockupsReady, printAreasReady, pricingReady, countConfiguredOptions } from './lib/readiness'
import type { OptionBlockFlags } from './lib/readiness'

type SideName = 'front' | 'back'

function ReadinessChip({ ready, label }: { ready: boolean; label: string }) {
  return (
    // POD-UI4.md §4.6 exact styling: green =
    // bg-accent-soft/40 border-accent/20 text-ink with a filled
    // check_circle; pending = bg-surface-4 border-line text-ink-soft with
    // `pending`. The label text itself changes between the two states (see
    // callers below) so the chip's state is never colour-only.
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 font-label text-label-sm ${
        ready ? 'border-accent/20 bg-accent-soft/40 text-ink' : 'border-line bg-surface-4 text-ink-soft'
      }`}
    >
      <Icon name={ready ? 'check_circle' : 'pending'} size={16} fill={ready} />
      {label}
    </span>
  )
}

function ReadinessChips({
  sides,
  basePrice,
  options,
}: {
  sides: ProductSide[]
  basePrice: number
  options: OptionBlockFlags
}) {
  const mockups = mockupsReady(sides)
  const printAreas = printAreasReady(sides)
  const pricing = pricingReady(basePrice)
  const optionCount = countConfiguredOptions(options)
  const optionsReady = optionCount >= 1

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ReadinessChip ready={mockups} label={mockups ? 'Mockups' : 'Add a mockup for each side'} />
      <ReadinessChip ready={printAreas} label={printAreas ? 'Print areas' : 'Print areas pending'} />
      <ReadinessChip ready={pricing} label={pricing ? 'Pricing' : 'Pricing pending'} />
      <ReadinessChip ready={optionsReady} label={`Options (${optionCount}/4)`} />
    </div>
  )
}

interface ProductPreviewWorkspaceProps {
  sides: ProductSide[]
  basePrice: number
  axis1Enabled: boolean
  axis2Enabled: boolean
  bulkEnabled: boolean
  customizationEnabled: boolean
}

export default function ProductPreviewWorkspace({
  sides,
  basePrice,
  axis1Enabled,
  axis2Enabled,
  bulkEnabled,
  customizationEnabled,
}: ProductPreviewWorkspaceProps) {
  const orderedSides = [...sides].sort((a, b) => a.sort_order - b.sort_order)
  const [activeSideName, setActiveSideName] = useState<SideName>(orderedSides[0]?.side ?? 'front')
  const [showOutline, setShowOutline] = useState(false)

  const currentSide = orderedSides.find((s) => s.side === activeSideName) ?? orderedSides[0] ?? null
  const hasPrintArea = !!currentSide && !!currentSide.customizable && currentSide.print_w > 0 && currentSide.print_h > 0

  return (
    <div className="dot-grid space-y-4 rounded-card border border-line bg-surface-2 p-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Only offer sides that actually exist — a single-sided product
            gets no toggle at all, never a disabled/greyed-out one. */}
        {orderedSides.length > 1 ? (
          <SegmentedControl
            aria-label="Preview side"
            value={activeSideName}
            onChange={(v) => setActiveSideName(v)}
            options={orderedSides.map((s) => ({ value: s.side, label: s.side === 'front' ? 'Front' : 'Back' }))}
          />
        ) : (
          <span className="font-label text-label-sm capitalize text-ink-soft">{orderedSides[0]?.side ?? 'Preview'}</span>
        )}
        <IconButton
          variant={showOutline ? 'primary' : 'secondary'}
          aria-label={showOutline ? 'Hide print area outline' : 'Show print area outline'}
          aria-pressed={showOutline}
          disabled={!currentSide}
          onClick={() => setShowOutline((v) => !v)}
        >
          <Icon name="grid_on" size={18} />
        </IconButton>
      </div>

      <div
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-card bg-surface shadow-canvas"
        style={{ aspectRatio: currentSide ? `${currentSide.image_w} / ${currentSide.image_h}` : '1 / 1' }}
      >
        {currentSide?.image_url ? (
          <img
            src={currentSide.image_url}
            alt={`${activeSideName} mockup`}
            className="absolute inset-0 h-full w-full object-fill"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-faint">
            Upload a mockup in Customization to see a live preview here.
          </div>
        )}

        {/* PreviewCheck folded in (POD-UI4.md D.3): a sample-text overlay
            over the saved print area, always shown when one exists, rather
            than a second competing preview elsewhere on the page. */}
        {hasPrintArea && currentSide && (
          <div
            className="absolute flex items-center justify-center overflow-hidden p-1"
            style={{
              left: `${currentSide.print_x * 100}%`,
              top: `${currentSide.print_y * 100}%`,
              width: `${currentSide.print_w * 100}%`,
              height: `${currentSide.print_h * 100}%`,
            }}
          >
            <span className="rounded bg-white/80 px-1.5 py-0.5 text-center text-[10px] font-bold leading-tight text-ink sm:text-sm">
              Your Design Here
            </span>
          </div>
        )}

        {/* The grid-overlay toggle — an outline only, independent of the
            sample text above so a merchant can check exact bounds without
            the placeholder copy in the way. */}
        {showOutline && hasPrintArea && currentSide && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-dashed border-accent"
            style={{
              left: `${currentSide.print_x * 100}%`,
              top: `${currentSide.print_y * 100}%`,
              width: `${currentSide.print_w * 100}%`,
              height: `${currentSide.print_h * 100}%`,
            }}
          />
        )}
      </div>

      <ReadinessChips
        sides={sides}
        basePrice={basePrice}
        options={{ axis1: axis1Enabled, axis2: axis2Enabled, bulk: bulkEnabled, customization: customizationEnabled }}
      />
    </div>
  )
}
