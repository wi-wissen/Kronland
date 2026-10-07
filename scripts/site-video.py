#!/usr/bin/env python3
"""Record the title scene of the start page (same world and camera as hero.webp in site-screens.py) as a video.

Usage (preview server must be running, e.g. `npm run build && npx vite preview --port 4301`):
    python3 scripts/site-video.py [base-url] [out-dir]
The game loop is stopped and driven frame by frame with a fixed clock (24 fps, 100-ms ticks as in the game), so the
recording runs in real game time however slow software rendering is. Each frame is read from the canvas.
Output: <out-dir>/frame-NNNN.png (default assets-src/site/hero-loop/frames) and <out-dir>/../raw.mp4 (lossless).
Length: two full turns of the windmill rotor (Renderer: rotation 1.5 rad/s) plus one second for the cross-fade;
scripts/art/loop.mjs then cuts the seamless loop. SwiftShader takes several seconds per frame (~20 min).
"""
import base64
import importlib.util
import math
import os
import subprocess
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('site_screens', ROOT / 'scripts' / 'site-screens.py')
ss = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ss)

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4301'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'assets-src' / 'site' / 'hero-loop' / 'frames'
FPS = 24
ROTOR = 1.5  # rad/s, src/render/Renderer.js ('rotor')
LOOP = round(2 * (2 * math.pi / ROTOR) * FPS)  # two full turns: 201 frames = 8.375 s
FADE = FPS
# 1440×900 like hero.webp, canvas 1920×1200
VIEW = dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=4 / 3, locale='de-DE')

# Stop the game loop; from now on every frame advances a fixed 1/FPS s of game and animation time
STOP = """() => { const e = window.__kronland; e.running = false; cancelAnimationFrame(e.raf); window.__t = e.last; }"""
STEP = """(ms) => {
  const e = window.__kronland;
  window.__t += ms;
  e.frame(window.__t);
  return e.renderer.renderer.domElement.toDataURL('image/png');
}"""


def main():
    if not (ROOT / 'assets-src').exists() and len(sys.argv) <= 2:
        sys.exit('Missing assets-src/: raw files stay outside Git (docs/ROHDATEIEN.md); pass an out-dir instead.')
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=ss.GL, executable_path=os.environ.get('PW_CHROMIUM') or None)
        ctx = b.new_context(**VIEW)
        ctx.add_init_script("try { localStorage.setItem('kronland-lang', 'de'); localStorage.setItem('kronland-settings', JSON.stringify({ edgeScroll: false })); } catch (e) {}")
        page = ss.boot(ctx, '?seed=11&fog=off&quality=high&players=2')
        # Same scene and camera as the title image (site-screens.py, 'hero')
        ss.settle(page, ticks=1500, dist=34, pitch=0.62, yaw=0.9, dx=1, dy=1)
        page.evaluate("() => { const e = window.__kronland, h = e.sim.findBuilding(0, 'headquarters'); window.__hqc = [h.x + 2.5, h.y + 2.5]; }")
        hq = page.evaluate('() => window.__hqc')
        page.evaluate(ss.FRAME, [hq[0], hq[1], 0.68, 0.5])
        page.wait_for_timeout(2500)
        page.evaluate(ss.HIDE_HUD)
        try:
            page.wait_for_function(ss.PLACEHOLDERS_GONE, timeout=180000, polling=1000)
        except Exception:
            print('warning: placeholders left:', page.evaluate(ss.STUCK), flush=True)
        page.evaluate(STOP)
        total = LOOP + FADE
        for k in range(total):
            url = page.evaluate(STEP, 1000 / FPS)
            (OUT / f'frame-{k:04d}.png').write_bytes(base64.b64decode(url.split(',', 1)[1]))
            if k % 10 == 0:
                print(f'frame {k}/{total}', flush=True)
        b.close()
    raw = OUT.parent / 'raw.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', str(OUT / 'frame-%04d.png'),
                    '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv444p', str(raw)], check=True)
    print(f'{raw}: {total} frames, loop {LOOP} frames ({LOOP / FPS:.3f} s) + fade {FADE}', flush=True)


if __name__ == '__main__':
    main()
