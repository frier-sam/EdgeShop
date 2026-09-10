# POD-UI3.md — Split the Design Surface from the Preview

> **Goal:** Make the customizer's two modes unmistakably different, and stop
> drawing a heavy frame around the print area in either of them.
>
> - **Design mode** stops rendering the product mockup entirely. The shopper
>   designs on a **flat white plane whose aspect ratio is exactly the print
>   area's**, fit to the stage — a sheet of paper, not a garment.
> - **Preview mode** renders the mockup with the artwork **composited into the
>   print area and shaded by the garment's own folds**, so it reads as printed
>   rather than pasted.
>
> **Non-goal (this round):** design templates. The storage architecture already
> supports them (see §2); this round only makes the separation visible in the
> UI. No schema change, no API change, no new settings key.

---

## 1. The two reported problems, diagnosed

### 1.1 "There is a large bounding box in design page and also in preview page"

Two overlapping DOM overlays in `frontend/src/editor/EditorStage.tsx`:

| Line | What it is | Why it reads as a box |
|---|---|---|
| `EditorStage.tsx:348` | `scrim` — `boxShadow: 0 0 0 9999px rgba(16,16,20,0.45)` at the bleed rect | Dims the entire mockup outside the bleed rect. Because a tee's print area is only ~35% of the mockup's width, the undimmed hole reads as a hard-edged box floating on a dark photo. |
| `EditorStage.tsx:383` | `gutter-scrim` — `boxShadow: 0 0 0 64px rgba(16,16,20,0.4)` at the bleed rect | A 64px-wide dark band, the visual replacement for the clip the handle gutter gave up (`canvasGutter.ts`, Bug 3b). It is **deliberately not faded in preview mode** (see its own comment) — so in preview, where every other guide fades to `opacity-0`, this band is the *only* thing left, sitting on the garment as a dark 64px picture frame. |

The gutter band exists for a real reason: with `HANDLE_GUTTER_PX = 64` the canvas
element is 128px wider than the bleed rect, so art dragged off the plane would
otherwise render un-trimmed. It cannot simply be deleted — it has to be
*restated* in a way that doesn't look like a frame.

### 1.2 "It's hard to distinguish between design and preview"

Both modes render the same three layers (mockup `<img>` → scrim → live Fabric
canvas) at the same geometry. The only differences are a badge in the header,
the guides' opacity, and whether selection handles draw. Nothing about the
*stage* changes, which is where the shopper is actually looking.

---

## 2. "This way the design files can be stored separately" — already true

Worth recording so nobody re-derives it: this is a **presentation** change, not
a storage change. `design_json` already contains only the art layer, and the
mockup is already never baked into it:

- `designSchema.ts`'s `StoredSideSnapshot` is a Fabric snapshot plus
  `canvasWidth`/`canvasHeight`, canonicalized to the **reference bleed rect**
  (`geometry.ts`'s `computeReferenceGeometry`) — a coordinate space defined by
  the print area alone.
- `admin/print/renderPrintFile.ts` already renders the art on a **transparent**
  background with no mockup: "print files ship without the mockup baked in".
- The mockup only ever appears in `editor/preview.ts`'s flattened
  ~1000px WebP shopper-facing preview, and in the live stage's `<img>`.

So a design template is already just `{ design_json, aspect ratio }` — nothing
in this round needs to change to unlock that later. What *does* change is that
the design surface now looks like the thing that gets stored.

---

## 3. Target design

### 3.1 Design mode (`mode === 'edit'`)

```
           ┌────────┐
           │ 👕  ▭  │  static mockup thumbnail, print area outlined
           └────────┘
  ┌──────────────────────────┐
  │░░░░░░ bleed ring ░░░░░░░░│   ← plane card, sized to the BLEED rect
  │░ ┌────────────────────┐ ░│      (white-ish, soft shadow)
  │░ │  white print area  │ ░│   ← solid outline at the true print rect
  │░ │  ┌ ─ safe area ─ ┐ │ ░│   ← dashed outline at the safe rect
  │░ │  └ ─ ─ ─ ─ ─ ─ ─ ┘ │ ░│
  │░ └────────────────────┘ ░│
  └──────────────────────────┘
       neutral workspace          ← art dragged out here is muted by a
                                    PAPER-coloured translucent band
```

- **No mockup image on the stage.** The plane is the print area.
- The plane's aspect ratio is derived from the same normalized `print_*`
  fractions everything else uses, so it is proportional to the print area by
  construction (§4.1's invariant).
- The plane is fit to the stage minus `HANDLE_GUTTER_PX` on every side, so it is
  **much larger than today's mockup-relative print area** (on a 390px phone:
  ~262px wide instead of ~150px) and selection handles at its edge still have
  room to draw.
- The dark scrim is **deleted** — there is no mockup left to dim, and the
  workspace outside the plane is now the "outside" cue.
- The dark gutter band becomes a translucent band in **the workspace ground's
  own colour** (`rgba(241,241,244,0.72)`, i.e. `--color-surface-2` at 72%). It
  still mutes art dragged past the trim edge, but it reads as "this part fades
  away", not as a frame. Handles stay grabbable through it
  (`pointer-events: none`, unchanged).
  **Matching the ground exactly is the requirement**, not an aesthetic
  preference: a band tinted anything other than what it sits on is visible *as a
  band* even at low alpha — which is the artifact §1.1 exists to remove. Alpha,
  not hue, does the muting, so matching the ground costs nothing.
- The bleed ring is drawn as a **diagonal hatch**, not a flat fill. Every flat
  fill in the palette puts the ring within ~6 RGB levels of the workspace
  (`--color-paper` #F7F7F9 on `--color-surface-2` #F1F1F4), so the shopper can
  neither see where the sheet ends nor tell that the ring is the part that gets
  trimmed. A hatch is the conventional notation for "margin, will be cut", and
  it doesn't depend on the ground colour staying put.
- **Plane colour: always white.** Decided against sampling the garment colour
  out of the mockup — a mismatch (black art on a black tee) is caught in
  Preview, and sampling would make the design surface depend on mockup pixels
  that the design file deliberately doesn't reference.
- **Static mockup thumbnail**, pinned top-right, gives placement context: the
  mockup at ~80px wide with the print area outlined on it. Static — no art
  composited, so it never re-renders and costs nothing. Purely decorative
  (`aria-hidden`); the Preview mode is the real check.

### 3.2 Preview mode (`mode === 'preview'`)

An **opaque overlay covering the stage**, showing a single rendered composite
image for the active side. No live canvas, no guides, no scrim, no frame.

The composite is produced by `editor/preview.ts` — **the same function that
renders the WebP uploaded to R2 at add-to-cart** — so what the shopper approves
and what appears as the cart thumbnail, the order line and the confirmation
email are the same bytes by construction. This is the whole reason preview mode
becomes a rendered image rather than a re-skinned live canvas.

Composite, in order:

1. Mockup, filling the canvas.
2. Art layer, drawn at the reference bleed rect.
3. **Garment shading**: the mockup's own pixels over the bleed rect,
   tone-normalized, masked to the art's alpha, drawn back with
   `multiply` at 85% — so the garment's folds and shadows fall across the
   artwork. See §4.2.

### 3.3 Why preview stops using the live canvas

The obvious cheaper implementation — keep the live canvas and overlay a copy of
the mockup with CSS `mix-blend-mode: multiply` — **cannot work**, and this is
worth writing down so it isn't attempted again:

CSS blend modes blend a whole element against its backdrop. The overlay would
have to be clipped to the bleed rect, and inside that rect the art is mostly
transparent — so `mockup × mockup` would darken the *bare garment* everywhere
the art isn't, painting exactly the dark rectangle §1.1 is trying to remove.
There is no way to mask a DOM element by a canvas's alpha channel. Masking by
art alpha requires `destination-in` on a 2D context, i.e. a rendered composite.

---

## 4. Contracts (authoritative — build against these exactly)

### 4.1 `frontend/src/editor/geometry.ts` — new export

```ts
export interface FlatStageGeometryInput {
  stageW: number
  stageH: number
  imageNaturalW: number
  imageNaturalH: number
  printRect: NormalizedRect
  bleedPercent: number
  safePercent: number
  /** Reserved on every side of the stage so selection handles at the plane's
   *  edge aren't clipped by the stage's own overflow:hidden. Callers pass
   *  canvasGutter.ts's HANDLE_GUTTER_PX; kept as a parameter so geometry.ts
   *  stays dependency-free and the invariants below are testable at any padding. */
  padding: number
}

/** Design-mode geometry: the BLEED rect fit to the stage, no mockup involved. */
export function computeFlatStageGeometry(input: FlatStageGeometryInput): StageGeometry
```

Returns the existing `StageGeometry` shape unchanged
(`containBox`, `printRectPx`, `bleedRectPx`, `safeRectPx`). Guarantees, each one
a required unit test:

1. **`bleedRectPx` is centred** in `stageW × stageH`.
2. **`bleedRectPx` fits** inside `(stageW - 2*padding) × (stageH - 2*padding)`
   and touches it on exactly one axis (it is a fit, not a shrink).
3. **Aspect-ratio fidelity (the print-safety invariant):**
   `bleedRectPx.w / bleedRectPx.h` equals
   `computeReferenceGeometry(same inputs).bleedRectPx.w / .h` to floating
   tolerance. This is what makes it safe to rescale a design between the flat
   stage and the canonical reference size — `rescaleFabricSnapshot` scales each
   axis independently, so an aspect mismatch would stretch every design.
4. **`printRectPx` / `safeRectPx` are consistent** with `bleedRectPx` under the
   existing frozen `deriveBleedRect`/`deriveSafeRect` maths — i.e. the returned
   `containBox` really is the synthetic mockup box that produces them, so
   `normalizedToPixelRect` still maps any normalized coordinate correctly.
5. **Degenerate inputs** (any of `stageW`, `stageH`, `imageNaturalW`,
   `imageNaturalH`, `printRect.w`, `printRect.h` `<= 0`) fall back to
   `computeStageGeometry(input)` — today's behaviour — rather than dividing by
   zero or returning `Infinity`.

Derivation (linear, closed-form — no iteration):

```
ar    = imageNaturalH / imageNaturalW          // mockup aspect
minc  = min(printRect.w, printRect.h * ar)     // shorter side, in box-width units
bp    = bleedPercent / 100
a     = printRect.w      + 2 * bp * minc       // bleedW, in box-width units
b     = printRect.h * ar + 2 * bp * minc       // bleedH, in box-width units
W     = min((stageW - 2*padding) / a, (stageH - 2*padding) / b)   // box width
```

then `containBox = { width: W, height: W * ar, left, top }` with `left`/`top`
solved so `bleedRectPx` lands centred, and the three rects derived from that box
with the **existing** `normalizedToPixelRect` / `deriveBleedRect` /
`deriveSafeRect` — do not re-implement them.

`computeStageGeometry`, `computeReferenceGeometry` and every helper they call
are **frozen**. `computeFlatStageGeometry` is additive.

### 4.2 `frontend/src/editor/shading.ts` — new file (pure maths, no DOM)

```ts
/** Strength of the garment-shading multiply layer. */
export const SHADING_STRENGTH = 0.85
/** Upper clamp on per-channel gain, so a near-black garment can't blow up. */
export const MAX_SHADING_GAIN = 16

export interface Channels { r: number; g: number; b: number }

/** Mean per-channel value of an RGBA buffer, ignoring fully transparent pixels. Returns {0,0,0} for an empty/fully transparent buffer. */
export function meanChannels(data: Uint8ClampedArray): Channels

/** Per-channel gain mapping `mean` to 255 (white), clamped to [1, MAX_SHADING_GAIN]. A zero mean yields MAX_SHADING_GAIN. */
export function shadingGain(mean: Channels): Channels

/** In place: multiplies each pixel's R/G/B by the per-channel gain, clamping at 255. Alpha untouched. */
export function applyShadingGain(data: Uint8ClampedArray, gain: Channels): void
```

**Why normalize at all.** A raw `multiply` of the mockup over the art is only
correct on a pure-white garment. On a black tee it multiplies the art by ~0.08
and the artwork disappears. Normalizing each channel so the print area's *mean*
becomes white means only the garment's **relative** variation — folds, seams,
shadows — reaches the art, and the garment's base colour and tint do not. Ink on
a black tee stays the colour it prints. Per-channel (not luminance) so a red
garment doesn't tint the artwork red.

Consequence worth stating: on a perfectly flat mockup the gain is ~1 and the
shading is invisible. That is correct — there is nothing to blend with. The
effect scales with how much real shading the mockup photo has.

### 4.3 `frontend/src/editor/preview.ts` — signature unchanged, output changes

`renderSidePreview(args): Promise<Blob>` keeps its exact current signature and
arguments. Its composite gains step 3:

```ts
// 1. mockup fills outW x outH                          (unchanged)
// 2. art layer drawn at geo.bleedRectPx                (unchanged)
// 3. NEW — garment shading, masked to the art's alpha:
//    shade = canvas(artW, artH)
//    shade.drawImage(mockupImg, -bleedX, -bleedY, outW, outH)   // same scale as `out`
//    d = shade.getImageData(...); applyShadingGain(d, shadingGain(meanChannels(d)))
//    shade.putImageData(d)
//    shade.globalCompositeOperation = 'destination-in'
//    shade.drawImage(artEl, 0, 0)                                // mask by art alpha
//    out.globalCompositeOperation = 'multiply'
//    out.globalAlpha = SHADING_STRENGTH
//    out.drawImage(shadeEl, bleedX, bleedY, artW, artH)
```

- The whole shading step is wrapped in `try/catch`. On any failure (a tainted
  canvas, a browser without `getImageData` on a large surface) it is **skipped**
  and the flat composite is returned. A preview must never fail to render.
- `globalAlpha` combined with `multiply` is what caps the effect: where art
  alpha is 0, source alpha is 0, and the backdrop is untouched — which is
  precisely why the bare garment inside the bleed rect does **not** darken.
- Nothing else about the function changes: same `outW`, same font gate, same
  `image/webp` at 0.85, same return type. `admin/print/renderPrintFile.ts` is
  untouched and keeps rendering art on transparency.

### 4.4 `frontend/src/editor/EditorStage.tsx` — design surface only

Now only ever renders the **design** surface (preview mode is an overlay above
it — §4.6). **The prop interface does not change at all** — `mockupUrl` is still
required (the thumbnail uses it), `printRect` still drives every rect, and
`mode` still fades the guides and toggles canvas interactivity. Nothing at the
call site in `CustomizerEditor.tsx` needs editing for this task.

Layer order, all positioned from `computeFlatStageGeometry(…, padding: HANDLE_GUTTER_PX)`:

| # | Element | Notes |
|---|---|---|
| 1 | workspace ground | existing `bg-surface-2` container |
| 2 | **plane card** at `bleedRectPx` | the trim ring: diagonal hatch + `shadow-lift`, square corners (this rect *is* the exported area) |
| 3 | **print sheet** at `printRectPx` | white fill — the plane proper; covers the hatch so it shows only in the ring |
| 4 | Fabric canvas wrapper | unchanged: `positionCanvasWrapper` + gutter viewport transform |
| 5 | **gutter band** at `bleedRectPx` | `boxShadow: 0 0 0 ${HANDLE_GUTTER_PX}px rgba(241,241,244,0.72)` — the workspace ground's own colour, see §3.1; keep `data-testid="gutter-scrim"`; keep `pointer-events-none`; keep it un-faded by mode |
| 6 | safe guide at `safeRectPx` | dashed, unchanged, fades with mode |
| 7 | print guide at `printRectPx` | solid, unchanged, fades with mode |
| 8 | empty-state prompt | unchanged |
| 9 | **mockup thumbnail** | new, top-right, fades with mode |

- **Deleted:** the full-stage mockup `<img>` and the `scrim` div (`:348`).
- **Thumbnail** needs no geometry: normalized `print_*` are fractions of the
  mockup's own box, so percentage positioning inside the `<img>`'s wrapper is
  exact — `left: print_x*100%`, `width: print_w*100%`, etc.
- The gutter/viewport-transform machinery in the geometry effect
  (`setCanvasDimensionsRaw` → `resizeCanvasScaled` → regrow → viewport
  transform → `positionCanvasWrapper`) is **unchanged**. Only the geometry
  *source* changes. `canvasGutter.ts` and `fabric/canvas.ts` stay frozen.

### 4.5 `frontend/src/editor/useEditorObjects.ts` — one gate

Add an `interactive?: boolean` option (default `true`). When false, the global
`keydown` effect does not bind. Required because in preview mode the live canvas
is now hidden behind an image: without this, Cmd+Z would silently mutate the
canvas while the shopper looks at a stale composite.

### 4.6 `frontend/src/editor/components/PreviewStage.tsx` — new file

```ts
export interface PreviewStageProps {
  /** Object URL of the composite for the active side; null while rendering. */
  imageUrl: string | null
  rendering: boolean
  error: string | null
  onRetry: () => void
}
```

An opaque overlay — `absolute inset-0 z-20 bg-surface-2` — rendered as a sibling
of `<EditorStage>` inside the same relative container, so **EditorStage stays
mounted and laid out beneath it**. That is load-bearing: EditorStage owns the
live Fabric canvas and the per-side snapshot cache, so unmounting it on mode
change would destroy the shopper's design. Shows the image `object-contain`, or
a spinner, or an error with a retry button.

### 4.7 `frontend/src/editor/CustomizerEditor.tsx` — orchestration

- Extract the "gather every side's canonical snapshot" block out of
  `handleAddToCart` into one helper used by **both** preview and add-to-cart, so
  the two can't drift:
  ```ts
  function buildCanonicalDesign(): DesignJson   // live canvas for the active side + sideSnapshotsRef for the rest
  ```
- New state: `previewUrls: Partial<Record<EditorSideName, string>>`,
  `previewRendering: boolean`, `previewError: string | null`.
- `handlePreview()` — keep the existing font gate, then `setMode('preview')` and
  render the active side.
- Render **lazily, per side, cached**: entering preview renders only the active
  side; tabbing to the other side in preview renders that one on demand and
  keeps both. Returning to edit revokes every object URL and clears the cache
  (so a subsequent preview always reflects the latest edits).
- Revoke every object URL on unmount too.
- Pass `interactive={mode === 'edit'}` into `useEditorObjects`.
- `handleAddToCart` keeps calling `renderSidePreview` exactly as it does today —
  it inherits the new shading for free. **No preview-blob cache shared with
  preview mode**: keying it correctly (canonical JSON + mockup + settings) is a
  correctness surface not worth buying a ~30ms saving.

---

## 5. Frozen — do not touch

`fabric/canvas.ts`, `canvasGutter.ts`, `fabric/rescaleSnapshot.ts`,
`designSchema.ts`, `designApi.ts`, `admin/print/**`, `admin/PrintAreaSelector.tsx`,
`worker/**`, the D1 schema, and every existing export of `geometry.ts`.
No new settings key, no migration, no API change.

---

## 6. Tasks

- [x] **6.1** `geometry.ts`: `computeFlatStageGeometry` per §4.1 + tests for all
      five guarantees (including the aspect-ratio invariant against
      `computeReferenceGeometry`).
- [x] **6.2** `EditorStage.tsx`: flat-plane surface per §4.4 — drop the mockup
      `<img>` and the dark scrim, add the plane/sheet layers, re-tint the gutter
      band, add the mockup thumbnail.
- [x] **6.3** `shading.ts` per §4.2 + unit tests (mean, gain clamps, in-place
      application, transparent-pixel handling).
- [x] **6.4** `preview.ts`: masked, tone-normalized multiply shading per §4.3,
      with the try/catch fallback.
- [x] **6.5** `PreviewStage.tsx` per §4.6.
- [x] **6.6** `CustomizerEditor.tsx`: `buildCanonicalDesign`, lazy per-side
      preview rendering, object-URL lifecycle, `interactive` gate per §4.7.
- [x] **6.7** `useEditorObjects.ts`: `interactive` option per §4.5.
- [x] **6.8** `tsc -b` clean, full `vitest` suite green — **170 tests / 17 files**
      (128 baseline + 11 flat-geometry + 22 shading + 9 preview-mode). `vite build`
      clean, and Fabric still lands in its own 315 KB chunk, out of the main bundle.
- [x] **6.9** Decisions recorded in §7 below; pointer row added to `POD.md` §13.

### 6.10 Verified in a real browser

Not just unit-tested — driven with Playwright against `wrangler dev` on the
seeded local D1, at 1280×900 and 390×844, product 9 (a 1000×1000 heather-grey
tee whose print area is `0.268 × 0.261`, i.e. 8in wide):

- **Design mode**: white plane with a hatched trim ring, print and safe guides,
  corner thumbnail, and **no dark frame anywhere**. Plane measures 650×627 CSS px
  on desktop and **262 px wide on mobile, against ~151 px before** — a 74%
  larger design surface on a phone. Height-bound on desktop, width-bound on
  mobile, both touching the padded stage on exactly one axis (§4.1 guarantee 2).
- **Preview mode**: the garment on a seamless white ground, artwork on it, no
  frame, no scrim, no guides. Zero console errors or page errors on either
  viewport.
- **The shading provably reaches the artwork.** A large flat `#c2410c`
  rectangle — which a flat composite would render at zero luminance variance —
  measured **σ = 4.24 across 6,730 pixels, spread p01 82.6 → p99 110.3**, i.e.
  the heather fabric's texture is genuinely modulating the ink. The bare garment
  around the rectangle is untouched, confirming the alpha mask (§3.3) holds.

---

## 7. Key Decisions Log

| Date | Decision | Why |
|---|---|---|
| 2026-09-03 | **Design mode drops the mockup entirely; preview gains it back with shading.** The two modes now share no visual language at all | The report was "hard to distinguish between design and preview". They previously differed only by a header badge, guide opacity, and whether handles drew — nothing about the *stage*, which is where the shopper looks. Removing the mockup from design mode also makes the surface honest: `design_json` never references the mockup, so the design surface now looks like the thing that actually gets stored |
| 2026-09-03 | **Preview renders a composite image through `renderSidePreview`, rather than re-skinning the live canvas** | The cheap alternative — the live canvas plus a CSS `mix-blend-mode: multiply` copy of the mockup — is not merely worse, it is impossible. A CSS blend applies to a whole element, and inside the print area the artwork is mostly transparent, so `mockup × mockup` darkens the *bare garment* everywhere the art isn't — reinstating the exact dark rectangle this round removes. Masking a DOM element by a canvas's alpha channel is not expressible in CSS; `destination-in` on a 2D context is. The consolation prize is large: the shopper's preview is now the same bytes as the R2 upload, so preview, cart thumbnail, order image and email image cannot disagree |
| 2026-09-03 | **`EditorStage` stays mounted beneath the preview overlay instead of being swapped out** | It owns the live Fabric canvas and the per-side snapshot cache. Unmounting on mode change would dispose the canvas and destroy the shopper's design. As a sibling under an opaque `absolute inset-0 z-20` overlay it keeps its ResizeObserver and its geometry, so returning to edit is instant and lossless |
| 2026-09-03 | **Garment shading is per-channel tone-normalized before the multiply**, gain clamped to `[1, 16]`, applied at 85% | A raw multiply is correct only on a white garment: on a black tee it multiplies the art by ~0.08 and the artwork disappears. Normalizing each channel so the print area's *mean* becomes white passes through only the garment's **relative** variation — folds, seams, shadows — and not its base colour. Per-channel rather than luminance so a red garment doesn't tint the ink red. Two consequences that look like bugs and aren't: on a perfectly flat mockup the gain is ~1 and the effect is invisible (there is nothing to blend with), and below a mean of ~16 the clamp bites, so a near-black garment dims the ink slightly rather than amplifying sensor noise |
| 2026-09-03 | **The whole shading step is wrapped in `try`/`catch` with `ctx.save()`/`restore()`, falling back to the flat composite** | The flat composite from steps 1–2 is already a correct, shippable preview. A shading failure (a tainted canvas, a hostile `getImageData`) must degrade the image, never fail the render — this function now sits on the add-to-cart path *and* the on-screen preview path |
| 2026-09-03 | **The canonical `DesignJson` is captured ONCE per preview session and reused for every side — and for add-to-cart** | Re-deriving it per side is racy: tabbing sides makes `EditorStage` swap canvas contents behind an `await restoreCanvas`, and child effects run before parent effects, so a naive read attributes the **outgoing** side's objects to the newly-active side. Extending the same frozen capture to `handleAddToCart` closes a **pre-existing** version of that race (a shopper who taps a side tab in preview and hits Add to cart before the swap settles would have bought the wrong artwork on the wrong side) and makes "what you previewed is what you buy" true by construction. Sound because the design provably cannot change mid-session: Fabric interactivity off, tool rail and properties panel unmounted, keybindings gated |
| 2026-09-03 | **Rejected: caching the rendered preview *blob* to reuse for the R2 upload.** Kept reusing the canonical `DesignJson` only | Keying rendered bytes correctly means canonical JSON + mockup URL + bleed/safe settings, and a stale hit ships the wrong image to the merchant. The saving is ~30 ms. Reusing the `DesignJson` is a different trade entirely — same object, same session, provably frozen — so it buys correctness rather than spending it |
| 2026-09-03 | **`useEditorObjects` gained an `interactive` flag that unbinds the global `keydown` listener** | The undo/redo/delete listeners are on `window`, not the canvas, so `setCanvasInteractive` never covered them. Harmless while the canvas was visible in preview; now that an image covers it, Cmd+Z would silently mutate the design behind a composite that cannot show it, and the divergence would surface only at add-to-cart |
| 2026-09-03 | **The bleed ring is a diagonal hatch, not a flat fill; and the gutter band is tinted the workspace ground's own colour** (`rgba(241,241,244,0.72)`, not `--color-paper`) | Every flat fill available put the ring within ~6 RGB levels of the workspace, so neither the sheet's edge nor the fact that the ring is the trimmed part was legible. A hatch is the conventional notation for "margin, will be cut". For the band, matching the ground *exactly* is a requirement rather than a preference: a band tinted anything other than what it sits on is visible **as a band** even at low alpha — precisely the artifact §1.1 removes. Alpha, not hue, does the muting, so matching costs nothing |
| 2026-09-03 | **Preview's ground is white, not the design stage's `bg-surface-2` grey** | Product mockups are shot on white, so a grey ground makes the photo's own white background read as a large white panel floating on it — a hard-edged rectangle, same artifact family. On white the photo's ground is seamless. It also reinforces the mode change: designing happens on a workbench, reviewing happens on a product page |
| 2026-09-03 | **Design plane is always white; rejected sampling the garment colour from the mockup** | Product-owner decision. A shopper putting black art on a black tee finds out in Preview, one tap away. Sampling would also make the design surface depend on mockup pixels that the design file deliberately doesn't reference — the opposite of what this round is establishing |
| 2026-09-03 | **`padding === HANDLE_GUTTER_PX` is load-bearing, not a tunable** | The plane is fit to the stage *minus* the padding, and the gutter band spreads exactly `HANDLE_GUTTER_PX`. Passing a smaller padding makes the band and the grown canvas element overflow the stage's `overflow-hidden`, and selection handles get clipped again — the Bug 3b failure the gutter exists to prevent |
| 2026-09-03 | **No schema, API, or settings change; templates deliberately not built** | `design_json` was *already* mockup-independent and canonicalized to the print area alone (§2), and the print export already renders art on transparency. Design templates are therefore already just `{ design_json, aspect ratio }`. This round only made that separation visible, so it needed no migration and no new settings key |

### 7.1 Known issue, not addressed here

The empty-state prompt ("Tap + to add text or an image") was restyled for the
white sheet, but the **mobile plane is width-bound at `stageW - 128 px`** — the
64px padding costs a third of a 390px viewport. It is still a 74% larger design
surface than before, and the padding cannot shrink without reintroducing clipped
rotation handles (see the `HANDLE_GUTTER_PX` decision above). Making it larger
would need a *dynamic* gutter — one that shrinks when the selected object isn't
near the plane's edge — which is a real feature, not a tweak.
</content>
