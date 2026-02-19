import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Theme, ThemeOverrides, NavItem } from './types'
import { themes } from './index'

interface ThemeContextValue {
  theme: Theme | null
  isLoading: boolean
  activeThemeId: string
  navItems: NavItem[]
  settings: Record<string, string>
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  isLoading: true,
  activeThemeId: 'jewellery',
  navItems: [],
  settings: {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: (): Promise<Record<string, string>> =>
      fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const activeThemeId = settings.active_theme ?? 'jewellery'
  const theme = themes[activeThemeId] ?? null

  const navItems = useMemo<NavItem[]>(() => {
    if (!settings.navigation_json) return []
    try {
      return JSON.parse(settings.navigation_json) as NavItem[]
    } catch {
      return []
    }
  }, [settings.navigation_json])

  // Inject CSS custom properties: merge theme defaults with merchant overrides from D1
  useEffect(() => {
    if (!theme) return
    let overrides: ThemeOverrides = {}
    if (settings.theme_overrides_json) {
      try {
        const allOverrides = JSON.parse(settings.theme_overrides_json)
        overrides = allOverrides[activeThemeId] ?? {}
      } catch {
        // ignore malformed JSON
      }
    }
    const merged = { ...theme.defaultCssVars, ...overrides }
    const root = document.documentElement
    for (const [prop, value] of Object.entries(merged)) {
      if (value) root.style.setProperty(prop, value)
    }
  }, [theme, settings, activeThemeId])

  return (
    <ThemeContext.Provider value={{ theme, isLoading, activeThemeId, navItems, settings }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
