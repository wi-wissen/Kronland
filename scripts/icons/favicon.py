#!/usr/bin/env python3
"""Create favicon and app icons from the painted crown of the icon sheet (docs/SYMBOLE.md).

Usage: python3 scripts/icons/favicon.py [--preview file.png]
Source: assets-src/icons/sheet.webp (cell "crown" per layout.json, ~208 px – larger than in the atlas).
Output in public/:
  favicon.ico           16/32/48 px, cut out (browser tab)
  apple-touch-icon.png  180 px on dark background (iOS fills transparency with black)
  icon-192.png          192 px on dark background (manifest, Android)
  icon-512.png          512 px on dark background, crown within the safe zone for "maskable"
"""
import json
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets-src' / 'icons'
OUT = ROOT / 'public'
BG = (26, 34, 30, 255)  # #1a221e, like background_color in the manifest


def cut_crown():
    layout = json.loads((SRC / 'layout.json').read_text())
    sheet = Image.open(SRC / 'sheet.webp').convert('RGB')
    i = layout['names'].index('crown')
    cw, ch = sheet.width / layout['cols'], sheet.height / layout['rows']
    c, r = i % layout['cols'], i // layout['cols']
    cell = sheet.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
    w, h = cell.size
    px = cell.load()

    # Flood white and light-grey ground shadow from the edge (like scripts/icons/slice.mjs)
    def bg_like(p):
        mn, mx = min(p), max(p)
        return mn > 185 and mx - mn < 20

    bg = [[False] * w for _ in range(h)]
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or bg[y][x] or not bg_like(px[x, y]):
            continue
        bg[y][x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    mask = Image.new('L', (w, h))
    mask.putdata([0 if bg[y][x] else 255 for y in range(h) for x in range(w)])
    # 2 px fringe: recompute colour over white so that no light edges remain
    inner = mask.filter(ImageFilter.MinFilter(5))
    out = Image.new('RGBA', (w, h))
    o = out.load()
    m, n = mask.load(), inner.load()
    for y in range(h):
        for x in range(w):
            if not m[x, y]:
                continue
            p = px[x, y]
            if n[x, y]:
                o[x, y] = (*p, 255)
                continue
            a = max(0.0, min(1.0, (255 - min(p)) / 90))
            if a <= 0:
                continue
            o[x, y] = tuple(max(0, min(255, round((v - (1 - a) * 255) / a))) for v in p) + (round(a * 255),)
    return out.crop(out.getbbox())


def fit(crown, size, share, bg=None):
    """Crown centred in a square; `share` = fraction of the longer side relative to the square."""
    s = share * size / max(crown.size)
    img = crown.resize((max(1, round(crown.width * s)), max(1, round(crown.height * s))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    return canvas


def main():
    crown = cut_crown()
    # Tab: as large as possible, no background
    ico = [fit(crown, s, 0.96) for s in (16, 32, 48)]
    ico[-1].save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:-1])
    # App icons: dark background; 512 is also "maskable" – crown within a circle of 80 % diameter
    fit(crown, 180, 0.74, BG).save(OUT / 'apple-touch-icon.png', optimize=True)
    fit(crown, 192, 0.74, BG).save(OUT / 'icon-192.png', optimize=True)
    fit(crown, 512, 0.62, BG).save(OUT / 'icon-512.png', optimize=True)
    print('Crown', crown.size, '→ favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png')

    if '--preview' in sys.argv:
        dest = sys.argv[sys.argv.index('--preview') + 1]
        pv = Image.new('RGBA', (900, 300), (240, 236, 228, 255))
        x = 10
        for im in [fit(crown, 512, 0.62, BG).resize((256, 256)), fit(crown, 192, 0.74, BG)]:
            pv.alpha_composite(im, (x, 22)); x += im.width + 20
        for s in (48, 32, 16):
            for y, bg in ((40, (240, 236, 228, 255)), (140, (40, 40, 40, 255))):
                pv.paste(Image.new('RGBA', (s + 8, s + 8), bg), (x - 4, y - 4))
                pv.alpha_composite(fit(crown, s, 0.96), (x, y))
            x += 70
        pv.save(dest)


if __name__ == '__main__':
    if not SRC.exists():
        sys.exit(f'Missing {SRC.relative_to(ROOT)}: the raw files of the asset pipeline (assets-src/) are not part of the repository, they are kept locally by the maintainer. See docs/ROHDATEIEN.md.')
    main()
