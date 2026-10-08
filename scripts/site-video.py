#!/usr/bin/env python3
"""Record the title scene of the start page (same world and camera as hero.webp in site-screens.py) as a seamless loop.

Usage (preview server must be running, e.g. `npm run build && npx vite preview --port 4301`):
    python3 scripts/site-video.py [base-url] [out-dir] [--frames N] [--scale 2]
--scale renders at that pixel density (2: 2880x1800, as hero-wide.webp; video-loop.mjs scales down for the small file).
Output: <out-dir>/frame-NNNN.png (default assets-src/site/hero-loop/frames) and <out-dir>/../raw.mp4 (lossless),
then cut with scripts/video-loop.mjs (docs/WEBSITE.md).

A recorded game never returns to its first frame: serfs vanish into buildings and new ones appear. So the loop is
choreographed:
1. Routes: serfs are placed just outside the picture and sent to the opposite side; the game's own movement
   (pathfinding around buildings) runs and every tick of their way is recorded.
2. Frozen world: the simulation stops. Figures that would walk, vanish or appear are removed; serfs working in place
   (hammering, chopping) stay and animate. Walkers follow the recorded routes on a schedule that repeats exactly after
   LOOP frames: a route longer than the loop gets several walkers spaced one loop apart. They enter and leave only
   outside the picture, so nobody pops in or out, and the cross-fade at the seam blends identical positions.
3. Every frame is rendered with a fixed clock (1/FPS s for animations, sails, smoke) and read from the canvas.
Length: two full turns of the windmill (rotor 1.5 rad/s) – 201 frames = 8.375 s – plus FADE frames for the cut.
SwiftShader needs several seconds per frame (~25 min at --scale 1, about four times that at 2).
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

args = [a for a in sys.argv[1:]]
N_FRAMES = None
if '--frames' in args:
    i = args.index('--frames'); N_FRAMES = int(args[i + 1]); del args[i:i + 2]
SCALE = 1
if '--scale' in args:
    i = args.index('--scale'); SCALE = int(args[i + 1]); del args[i:i + 2]
BASE = args[0] if len(args) > 0 else 'http://localhost:4301'
OUT = Path(args[1]) if len(args) > 1 else ROOT / 'assets-src' / 'site' / 'hero-loop' / 'frames'
FPS = 24
ROTOR = 1.5  # rad/s, windmill sails (src/render/movingParts.js)
LOOP = round(2 * (2 * math.pi / ROTOR) * FPS)  # two full turns: 201 frames = 8.375 s
FADE = FPS
VIEW = dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=SCALE, locale='de-DE')

# 1. Routes from just outside one edge of the picture to the opposite one, walked by the game's own movement
ROUTES = """(o) => {
  const e = window.__kronland, s = e.sim, r = e.renderer, m = s.map, W = innerWidth, H = innerHeight;
  const scr = (x, z) => r.project(x, r.terrain.heightAt(x, z), z);
  const hq = s.findBuilding(0, 'headquarters');
  // band of walkable tiles 30–160 px outside the picture, by side
  const sides = { l: [], r: [], t: [], b: [] };
  for (let y = hq.y - 45; y < hq.y + 45; y++) for (let x = hq.x - 45; x < hq.x + 45; x++) {
    if (x < 1 || y < 1 || x >= m.width - 1 || y >= m.height - 1 || !m.walkable(x, y)) continue;
    const p = scr(x + 0.5, y + 0.5);
    const out = Math.max(-p.x, p.x - W, -p.y, p.y - H);
    if (out < 30 || out > 160) continue;
    const side = -p.x === out ? 'l' : p.x - W === out ? 'r' : -p.y === out ? 't' : 'b';
    sides[side].push({ x, y, sx: p.x, sy: p.y });
  }
  // deterministic picks: pairs of opposite sides, spread along the edge
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pairs = [['l', 'r'], ['b', 'r'], ['r', 'l'], ['l', 'b'], ['r', 'b'], ['b', 'l'], ['t', 'b'], ['b', 't']];
  const walkers = [];
  for (let i = 0; i < o.count; i++) {
    const [a, b] = pairs[i % pairs.length];
    if (!sides[a].length || !sides[b].length) continue;
    const from = pick(sides[a]), to = pick(sides[b]);
    const u = s.spawnSerf(0);
    if (!u) break;
    u.px = from.x * 1000 + 500; u.py = from.y * 1000 + 500; u.path = []; u.job = null;
    // every second one passes the square in front of the castle on its way
    const via = i % 2 === 0 ? { x: hq.x + 1 + (i % 4), y: hq.y + hq.h + 1 + (i % 3) } : null;
    const first = via && m.walkable(via.x, via.y) ? via : to;
    s.pending.push({ type: 'move', player: 0, units: [u.id], x: first.x, y: first.y });
    walkers.push({ id: u.id, to, via: first === to ? null : first, track: [], done: false });
  }
  for (let t = 0; t < o.maxTicks && walkers.some((w) => !w.done); t++) {
    s.run(1);
    for (const w of walkers) {
      if (w.done) continue;
      const u = s.entities.get(w.id);
      if (!u) { w.done = true; continue; }
      w.track.push([u.px, u.py]);
      if (w.via && !u.path.length && Math.abs(u.px / 1000 - w.via.x - 0.5) < 1.5 && Math.abs(u.py / 1000 - w.via.y - 0.5) < 1.5) {
        s.pending.push({ type: 'move', player: 0, units: [u.id], x: w.to.x, y: w.to.y });
        w.via = null;
      }
      const p = scr(u.px / 1000, u.py / 1000);
      // arrived, or stuck: stop as soon as it stands outside the picture again after having been inside
      w.seen ||= p.x > 0 && p.x < W && p.y > 0 && p.y < H;
      if (w.seen && (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30)) w.done = true;
    }
  }
  const ok = walkers.filter((w) => w.seen && w.done && w.track.length > 5);
  window.__walkers = ok.map((w) => ({ id: w.id, track: w.track }));
  return { sides: Object.fromEntries(Object.entries(sides).map(([k, v]) => [k, v.length])), walkers: walkers.length, kept: ok.length,
    ticks: ok.map((w) => w.track.length) };
}"""

# 2. Freeze: remove figures that would move, vanish or appear; walkers repeat on a loop-periodic schedule
FREEZE = """(o) => {
  const e = window.__kronland, s = e.sim;
  e.running = false; cancelAnimationFrame(e.raf);
  const keep = new Set(window.__walkers.map((w) => w.id));
  let removed = 0;
  for (const u of [...s.entities.values()]) {
    if (keep.has(u.id)) continue;
    const working = u.kind === 'unit' && u.job && u.path.length === 0 && s.entities.get(u.job.target);
    const still = u.kind === 'worker' && (u.inside || u.state === 'camping' || (u.state === 'waiting' && !u.path?.length));
    if ((u.kind === 'unit' && !working) || (u.kind === 'worker' && !still)) { s.entities.delete(u.id); removed++; }
  }
  // schedule: a route of D seconds gets k = ceil(D / L) walkers, one loop apart, plus a start offset per route
  const L = o.loop / o.fps;
  const plan = [];
  const base = window.__walkers;
  base.forEach((w, i) => {
    const D = w.track.length / 10, k = Math.ceil((D + 0.5) / L);
    const off = ((i * 0.37) % 1) * L;
    for (let j = 0; j < k; j++) {
      let u = s.entities.get(w.id);
      if (j > 0) { u = { ...u, id: s.nextId++, path: [] }; s.entities.set(u.id, u); }
      // plain walk clip as in the game: serfs never carry there, and the carry clip's short steps would slide
      u.path = []; u.job = null;
      plan.push({ id: u.id, track: w.track, period: k * L, phase: off + j * L });
    }
  });
  window.__plan = plan;
  window.__clock = 0;
  return { removed, walkers: plan.length };
}"""

STEP = """(o) => {
  const e = window.__kronland, s = e.sim, r = e.renderer;
  const t = window.__clock; window.__clock += 1 / o.fps;
  const at = (p, u) => {
    const x = ((u + p.phase) % p.period + p.period) % p.period * 10, n = p.track.length - 1;
    if (x >= n) return p.track[n];
    const i = Math.floor(x), f = x - i, a = p.track[i], b = p.track[i + 1];
    return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f)];
  };
  const prev = new Map();
  for (const p of window.__plan) {
    const u = s.entities.get(p.id), c = at(p, t), q = at(p, t - 0.1);
    u.px = c[0]; u.py = c[1];
    prev.set(p.id, { px: q[0], py: q[1] });
  }
  r.frame(1, 1 / o.fps, prev, { selected: new Set(), ghost: null, hint: null, landmarks: null, revealAll: true, speed: 1 });
  return r.renderer.domElement.toDataURL('image/png');
}"""


def main():
    if not (ROOT / 'assets-src').exists() and len(args) <= 1:
        sys.exit('Missing assets-src/: raw files stay outside Git (docs/ROHDATEIEN.md); pass an out-dir instead.')
    OUT.mkdir(parents=True, exist_ok=True)
    total = N_FRAMES or LOOP + FADE
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
        page.wait_for_timeout(1500)
        page.evaluate(ss.HIDE_HUD)
        try:
            page.wait_for_function(ss.PLACEHOLDERS_GONE, timeout=180000, polling=1000)
        except Exception:
            print('warning: placeholders left:', page.evaluate(ss.STUCK), flush=True)
        print('routes', page.evaluate(ROUTES, {'count': 12, 'maxTicks': 900}), flush=True)
        print('freeze', page.evaluate(FREEZE, {'loop': LOOP, 'fps': FPS}), flush=True)
        for k in range(total):
            url = page.evaluate(STEP, {'fps': FPS})
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
