#!/usr/bin/env python3
"""Cut out a hero portrait as a transparent pictogram (like the atlas icons, docs/SYMBOLE.md).

The painted portraits (public/portraits/hero-*.webp) sit on a flat cream ground. For the category icon
"Helden" (start page, compendium) it is removed: flood from the image edges over everything close to the
ground colour, then "colour over ground" is recomputed in a 2 px fringe so the anti-aliasing becomes
semi-transparent. The result is fitted into 128 px like an atlas cell.

Usage: python3 scripts/icons/hero-icon.py [hero] [--preview file.png]
Output: public/icons/heroes.webp
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
HERO = next((a for a in sys.argv[1:] if not a.startswith('-') and not a.endswith('.png')), 'nelia')
SRC = ROOT / 'public' / 'portraits' / f'hero-{HERO}.webp'
OUT = ROOT / 'public' / 'icons' / 'heroes.webp'
CELL, PAD = 128, 4
TOL = 22  # max. channel distance to the ground colour that still counts as ground

im = Image.open(SRC).convert('RGB')
W, H = im.size
px = im.load()
ground = px[0, 0]
near = lambda c, t=TOL: max(abs(c[i] - ground[i]) for i in range(3)) <= t

# 1) flood from the edges
bg = [[False] * W for _ in range(H)]
q = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
while q:
    x, y = q.popleft()
    if bg[y][x] or not near(px[x, y]):
        continue
    bg[y][x] = True
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not bg[ny][nx]:
            q.append((nx, ny))

# 2) fringe: 2 px next to the ground
edge = [[False] * W for _ in range(H)]
src = bg
for _ in range(2):
    add = []
    for y in range(H):
        for x in range(W):
            if bg[y][x] or edge[y][x]:
                continue
            if any(0 <= nx < W and 0 <= ny < H and src[ny][nx] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
                add.append((x, y))
    for x, y in add:
        edge[y][x] = True
    src = edge

# 3) alpha: ground transparent, fringe as "colour over ground" (alpha from the largest channel distance)
out = Image.new('RGBA', (W, H))
op = out.load()
for y in range(H):
    for x in range(W):
        c = px[x, y]
        if bg[y][x]:
            continue
        if not edge[y][x]:
            op[x, y] = (*c, 255)
            continue
        a = max(abs(c[i] - ground[i]) / max(ground[i], 255 - ground[i], 1) for i in range(3))
        a = min(1.0, a * 1.6)
        if a < 0.08:
            continue
        col = tuple(max(0, min(255, round((c[i] - (1 - a) * ground[i]) / a))) for i in range(3))
        op[x, y] = (*col, round(a * 255))

# 4) crop and fit into an atlas-like cell
box = out.getbbox()
icon = out.crop(box)
icon.thumbnail((CELL - 2 * PAD, CELL - 2 * PAD), Image.LANCZOS)
cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
cell.alpha_composite(icon, ((CELL - icon.width) // 2, (CELL - icon.height) // 2))
OUT.parent.mkdir(parents=True, exist_ok=True)
cell.save(OUT, 'WEBP', quality=90, alpha_quality=100, method=6)
print(f'{OUT.relative_to(ROOT)}: {CELL}x{CELL}, {OUT.stat().st_size // 1024} KB (from {SRC.name})')

if '--preview' in sys.argv:
    # on dark and light ground, like slice.mjs --preview
    prev = Image.new('RGBA', (CELL * 2, CELL), '#3a2c20')
    prev.paste(Image.new('RGBA', (CELL, CELL), '#e9dcc0'), (CELL, 0))
    prev.alpha_composite(cell, (0, 0))
    prev.alpha_composite(cell, (CELL, 0))
    prev.save(sys.argv[sys.argv.index('--preview') + 1])
