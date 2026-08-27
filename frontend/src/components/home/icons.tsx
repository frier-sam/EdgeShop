// Shared inline SVG icons for the homepage sections (F2 trust strip, F5 how
// it works, F6 ratings, F7 closing CTA). No icon library dependency per the
// workstream brief — every icon here is a small hand-written stroke SVG in
// the same visual language as Header.tsx's CartIcon/AccountIcon
// (strokeWidth 1.75, round caps/joins), sized by the parent via className.
// All are decorative (aria-hidden) — the text next to them carries meaning.

interface IconProps {
  className?: string
}

export function TruckIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 7h11v9H2z" />
      <path d="M13 10h4l4 3.2V16h-8z" />
      <circle cx="6" cy="18.5" r="1.75" />
      <circle cx="16.5" cy="18.5" r="1.75" />
    </svg>
  )
}

export function ShieldCheckIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4.5 5.5v5.4c0 4.8 3.2 7.9 7.5 9.6 4.3-1.7 7.5-4.8 7.5-9.6V5.5L12 3Z" />
      <path d="m8.75 12 2.25 2.25 4.25-4.5" />
    </svg>
  )
}

export function PackageIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 7v10l8 4 8-4V7z" />
      <path d="M4 7l8 4 8-4" />
      <path d="M12 11v10" />
    </svg>
  )
}

export function RefreshIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.6-4.6M4 4v4.5h4.5" />
      <path d="M4 13a8 8 0 0 0 14.6 4.6M20 20v-4.5h-4.5" />
    </svg>
  )
}

export function GridIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function PencilIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m14.5 4.5 5 5L8 21H3v-5Z" />
      <path d="m13 6 5 5" />
    </svg>
  )
}

export function PrinterIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V3h12v6" />
      <rect x="3.5" y="9" width="17" height="8" rx="1.5" />
      <path d="M6 14h12v7H6z" />
    </svg>
  )
}

export function StarIcon({ className = 'h-4 w-4', filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />
    </svg>
  )
}

export function ArrowRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h16" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  )
}

export function SparkleIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m6.5 6.5 2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2" />
    </svg>
  )
}
