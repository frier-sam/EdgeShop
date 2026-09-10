import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
export type BadgeSize = 'sm' | 'md'

// POD-UI4.md §2.2/§5 A.1 — `accent` is now the comp's mint chip
// (`bg-accent-soft text-on-accent-soft`), not the darker `accent-dark`
// text this used before mint got its own dedicated on-color token.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  accent: 'bg-accent-soft text-on-accent-soft',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

// Text size is `text-label-sm` (the badges/chips/eyebrows step, §2.3) for
// both sizes now — only height/padding vary — instead of each size
// picking its own ad hoc arbitrary/Tailwind-default text size.
const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'h-5 px-2',
  md: 'h-6 px-2.5',
}

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'className'> {
  variant?: BadgeVariant
  size?: BadgeSize
  /** Plays the `badge-pop` keyframe once (e.g. on a cart count bump). */
  pop?: boolean
  className?: string
  children?: ReactNode
}

/** Small status/count pill. Not interactive — use IconButton/Button for anything clickable. */
export default function Badge({
  variant = 'neutral',
  size = 'md',
  pop = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-pill font-label text-label-sm',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        pop ? 'animate-badge-pop' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}
