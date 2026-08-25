# POD-UI.md — Visual Overhaul & Mobile Plan

> **Goal:** The POD conversion is functionally complete (POD.md, 9 phases, 132 tests). This plan fixes how it *looks and feels*: a coherent design language, genuine mobile support, discoverable editor controls, and motion — aimed at a convincing demo.
>
> **Non-goal:** No functional changes. Pricing, print geometry, security and the print-fidelity guarantees are frozen. See §6.

---

## 1. Findings — what is actually wrong

Evidence gathered from the codebase, not assumed:

| # | Finding | Evidence |
|---|---|---|
| 1 | **Text/shape colour is undiscoverable on mobile** — not missing. Controls exist (`type="color"` for text `fill`, shape `fill`/`stroke`), and `addAndSelect()` auto-selects new objects. But on mobile the panel renders only when something is selected, inside `max-h-56 overflow-y-auto` — a 224px scrolling strip where colour sits *below* font/size controls, off-screen. | `PropertiesPanel.tsx:161,321`, `objects.ts:161`, `CustomizerEditor.tsx:447` |
| 2 | **The customizer is barely responsive.** Only 7 breakpoint utilities in the whole 500-line orchestrator. Desktop gets a `w-72` right rail; mobile gets the cramped strip above. | `CustomizerEditor.tsx:438,447` |
| 3 | **The palette is muddy.** Burnt orange `#c2410c` on warm beige `#faf6f0` — two warm mid-tones fighting each other, giving low separation and a dated feel. | `index.css` `@theme` |
| 4 | **No motion language.** A single `fade-in` keyframe exists and is barely used. No hover/press feedback, no drawer transitions, no entrance choreography. | `index.css` |
| 5 | **No spacing or radius system.** Components hard-code arbitrary values, so rhythm drifts page to page. | across `components/`, `pages/` |

**The headline fix for #1 is UX, not features:** surface colour as a swatch row at the *top* of the mobile sheet, one tap from selection.

---

## 2. Direction — "Bold editorial, design-tool confidence"

Chosen without further consultation to keep momentum; redirect if wrong.

- **Cool neutral base, not warm beige.** The warm/warm clash is the main reason the current theme reads muddy. A near-white cool ground makes product imagery pop and reads cleaner in screenshots.
- **One disciplined accent** — indigo. It signals "design tool", which is exactly what the customizer is, and it sits cleanly on white without vibrating the way orange-on-beige does. Reserved for primary actions and active states. No second accent.
- **Oversized display type** with a real scale, generous whitespace, image-dominant product cards.
- **Motion: polished micro-interactions**, 150–300ms, always `prefers-reduced-motion`-aware. Rich scroll choreography is explicitly out — it risks fighting canvas touch input in the editor.

### 2.1 Design tokens — AUTHORITATIVE SPEC

Every agent consumes these exact names. Tailwind v4 auto-generates utilities from `@theme` (`bg-ink`, `text-accent`, `rounded-card`, …). Workstream A writes this block; B, C and D consume it and must not invent parallel tokens.

```css
@theme {
  /* Neutrals — cool, high separation */
  --color-paper:      #F7F7F9;   /* page ground */
  --color-surface:    #FFFFFF;   /* cards, sheets, inputs */
  --color-surface-2:  #F1F1F4;   /* subtle fills, skeletons */
  --color-ink:        #101014;   /* primary text */
  --color-ink-soft:   #6A6A77;   /* secondary text */
  --color-ink-faint:  #9B9BA6;   /* tertiary, placeholders */
  --color-line:       #E4E4EA;   /* borders, dividers */

  /* The one accent */
  --color-accent:      #4F46E5;
  --color-accent-dark: #4338CA;  /* hover/press */
  --color-accent-soft: #EEF2FF;  /* tint backgrounds, active chips */
  --color-on-accent:   #FFFFFF;

  /* Status */
  --color-success: #15803D;
  --color-warning: #B45309;
  --color-danger:  #DC2626;

  /* Type */
  --font-display: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;
  --font-sans:    'Inter', system-ui, -apple-system, sans-serif;

  /* Radius */
  --radius-btn:   0.625rem;
  --radius-card:  1rem;
  --radius-sheet: 1.5rem;

  /* Elevation — soft, neutral, never black */
  --shadow-card:  0 1px 2px rgb(16 16 20 / 0.04), 0 4px 16px rgb(16 16 20 / 0.06);
  --shadow-lift:  0 2px 4px rgb(16 16 20 / 0.06), 0 12px 32px rgb(16 16 20 / 0.10);
  --shadow-sheet: 0 -4px 24px rgb(16 16 20 / 0.12);

  /* Motion */
  --ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1);
  --dur-fast:   150ms;
  --dur-base:   240ms;
  --dur-slow:   360ms;
}
```

**Type scale** (display uses `font-display`, everything else `font-sans`):

| Role | Mobile | Desktop | Weight / tracking |
|---|---|---|---|
| Hero | 2.5rem | 4.5rem | 700, -0.03em |
| Page title | 1.75rem | 2.5rem | 700, -0.02em |
| Section | 1.25rem | 1.75rem | 600, -0.01em |
| Body | 0.9375rem | 1rem | 400 |
| Small / meta | 0.8125rem | 0.875rem | 500 |

**Spacing rhythm:** 4px base. Section vertical padding `py-12` mobile / `py-20` desktop. Page gutter `px-4` mobile / `px-8` desktop. Max content width `max-w-6xl`.

**Accessibility floor:** body text ≥ 4.5:1, large text and UI ≥ 3:1. `#4F46E5` on white is 6.3:1 — safe for text and buttons. Every interactive target ≥ 44px on touch.

---

## 3. Workstreams

### A — Design system foundation
Owns `frontend/src/index.css`, `frontend/src/components/Button.tsx`, `Field.tsx`, plus new `components/ui/`.

1. Replace the `@theme` block with §2.1 verbatim.
2. Add a `@media (prefers-reduced-motion: reduce)` block that neutralises every animation and transition to ~0.01ms. **Non-negotiable** — motion must be opt-out-able at the system level.
3. Keyframes: `fade-up`, `fade-in`, `scale-in`, `slide-up-sheet`, `shimmer`, `badge-pop`.
4. `Button` — variants `primary` / `secondary` / `ghost` / `danger`, sizes `sm` / `md` / `lg`, `loading` state with spinner, press-scale `0.97`, min 44px touch height. All consumers migrate to it.
5. `Field` — consistent label/hint/error, 44px min height, visible `:focus-visible` ring in accent.
6. New primitives: `Sheet` (mobile bottom sheet with drag-to-dismiss + backdrop), `Badge`, `Skeleton` (shimmer), `IconButton`, `SegmentedControl`.

### B — Storefront polish + mobile
Owns `frontend/src/pages/**` (except account internals), `frontend/src/components/**` (excluding `ui/` primitives from A).

- **Header** — sticky, condenses on scroll, real mobile menu (slide-in), animated cart badge.
- **HomePage** — full-bleed hero with oversized display type and a clear CTA; "How it works" as three numbered cards; product grid with staggered `fade-up` entrance (40ms apart, ≤6 items so it never feels slow).
- **ShopPage** — responsive grid `2 / 3 / 4` columns at `base / md / lg`; category chips horizontally scrollable on mobile with snap.
- **ProductPage** — mobile-first: swipeable gallery with dot indicators, sticky bottom action bar on mobile carrying price + CTA, size picker as proper 44px chips, price breakdown in a clean bordered card.
- **CartDrawer** — slide-in with backdrop fade, per-line design thumbnails, empty state with illustration, smooth quantity stepper.
- **CheckoutPage** — single-column mobile, grouped sections, sticky order summary on desktop, inline validation.
- **OrderSuccessPage** — celebratory but restrained; show the design previews prominently.
- Skeletons replace all spinner-only loading states.

### C — Customizer mobile overhaul ← **highest priority**
Owns `frontend/src/editor/components/**`, `frontend/src/editor/CustomizerEditor.tsx`, and the presentational layer of `EditorStage.tsx`.

**Hard constraint:** must not alter coordinate maths, canvas sizing, export paths, or anything in §6. Geometry is print fidelity.

1. **Fix colour discoverability (Finding #1).** Replace the cramped mobile strip with a proper bottom `Sheet`:
   - A **swatch row is the first thing in the sheet** — 10 preset colours plus a custom picker, one tap from selecting an object.
   - Tabbed sections below: *Style* (colour, opacity), *Text* (font, size, weight, align), *Arrange* (layer, duplicate, delete).
   - Sheet is drag-dismissible and defaults to a compact peek height showing the swatch row without expanding.
2. **Mobile layout:** stage gets maximum viewport; tool rail becomes a fixed bottom bar above the sheet; undo/redo always reachable; safe-area insets respected (`env(safe-area-inset-bottom)`).
3. **Desktop:** keep the right rail but restyle to the new system; add the same swatch row at its top for parity.
4. **Side tabs** (Front/Back) as a `SegmentedControl` with an animated indicator.
5. **Price footer** — animate value changes; make the per-side fee breakdown legible on small screens.
6. **Preview mode** — smooth cross-fade from edit; prominent, thumb-reachable Add-to-cart.
7. **Empty state:** when a side has no objects, show a subtle prompt inside the print area ("Tap + to add text or an image") that never exports — it must be a DOM overlay, never a canvas object.
8. Loading and uploading states use the new skeleton/spinner language.

### D — Admin polish
Owns `frontend/src/admin/**`. Lighter touch — internal tooling, not the demo centrepiece.

- Adopt the new tokens, `Button`, `Field`.
- Make tables usable on mobile (card layout below `md`).
- `PrintAreaSelector`: clearer handles, better contrast against arbitrary mockups, visible focus states.
- Restyle `AdminLayout` nav to match.

---

## 4. Agent assignment & file ownership

Ownership is exclusive — concurrent agents must not edit outside their lane.

| Agent | Workstream | Owns | Must not touch |
|---|---|---|---|
| 1 | A (foundation) | `index.css`, `components/Button.tsx`, `components/Field.tsx`, `components/ui/**` | pages, editor, admin |
| 2 | C (customizer) | `editor/components/**`, `editor/CustomizerEditor.tsx`, `editor/EditorStage.tsx` (presentation only) | §6 frozen files, pages, admin |
| 3 | B (storefront) | `pages/**`, `components/**` except `ui/` | `index.css`, editor, admin |
| 4 | D (admin) | `admin/**` | everything else |

**Sequencing:** Agent 1 lands first and is committed — it defines the shared contract. Agents 2, 3 and 4 then run in parallel against it. Agent 2 is the priority; if effort must be traded, C beats D.

---

## 5. Acceptance criteria

1. `worker tsc`, `frontend tsc -b`, `vite build` clean.
2. **All 132 tests still pass.** Any test change must be justified as an intentional behaviour change, not a convenience edit.
3. Fabric and fflate remain absent from the main bundle. Main chunk must not grow more than ~15KB gz.
4. No horizontal scroll at 360px, 390px and 768px viewport widths on any page.
5. Every interactive target ≥ 44px on touch.
6. `prefers-reduced-motion: reduce` disables all animation.
7. **Colour is reachable in ≤ 2 taps** from selecting an object on a 390px viewport.
8. Print output is byte-identical in geometry to before — verified by re-running the Phase 8 registration check.

---

## 6. FROZEN — do not modify

Changing these risks the print-fidelity and security guarantees earned across POD.md Phases 6–8. Presentation may change; logic may not.

```
frontend/src/editor/geometry.ts              coordinate maths
frontend/src/editor/fabric/**                canvas, export, rescale
frontend/src/editor/preview.ts               preview compositor
frontend/src/editor/designSchema.ts          design serialization
frontend/src/editor/designApi.ts             persistence
frontend/src/admin/print/**                  300 DPI renderer
worker/**                                    all backend, pricing, auth
```

Specifically: do not change how the canvas element is sized or positioned relative to the bleed rect (POD.md §5.2), do not introduce Fabric `clipPath`, and do not add canvas objects for UI purposes — guides and prompts stay DOM so they cannot leak into a print file.

---

## 7. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-26 | Text/shape colour treated as a discoverability bug, not a missing feature | Controls already exist and new objects auto-select; the failure is a 224px mobile strip that pushes colour off-screen |
| 2026-08-26 | Garment/product colour explicitly out of scope | Confirmed not wanted; the original size-only decision (POD.md §0) stands |
| 2026-08-26 | Cool neutral base replaces warm beige | Warm accent on warm ground was the root of the "muddy" feel — two mid-tones with little separation |
| 2026-08-26 | Single indigo accent, no secondary | One disciplined accent reads more professional than competing colours; indigo also signals "design tool", matching the customizer |
| 2026-08-26 | Micro-interactions over scroll choreography | Rich motion risks competing with canvas touch handling in the editor, where input latency is far more damaging than a missing parallax |
| 2026-08-26 | Editor geometry frozen during the overhaul | Print registration was verified numerically in Phase 8; a restyle must not be able to regress it |
| 2026-08-26 | Foundation agent lands before the other three | Shared tokens are a contract; parallel agents inventing their own would reproduce exactly the inconsistency this plan exists to fix |
