# POD-V2.md — Option Axes, Bulk Pricing and Design Templates

> **Status: Phases 1 and 4 complete.** All nine decisions in §9 are settled.
> Phase 1 (schema, the one admin product form) and Phase 4 (design templates —
> admin authoring, browsing and applying) are done and browser-verified.
> Phase 4 was brought forward ahead of Phases 2–3 on request; it has no
> dependency on them. Phases 2, 3, 5 and 6 are pending.
>
> **Scope:** a second option axis (colour / finish / material — no price
> difference), bulk quantity pricing (with price difference), browsable design
> templates, a Vistaprint-shaped storefront and editor — and above all **one
> admin product form for every kind of product**, not a form per product type.
>
> **Substrate-agnostic by rule.** This system prints on t-shirts, visiting
> cards, bottles, mugs, posters. Nothing below may assume a garment. Where the
> existing code or docs say "garment", read "substrate", and §8 lists the places
> that wording has to actually change.

---

## 1. The organizing principle: capability blocks, not product types

> **Nothing about a product's *type* is ever encoded in the schema, the routes,
> or the number of admin pages.** A mug, a t-shirt and a visiting card differ
> only in which checkboxes are ticked and what strings sit in the label columns.

Every product is:

```
{ basics } + [ axis 1? ] + [ axis 2? ] + [ bulk pricing? ] + [ customization? ]
```

Four independent, optional blocks on **one** form. The moment a `product_type`
column exists, every feature after it has to ask "which type?" — and that is
exactly how you end up with hundreds of admin variants.

**This already half-works, which is why "no units" is free.** `product_sizes.label`
is an opaque `TEXT` column: never parsed, never validated against a unit, never
sorted semantically (it sorts on `sort_order`, which the admin controls). So
`S`, `XL`, `250ml`, `A4` and `90×50mm` are all valid **today**, with zero code
change. The same discipline governs everything new here: axis-2 labels are
opaque strings, bulk tiers are opaque integer quantities. **No unit field
anywhere in the system.**

### 1.1 Two *nameable* option axes

The request said "size" and "colour", but those are t-shirt words. A visiting
card varies by *paper size* and *finish*; a bottle by *volume* and *cap colour*;
a poster by *dimensions* and *stock*.

The generalization that stays small is **not** an arbitrary N-axis attribute
system — that's the same combinatorial explosion in disguise, and it drags in a
matrix UI, EAV-ish queries and per-combination rows. Instead: **exactly two
axes, whose *names* the admin can edit.**

| | Axis 1 (default name "Size") | Axis 2 (default name "Colour") |
|---|---|---|
| Price delta | ✅ optional per option | ❌ never — see §3.1 |
| Stock | ✅ per option | ❌ (§3.3) |
| Swatch | ❌ | optional |
| Photo | ❌ | optional (§3.2) |
| T-shirt | S · M · L · XL | Navy · White · Heather |
| Visiting card | 90×50mm · 85×55mm | Matte · Glossy · Textured |
| Bottle | 250ml · 500ml · 1L | Steel · Black · Copper |
| Mug | 11oz · 15oz | Ceramic White · Black |

Two `TEXT` columns on `products` (`axis1_label`, `axis2_label`, defaulting to
`Size` and `Colour`) buy the entire generalization. No new tables, no matrix, no
per-type code — and the storefront just renders whatever the merchant named it.

### 1.2 Presets are form prefills, never schema

Optional presets on the *new product* screen — "T-shirt", "Visiting card",
"Bottle", "Mug", "Poster". A preset does exactly one thing: **ticks some
checkboxes, sets the two axis names, and prefills some rows.** It writes nothing
a hand-filled form couldn't, creates no route, and lives as a client-side
constant. This is the whole "don't build 100 admins" answer: the convenience of
product types with none of the branching.

---

## 2. Block A — Axis 1 (already built, no schema change)

`product_sizes(label, price_delta, stock_count, sort_order)` is already
free-text with an optional price delta. It needs **no schema change** — only:

- The section header and the storefront picker read `products.axis1_label`, so a
  bottle merchant sees "Volume" and a card merchant sees "Paper size".
- It sits behind a checkbox, collapsed by default.

(The table name `product_sizes` stays as-is. Renaming a table for vocabulary
alone is a migration with no functional payoff; the *label* is what users see.)

---

## 3. Block B — Axis 2 (colour / finish / material)

### 3.1 The decision that keeps this cheap

**Axis 2 carries no price difference.** That isn't only a pricing choice, it's
the simplification that keeps this axis out of the pricing engine *entirely*:
`lib/pricing.ts`'s `computeLine` — the security-critical, server-authoritative
recompute — needs **no axis-2 awareness at all**. It becomes a pure
presentation-and-fulfilment attribute. Worth defending: the first time someone
asks "+₹50 for the metallic finish", the honest answer is a separate product,
not a price-bearing option column.

```sql
CREATE TABLE product_variants (          -- axis 2; name is deliberately neutral
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,            -- opaque: 'Navy', 'Matte', 'Steel'
  swatch_hex TEXT    DEFAULT NULL,        -- NULL when the option isn't a colour
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (product_id, label)
);
```

**`swatch_hex` must be nullable, and that's a substrate-agnostic requirement,
not a nicety.** Matte vs glossy has no colour. A steel bottle isn't a hex value.
So the storefront picker has to degrade gracefully: swatch chips when hexes
exist, photo thumbnails when photos exist, and plain labelled pills when neither
does. A design that assumes a colour chip is a design that only works for
t-shirts.

### 3.2 Photos per option

A navy tee is a different photograph from a white tee; a glossy card
photographs differently from a matte one. Options:

| Option | Verdict |
|---|---|
| **(a) Per-option photo override, print area stays on the side** | Recommended. `product_side_images(side_id, variant_id, image_url, image_w, image_h)`, with `product_sides.image_url` as the **default** used by any option lacking its own photo — so adding an option never blocks on having photos ready. **One normalized print rect stays on `product_sides`, shared by every option**, which is exactly the existing "normalized coordinates, one number, three consumers" philosophy. |
| (b) Tint one mockup in-browser | Needs no photography, and we already composite in canvas. But it only works for *colour* options — it is meaningless for matte/glossy/textured, which is precisely the substrate-agnostic case. Rejected as the primary mechanism; possibly fine as a placeholder. |
| (c) Each option owns its own sides | 6 options × 2 sides = 12 print areas to define and keep in sync, and the print area is the one thing that must *not* vary by option. Rejected. |

**The invariant (a) depends on, which the admin must enforce:** every photo for a
side must share the default's framing and aspect ratio, because they all share
one print rect. A photo shot at a different zoom makes the print area silently
misregister *on that option only* — a bug that reaches production one variant at
a time. On upload, compare aspect ratio against the side's default and **block**
beyond a small tolerance. Both dimensions are already captured at upload time,
so this is cheap.

### 3.3 Stock stays on axis 1 only

An axis1 × axis2 stock matrix is an N×M grid UI and N×M rows for a benefit most
print-on-demand shops don't need. Stock stays exactly where it is — on
`product_sizes`, or `products.stock_count` when there are no options. Additive
later if ever needed.

### 3.4 What axis 2 touches

| Area | Change |
|---|---|
| Cart line identity | `product_id:size:design_id` → **`product_id:size:variant:design_id`** (`cartStore.ts:28`) |
| `designs` table | **Nothing** — see §4 |
| `items_json` / order detail | Carries the option label, so the merchant knows which blank to pull |
| Print file | **Unchanged.** Art renders on transparency; the substrate never enters it |
| Product page | Swatch / thumbnail / pill picker per §3.1, swapping the gallery |

---

## 4. Designs are option-independent (decided)

**A design is never authored for a particular colour, finish or material.** One
design row works on every option, and nothing about axis 2 is stored on it.

The consequences are all simplifications:

- **The editor never learns that axis 2 exists.** The most complex part of the
  app is completely untouched by this feature.
- **One design row is reusable across every option** — so My Designs, re-order,
  and templates all stay option-free.
- **The design plane stays neutral white.** `POD-UI3.md` §7's "always white"
  decision survives unchanged: an option-independent design has no colour to
  take. (Had designs been option-specific, that decision would have needed
  revisiting, since `swatch_hex` is explicit data rather than sampled pixels.)
- **Bulk grouping gets simpler** — quantity aggregates across options naturally,
  because the design is the same design (§5.1).

The one thing this leaves open is which substrate the *preview image* is
composited onto, since a rendering necessarily shows something — §10 Q1.

---

## 5. Block C — Bulk pricing

Now a first-class requirement, not a nice-to-have: nobody buys one visiting
card, they buy 250. For flat-goods categories **the tiers effectively become the
quantity picker.**

```sql
CREATE TABLE product_price_breaks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty    INTEGER NOT NULL,           -- opaque count, no unit
  unit_price REAL    NOT NULL,           -- absolute, all-in (§9)
  UNIQUE (product_id, min_qty)
);
```

Plus `products.min_order_qty INTEGER NOT NULL DEFAULT 1` — a card product can
require 100 minimum, and the product page's quantity control becomes **chips
derived from the tiers** (100 · 250 · 500 · 1000) rather than a free spinner.
That is both the Vistaprint pattern and a genuine usability win.

### 5.1 Aggregation (decided: grouped)

Quantity aggregates by **`(product_id, design_id)` across both axes**, then the
resulting tier applies to every line in the group. A 50-shirt order placed as
10 S + 20 M + 20 L is three cart lines but one bulk order, and per-line tiers
would give that customer nothing — a bug every merchant would report.

**Structural consequence worth flagging loudly:** `computeLine` is currently
*pure per-line*, which is what makes `pricing.test.ts` simple and the
server-authoritative recompute easy to reason about. Aggregation makes pricing
**two-pass** — group lines, resolve each group's tier, then price. It stays
server-authoritative and unit-testable, but the tier resolution moves up into
`computeOrderQuote`, and no line can be priced in isolation any more. The cart's
display logic and `POST /api/checkout` must run identical logic, or the
`price_mismatch` guard fires on legitimate orders.

### 5.2 The open edge of absolute pricing

Tiers store an **absolute all-in unit price** (§9). One wrinkle still needs a
rule, because print fees are per *side*: a front+back design costs the merchant
twice the printing but would be charged the same flat tier as a front-only one,
and a deep tier can fall *below* the print fees alone. §10 Q2.

---

## 6. Design templates ("browse designs")

### 6.1 Shape

```sql
CREATE TABLE template_collections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,            -- 'Birthday', 'Corporate', 'Minimal'
  category   TEXT    NOT NULL DEFAULT '',  -- '' = every category
  status     TEXT    NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE design_templates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES template_collections(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  design_json   TEXT    NOT NULL,         -- ONE side's StoredSideSnapshot
  canvas_w      REAL    NOT NULL,         -- the bleed rect it was authored at
  canvas_h      REAL    NOT NULL,
  preview_url   TEXT    NOT NULL DEFAULT '',
  tags          TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'active',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Category → collections → templates, as requested. A separate admin section, not
part of the product form. Templates being option-independent falls straight out
of §4 — a template is just a design, and designs don't know about axis 2.

**A separate table, deliberately not a flagged `designs` row.** The orphan GC
(`worker/src/lib/gc.ts`) deletes `designs` where `order_id IS NULL` past the
retention window. A template is by definition never attached to an order, so
storing templates as `designs` rows would have the nightly cron quietly eat the
merchant's whole template library after 30 days. Templates must also be excluded
from any future cleanup of `uploads/` art — `gc.ts` already defers that, and
this is a second reason to be careful there.

### 6.2 The hard technical problem: aspect mismatch

`design_json` is canonicalized to a **specific print area's bleed rect**
(`canvasWidth`/`canvasHeight`, from `computeReferenceGeometry`). Templates are
keyed to a *category*, and this is where substrate-agnosticism bites hardest: a
"Corporate" template will meet a 90×50mm card, a square 8in chest print and a
tall bottle wrap.

`rescaleFabricSnapshot` scales each axis independently, so reusing it here would
**stretch** the artwork. What's needed is a sibling primitive:

```ts
/** Uniform-scale + re-centre a snapshot into a different-shaped canvas — letterbox, never stretch. */
export function fitSnapshotToCanvas(snapshot, fromW, fromH, toW, toH): FabricSnapshot
```

Uniform scale by `min(toW/fromW, toH/fromH)`, then re-centre. Small, pure,
directly unit-testable, and it belongs beside `rescaleFabricSnapshot`. Storing
`canvas_w`/`canvas_h` is what makes the fit computable, and their ratio lets the
admin warn *"drawn for a square area; on this product it will letterbox"*.

Open: whether templates should be **filtered** by aspect compatibility rather
than letterboxed — a landscape card design fitted into a tall bottle wrap is
technically correct and visually useless. §10 Q3.

### 6.3 Templates are single-side

A template holds **one side's** snapshot and applies to whichever side the
shopper is on. Multi-side doubles the authoring UI, the browse UI and the fit
logic to serve a rare case, and composes fine anyway — apply one template to the
front, another to the back.

### 6.4 Author templates in the existing customizer, in an admin mode

The highest-leverage decision here. **Do not build a template editor.** Admin
picks a category and a *reference product* (to borrow a real print area), then
gets the exact same customizer the shopper uses, with "Save as template"
replacing "Add to cart". One editor, one design format, one renderer, one
preview compositor — so a template can never render differently from the design
it becomes.

### 6.5 Applying a template is genuinely cheap here

Because `design_json` *is* Fabric JSON, applying a template is `loadFromJSON`
into the current side — the shopper gets **fully editable text, images and
shapes**, not a flattened picture. That is exactly the "add a design and quickly
edit" behaviour asked for, with no new machinery. Applying **replaces** the
side's contents (Vistaprint behaviour) as a single undo entry, so it's
recoverable — the undo stack already exists.

### 6.6 Browse UI, inside the editor

- The editor's empty state becomes **"Start from a design, or start blank"** —
  the biggest Vistaprint pattern, and a natural fit for the flat plane built
  last round, which is already the template's own coordinate space.
- A **Designs** entry at the top of the tool rail opens a drawer: collections as
  rows, filtered to the product's category by default, search over `name` +
  `tags`, and an "all categories" escape hatch.
- Cards show `preview_url`, so browsing costs one small image per template and
  no Fabric work until something is picked.

---

## 7. Categories: suggestions are nearly free, with one caveat

`GET /api/categories` already returns the distinct category values across active
products with counts and a representative image (`worker/src/lib/categories.ts`,
derived from `products.category` — no table). So "a dropdown of existing
categories, or type a new one" is a combobox over an endpoint that ships today.

**The caveat:** categories are free text, and templates are now keyed by
category. A collection filed under `Visiting Card` while products sit in
`Visiting Cards` silently shows an empty drawer — no error, no clue. Either:

- **Lightweight (recommended for now):** the collection's category field uses the
  same combobox and warns inline when the typed value matches no existing
  category. Zero migration.
- **Robust:** promote categories to a real table with `products.category_id` — correct,
  and probably where this ends up if categories ever get their own pages, but a
  migration touching products, the shop page, the chips and the sitemap for a
  problem the warning mostly solves.

---

## 8. Substrate-agnostic cleanup this forces

Places where t-shirt assumptions are currently baked in, and what to do:

| Where | Assumption | Fix |
|---|---|---|
| `product_sides.side CHECK (side IN ('front','back'))` | Flat two-sided goods | **Relabel, don't restructure.** Keep exactly two side slots and the internal `front`/`back` keys — `design_json`, `sides_used`, pricing validation and print-file naming all depend on them — but add a display label per side so a bottle reads "Wrap" and a mug reads "Outer". 90% of the value, near-zero risk. N named panels stay a later decision. |
| `preview.ts` "garment shading" | Fabric folds | Rename the concept to **substrate shading** in code and comments. The maths is unchanged and correct for paper texture and bottle highlights alike — it only ever amplified the substrate's *relative* variation. |
| Curved substrates | Bottles, mugs | **Honest limitation:** the compositor multiplies, it does not *warp*. On a strongly curved surface the art will read as a flat decal rather than wrapping. Displacement-map warping is a real feature, explicitly out of scope here, and should be written down rather than discovered. |
| Storefront copy | "Colour", "Size" | Read `axis1_label` / `axis2_label` (§1.1). |
| `print_width_in` | — | Already universal. Fine. |

---

## 9. Decided in discussion

| # | Decision | Note |
|---|---|---|
| 1 | **Bulk tiers store an absolute all-in unit price** | Merchant-friendly and round-numbered ("250 cards = ₹8 each"). Leaves the per-side print-fee edge open — §10 Q2 |
| 2 | **Bulk quantity aggregates across both axes**, grouped by `(product_id, design_id)` | Accepts the two-pass pricing change (§5.1) |
| 3 | **Designs are option-independent** | Editor stays option-free; one design row serves every colour/finish (§4) |
| 4 | **The design plane stays white** | Follows from #3 — no option-specific design means no colour for the plane to take |
| 5 | **The system is substrate-agnostic** | Two *nameable* option axes, relabelled side slots, no `product_type` (§1.1, §8) |
| 6 | **Previews always composite onto the side's default photo** | One preview per design per side. No schema change, and last round's "the image you approve is byte-identical to your cart thumbnail" guarantee survives intact. A shopper who picked Navy reviews on the default photo — accepted |
| 7 | **A bulk tier's absolute unit price includes printing** | The tier price replaces `base_price + print fees`. **Assumption to confirm on sight:** axis-1 price deltas still apply *on top* (an XL at a tier costs tier + XL delta), because folding them in would need one tier row per size — §11.3 |
| 8 | **Templates are filtered by aspect compatibility**, not letterboxed into any shape | With a tolerance, plus a "show all shapes" toggle so nothing is permanently unreachable — letterboxing stays the fallback for what the toggle reveals |
| 9 | **Axis 2 needs neither swatch nor photo** | A plain labelled pill is a legitimate third state, so "Matte / Glossy" is a complete, shippable option set |

### 9.1 One consequence of #7 the merchant should be warned about, not protected from

With an all-in tier price, a front+back design costs the merchant twice the
printing for the same revenue as a front-only one, and a deep tier can fall
*below* the print fees alone. This was raised and reaffirmed, so it is the
intended behaviour — the tier is a flat advertised price and that is the point.

The cheap safeguard that respects the decision: **the admin shows a non-blocking
warning** when a tier's price is below the sum of that product's per-side print
fees ("at 100+, a front+back order earns ₹180 against ₹198 of printing"). It
changes no pricing behaviour; it just means the merchant sets that number with
their eyes open. Same pattern as the existing low-DPI warning.

---

## 10. Migration mechanics (read before writing any SQL)

This repo self-bootstraps its schema, so **every new table and column has to
land in two places or fresh and existing deployments diverge**:

1. `worker/migrations/schema.sql` — applied by `0000_base_schema`, which is what
   a **brand-new** Cloudflare account gets on first deploy. Then
   `npm run generate:schema` regenerates `worker/src/lib/schemaSql.generated.ts`.
2. A new registry entry in `worker/src/lib/migrate.ts`, next number
   **`0016_v2_options_bulk_templates.sql`** (the registry currently ends at
   `0015_espod_rename.sql`), which patches **existing** databases.

`0000_base_schema` must stay the first entry, and later migrations must be
written so they are no-ops on a database that just got the full schema from it —
`CREATE TABLE IF NOT EXISTS` and guarded `ALTER TABLE ... ADD COLUMN`.

---

## 11. Phased task plan

Ordered so the app stays runnable and verifiable after every phase, and so the
security-critical pricing change is isolated in one of them. Each phase ends
green: `tsc -b` clean, both suites passing (currently 170 frontend + 83 worker).

### Phase 1 — Schema, axis naming, and the one admin form

- [x] **1.1** `schema.sql` + `0016` migration: `product_variants`,
      `product_side_images`, `product_price_breaks`, `template_collections`,
      `design_templates`; new columns `products.axis1_label`,
      `products.axis2_label`, `products.min_order_qty`, `product_sides.label`.
      Regenerate `schemaSql.generated.ts`.
- [x] **1.2** Relax nothing about `product_sides.side` — add the display `label`
      only (§8). Confirm `design_json`, `sides_used`, pricing validation and
      print-file naming still key off `front`/`back`.
- [x] **1.3** Admin product form → four collapsible capability blocks
      (axis 1 · axis 2 · bulk pricing · customization), each behind a checkbox,
      **unticking hides but never deletes rows**.
- [x] **1.4** Axis-name fields; every admin and storefront label reads them.
- [x] **1.5** Category combobox over the existing `GET /api/categories`, free
      text allowed, inline warning when the value matches no existing category.
- [x] **1.6** New-product presets as client-side constants only (§1.2).
- [x] **1.7** Admin CRUD for variants and price breaks. Worker validation:
      opaque non-empty labels, unique per product, `min_qty >= 1`, unique tiers.

### Phase 2 — Axis 2 on the storefront

- [ ] **2.1** Per-option photo upload per side, with the **aspect-ratio guard**
      (§3.2) blocking a mismatch against the side default. This is the print-
      registration trap; it needs a test.
- [ ] **2.2** `GET /api/products/:id` returns variants + their photos, falling
      back to the side default per option.
- [ ] **2.3** Storefront picker with all three degradation states — swatch chips,
      photo thumbnails, plain labelled pills (§3.1, decision #9) — swapping the
      gallery on selection.
- [ ] **2.4** Cart line identity → `product_id:size:variant:design_id`, **plus a
      persisted-store version bump**: existing shoppers hold old-format lines in
      `localStorage`, and a silent key change would corrupt live carts.
- [ ] **2.5** `items_json` carries the variant label; admin order detail and
      account order history display it so the merchant pulls the right blank.
- [ ] **2.6** Confirm the editor is untouched (§4) — a passing test that a
      customizable product with variants still produces an option-free design.

### Phase 3 — Bulk pricing (security-critical)

- [ ] **3.1** Two-pass pricing in `lib/pricing.ts`: keep `computeLine` as
      per-line validation and list-price resolution; add `resolveBulkTiers` to
      group by `(product_id, design_id)`, sum quantity across both axes, pick
      the highest matching tier, and rewrite each line's unit/line total. Tier
      price replaces `base_price + print fees`; axis-1 delta stays additive
      (decision #7).
- [ ] **3.2** `computeOrderQuote` orchestrates the two passes. Verify
      `print_total` stays **informational** — it is reported separately and does
      not feed `total_amount`, so folding fees into a tier must not double-count.
- [ ] **3.3** Server-side `min_order_qty` enforcement in checkout.
- [ ] **3.4** Client cart runs **identical** grouping logic, or the
      `price_mismatch` guard fires on legitimate orders. Shared pure module.
- [ ] **3.5** Product page: quantity chips derived from tiers (100 · 250 · 500),
      the price-break table with the active tier highlighted, live unit price.
- [ ] **3.6** Cart "add N more to save ₹X each" nudge from the same tiers.
- [ ] **3.7** Admin warning when a tier price falls below that product's summed
      per-side print fees (§9.1). Non-blocking.
- [ ] **3.8** Pricing tests: mixed-size grouping hits the right tier, tampered
      client totals still rejected, tier boundaries exact, `min_order_qty`
      enforced, single-item orders unaffected.

### Phase 4 — Design templates

- [x] **4.1** `fitSnapshotToCanvas` in `editor/fabric/` beside
      `rescaleFabricSnapshot` — uniform scale by `min(sx, sy)` + re-centre,
      never stretch. Pure, unit-tested (§6.2).
- [x] **4.2** Admin `Design templates` section: collections CRUD (name,
      category via the same combobox, status, order).
- [x] **4.3** Template authoring by mounting the **existing** `CustomizerEditor`
      in an admin mode — pick category + reference product for a real print
      area, "Save as template" replacing "Add to cart" (§6.4). No second editor.
      `CustomizerEditor`'s `templateMode` contract is ready for this (editor
      half shipped below); the admin mount page itself is admin-owned.
- [x] **4.4** Template preview render: the **art layer alone**, no mockup, since
      a template is product-independent — closer to `renderPrintFile`'s
      transparent export than to `renderSidePreview`. ~400px WebP.
- [x] **4.5** `GET /api/templates?category=` — collections with their templates,
      **aspect-filtered** against the target print area with a tolerance, plus
      `?all=1` for the "show all shapes" toggle (decision #8). *(Worker-owned;
      the editor's `templatesApi.ts` fetch wrapper was built and verified
      against this route's actual response shape.)*
- [x] **4.6** Editor: `Designs` as the first tool-rail entry opening a drawer
      (collections as rows, search over name + tags), and the empty-plane state
      becomes "Start from a design, or start blank" (§6.6).
- [x] **4.7** Applying a template = `loadFromJSON` after `fitSnapshotToCanvas`,
      **replacing** the side's contents as a single undo entry (§6.5).
- [x] **4.8** **GC exclusion.** `gc.ts` reaps `designs` with
      `order_id IS NULL`; templates live in their own table so they are already
      safe, but add a test that pins it, and make sure template art under
      `uploads/` can never be reaped by a future upload GC (§6.1).

### Phase 5 — Substrate-agnostic cleanup and Vistaprint polish

- [ ] **5.1** Rename "garment shading" → **substrate shading** across
      `preview.ts`, `shading.ts` and `POD-UI3.md` references. Maths unchanged.
- [ ] **5.2** Write the **no-warp limitation** into `preview.ts`'s header and
      `project.md`: the compositor multiplies, it does not displace, so art on a
      strongly curved substrate reads as a flat decal (§8).
- [ ] **5.3** Side display labels surface in the editor's side tabs and the
      admin order detail ("Wrap" instead of "Front").
- [ ] **5.4** Editor step indicator (Design → Preview → Cart).
- [ ] **5.5** Update `project.md`, `README.md` doc index, and `POD.md` §13 with a
      pointer row. Record decisions in §12 below.

### Phase 6 — Verification

- [ ] **6.1** Both suites green; `vite build` clean; Fabric still out of the main
      bundle.
- [ ] **6.2** Browser-verified against `wrangler dev` on seeded data, desktop and
      mobile: a card product (bulk tiers + finish pills, no swatches), a bottle
      (nameable axes + relabelled side), a t-shirt (swatches + per-colour photos
      + template applied). Screenshots in the decisions log.
- [ ] **6.3** Print-registration check per `POD.md`'s established methodology:
      a design placed through a **variant** product still exports at the exact
      expected normalized coordinates — proving axis 2 never touched print
      geometry.

---

## 12. Key Decisions Log

| Date | Decision | Why |
|---|---|---|

| 2026-09-08 | **Phase 1 shipped.** 5 tables (`product_variants`, `product_side_images`, `product_price_breaks`, `template_collections`, `design_templates`) + 4 columns (`products.axis1_label` / `axis2_label` / `min_order_qty`, `product_sides.label`), full-replace `PUT /variants` and `PUT /price_breaks`, and one admin product form with four capability blocks | Worker 83 → **108 tests**, frontend 170 → **208 tests**, both `tsc` clean. `lib/pricing.ts` verified untouched — bulk pricing is Phase 3 and money logic does not belong in a schema phase |
| 2026-09-08 | **`0016` uses the existing bookkeeping-mirror, not a new guard mechanism** — `schema.sql` appends `0016_v2_options_bulk_templates.sql` to its own `INSERT OR IGNORE INTO _migrations` list, exactly as `0012`–`0015` do | SQLite has no `ADD COLUMN IF NOT EXISTS` and this codebase has no runtime column-existence guard. Mirroring the migration name into the bookkeeping list makes `0016` a **true no-op** on a fresh install (`0000_base_schema` marks it pre-applied, so its `ALTER TABLE`s never execute) rather than merely idempotent-safe, and it needed no new mechanism. Verified for real: the local D1 still held the pre-0016 schema, so booting the worker exercised the actual `ALTER TABLE`-against-an-existing-database path, which applied cleanly with correct defaults |
| 2026-09-08 | **A capability checkbox is a disclosure control derived from row presence — never a persisted "has colours" flag** | The source of truth for whether a product offers an axis is **whether it has rows**. A stored boolean could disagree with the data it describes ("no colours" beside three colour rows) and then every consumer has to decide which is lying. Consequences, both intended: unticking hides without deleting (data loss must never be a side effect of collapsing a section), and a reload re-ticks a block that still has rows. Phase 2's storefront picker must read the rows, not a flag |
| 2026-09-08 | Capability block headings render **the merchant's own axis name**, not "Axis 1"/"Axis 2" | "Axis" is our vocabulary, not theirs. A card merchant reads "Paper size" and "Finish"; a bottle merchant reads "Volume" — which is the entire point of the axis being nameable. Caught in review of the subagent's output, where the generic term had leaked into the UI |
| 2026-09-08 | Verification data was cleaned up, not left behind | A throwaway `super_admin` was created for the browser pass rather than touching the real `admin@gmail.com` account (whose password we don't hold and shouldn't reset), and the seeded variants/price breaks on product 9 were removed afterwards. Confirmed back to the original 1 customer / 3 products / 0 variants / 0 price breaks — same discipline as `POD.md`'s 2026-09-02 cleanup row |
| 2026-09-08 | Browser-verified against `wrangler dev`: the nullable-swatch case works end to end | Product 9 seeded with `Navy #1B2A4A` and `Matte NULL` returned `swatch_hex: None` through the real API and rendered as an unchecked "Has colour" with a *No colour* placeholder in the editor — the substrate-agnostic case (a finish is a complete option with no colour) proven rather than assumed. The category combobox was verified the same way: suggestions `["T-Shirts","Polo Shirts"]` from the live endpoint, a warning on the near-miss `Visiting Card`, and no warning on the exact `T-Shirts` |
| 2026-09-08 | **Phase 4, editor half, shipped** (4.1, 4.4, 4.6, 4.7 — 4.2/4.3 are admin-owned, 4.5 is worker-owned and was already live in-tree, verified against on sight): `fabric/fitSnapshot.ts` (`fitSnapshotToCanvas`), `templatePreview.ts` (`renderTemplatePreview`), `templatesApi.ts` (`fetchTemplates`), `components/TemplateDrawer.tsx`, plus the `Designs` tool-rail entry, the "Start from a design, or start blank" empty-plane prompt, and the apply-a-template flow, all wired into `CustomizerEditor.tsx`/`EditorStage.tsx`. Frontend 322 → **349 tests**, `tsc -b` clean | Full narrative below |
| 2026-09-08 | **`CustomizerEditor`'s `templateMode` payload hands over the active side's LIVE bleed-rect snapshot, not a `canonicalizeSideSnapshot`-canonicalized one** | Add-to-cart canonicalizes to `computeReferenceGeometry`'s fixed reference size because a shopper's design is tied to one specific product's print area forever. A template has no such fixed home — it gets uniformly re-fit (`fitSnapshotToCanvas`) into whatever product it's later applied to regardless of what size it was authored at, so the live bleed size is an equally valid coordinate space to persist and skips a rescale that would buy nothing. Verified against the worker's actual `POST /api/admin/templates` (already in-tree): it takes `design_json`/`canvas_w`/`canvas_h` as plain fields with no size expectation beyond "positive and internally consistent" |
| 2026-09-08 | **Applying a template brackets `restoreCanvas` with `suspendHistory`/`resumeAndReseedHistory` — the exact same pair EditorStage's own side-swap uses, not a new mechanism** | The task list's own wording ("useEditorObjects already exposes ... for exactly this bracketing") pins this. Flagging the one real tension for whoever reads this next: `resumeAndReseedHistory` re-seeds history at index 0 (mirroring a side-swap, where undo must NOT reach across sides), so immediately after applying a template `canUndo` is `false` — a shopper cannot Cmd+Z the apply back to a blank side on the same side's own history. A true "one Cmd+Z undoes the apply" would need a new non-reseeding resume exposed from `useEditorObjects.ts`, which is outside this task's file ownership (not in "YOU OWN ONLY", not safe to add without a product call) — so this used the literal mechanism named in the spec rather than inventing one |
| 2026-09-08 | Verified `templatesApi.ts`'s contract against the worker's ACTUAL (already in-tree) `GET /api/templates` route and response shaping (`worker/src/lib/templates.ts`) rather than only the doc's prose | Exact match with no changes needed: `?category=&aspect=&all=0\|1`, `{ collections: [{ id, name, templates: [{ id, name, design_json (parsed), canvas_w, canvas_h, preview_url, tags }] }] }`, aspect param omitted when non-finite/non-positive, `{ error }` on failure. Recorded here so nobody re-verifies it |
| 2026-09-08 | **Phase 4, admin half, shipped** (4.2, 4.3): `AdminTemplates.tsx` (collections CRUD — name/category via `CategoryCombobox`/status/sort order — each expanding to a template grid with inline rename/status/delete, gated behind `enabled: expanded` so collapsed collections cost nothing) and `AdminTemplateEdit.tsx` (a three-step authoring flow: pick a reference product → a "Ready to draw" confirm screen naming the product, its print-area shape via a new `describeAspectRatio` helper, and the not-tied-to-this-product explanation → the bare lazy `CustomizerEditor` in `templateMode`). Nav entry + routes wired. Ends at **371 frontend tests / 30 files**, `tsc -b` clean, worker's own 157 tests unaffected (not touched) — 18 of those tests are the 3 new files this task added directly (`adminBundleComposition.test.ts` ×2, `AdminTemplates.test.tsx` ×7, `AdminTemplateEdit.test.tsx` ×9); the rest of the delta from the task brief's stated 321/23 starting point is the editor agent's own concurrently-landed Phase 4 work (see the entries above) plus `noInternalDocRefs.test.ts`'s per-file scan automatically picking up the 2 new page files | `templateMode` had already landed in `CustomizerEditor.tsx` by the time this started (`tsc -b` was clean on the first try, no coordination gap) |
| 2026-09-08 | **`AdminTemplateEdit`'s draw step is a sibling ROUTE of `/admin`, not nested inside `AdminLayout`'s `<Outlet/>`** | `CustomizerEditor`'s root is a hard `h-[100dvh]` — a genuine full-viewport tool, same as the shopper's `/customize/:productId` — which does not compose with `AdminLayout`'s padded, sidebar'd `<main>` (nesting it would either clip the editor or force a double-scrolling page). Consequence: this one route re-implements the two things it would otherwise inherit from `AdminLayout` for free — the admin-auth redirect guard (`useAdminAuthStore` + the same `useEffect` pattern) and a mounted `<ToastContainer/>` (the admin toast bus, `admin/Toast.tsx`, is a module-level singleton — `showToast()` reaches any mounted container regardless of tree position, but AdminLayout's own container unmounts along with AdminLayout the moment this sibling route is active, so without its own copy every toast on this page would silently vanish) |
| 2026-09-08 | **The reference-product picker shows every customizable product, with no category filter** | POD-V2.md §6.4 says "any customizable product" — a reference product only lends a print AREA, it never ties the template to that product's category. Filtering the picker by the collection's own category would be a plausible-looking but wrong constraint (a "Corporate" collection filed under no particular category, or a merchant who deliberately wants a card-shaped template borrowed from a sticker product, would both be blocked for no real reason) |
| 2026-09-08 | **The confirm step, not the picker, is what makes the reference-product choice and its aspect ratio legible** — a dedicated "Ready to draw" screen between picking and drawing, not a persistent header bar layered over the editor | Follows directly from the `h-[100dvh]` full-bleed decision above: nothing can be reliably layered around the editor's own chrome, so the legibility requirement (spec: "make the reference-product choice legible... show the authored aspect ratio") is satisfied at the one moment before Fabric even downloads, where a plain, unhurried page is still possible. `describeAspectRatio` deliberately returns a decimal ratio + orientation word ("Landscape, 1.50:1") rather than a reduced integer fraction (3:2) — reducing an arbitrary float to a "nice" fraction needs a tolerance search that buys nothing for a purely informational label |
| 2026-09-08 | **A real, in-process `vite build()` (`write:false`, `@vitest-environment node`) is the bundle-composition guard, not a source-text heuristic** | The task called this "a hard requirement with a test guarding bundle composition." `noInternalDocRefs.test.ts`'s `import.meta.glob(...'?raw')` pattern was considered and rejected for this specific question: "is Fabric in the main chunk" is exactly what a bundler's own chunking decides, not something a regex over import statements can prove — a chunk's `moduleIds` is ground truth, a source-text scan is not. Running under jsdom (this repo's default test environment) breaks esbuild's own `TextEncoder` invariant check, hence the one file-scoped `@vitest-environment node` override. Confirmed empirically (not just asserted): the entry chunk excludes both `fabric` and `CustomizerEditor.tsx`, and a single shared dynamic-only chunk carries both — even now that TWO call sites (`CustomizePage.tsx` and `AdminTemplateEdit.tsx`) lazy-import `CustomizerEditor`, Rollup still resolves it to one shared chunk, not a duplicate per call site |
| 2026-09-08 | **Cross-checked the client code against the worker's actual (already-landed) route handlers, not just the API-contract summary in the task brief, and fixed two real mismatches found that way** | (1) `POST /api/admin/templates` responds `{ template: {...} }`, not a bare `{ id }` — the id needed for the follow-up preview `PUT` lives one level in (`created.template.id`). (2) The collection/template delete mutations weren't checking `res.ok` before calling `onSuccess` (`fetch` never rejects on a 4xx/5xx) — `AdminProducts.tsx`'s own delete mutation has this identical latent gap and was left alone (out of ownership), but there was no reason to import a known weakness into new code when checking `r.ok` costs three lines. Reading the real handler is strictly stronger evidence than the contract summary alone, and this is why it's worth doing even when a contract is stated explicitly |
| 2026-09-08 | **Left as a known rough edge, not fixed**: `CustomizerEditor`'s header back-button still hardcodes `navigate('/product/${product.id}')` even under `templateMode`, which in the admin authoring flow sends the merchant to the reference product's real, live SHOPPER page instead of back to `/admin/templates`. `frontend/src/editor/CustomizerEditor.tsx` is explicitly out of ownership for this task ("DO NOT EDIT"), so this needs a follow-up from whoever owns that file next — worth flagging rather than routing around from the admin side, which would need patching editor internals this task isn't allowed to touch |
| 2026-09-08 | **Phase 4 shipped and verified end to end in a browser**, brought forward ahead of Phases 2–3 (no dependency on either) | Worker 108 → **157 tests**, frontend 321 → **371**, both `tsc` clean. The full loop was driven with Playwright against `wrangler dev`: create a collection → author a template in the shopper's own editor → save → browse it in the customizer's Designs drawer → apply → undo. Zero console errors at every step. Concretely proven: the template stored at 594×734 with a 1.7 KB art-only preview at `/img/templates/1/preview.webp`, the drawer thumbnail loaded from that same-origin URL, applying painted 10,087 canvas pixels, and Undo returned the canvas to 0 |
| 2026-09-08 | **Template apply gained `resumeHistoryAsOneEntry`; it must NOT use `resumeAndReseedHistory`** | §6.5 asks a template apply to land "as a single undo entry, so it's recoverable", and the single-entry half is easy to satisfy in a way that silently breaks the recoverable half — which is what happened. The only bracket-closing call that existed was written for side swaps and WIPES the undo stack (correct there: the outgoing side's history must not be reachable from the incoming side). Used for a template apply it left `canUndo === false`, making a replace of the shopper's work permanent — one mis-tap on a template card and it is gone. The subagent flagged this rather than inventing a mechanism outside its assigned files, which was right. Three tests now pin the behavioural difference between the two variants, including that a 6-object template still records exactly one entry |
| 2026-09-08 | The template-authoring picker filters on a new `has_print_area`, not just `is_customizable` | `is_customizable = 1` does not mean a product can be drawn on: a side can be flagged customizable while its normalized print rect is still the 0×0 default, which would mount the editor on a zero-sized plane. The picker had no `sides` on its list payload, so it validated on click and showed "That product has no customizable print area" — a card that could only ever fail. `GET /api/admin/products` now reports `has_print_area` per row via an EXISTS subquery (one query, one row per product) and the picker excludes them up front; the click-time check stays as a backstop for a stale list. Caught by clicking the first card during browser verification and hitting the error, then confirmed fixed: 4 products, 3 offered, the unconfigured Visiting card excluded |
| 2026-09-08 | `templateMode` gained `onExit` / `exitLabel`; the editor's back control is not one-size-fits-all | In template mode the shopper default sent the merchant to the reference product's PUBLIC storefront page, labelled with that product's name. Both are wrong: it strands them on the storefront mid-task, and the label asserts exactly what the flow works to disprove — that the template belongs to that product. It now reads "← Design templates" and returns to the admin list. Flagged by the admin subagent, whose ownership excluded the editor file |
| 2026-09-08 | `imgGuard.ts` gained a `templates/` prefix | Template previews are served through the same same-origin `/img/*` proxy as design previews, so without the allowlist entry every thumbnail 404s. Verified the addition did not weaken the guard: `/img/templates/1/preview.webp` returns 200 image/webp while a control request to `/img/secrets/x.webp` still 404s |
| 2026-09-08 | Aspect filtering verified against real data, both directions | The template was authored at 0.81 portrait. Browsing from Grey Tshirt (print area 1.028, near-square) correctly returns `{"collections":[]}` — ratio 1.27 against a 1.2 tolerance — while `all=1` returns it, and browsing from White Tshirt (0.798) returns it unfiltered. So decision 8's "filter, with an escape hatch so nothing is permanently unreachable" is real behaviour, not just intent |
| 2026-09-08 | Verification data cleaned up, with one deliberate exception | The throwaway `super_admin` created for the browser pass was deleted (the real `admin@gmail.com` account was never touched). The sample "Corporate" collection and its "Corporate Bold" template were **left in the local dev database on purpose** so the feature is visible on first look, and both are deletable from the UI this phase added — unlike `POD.md`'s 2026-09-02 cleanup, which removed orders and stock mutations that would have corrupted business data |
