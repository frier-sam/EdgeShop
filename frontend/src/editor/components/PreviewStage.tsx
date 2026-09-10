// frontend/src/editor/components/PreviewStage.tsx
//
// POD-UI3.md §3.2 / §4.6 — preview mode's stage. Purely presentational:
// it fetches nothing, renders nothing to a canvas and owns no lifecycle.
// CustomizerEditor.tsx does all of that (§4.7) and hands the finished
// composite down as an object URL.
//
// Why an OVERLAY and not a replacement for EditorStage: EditorStage owns
// the one long-lived Fabric canvas instance AND the per-side snapshot
// cache that makes front/back independent. Unmounting it to show a preview
// would dispose that canvas and throw away the shopper's design, so this
// component is rendered as a SIBLING inside the same relative container
// and simply covers it — `absolute inset-0 z-20` over an opaque
// `bg-surface`. Opaque matters: the design surface underneath is a flat
// white plane with guides on it (POD-UI3.md §3.1) and any bleed-through
// would undo the whole point of making the two modes distinguishable.
//
// White specifically, not the `bg-surface-2` workspace grey the design
// stage uses. Product mockups are shot on white, so a grey ground makes
// the photo's own white background read as a large white panel floating on
// it — a hard-edged rectangle, which is the family of artifact this whole
// round is removing. On white the photo's ground is seamless and the
// garment reads as the only object on screen. It also correctly signals
// the mode change: designing happens on a workbench, reviewing happens on
// a product page.
//
// Being a real (not `pointer-events-none`) overlay is also deliberate —
// it swallows drags that would otherwise land on the canvas below. Fabric's
// own interactivity is already disabled in preview mode
// (`setCanvasInteractive`), and useEditorObjects' keybindings are gated by
// its `interactive` option (§4.5); this is the third and simplest of those
// three guards.
import Button from '../../components/Button'

export interface PreviewStageProps {
  /** Object URL of the composite for the active side; null while rendering. */
  imageUrl: string | null
  rendering: boolean
  error: string | null
  onRetry: () => void
}

export default function PreviewStage({ imageUrl, rendering, error, onRetry }: PreviewStageProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-surface animate-fade-in"
      data-testid="preview-stage"
    >
      {/* Precedence is image -> error -> spinner, and the order is load
          bearing. `error` and `rendering` are per-SESSION flags while
          `imageUrl` is per-SIDE (CustomizerEditor caches both sides'
          composites), so a shopper who is looking at a side that rendered
          fine must keep seeing it even if the OTHER side is still in
          flight or failed. */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Preview of your design on the product"
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
          <p className="max-w-xs text-sm text-ink-soft">{error}</p>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : (
        // Matches the "Loading design tools…" block in CustomizerEditor.tsx
        // exactly, so the two waits in this screen never read as two
        // different kinds of wait.
        <div className="flex flex-col items-center justify-center gap-3" aria-live="polite">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
          <p className="text-sm text-ink-soft">{rendering ? 'Rendering your preview…' : 'Preparing your preview…'}</p>
        </div>
      )}
    </div>
  )
}
