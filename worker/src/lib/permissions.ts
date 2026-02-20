export const PERMISSION_KEYS = [
  'products','orders','customers','discounts','reviews',
  'analytics','content','appearance','shipping','settings',
] as const

export function allPermissions(): Record<string, boolean> {
  return Object.fromEntries(PERMISSION_KEYS.map(k => [k, true]))
}
