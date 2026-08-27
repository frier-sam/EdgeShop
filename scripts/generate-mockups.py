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


def draw_tee(colorway: Colorway, view: str) -> Image.Image:
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

    print(f"\n{count} mockups written to {out_dir}")


if __name__ == "__main__":
    main()
