import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Theme } from './types'
import { themes } from './index'

interface ThemeContextValue {
  theme: Theme | null
  isLoading: boolean
  activeThemeId: string
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  isLoading: true,
  activeThemeId: 'jewellery',
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: (): Promise<Record<string, string>> =>
      fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const activeThemeId = settings?.active_theme ?? 'jewellery'
  const theme = themes[activeThemeId] ?? null

  return (
    <ThemeContext.Provider value={{ theme, isLoading, activeThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
