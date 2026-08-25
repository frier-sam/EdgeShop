import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
export type BadgeSize = 'sm' | 'md'

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  accent: 'bg-accent-soft text-accent-dark',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'h-5 px-2 text-[11px]',
  md: 'h-6 px-2.5 text-xs',
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
        'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full font-semibold tracking-wide',
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
