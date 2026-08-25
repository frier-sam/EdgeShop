import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { BUTTON_VARIANT_CLASSES } from '../Button'
import type { ButtonVariant } from '../Button'

export type IconButtonSize = 'sm' | 'md' | 'lg'

// sm = 36px, md = 44px, lg = 52px — same scale as Button.
const SIZE_CLASSES: Record<IconButtonSize, string> = {
  sm: 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-11 w-11 [&_svg]:h-5 [&_svg]:w-5',
  lg: 'h-[52px] w-[52px] [&_svg]:h-6 [&_svg]:w-6',
}

const BASE =
  'inline-flex shrink-0 items-center justify-center rounded-btn ' +
  'transition-[background-color,border-color,color,transform] duration-fast ease-out-soft ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: IconButtonSize
  className?: string
  children: ReactNode
  /** Required — an icon-only control must always name itself for assistive tech. */
  'aria-label': string
}

/** Square, icon-only touch target. Always a real <button> — pair with `aria-label`. */
const IconButton = forwardRef(function IconButton(
  { variant = 'secondary', size = 'md', className = '', children, type = 'button', ...rest }: IconButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[BASE, BUTTON_VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
})

export default IconButton
