import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import AnnouncementBar from '../components/AnnouncementBar'
import { useQuery } from '@tanstack/react-query'
import type { Theme, ThemeOverrides, NavItem, FooterData } from './types'
import { themes } from './index'

interface ThemeContextValue {
  theme: Theme | null
  isLoading: boolean
  activeThemeId: string
  navItems: NavItem[]
  footerData: FooterData
  settings: Record<string, string>
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: null,
  isLoading: true,
  activeThemeId: 'jewellery',
  navItems: [],
  footerData: {},
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
    try { return JSON.parse(settings.navigation_json) as NavItem[] }
    catch { return [] }
  }, [settings.navigation_json])

  const footerData = useMemo<FooterData>(() => {
    if (!settings.footer_json) return {}
    try { return JSON.parse(settings.footer_json) as FooterData }
    catch { return {} }
  }, [settings.footer_json])

  useEffect(() => {
    if (!theme) return
    let overrides: ThemeOverrides = {}
    if (settings.theme_overrides_json) {
      try {
        const allOverrides = JSON.parse(settings.theme_overrides_json)
        overrides = allOverrides[activeThemeId] ?? {}
      } catch { /* ignore */ }
    }
    const merged = { ...theme.defaultCssVars, ...overrides }
    const root = document.documentElement
    for (const [prop, value] of Object.entries(merged)) {
      if (value) root.style.setProperty(prop, value)
    }
  }, [theme, settings, activeThemeId])

  const announcementEnabled = settings.announcement_bar_enabled === 'true'
  const announcementText = settings.announcement_bar_text ?? ''
  const announcementColor = settings.announcement_bar_color ?? '#1A1A1A'

  return (
    <ThemeContext.Provider value={{ theme, isLoading, activeThemeId, navItems, footerData, settings }}>
      {announcementEnabled && announcementText && (
        <AnnouncementBar text={announcementText} color={announcementColor} />
      )}
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
