import type { CSSProperties } from 'react'

export type SkeletonShape = 'text' | 'rect' | 'circle'

const SHAPE_CLASSES: Record<SkeletonShape, string> = {
  text: 'rounded',
  rect: 'rounded-card',
  circle: 'rounded-full',
}

export interface SkeletonProps {
  shape?: SkeletonShape
  /** CSS length (px number or any string). Defaults vary by shape. */
  width?: number | string
  /** CSS length (px number or any string). Defaults: text 1em, rect 8rem, circle = width. */
  height?: number | string
  className?: string
  style?: CSSProperties
}

const toLength = (value: number | string | undefined) => (typeof value === 'number' ? `${value}px` : value)

/**
 * Shimmer placeholder primitive (POD-UI.md §A6). Note this is distinct from
 * the legacy `components/Skeleton.tsx` (Skeleton/SkeletonTable/SkeletonCards
 * /SkeletonStatCards), which stays as-is for its existing ~6 admin/storefront
 * consumers — prefer this shape-based primitive in new code.
 */
export default function Skeleton({ shape = 'text', width, height, className = '', style }: SkeletonProps) {
  const resolvedWidth = toLength(width) ?? (shape === 'circle' ? '2.5rem' : '100%')
  const resolvedHeight =
    toLength(height) ?? (shape === 'text' ? '0.875em' : shape === 'circle' ? resolvedWidth : '8rem')

  return (
    <span
      aria-hidden="true"
      style={{ width: resolvedWidth, height: resolvedHeight, ...style }}
      className={[
        'inline-block animate-shimmer bg-gradient-to-r from-surface-2 via-line to-surface-2 bg-[length:200%_100%]',
        SHAPE_CLASSES[shape],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
