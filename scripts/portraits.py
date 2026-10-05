#!/usr/bin/env python3
"""Cut portraits (head and shoulders) from the front views of the character concept sheets, plus building icons
without an atlas cell from the concept images.

  python3 scripts/portraits.py            # all from PORTRAITS → public/portraits/<name>.webp

Source: assets-src/characters/<figure>/view-1.png (1024 px, plain background). The background
becomes cream, magenta (placeholder for the team colour) gets the given hue.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
# Output name → (figure, hue for magenta in degrees[, saturation, brightness])
# Heroes in muted, neutral tones (no player colour – a hero can belong to any side)
PORTRAITS = {
    'hero-nelia': ('nelia', 95, 0.35, 0.8), 'hero-orrin': ('orrin', 28, 0.45, 0.8), 'hero-taran': ('taran', 210, 0.12, 0.75),
    'hero-malvor': ('malvor', 260, 0.1, 0.45),
    # Speakers in missions (src/sim/missions/speakers.js)
    'sp-elder': ('worker_scholar_f', 25, 0.45, 0.85), 'sp-villager': ('serf_f', 40, 0.5, 0.9),
    'sp-collector': ('worker_treasurer', 5, 0.5, 0.65), 'sp-merchant': ('worker_trader', 28, 0.5, 0.8),
    'sp-bandit': ('bandit', 5, 0.45, 0.55), 'sp-miner': ('worker_miner', 30, 0.6, 0.85),
    'sp-scholar': ('worker_scholar_f', 205, 0.25, 0.7), 'sp-prisoner': ('serf_m', 30, 0.4, 0.75),
}
CREAM = np.array([241, 236, 228]) / 255


def background_mask(a):
    """Connected background from the corners (colour of the top-left corner)."""
    bg = np.abs(a - a[5, 5]).sum(-1) < 0.10
    m = Image.fromarray((bg * 255).astype('uint8')).convert('RGB')
    w, h = m.size
    for pt in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        if m.getpixel(pt) == (255, 255, 255):
            ImageDraw.floodfill(m, pt, (128, 0, 0))
    return np.array(m)[..., 0] == 128


def recolor_magenta(a, hue, sat=1.0, val=1.0):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    mag = (np.abs(h - 305) < 34) & (d > 0.12)
    v = mx * val
    c = d / (mx + 1e-6) * sat * v
    x = c * (1 - abs((hue / 60) % 2 - 1))
    m = v - c
    z = 0 * c
    comb = [(c, x, z), (x, c, z), (z, c, x), (z, x, c), (x, z, c), (c, z, x)][int(hue // 60) % 6]
    out = a.copy()
    for k in range(3):
        out[..., k] = np.where(mag, comb[k] + m, a[..., k])
    return out


def portrait(figure, hue, sat=1.0, val=1.0, size=256):
    a = np.array(Image.open(ROOT / 'assets-src/characters' / figure / 'view-1.png').convert('RGB')).astype(float) / 255
    bgm = background_mask(a)
    fg = ~bgm
    ys, _ = np.where(fg)
    top, bot = ys.min(), ys.max()
    height = bot - top
    band = fg[top:top + int(height * 0.2)]
    bx = np.where(band.any(0))[0]
    cx = (bx.min() + bx.max()) // 2
    o = recolor_magenta(a, hue, sat, val)
    soft = np.array(Image.fromarray((bgm * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))).astype(float)[..., None] / 255
    o = o * (1 - soft) + CREAM * soft
    img = Image.fromarray((o.clip(0, 1) * 255).astype('uint8'))
    side = int(height * 0.40)
    x0, y0 = max(0, cx - side // 2), max(0, top - int(side * 0.04))
    return img.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.LANCZOS)


# Building icons without an atlas cell: cut-out concept image (assets-src/buildings/<id>/concept.png) → public/icons/
BUILDING_ICONS = {'b-fountain': 'fountain', 'b-statue': 'statue', 'b-bridge': 'bridge'}


def building_icon(folder, size=128):
    """Cut out the concept image (background transparent from the corners), crop to the content, square."""
    im = Image.open(ROOT / 'assets-src/buildings' / folder / 'concept.png').convert('RGB')
    a = np.array(im).astype(float) / 255
    bgm = background_mask(a)
    alpha = Image.fromarray(((~bgm) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.2))
    rgba = im.copy()
    rgba.putalpha(alpha)
    box = Image.fromarray(((~bgm) * 255).astype('uint8')).getbbox()
    rgba = rgba.crop(box)
    side = int(max(rgba.size) * 1.04)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.alpha_composite(rgba, ((side - rgba.width) // 2, (side - rgba.height) // 2))
    # Pennant (magenta) in gold ochre like the other icons without a player colour
    arr = np.array(sq).astype(float) / 255
    arr[..., :3] = recolor_magenta(arr[..., :3], 40)
    return Image.fromarray((arr * 255).astype('uint8'), 'RGBA').resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    out = ROOT / 'public/portraits'
    for name, (figure, *tone) in PORTRAITS.items():
        portrait(figure, *tone).save(out / f'{name}.webp', quality=88)
        print(out / f'{name}.webp')
    for name, folder in BUILDING_ICONS.items():
        building_icon(folder).save(ROOT / 'public/icons' / f'{name}.webp', quality=90)
        print(ROOT / 'public/icons' / f'{name}.webp')
