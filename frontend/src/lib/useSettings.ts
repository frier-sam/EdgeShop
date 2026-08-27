import { useQuery } from '@tanstack/react-query'
import { fetchJson } from './api'

export interface StoreSettings {
  store_name: string
  currency: string
  [key: string]: string | undefined
}

const DEFAULTS = {
  store_name: 'ESPOD',
  currency: 'INR',
}

/**
 * Fetches /api/settings and exposes it with sensible defaults.
 * Replaces the `settings` value that ThemeProvider used to provide via context.
 */
export function useSettings() {
  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetchJson<Record<string, string>>('/api/settings'),
    staleTime: 5 * 60 * 1000,
  })

  return {
    settings: { ...DEFAULTS, ...data } as StoreSettings,
    isLoading,
    store_name: data?.store_name ?? DEFAULTS.store_name,
    currency: data?.currency ?? DEFAULTS.currency,
  }
}
