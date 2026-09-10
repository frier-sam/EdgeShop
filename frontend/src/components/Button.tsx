import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ElementType, ReactNode, Ref } from 'react'
import { cn } from '../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

// POD-UI4.md §2/§5 A.1 — `primary` is the black ground (weight, not a
// second accent); `secondary` is the comp's teal *outline* button (filling
// solid on hover, matching the reference's bordered CTAs — the variant
// name stays `secondary` for backward compatibility even though visually
// it's what the comp would call "outline"); `ghost` stays quiet/neutral;
// `danger` is reserved for destructive actions (delete, remove). Disabled
// styling keys off `aria-disabled` rather than the `:disabled` pseudo-class
// because this component can render as an <a>, which has no native
// disabled state.
// Exported so IconButton (ui/IconButton.tsx) and SegmentedControl can reuse
// the exact same variant treatment instead of redeclaring it.
export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-container active:bg-primary-container ' +
    'aria-disabled:bg-primary/40',
  secondary:
    'border border-accent bg-transparent text-accent hover:bg-accent hover:text-on-accent ' +
    'active:bg-accent-dark active:text-on-accent ' +
    'aria-disabled:border-line aria-disabled:text-ink-faint aria-disabled:hover:bg-transparent aria-disabled:hover:text-ink-faint',
  ghost:
    'bg-transparent text-ink hover:bg-surface-2 active:bg-surface-3 aria-disabled:opacity-40 ' +
    'aria-disabled:hover:bg-transparent',
  danger:
    'bg-danger text-on-primary hover:bg-danger/90 active:bg-danger/80 aria-disabled:bg-danger/40',
}
const VARIANT_CLASSES = BUTTON_VARIANT_CLASSES

// sm = 36px, md = 44px, lg = 52px. md and lg clear the 44px touch floor.
// Text size is deliberately NOT part of this table any more (POD-UI4.md
// §2.3/§5 A.1): the comps set every button — CTA-sized or not — in
// `font-label-md`/`text-label-md`, so BASE below carries one label size
// for all three, and only height/padding vary by size.
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5',
  md: 'h-11 px-5',
  lg: 'h-[52px] px-7',
}

const GAP_CLASSES: Record<ButtonSize, string> = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
}

const SPINNER_SIZE: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-[18px] w-[18px]',
}

const BASE =
  'relative inline-flex items-center justify-center rounded-btn font-label text-label-md ' +
  'select-none whitespace-nowrap ' +
  'transition-[background-color,border-color,color,transform] duration-fast ease-out-soft ' +
  'active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:active:scale-100 ' +
  'aria-disabled:pointer-events-none ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

export interface ButtonOwnProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Inline spinner, disables interaction, preserves button width. */
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /**
   * Present without `as` → renders an <a>. Combine with `as={Link}` (React
   * Router) and pass its `to` prop through `rest` for client-side routing:
   * `<Button as={Link} to="/shop">Shop</Button>`.
   */
  href?: string
  className?: string
  children?: ReactNode
}

export type ButtonProps<C extends ElementType = 'button'> = ButtonOwnProps &
  Omit<ComponentPropsWithoutRef<C>, keyof ButtonOwnProps | 'as'> & {
    as?: C
  }

function Spinner({ size }: { size: ButtonSize }) {
  return (
    <svg
      className={`${SPINNER_SIZE[size]} animate-spin`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z"
      />
    </svg>
  )
}

function ButtonInner<C extends ElementType = 'button'>(
  {
    as,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    href,
    className = '',
    children,
    disabled,
    type,
    onClick,
    ...rest
  }: ButtonProps<C>,
  ref: Ref<Element>,
) {
  const Component = (as ?? (href ? 'a' : 'button')) as ElementType
  const isNativeButton = Component === 'button'
  const isDisabled = Boolean(disabled) || loading

  // `cn` (not plain `.join(' ')`) — BASE hard-codes `inline-flex`, and a
  // caller passing a display utility like `hidden` or `md:flex` in
  // `className` must win the cascade instead of silently losing to it.
  // See lib/cn.ts for why string order in `class="..."` doesn't decide
  // that on its own.
  const classes = cn(BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], fullWidth ? 'w-full' : '', className)

  const handleClick = (event: React.MouseEvent) => {
    if (isDisabled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    ;(onClick as ((e: React.MouseEvent) => void) | undefined)?.(event)
  }

  return (
    <Component
      ref={ref}
      href={href}
      className={classes}
      // Native <button> defaults to type="button" so it never triggers an
      // implicit form submit; non-button elements get no `type` attribute.
      type={isNativeButton ? type ?? 'button' : undefined}
      disabled={isNativeButton ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      tabIndex={!isNativeButton && isDisabled ? -1 : undefined}
      onClick={handleClick}
      {...rest}
    >
      <span
        className={`inline-flex items-center justify-center ${GAP_CLASSES[size]} ${loading ? 'invisible' : ''}`}
      >
        {leftIcon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children}
        {rightIcon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner size={size} />
        </span>
      )}
    </Component>
  )
}

/**
 * Single button primitive. Polymorphic via `as` (defaults to `button`, or
 * `a` automatically when `href` is passed) so it renders as a React Router
 * `Link` — `<Button as={Link} to="/shop">` — without duplicating styles.
 */
const Button = forwardRef(ButtonInner) as <C extends ElementType = 'button'>(
  props: ButtonProps<C> & { ref?: Ref<Element> },
) => ReturnType<typeof ButtonInner>

export default Button
