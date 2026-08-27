#!/usr/bin/env python3
"""
generate-mockups.py — ESPOD demo catalog product mockups (POD-UI2.md §3/E5)

Replaces the previous placeholder generator, whose Classic Tee rendered as
a malformed black blob with an "arrow spike" (bad sleeve polygon
coordinates) and whose products sat on inconsistent background colours
(some white, some cream) so the shop grid looked accidental.

Two fixes drive this rewrite:

  1. Every image shares exactly one flat, light-neutral ground colour
     (`GROUND`, matching `--color-surface-2` from index.css so a card's
     image blends into its own container). That's the actual root cause
     of "the grid looks unintentional" — not any one bad mockup.

  2. Silhouettes are built from a small set of anchor points run through
     `smooth_polygon()`, which rounds every vertex with a quadratic-Bézier
     arc instead of drawing a raw straight-edged polygon. A raw polygon
     with one mis-placed anchor is exactly how the old script produced a
     spike; rounding every corner and supersampling 3x before a LANCZOS
     downsample means a slightly-off anchor just shows up as a gentle
     curve in the wrong place, never a hard spike.

Usage:
    python3 scripts/generate-mockups.py [--out DIR] [--png]

Produces webp mockups (plus optional .png previews with --png, useful for
eyeballing output — webp isn't universally viewable in every image tool)
for: tee-front, tee-back, hoodie, mug, tote, cap, polo — each in a
handful of garment colourways so the catalogue reads as varied rather
than repetitive. Canvas size is fixed per run (1200x1200, square) so every
product sits on the same footprint at the same margin, matching the
`aspect-square` card treatment in ProductCard.tsx.

Also produces three "how it works" process images (POD-UI2.md §7.2),
replacing the decorative icon circles previously used in HowItWorks.tsx:
process-pick-product (a blank garment), process-add-design (the same
garment carrying a printed emblem in its chest print area), and
process-print-ship (a packed shipping box with a matching folded garment
peeking out). Same GROUND, same CANVAS footprint, same smooth_polygon
rounding — so the section reads as one system with the product grid.

This script only *produces files on disk* — it does not talk to R2 or D1.
Wiring the results into the local dev catalogue (uploading to R2 under
mockups/, updating product_sides.image_url) is a separate, explicit step
documented in DEPLOY.md, because production uploads go through the admin
API (`PUT /api/admin/upload/put`), not this script.
"""

from __future__ import annotations

import argparse
import math
import os
from dataclasses import dataclass

from PIL import Image, ImageDraw, ImageFilter

# ── Canvas ──────────────────────────────────────────────────────────
CANVAS = 1200          # final px, square — matches ProductCard's aspect-square
SS = 3                 # supersample factor; drawn at CANVAS*SS then LANCZOS-downsampled
WORK = CANVAS * SS

# One uniform light-neutral ground for every image — index.css --color-surface-2.
GROUND = (241, 241, 244, 255)

# ── Colourways ──────────────────────────────────────────────────────
@dataclass(frozen=True)
class Colorway:
    base: tuple[int, int, int]
    shadow: tuple[int, int, int]      # for soft directional shading (multiply-ish, low alpha)
    highlight: tuple[int, int, int]
    outline: tuple[int, int, int]     # drawn as an underlying slightly-larger silhouette


COLORWAYS: dict[str, Colorway] = {
    "black":        Colorway(base=(28, 28, 31), shadow=(0, 0, 0), highlight=(80, 80, 88), outline=(10, 10, 12)),
    "white":        Colorway(base=(248, 247, 244), shadow=(205, 203, 197), highlight=(255, 255, 255), outline=(206, 203, 196)),
    "heather-grey": Colorway(base=(163, 163, 171), shadow=(110, 110, 120), highlight=(205, 205, 211), outline=(120, 120, 130)),
    "natural":      Colorway(base=(224, 213, 190), shadow=(188, 175, 148), highlight=(240, 233, 216), outline=(178, 165, 138)),
    "navy":         Colorway(base=(30, 38, 66), shadow=(14, 18, 34), highlight=(70, 82, 120), outline=(12, 15, 28)),
}

DROP_SHADOW = (16, 16, 20, 60)


# ── Geometry helpers ─────────────────────────────────────────────────
Point = tuple[float, float]


def lerp(a: Point, b: Point, t: float) -> Point:
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def smooth_polygon(points: list[Point], radius: float, steps: int = 10) -> list[Point]:
    """Round every vertex of a closed polygon with a quadratic-Bézier arc.

    This is the core fix for the old generator's "arrow spike" bug: a raw
    `ImageDraw.polygon()` connects anchor points with hard straight edges,
    so one slightly-wrong coordinate reads as a visible spike. Replacing
    each vertex with a short Bézier arc (using the vertex itself as the
    control point) turns any such error into a gentle, forgiving curve
    instead, and gives every silhouette soft, consistent corners without
    needing true circular-arc trigonometry.
    """
    n = len(points)
    out: list[Point] = []
    for i in range(n):
        p_prev = points[(i - 1) % n]
        p_curr = points[i]
        p_next = points[(i + 1) % n]

        d_in = math.hypot(p_curr[0] - p_prev[0], p_curr[1] - p_prev[1])
        d_out = math.hypot(p_next[0] - p_curr[0], p_next[1] - p_curr[1])
        r_in = min(radius, d_in / 2)
        r_out = min(radius, d_out / 2)

        start = lerp(p_curr, p_prev, r_in / d_in if d_in else 0)
        end = lerp(p_curr, p_next, r_out / d_out if d_out else 0)

        for s in range(steps + 1):
            t = s / steps
            pt = (
                (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * p_curr[0] + t ** 2 * end[0],
                (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * p_curr[1] + t ** 2 * end[1],
            )
            out.append(pt)
    return out


def scale_from_centroid(points: list[Point], factor: float) -> list[Point]:
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in points]


def mirror_x(points: list[Point], axis: float) -> list[Point]:
    return [(2 * axis - x, y) for x, y in points]


# ── Piece: draws one smoothed silhouette shape onto both the RGB layer
# and a parallel mask layer (for later directional shading), plus an
# outline pass underneath. ────────────────────────────────────────────
class Scene:
    def __init__(self, colorway: Colorway):
        self.canvas = Image.new("RGBA", (WORK, WORK), GROUND)
        self.mask = Image.new("L", (WORK, WORK), 0)
        self.draw = ImageDraw.Draw(self.canvas)
        self.mdraw = ImageDraw.Draw(self.mask)
        self.cw = colorway

    def shadow_ellipse(self, cx: float, cy: float, rx: float, ry: float) -> None:
        layer = Image.new("RGBA", (WORK, WORK), (0, 0, 0, 0))
        ImageDraw.Draw(layer).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=DROP_SHADOW)
        layer = layer.filter(ImageFilter.GaussianBlur(radius=WORK * 0.02))
        self.canvas.alpha_composite(layer)

    def piece(self, anchors: list[Point], radius: float, outline_grow: float = 1.03) -> None:
        outline_pts = smooth_polygon(scale_from_centroid(anchors, outline_grow), radius * outline_grow)
        self.draw.polygon(outline_pts, fill=self.cw.outline)
        fill_pts = smooth_polygon(anchors, radius)
        self.draw.polygon(fill_pts, fill=self.cw.base)
        self.mdraw.polygon(fill_pts, fill=255)

    def hole(self, bbox: list[float]) -> None:
        """Punch a hole through to the ground colour (neckline, handle loop, …)."""
        self.draw.ellipse(bbox, fill=GROUND)
        self.mdraw.ellipse(bbox, fill=0)

    def hole_polygon(self, anchors: list[Point], radius: float) -> None:
        pts = smooth_polygon(anchors, radius)
        self.draw.polygon(pts, fill=GROUND)
        self.mdraw.polygon(pts, fill=0)

    def apply_shading(self) -> None:
        """Soft top-left highlight → bottom-right shadow, clipped to the mask."""
        gradient = Image.new("L", (1, WORK), color=0)
        for y in range(WORK):
            gradient.putpixel((0, y), int(255 * (y / WORK)))
        gradient = gradient.resize((WORK, WORK))
        shade = Image.new("RGBA", (WORK, WORK), self.cw.shadow + (0,))
        shade.putalpha(gradient.point(lambda v: int(v * 0.38)))
        clipped_shadow_mask = Image.eval(self.mask, lambda v: v)
        shade.putalpha(Image.composite(shade.getchannel("A"), Image.new("L", (WORK, WORK), 0), clipped_shadow_mask))
        self.canvas.alpha_composite(shade)

        highlight_gradient = gradient.transpose(Image.FLIP_TOP_BOTTOM).transpose(Image.FLIP_LEFT_RIGHT)
        glow = Image.new("RGBA", (WORK, WORK), self.cw.highlight + (0,))
        glow.putalpha(highlight_gradient.point(lambda v: int(v * 0.22)))
        glow.putalpha(Image.composite(glow.getchannel("A"), Image.new("L", (WORK, WORK), 0), clipped_shadow_mask))
        self.canvas.alpha_composite(glow)

    def finish(self) -> Image.Image:
        return self.canvas.resize((CANVAS, CANVAS), Image.LANCZOS)


# ── Product silhouettes ───────────────────────────────────────────────
# All proportions are fractions of WORK, symmetric around cx = WORK/2, so
# every product sits centred with an equal margin regardless of shape.
CX = WORK / 2
CY = WORK / 2
MARGIN = WORK * 0.10


def _torso_anchors(waist_taper: float, hem_y: float, shoulder_y: float, shoulder_hw: float, neck_hw: float) -> list[Point]:
    waist_hw = shoulder_hw * waist_taper
    return [
        (CX - neck_hw, shoulder_y - WORK * 0.01),
        (CX - shoulder_hw, shoulder_y),
        (CX - waist_hw, hem_y),
        (CX + waist_hw, hem_y),
        (CX + shoulder_hw, shoulder_y),
        (CX + neck_hw, shoulder_y - WORK * 0.01),
    ]


def _sleeve_anchors(side: int, shoulder_y: float, shoulder_hw: float, length: float, drop: float) -> list[Point]:
    x0 = CX + side * shoulder_hw * 0.82
    pts = [
        (x0, shoulder_y + WORK * 0.01),
        (CX + side * (shoulder_hw + length), shoulder_y + WORK * 0.03),
        (CX + side * (shoulder_hw + length * 0.82), shoulder_y + drop),
        (CX + side * shoulder_hw * 0.55, shoulder_y + drop * 0.78),
    ]
    return pts


def _draw_print_patch(scene: "Scene", shoulder_y: float) -> None:
    """Draw a small two-colour printed emblem onto the chest print area.

    Used by the "Add your design" process image (POD-UI2.md §7.2) — the
    same tee silhouette as the "Pick a product" step, but now carrying a
    visible print, so the step reads as customisation rather than just a
    different product. The emblem itself (a circle + a rounded triangle,
    both in flat white on an indigo patch matching index.css
    `--color-accent`) is deliberately simple: it only needs to read as "a
    design", not be a specific brand mark. Drawn last, on top of the
    already-shaded garment, since a print sits flat on fabric rather than
    picking up the garment's own directional shading.
    """
    accent = (79, 70, 229)  # index.css --color-accent #4F46E5
    patch_w, patch_h = WORK * 0.15, WORK * 0.17
    cx = CX
    cy = shoulder_y + WORK * 0.135

    patch_anchors = [
        (cx - patch_w / 2, cy - patch_h / 2),
        (cx + patch_w / 2, cy - patch_h / 2),
        (cx + patch_w / 2, cy + patch_h / 2),
        (cx - patch_w / 2, cy + patch_h / 2),
    ]
    patch_pts = smooth_polygon(patch_anchors, WORK * 0.018)

    # Soft seating shadow so the patch reads as printed onto the fabric
    # rather than pasted on top of it.
    shadow_layer = Image.new("RGBA", (WORK, WORK), (0, 0, 0, 0))
    ImageDraw.Draw(shadow_layer).polygon(
        [(x + WORK * 0.006, y + WORK * 0.008) for x, y in patch_pts], fill=(16, 16, 20, 50)
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=WORK * 0.008))
    scene.canvas.alpha_composite(shadow_layer)

    scene.draw.polygon(patch_pts, fill=accent)

    # Emblem: a small circle ("sun") above a rounded triangle ("mountain").
    sun_r = WORK * 0.02
    sun_cx, sun_cy = cx, cy - patch_h * 0.18
    scene.draw.ellipse([sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r], fill=(255, 255, 255))

    tri_anchors = [
        (cx - patch_w * 0.28, cy + patch_h * 0.22),
        (cx, cy - patch_h * 0.06),
        (cx + patch_w * 0.28, cy + patch_h * 0.22),
    ]
    scene.draw.polygon(smooth_polygon(tri_anchors, WORK * 0.012), fill=(255, 255, 255))


def draw_tee(colorway: Colorway, view: str, print_design: bool = False) -> Image.Image:
    scene = Scene(colorway)
    shoulder_y = CY - WORK * 0.22
    hem_y = CY + WORK * 0.28
    shoulder_hw = WORK * 0.185
    neck_hw = WORK * 0.075
    radius = WORK * 0.028

    scene.shadow_ellipse(CX, hem_y + WORK * 0.02, shoulder_hw * 1.05, WORK * 0.03)

    for side in (-1, 1):
        scene.piece(_sleeve_anchors(side, shoulder_y, shoulder_hw, WORK * 0.135, WORK * 0.18), radius * 0.85)

    scene.piece(_torso_anchors(0.82, hem_y, shoulder_y, shoulder_hw, neck_hw), radius)

    if view == "front":
        neck_w, neck_h = WORK * 0.085, WORK * 0.045
        scene.hole([CX - neck_w, shoulder_y - WORK * 0.045, CX + neck_w, shoulder_y - WORK * 0.045 + neck_h * 2])
    else:
        # Back view: slightly shallower, wider neckline; a faint centre
        # seam suggested by a thin darker line instead of any collar detail.
        neck_w, neck_h = WORK * 0.10, WORK * 0.028
        scene.hole([CX - neck_w, shoulder_y - WORK * 0.04, CX + neck_w, shoulder_y - WORK * 0.04 + neck_h * 2])

    scene.apply_shading()

    if view == "back":
        seam = ImageDraw.Draw(scene.canvas)
        seam.line([(CX, shoulder_y + WORK * 0.02), (CX, hem_y - WORK * 0.03)], fill=colorway.shadow + (70,), width=max(1, int(WORK * 0.003)))

    if print_design:
        _draw_print_patch(scene, shoulder_y)

    return scene.finish()


def draw_polo(colorway: Colorway) -> Image.Image:
    scene = Scene(colorway)
    shoulder_y = CY - WORK * 0.22
    hem_y = CY + WORK * 0.26
    shoulder_hw = WORK * 0.185
    neck_hw = WORK * 0.075
    radius = WORK * 0.028

    scene.shadow_ellipse(CX, hem_y + WORK * 0.02, shoulder_hw * 1.05, WORK * 0.03)

    for side in (-1, 1):
        scene.piece(_sleeve_anchors(side, shoulder_y, shoulder_hw, WORK * 0.1, WORK * 0.11), radius * 0.7)

    scene.piece(_torso_anchors(0.84, hem_y, shoulder_y, shoulder_hw, neck_hw), radius)

    # Collar: two small mirrored quadrilaterals — straight-sided by design
    # (a real collar point is straight-edged), so no rounding needed here.
    collar_w, collar_h = WORK * 0.06, WORK * 0.05
    top = shoulder_y - WORK * 0.018
    for side in (-1, 1):
        pts = [
            (CX + side * WORK * 0.01, top),
            (CX + side * (WORK * 0.01 + collar_w), top + collar_h * 0.35),
            (CX + side * (WORK * 0.01 + collar_w * 0.55), top + collar_h),
            (CX + side * WORK * 0.005, top + collar_h * 0.5),
        ]
        scene.draw.polygon(pts, fill=colorway.shadow)
        scene.mdraw.polygon(pts, fill=255)

    # Placket + buttons.
    placket_w = WORK * 0.018
    scene.draw.rectangle([CX - placket_w / 2, top + collar_h * 0.4, CX + placket_w / 2, top + collar_h * 2.6], fill=colorway.shadow)
    for i in range(2):
        by = top + collar_h * (1.1 + i * 0.75)
        r = WORK * 0.008
        scene.draw.ellipse([CX - r, by - r, CX + r, by + r], fill=colorway.outline)

    scene.apply_shading()
    return scene.finish()


def draw_hoodie(colorway: Colorway) -> Image.Image:
    scene = Scene(colorway)
    shoulder_y = CY - WORK * 0.20
    hem_y = CY + WORK * 0.30
    shoulder_hw = WORK * 0.205
    neck_hw = WORK * 0.09
    radius = WORK * 0.032

    scene.shadow_ellipse(CX, hem_y + WORK * 0.02, shoulder_hw * 1.05, WORK * 0.03)

    for side in (-1, 1):
        scene.piece(_sleeve_anchors(side, shoulder_y, shoulder_hw, WORK * 0.15, WORK * 0.22), radius * 0.85)

    # Hood — a wide rounded shape sitting behind the shoulders.
    hood_anchors = [
        (CX - shoulder_hw * 0.9, shoulder_y + WORK * 0.02),
        (CX - neck_hw * 1.6, shoulder_y - WORK * 0.13),
        (CX, shoulder_y - WORK * 0.165),
        (CX + neck_hw * 1.6, shoulder_y - WORK * 0.13),
        (CX + shoulder_hw * 0.9, shoulder_y + WORK * 0.02),
    ]
    scene.piece(hood_anchors, radius * 1.1)

    scene.piece(_torso_anchors(0.86, hem_y, shoulder_y, shoulder_hw, neck_hw), radius)

    # Kangaroo pocket.
    pocket_y = hem_y - WORK * 0.14
    pocket_anchors = [
        (CX - shoulder_hw * 0.62, pocket_y),
        (CX - shoulder_hw * 0.5, pocket_y - WORK * 0.06),
        (CX + shoulder_hw * 0.5, pocket_y - WORK * 0.06),
        (CX + shoulder_hw * 0.62, pocket_y),
    ]
    scene.hole_polygon(pocket_anchors, radius * 0.6)
    pocket_outline = smooth_polygon(pocket_anchors, radius * 0.6)
    scene.draw.line(pocket_outline + [pocket_outline[0]], fill=colorway.outline, width=max(1, int(WORK * 0.0025)))

    # Drawstrings.
    for side in (-1, 1):
        sx = CX + side * neck_hw * 0.7
        scene.draw.line([(sx, shoulder_y - WORK * 0.02), (sx + side * WORK * 0.012, shoulder_y + WORK * 0.06)], fill=colorway.shadow, width=max(2, int(WORK * 0.006)))

    scene.apply_shading()
    return scene.finish()


def _ring(scene: Scene, cx: float, cy: float, outer_r: float, inner_r: float, keep_side: str) -> None:
    """Draw a filled ring (annulus) and keep only one half — used for mug/tote handles.

    `keep_side` is 'left' / 'right' (mug handle: protrudes sideways, cut by
    a vertical line through the centre) or 'top' / 'bottom' (tote handle:
    a loop that protrudes up out of the bag, cut by a *horizontal* line —
    call with `cy` equal to the attachment seam so the two cut leg-ends
    land exactly on it instead of floating above a gap).
    """
    layer = Image.new("RGBA", (WORK, WORK), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], fill=scene.cw.base)
    ld.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(0, 0, 0, 0))
    mlayer = Image.new("L", (WORK, WORK), 0)
    mld = ImageDraw.Draw(mlayer)
    mld.ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], fill=255)
    mld.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=0)

    half_boxes = {
        "right": [cx, cy - outer_r, cx + outer_r, cy + outer_r],
        "left": [cx - outer_r, cy - outer_r, cx, cy + outer_r],
        "top": [cx - outer_r, cy - outer_r, cx + outer_r, cy],
        "bottom": [cx - outer_r, cy, cx + outer_r, cy + outer_r],
    }
    keep_mask = Image.new("L", (WORK, WORK), 0)
    ImageDraw.Draw(keep_mask).rectangle(half_boxes[keep_side], fill=255)

    outline_layer = Image.new("RGBA", (WORK, WORK), (0, 0, 0, 0))
    ImageDraw.Draw(outline_layer).ellipse(
        [cx - outer_r - WORK * 0.004, cy - outer_r - WORK * 0.004, cx + outer_r + WORK * 0.004, cy + outer_r + WORK * 0.004],
        fill=scene.cw.outline,
    )
    ImageDraw.Draw(outline_layer).ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=(0, 0, 0, 0))
    combined_mask = Image.composite(mlayer, Image.new("L", (WORK, WORK), 0), keep_mask)
    scene.canvas.paste(outline_layer, (0, 0), Image.composite(Image.new("L", (WORK, WORK), 255), Image.new("L", (WORK, WORK), 0), combined_mask))
    scene.canvas.paste(layer, (0, 0), combined_mask)
    scene.mask.paste(255, (0, 0), combined_mask)


def draw_mug(colorway: Colorway) -> Image.Image:
    scene = Scene(colorway)
    body_hw = WORK * 0.16
    top_y = CY - WORK * 0.19
    bottom_y = CY + WORK * 0.20
    rim_ry = WORK * 0.028

    scene.shadow_ellipse(CX, bottom_y + WORK * 0.015, body_hw * 1.15, WORK * 0.03)

    body_anchors = [
        (CX - body_hw, top_y),
        (CX - body_hw * 0.94, bottom_y),
        (CX + body_hw * 0.94, bottom_y),
        (CX + body_hw, top_y),
    ]
    scene.piece(body_anchors, WORK * 0.02)
    # Rim + base ellipses read as the cylinder's top/bottom curvature.
    scene.draw.ellipse([CX - body_hw, top_y - rim_ry, CX + body_hw, top_y + rim_ry], fill=colorway.base, outline=colorway.outline, width=max(1, int(WORK * 0.003)))
    scene.mdraw.ellipse([CX - body_hw, top_y - rim_ry, CX + body_hw, top_y + rim_ry], fill=255)
    inner_rim = WORK * 0.018
    scene.draw.ellipse([CX - body_hw * 0.85, top_y - inner_rim, CX + body_hw * 0.85, top_y + inner_rim], fill=colorway.shadow)

    handle_r_out = WORK * 0.1
    handle_r_in = WORK * 0.058
    _ring(scene, CX + body_hw * 0.86, CY - WORK * 0.02, handle_r_out, handle_r_in, keep_side="right")

    scene.apply_shading()
    return scene.finish()


def draw_tote(colorway: Colorway) -> Image.Image:
    scene = Scene(colorway)
    top_y = CY - WORK * 0.14
    bottom_y = CY + WORK * 0.28
    top_hw = WORK * 0.15
    bottom_hw = WORK * 0.205
    radius = WORK * 0.022

    scene.shadow_ellipse(CX, bottom_y + WORK * 0.02, bottom_hw * 1.05, WORK * 0.03)

    body_anchors = [
        (CX - top_hw, top_y),
        (CX - bottom_hw, bottom_y),
        (CX + bottom_hw, bottom_y),
        (CX + top_hw, top_y),
    ]
    scene.piece(body_anchors, radius)

    # Handle loops: `cy=top_y` puts the ring's own centre — and so the
    # horizontal cut line kept by `keep_side="top"` — exactly on the bag's
    # top seam, so the two straight leg-ends of each loop land right on
    # the fabric instead of floating above a gap.
    handle_r_out = WORK * 0.065
    handle_r_in = WORK * 0.044
    for side in (-1, 1):
        hx = CX + side * top_hw * 0.42
        _ring(scene, hx, top_y, handle_r_out, handle_r_in, keep_side="top")

    scene.apply_shading()
    return scene.finish()


def draw_cap(colorway: Colorway) -> Image.Image:
    scene = Scene(colorway)
    crown_r = WORK * 0.185
    crown_cy = CY - WORK * 0.02

    scene.shadow_ellipse(CX, crown_cy + crown_r * 0.55, crown_r * 1.5, WORK * 0.025)

    # Crown: top half of a circle, smoothed via a coarse polygon approximation.
    crown_anchors = [(CX + crown_r * math.cos(a), crown_cy + crown_r * math.sin(a)) for a in [math.radians(d) for d in range(180, 361, 20)]]
    scene.piece(crown_anchors, WORK * 0.03)

    # Button on top.
    br = WORK * 0.012
    scene.draw.ellipse([CX - br, crown_cy - crown_r - br * 0.4, CX + br, crown_cy - crown_r + br * 1.6], fill=colorway.shadow)

    # Two short, subtle panel seams near the crown's own edge (not
    # reaching anywhere near the brim — full-length lines down to a
    # separate shape below read as a face/dart rather than fabric panels).
    for side in (-1, 1):
        scene.draw.line(
            [(CX + side * crown_r * 0.32, crown_cy - crown_r * 0.92), (CX + side * crown_r * 0.55, crown_cy - crown_r * 0.35)],
            fill=colorway.shadow + (70,),
            width=max(1, int(WORK * 0.003)),
        )

    # Brim — a shallow, symmetric front-view visor sitting flush against
    # the crown's flat bottom edge (`crown_cy`), overlapping it slightly
    # so there's no gap between the two pieces.
    brim_cy = crown_cy + WORK * 0.006
    brim_anchors = [
        (CX - crown_r * 1.04, crown_cy - WORK * 0.01),
        (CX - crown_r * 0.4, brim_cy + WORK * 0.062),
        (CX + crown_r * 0.4, brim_cy + WORK * 0.062),
        (CX + crown_r * 1.04, crown_cy - WORK * 0.01),
    ]
    scene.piece(brim_anchors, WORK * 0.022)

    scene.apply_shading()
    return scene.finish()


def draw_process_ship(colorway: Colorway) -> Image.Image:
    """"We print & ship" process image (POD-UI2.md §7.2): a packed shipping
    box with a folded garment peeking out of the open top and a shipping
    label on the front. Reuses `Scene`/`smooth_polygon` for every silhouette
    (box body, flap band, folded-garment layers, label) so its corners are
    softened the same way as every garment piece in this file — the one
    exception being the box's straight edges themselves, which are
    correctly straight (a shipping carton is not meant to look rounded like
    a soap bar); only the polygon *corners* get the shared rounding.
    `colorway` is the same one used for the "pick"/"design" steps so the
    folded garment inside the box visually continues the same story.
    """
    scene = Scene(colorway)

    box_hw = WORK * 0.19
    box_top = CY - WORK * 0.04
    box_bottom = CY + WORK * 0.30
    flap_h = WORK * 0.055

    cardboard = (196, 162, 116)
    cardboard_flap = (172, 141, 98)
    tape = (232, 219, 196)

    scene.shadow_ellipse(CX, box_bottom + WORK * 0.02, box_hw * 1.1, WORK * 0.03)

    # Folded garment, drawn first so the box's front face overlaps its
    # lower portion — it reads as tucked just inside the open top, peeking
    # out above the box, rather than floating in front of it. Each layer
    # gets a small horizontal jitter and a generous corner radius (larger
    # than the box's own WORK*0.01) so the stack reads as soft folded
    # fabric rather than a rigid lid — a first pass with perfectly
    # aligned, barely-rounded layers read as a flat grey slab sitting on
    # the box rather than a garment, so this exists specifically to avoid
    # that misread.
    fold_w, fold_h = WORK * 0.23, WORK * 0.05
    fold_cx = CX - box_hw * 0.18
    fold_radius = WORK * 0.024
    layers = 3
    jitters = [0.0, WORK * 0.016, -WORK * 0.011]
    top_fold_y = box_top - WORK * 0.02 - (layers - 1) * fold_h * 0.58
    top_pts: list[Point] = []
    for i in range(layers):
        fy = box_top - WORK * 0.02 - i * fold_h * 0.58
        dx = jitters[i]
        anchors = [
            (fold_cx + dx - fold_w / 2, fy),
            (fold_cx + dx + fold_w / 2, fy),
            (fold_cx + dx + fold_w / 2, fy + fold_h),
            (fold_cx + dx - fold_w / 2, fy + fold_h),
        ]
        pts = smooth_polygon(anchors, fold_radius)
        shade = 1 - i * 0.16
        col = tuple(min(255, int(c * shade)) for c in colorway.base)
        scene.draw.polygon(pts, fill=col)
        if i == layers - 1:
            top_pts = pts
            # A couple of fold-crease lines across the topmost layer's
            # own surface, so it reads as fabric rather than a flat card.
            crease_col = tuple(max(0, int(c * 0.82)) for c in col)
            for cy_frac in (0.38, 0.68):
                cy = fy + fold_h * cy_frac
                scene.draw.line(
                    [(fold_cx + dx - fold_w * 0.42, cy), (fold_cx + dx + fold_w * 0.42, cy)],
                    fill=crease_col,
                    width=max(1, int(WORK * 0.0025)),
                )
    scene.draw.line(top_pts + [top_pts[0]], fill=colorway.outline, width=max(1, int(WORK * 0.0025)))

    # Box body (front face) — a plain rectangle is the correct shape for a
    # box; only the corners get the shared smooth_polygon rounding.
    box_anchors = [
        (CX - box_hw, box_top),
        (CX + box_hw, box_top),
        (CX + box_hw, box_bottom),
        (CX - box_hw, box_bottom),
    ]
    scene.draw.polygon(smooth_polygon(box_anchors, WORK * 0.01), fill=cardboard)

    # Flap seam band along the top edge (the folded-over top flaps, seen
    # face-on) and the packing-tape cross.
    flap_anchors = [
        (CX - box_hw, box_top),
        (CX + box_hw, box_top),
        (CX + box_hw, box_top + flap_h),
        (CX - box_hw, box_top + flap_h),
    ]
    scene.draw.polygon(smooth_polygon(flap_anchors, WORK * 0.008), fill=cardboard_flap)

    tape_w = WORK * 0.022
    scene.draw.rectangle([CX - tape_w / 2, box_top, CX + tape_w / 2, box_bottom], fill=tape)
    scene.draw.rectangle(
        [CX - box_hw, box_top + flap_h * 0.3, CX + box_hw, box_top + flap_h * 0.3 + tape_w], fill=tape
    )

    # Shipping label with a few text-line bars and a tiny barcode block.
    label_w, label_h = WORK * 0.16, WORK * 0.11
    label_cx = CX + box_hw * 0.42
    label_cy = box_top + flap_h + WORK * 0.09
    label_anchors = [
        (label_cx - label_w / 2, label_cy - label_h / 2),
        (label_cx + label_w / 2, label_cy - label_h / 2),
        (label_cx + label_w / 2, label_cy + label_h / 2),
        (label_cx - label_w / 2, label_cy + label_h / 2),
    ]
    scene.draw.polygon(smooth_polygon(label_anchors, WORK * 0.01), fill=(250, 250, 250))
    for i in range(3):
        ly = label_cy - label_h * 0.28 + i * label_h * 0.22
        scene.draw.rectangle(
            [label_cx - label_w * 0.34, ly, label_cx + label_w * (0.1 if i == 2 else 0.34), ly + WORK * 0.006],
            fill=(160, 160, 168),
        )
    bx = label_cx - label_w * 0.34
    by = label_cy + label_h * 0.14
    for i in range(6):
        bar_w = WORK * 0.004 if i % 2 == 0 else WORK * 0.007
        scene.draw.rectangle([bx, by, bx + bar_w, by + WORK * 0.03], fill=(70, 70, 78))
        bx += bar_w + WORK * 0.003

    return scene.finish()


# ── "How it works" process images (POD-UI2.md §7.2) ─────────────────
# Three images sharing one garment colourway across steps 1 and 2 so the
# three read as one continuous story: the same blank product, then that
# product carrying a design, then a packed box with a matching folded
# garment peeking out. All three sit on the identical GROUND / CANVAS
# footprint as the product mockups above, so the "How it works" section
# reads as part of the same visual system.
PROCESS_COLORWAY = COLORWAYS["heather-grey"]

PROCESS_IMAGES: dict[str, callable] = {
    "process-pick-product": lambda: draw_tee(PROCESS_COLORWAY, "front"),
    "process-add-design": lambda: draw_tee(PROCESS_COLORWAY, "front", print_design=True),
    "process-print-ship": lambda: draw_process_ship(PROCESS_COLORWAY),
}


PRODUCTS: dict[str, tuple[callable, list[str]]] = {
    "tee-front": (lambda cw: draw_tee(cw, "front"), ["black", "white", "heather-grey"]),
    "tee-back": (lambda cw: draw_tee(cw, "back"), ["black", "white", "heather-grey"]),
    "hoodie": (draw_hoodie, ["black", "white", "heather-grey"]),
    "polo": (draw_polo, ["black", "white", "heather-grey"]),
    "mug": (draw_mug, ["white", "black"]),
    "tote": (draw_tote, ["natural", "black", "heather-grey"]),
    "cap": (draw_cap, ["black", "white", "heather-grey"]),
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "scratch", "mockups"), help="Output directory")
    parser.add_argument("--png", action="store_true", help="Also save a .png copy of each image (webp isn't viewable in every tool)")
    args = parser.parse_args()

    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    count = 0
    for name, (fn, colors) in PRODUCTS.items():
        for color in colors:
            cw = COLORWAYS[color]
            img = fn(cw)
            stem = f"{name}-{color}"
            webp_path = os.path.join(out_dir, f"{stem}.webp")
            img.convert("RGB").save(webp_path, "WEBP", quality=90, method=6)
            if args.png:
                img.convert("RGB").save(os.path.join(out_dir, f"{stem}.png"), "PNG")
            count += 1
            print(f"  wrote {stem}.webp")

    for stem, fn in PROCESS_IMAGES.items():
        img = fn()
        webp_path = os.path.join(out_dir, f"{stem}.webp")
        img.convert("RGB").save(webp_path, "WEBP", quality=90, method=6)
        if args.png:
            img.convert("RGB").save(os.path.join(out_dir, f"{stem}.png"), "PNG")
        count += 1
        print(f"  wrote {stem}.webp")

    print(f"\n{count} mockups written to {out_dir}")


if __name__ == "__main__":
    main()
