// POD-UI4.md §5 D.2 (A2) — the comp's sticky top app bar (back arrow,
// title, status chip, action pills), generalized into one component
// reused by AdminProductEdit, AdminTemplateEdit and AdminOrderDetail.
//
// The per-section save model stays (see POD-UI4.md's decisions log): a
// single global save across five independently-PUTing editors is a
// separate refactor with real regression risk. `actions` holds each
// screen's own EXISTING primary action — never a fabricated "Publish
// Changes" button that doesn't publish anything a single click here could
// actually mean.
import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'

export type AdminPageHeaderTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

export interface AdminPageHeaderStatus {
  label: string
  tone: AdminPageHeaderTone
}

// Danger pairs with `on-danger-soft` (POD-UI4.md §2.2 gives it a dedicated
// on-* token); success/warning/accent have no dedicated "on-*-soft" token
// of their own, so their own base tone reads correctly on their soft
// ground — the same pairing AdminOrders.tsx's status chips already use.
const TONE_CLASSES: Record<AdminPageHeaderTone, string> = {
  accent: 'bg-accent-soft text-on-accent-soft',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-on-danger-soft',
  neutral: 'bg-surface-2 text-ink-soft',
}

interface AdminPageHeaderProps {
  title: string
  /** Route the back arrow links to. Omit to render without a back control. */
  backTo?: string
  status?: AdminPageHeaderStatus
  /** Right-aligned action slot — pill buttons the screen already had. */
  actions?: React.ReactNode
}

/**
 * Sticks to the top of its scroll container on `md` and up (the mobile
 * drawer top bar already owns small-screen chrome — see AdminLayout.tsx —
 * so this one only pins where there's room to reason about the two
 * stacking without a magic offset). The `-mx-4`/`sm:-mx-6` pair cancels
 * exactly the horizontal padding AdminLayout's content column and
 * AdminTemplateEdit's own standalone pages both use, so the bar's `bg-
 * surface` ground reads edge-to-edge instead of floating with page
 * background visible down its sides.
 */
export default function AdminPageHeader({ title, backTo, status, actions }: AdminPageHeaderProps) {
  return (
    <div className="z-30 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-4 sm:-mx-6 sm:px-6 md:sticky md:top-0">
      <div className="flex min-w-0 items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-ink-soft transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="arrow_back" />
          </Link>
        )}
        <h1 className="truncate font-display text-headline-md text-primary">{title}</h1>
        {status && (
          <span
            className={`shrink-0 rounded-xs px-2 py-0.5 font-label text-label-sm uppercase tracking-wide ${TONE_CLASSES[status.tone]}`}
          >
            {status.label}
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
