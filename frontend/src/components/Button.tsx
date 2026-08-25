import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type ButtonVariant = 'accent' | 'ink' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
  /** Renders as a router <Link> instead of a <button> when set. */
  to?: string
  children?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // The one accent, reserved for primary/conversion actions.
  accent: 'bg-accent text-white hover:bg-accent-dark active:bg-accent-dark disabled:bg-accent/40',
  ink: 'bg-ink text-paper hover:bg-ink/85 active:bg-ink/75 disabled:bg-ink/30',
  outline: 'border border-line text-ink bg-transparent hover:border-ink disabled:opacity-40',
  ghost: 'text-ink hover:bg-ink/5 disabled:opacity-40',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  // 44px is the mobile-first minimum touch target — md meets it exactly.
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide ' +
  'transition-colors duration-150 disabled:cursor-not-allowed select-none whitespace-nowrap'

export default function Button({
  variant = 'ink',
  size = 'md',
  fullWidth = false,
  className = '',
  to,
  children,
  onClick,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ')

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}
