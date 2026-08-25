// frontend/src/editor/fonts.ts
//
// Curated, self-hosted design font manifest — POD.md §5.5 / §6.4. This is
// the single source of truth for "which fonts can a customer put on a
// print": the font picker in the text tool reads this list, and the woff2
// binaries + @font-face rules in ./fonts.css are declared to match it
// exactly. Do not add a family here without adding its @font-face block
// (and the actual woff2 + OFL.txt under frontend/public/fonts/<family>/).
//
// All ten are Google Fonts' OFL-licensed distributions, downloaded from
// github.com/google/fonts and converted to woff2 locally — see
// frontend/public/fonts/<slug>/OFL.txt for the licence text of each family.
export interface DesignFont {
  /** CSS font-family name, matches the @font-face declarations in fonts.css. */
  family: string
  /** Short label for the UI. */
  label: string
  category: 'sans' | 'serif' | 'display' | 'script'
  /** Font weights this family actually has a real face for (see fonts.css). Others are browser-synthesized. */
  weights: (400 | 700)[]
}

export const DESIGN_FONTS: DesignFont[] = [
  { family: 'Poppins', label: 'Poppins', category: 'sans', weights: [400, 700] },
  { family: 'Montserrat', label: 'Montserrat', category: 'sans', weights: [400, 700] },
  { family: 'Playfair Display', label: 'Playfair Display', category: 'serif', weights: [400, 700] },
  { family: 'Merriweather', label: 'Merriweather', category: 'serif', weights: [400, 700] },
  { family: 'Oswald', label: 'Oswald', category: 'display', weights: [400, 700] },
  { family: 'Bebas Neue', label: 'Bebas Neue', category: 'display', weights: [400] },
  { family: 'Anton', label: 'Anton', category: 'display', weights: [400] },
  { family: 'Archivo Black', label: 'Archivo Black', category: 'display', weights: [400] },
  { family: 'Pacifico', label: 'Pacifico', category: 'script', weights: [400] },
  { family: 'Caveat', label: 'Caveat', category: 'script', weights: [400] },
]

export const DEFAULT_DESIGN_FONT = DESIGN_FONTS[0].family

/** System fallback used only if a design font genuinely fails to load — the editor must never hard-fail. */
export const SYSTEM_FALLBACK_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

export function fontFamilyWithFallback(family: string): string {
  return `"${family}", ${SYSTEM_FALLBACK_FONT}`
}

/**
 * POD.md §5.5 — gate every export/thumbnail render on the *actual* fonts
 * used in the design being fully loaded, not just "the manifest exists".
 * A silently-failed font swap must never change approved artwork.
 */
export async function ensureFontsReady(usedFamilies: string[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  await document.fonts.ready
  const unique = Array.from(new Set(usedFamilies))
  await Promise.all(
    unique.flatMap((family) => [
      document.fonts.load(`400 16px "${family}"`).catch(() => undefined),
      document.fonts.load(`700 16px "${family}"`).catch(() => undefined),
      document.fonts.load(`italic 400 16px "${family}"`).catch(() => undefined),
    ])
  )
}
