import { useQuery } from '@tanstack/react-query'

// POD.md §6.2 / §6.5 — the customizer's geometry and upload limits come
// from GET /api/settings (already seeded — POD.md §6.3), with the exact
// fallbacks POD.md specifies so the editor still works sensibly if a
// deployment's settings row is missing.
export interface EditorSettings {
  printBleedPercent: number
  printSafePercent: number
  printDpi: number
  maxArtUploadMb: number
}

const FALLBACKS: EditorSettings = {
  printBleedPercent: 4,
  printSafePercent: 4,
  printDpi: 300,
  maxArtUploadMb: 15,
}

function toNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function useEditorSettings(): { settings: EditorSettings; isLoading: boolean } {
  const { data, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const settings: EditorSettings = {
    printBleedPercent: toNumber(data?.print_bleed_percent, FALLBACKS.printBleedPercent),
    printSafePercent: toNumber(data?.print_safe_percent, FALLBACKS.printSafePercent),
    printDpi: toNumber(data?.print_dpi, FALLBACKS.printDpi),
    maxArtUploadMb: toNumber(data?.max_art_upload_mb, FALLBACKS.maxArtUploadMb),
  }

  return { settings, isLoading }
}
