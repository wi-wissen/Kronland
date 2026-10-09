#!/usr/bin/env python3
"""Take screenshots for the start page and the manual from the running game (not part of the tests).

Usage (preview server must be running, e.g. `npm run build && npx vite preview --port 4301`):
    python3 scripts/site-screens.py [base-url] [filter]
Output: public/site/<name>.webp (+ <name>-small.webp for the gallery), HUD crops hud-*.webp,
title image hero.webp (1440 px) and hero-wide.webp (2880 px, twice the pixel density).
Desktop 1440×900 with graphics level high (SwiftShader – slow, several minutes).
"""
import base64
import io
import os
import sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4301'
FILTER = sys.argv[2] if len(sys.argv) > 2 else ''
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'site'
OUT.mkdir(parents=True, exist_ok=True)
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
DESK = dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
# Title image of the start page fills large screens: same picture (1440×900 viewport), twice the pixel density
DESK2 = dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
PHONE = dict(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)

# Settlement: technologies, resources, buildings around the castle, serfs on construction sites, fast-forward time
SETTLE = """(o) => {
  const e = window.__kronland, s = e.sim, p = s.players[0];
  Object.assign(p.stock, { gold: 4000, wood: 4000, clay: 4000, stone: 4000, iron: 2000, sulfur: 1000 });
  ['education','construction','alchemy','conscription','trade','gears','standingArmy','alloys','pulley','metallurgy','tactics','printing']
    .forEach((t) => p.techs.add(t));
  const hq = s.findBuilding(0, 'headquarters');
  hq.level = 1;
  hq.hp = Math.max(hq.hp, 3200); // HP of the fortress, otherwise the castle counts as damaged
  const cx = hq.x + 2, cy = hq.y + 2;
  const list = o.list;
  const made = [];
  list.forEach((t, i) => {
    const ang = i * 2.39996, r = 8 + i * 0.75;
    const pos = s.findPlacement(0, t, Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 30);
    if (!pos) return;
    const b = s.createBuilding(0, t, pos.x, pos.y, true);
    if (o.levels && i % 4 === 1 && s.constructor && b.level === 0) {
      const max = { residence: 2, farm: 2, villageCenter: 2, university: 1, tower: 2 }[t];
      if (max) b.level = Math.min(max, 1 + (i % 2));
    }
    made.push(b.id);
  });
  for (let i = 0; i < 8; i++) s.spawnSerf(0);
  const serfs = [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0).map((u) => u.id);
  const site = s.findPlacement(0, 'residence', cx + 5, cy - 7, 20);
  if (site) e.issue({ type: 'placeBuilding', player: 0, building: 'residence', x: site.x, y: site.y, units: serfs.slice(0, 4) });
  s.run(o.ticks || 0);
  e.renderer.rig.lookAt(cx + (o.dx || 0), cy + (o.dy || 0));
  if (o.dist) e.renderer.rig.dist = o.dist;
  if (o.pitch) e.renderer.rig.pitch = o.pitch;
  if (o.yaw !== undefined) e.renderer.rig.yaw = o.yaw;
  e.clearSelection();
  return made.length;
}"""

BATTLE = """(o) => {
  const e = window.__kronland, s = e.sim;
  const hq = s.findBuilding(0, 'headquarters');
  const W = s.map.width, mid = (W / 2) | 0;
  const dx = Math.sign(mid - hq.x), dy = Math.sign(mid - hq.y);
  // search for a free, flat area (14 × 8 tiles without water, occupancy, rock) towards the map centre
  const cx = hq.x + 2 + dx * 14, cy = hq.y + 2 + dy * 14;
  let area = null;
  for (let r = 0; r < 30 && !area; r++) for (let oy = -r; oy <= r && !area; oy++) for (let ox = -r; ox <= r && !area; ox++) {
    if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
    if (s.map.rectFree(cx + ox, cy + oy, 14, 8, 1 | 2 | 8)) area = { x: cx + ox, y: cy + oy };
  }
  if (!area) area = { x: cx, y: cy };
  const a = { x: area.x + 3, y: area.y + 4 }, b = { x: area.x + 10, y: area.y + 4 };
  const mine = [['sword3', 0, -2], ['spear3', 0, 2], ['bow2', -2, 0], ['heavyCav1', 1, 0]]
    .map(([d, ox, oy]) => s.spawnLeader(0, d, a.x + ox, a.y + oy));
  const foe = [['sword2', 0, -2], ['spear2', 0, 2], ['bow2', 2, 0], ['lightCav1', 1, 1]]
    .map(([d, ox, oy]) => s.spawnLeader(1, d, b.x + ox, b.y + oy));
  const hero = [...s.entities.values()].find((x) => x.kind === 'hero' && x.owner === 0);
  if (hero) { hero.px = a.x * 1000 + 500; hero.py = (a.y + 1) * 1000 + 500; hero.path = []; }
  s.pending.push({ type: 'order', player: 0, units: mine.map((l) => l.id).concat(hero ? [hero.id] : []), order: 'attackMove', x: b.x, y: b.y });
  s.pending.push({ type: 'order', player: 1, units: foe.map((l) => l.id), order: 'attackMove', x: a.x, y: a.y });
  e.selected.clear();
  mine.forEach((l) => e.selected.add(l.id));
  if (hero) e.selected.add(hero.id);
  e.renderer.rig.lookAt((a.x + b.x) / 2 + 0.5, (a.y + b.y) / 2 + 0.5);
  e.renderer.rig.dist = o.dist || 22;
  e.renderer.rig.pitch = o.pitch || 0.8;
  e.emitUi();
  // The game loop computes at most one tick per frame – far too slow with software rendering. So fast-forward
  // until the troops meet and the first hits land.
  const foeCount = () => [...s.entities.values()].filter((x) => x.kind === 'soldier' && x.owner === 1).length;
  const start = foeCount();
  for (let i = 0; i < 40 && foeCount() > start - 2; i++) s.run(5);
  // hold the moment: the screenshot may wait minutes for figure models, the fight would be over by then
  e.paused = true;
  return start - foeCount();
}"""

# Move the camera so that the world point (x, z) lies at the screen position (fx·width, fy·height)
FRAME = """([x, z, fx, fy]) => {
  const e = window.__kronland, r = e.renderer, rig = r.rig;
  const W = innerWidth, H = innerHeight;
  const at = () => { rig.update(0); r.camera.updateMatrixWorld(); return r.project(x, r.terrain.heightAt(x, z), z); };
  let tx = rig.target ? rig.target.x : x, tz = rig.target ? rig.target.z : z;
  for (let i = 0; i < 8; i++) {
    const p = at(); const ex = fx * W - p.x, ey = fy * H - p.y;
    if (Math.abs(ex) < 4 && Math.abs(ey) < 4) break;
    // derivative: move the target by 1 tile in x or z
    const c = rig.target; const ox = c.x, oz = c.z;
    rig.lookAt(ox + 1, oz); const px = at(); rig.lookAt(ox, oz + 1); const pz = at(); rig.lookAt(ox, oz); const p0 = at();
    const a = px.x - p0.x, b = pz.x - p0.x, cc = px.y - p0.y, d = pz.y - p0.y, det = a * d - b * cc;
    if (!det) break;
    const dx = (d * ex - b * ey) / det, dz = (-cc * ex + a * ey) / det;
    rig.lookAt(ox + dx, oz + dz);
  }
  rig.update(0);
}"""

# Find a slope building site near the castle (allowed, but clearly inclined) and point the camera flat at it (like e2e/slope.spec.js)
SLOPE_SITE = """() => {
  const e = window.__kronland, sim = e.sim, m = sim.map;
  const hq = sim.findBuilding(0, 'headquarters');
  let best = null, bd = Infinity;
  for (let y = 8; y < m.height - 12; y++) for (let x = 8; x < m.width - 12; x++) {
    if (!m.rectFree(x - 1, y - 1, 5, 5)) continue;
    const s = m.slope(x, y, 3, 3);
    if (s < 280 || sim.checkPlacement(0, 'residence', x, y)) continue;
    const d = (x - hq.x) ** 2 + (y - hq.y) ** 2;
    if (d < bd) { bd = d; best = { x, y, slope: s }; }
  }
  if (!best) return null;
  const cx = best.x + 1.5, cz = best.y + 1.5;
  e.renderer.rig.lookAt(cx, cz);
  e.renderer.rig.dist = 16;
  e.renderer.rig.pitch = 0.6;
  e.renderer.rig.update(0);
  e.renderer.camera.updateMatrixWorld();
  const p = e.renderer.project(cx, e.renderer.terrain.heightAt(cx, cz), cz);
  return { ...best, sx: p.x, sy: p.y };
}"""

# Send a serf far around an obstacle, pause the game (like e2e/devmode.spec.js)
DEV_MOVE = """() => {
  const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters'), m = e.sim.map;
  const s = [...e.sim.entities.values()].find((x) => x.kind === 'unit' && x.owner === 0);
  const W = m.width, mid = W >> 1, dx = Math.sign(mid - hq.x) || 1, dy = Math.sign(mid - hq.y) || 1;
  let to = null;
  for (let r = 0; r < 20 && !to; r++) for (let o = -r; o <= r && !to; o++) {
    const x = hq.x + 2 + dx * 16 + o, y = hq.y + 2 + dy * 12 - r;
    if (m.walkable(x, y)) to = { x, y };
  }
  e.selected.clear(); e.selected.add(s.id);
  e.issue({ type: 'move', units: [s.id], ...to });
  e.stepOnce(); e.stepOnce();
  e.paused = true;
  e.emitUi();
  window.__devTo = to;
  return to;
}"""

DEV_FRAME = """() => {
  const e = window.__kronland, d = e.dev, s = [...e.selected].map((id) => e.sim.entities.get(id))[0];
  if (d.pb) { d.playing = false; d.pb.seek(Math.round(d.pb.rec.steps * 0.7)); }
  const to = window.__devTo, fx = s.px / 1000, fy = s.py / 1000;
  e.renderer.rig.lookAt((fx + to.x) / 2 - 3, (fy + to.y) / 2);
  e.renderer.rig.dist = 30; e.renderer.rig.pitch = 1.0;
  e.emitUi();
}"""

CODE = '[data-testid=section-player] [data-testid=code-input]'

# Footpaths: look at the most trodden spot near the castle (sum of track strength in a 12×12 window)
PATHS_VIEW = """(dist) => {
  const e = window.__kronland, s = e.sim, m = s.map, W = m.width, hq = s.findBuilding(0, 'headquarters');
  let best = { x: hq.x + 2, y: hq.y + 2 }, bv = -1;
  for (let y = hq.y - 18; y <= hq.y + 18; y += 2) for (let x = hq.x - 18; x <= hq.x + 18; x += 2) {
    let v = 0;
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const xx = x + i, yy = y + j;
      if (xx >= 0 && yy >= 0 && xx < W && yy < m.height) v += m.tracks[yy * W + xx];
    }
    if (v > bv) { bv = v; best = { x: x + 6, y: y + 6 }; }
  }
  if (!window.__pathsAt) window.__pathsAt = best; // winter: same place as in summer
  const at = window.__pathsAt;
  e.renderer.rig.lookAt(at.x, at.y);
  e.renderer.rig.dist = dist;
  e.renderer.rig.update(0);
  return { ...at, v: bv };
}"""

HIDE_HUD = "() => { const st = document.createElement('style'); st.id = 'nohud'; st.textContent = '.game > :not(canvas), .tooltip { display: none !important; }'; document.head.appendChild(st); }"
NO_GRAY = "() => { if (document.getElementById('nogray')) return; const st = document.createElement('style'); st.id = 'nogray'; st.textContent = '.game canvas.paused-gray { filter: none !important; } .pause-banner { display: none !important; }'; document.head.appendChild(st); }"
SHOW_HUD ="() => document.getElementById('nohud')?.remove()"
PLAIN_GROUND = "() => { const st = document.createElement('style'); st.id = 'plain'; st.textContent = '.game > canvas, .toasts, .notices { visibility: hidden !important; } .game { background: #1d1712 !important; }'; document.head.appendChild(st); }"
# No shown figure waits for a lazily loaded model any more (src/render/characters.js: pendingModel; prepared but
# unused roles may keep their placeholder, so only the records of drawn figures count)
PLACEHOLDERS_GONE = """() => { const r = window.__kronland?.renderer, c = r?.chars; if (!c) return true;
  const pending = (v) => !!v && (!!v.pendingModel || (v.attach ?? []).some((a) => pending(a.variant)));
  // Own building models load on demand too: the key of a drawn building ends in its load state (2 = original there)
  if ([...(r.buildings?.values() ?? [])].some((g) => !String(g.userData.key ?? ':2').endsWith(':2'))) return false;
  return ![...c.records.values()].some((r) => r.visible && pending(r.variant)); }"""
STUCK = """() => { const r = window.__kronland.renderer;
  return [...new Set([...r.chars.records.values()].filter((x) => x.visible && x.variant?.pendingModel).map((x) => x.roleKey + '>' + x.variant.pendingModel))]
    .concat([...(r.buildings?.values() ?? [])].filter((g) => !String(g.userData.key ?? ':2').endsWith(':2')).map((g) => 'building ' + g.userData.key)); }"""


def save(img_bytes, name, small=True, size=None, quality=80):
    im = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    if size:
        im.thumbnail(size, Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=quality, method=6)
    if small:
        sm = im.copy()
        sm.thumbnail((720, 720), Image.LANCZOS)
        sm.save(OUT / f'{name}-small.webp', 'WEBP', quality=78, method=6)
    print('saved', name, im.size, flush=True)


def save_placeholder(img_bytes):
    """Tiny blurred stand-in of the title image (32x20 px, ~250 bytes) inlined into the page: visible at once,
    before hero.webp and the title video arrive (src/site/home/heroPlaceholder.js)."""
    im = Image.open(io.BytesIO(img_bytes)).convert('RGB').resize((32, 20), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=40, method=6)
    uri = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    (ROOT / 'src' / 'site' / 'home' / 'heroPlaceholder.js').write_text(
        '// Generated by scripts/site-screens.py (hero): tiny stand-in of public/site/hero.webp, shown blurred until it loads\n'
        f"export const HERO_PLACEHOLDER = '{uri}';\n")
    print('saved hero placeholder', len(b.getvalue()), 'bytes', flush=True)


def want(n):
    return not FILTER or any(f and f in n for f in FILTER.split(','))


def frames(page, n=2):
    """Wait for n drawn frames (SwiftShader with graphics level high sometimes needs seconds per frame)."""
    page.evaluate("(n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); })", n)


def shoot(page, target=None):
    """Freeze the frame (3D scene stops drawing, HUD stays), then capture. Without freezing,
    Playwright cannot keep up with the screenshot when a frame arrives every few seconds."""
    # Figure and building models (riders, horse, workshops …) load lazily; until then a procedural placeholder stands in.
    # Draw first: after a fast-forward the renderer only meets new buildings (and requests their models) in a frame.
    frames(page, 3)
    # A paused game is shown in grey with a banner; the pictures pause only to hold a moment
    page.evaluate(NO_GRAY)
    if os.environ.get('SHOTS_DEBUG'):
        print('waiting for:', page.evaluate(STUCK), flush=True)
    try:
        page.wait_for_function(PLACEHOLDERS_GONE, timeout=180000, polling=1000)
    except Exception:
        print('warning: placeholders left:', page.evaluate(STUCK), flush=True)
    frames(page, 2)
    page.evaluate("() => { const r = window.__kronland.renderer; if (!r.__frame) { r.__frame = r.frame; r.frame = () => {}; } }")
    page.wait_for_timeout(700)
    # Crop via the element's position (Locator.screenshot waits for "stable" – animated panels never are)
    # several targets: their common rectangle (e.g. command panel and selection card of the army)
    boxes = [t.bounding_box() for t in (target if isinstance(target, (list, tuple)) else [target])] if target else []
    clip = None
    if boxes:
        x0, y0 = min(b['x'] for b in boxes), min(b['y'] for b in boxes)
        x1, y1 = max(b['x'] + b['width'] for b in boxes), max(b['y'] + b['height'] for b in boxes)
        clip = {'x': x0, 'y': y0, 'width': x1 - x0, 'height': y1 - y0}
    shot = page.screenshot(type='png', timeout=600000, clip=clip) if clip else page.screenshot(type='png', timeout=600000)
    page.evaluate("() => { const r = window.__kronland.renderer; if (r.__frame) { r.frame = r.__frame; delete r.__frame; } }")
    return shot


def boot(ctx, query):
    page = ctx.new_page()
    page.set_default_timeout(600000)
    page.on('pageerror', lambda e: print('pageerror', e, flush=True))
    page.goto(f'{BASE}/play/{query}')
    page.wait_for_function('() => !!window.__kronland && !!document.querySelector("[data-testid=topbar]")', timeout=240000)
    page.wait_for_timeout(3000)
    return page


def settle(page, **o):
    o.setdefault('list', ['residence', 'farm', 'university', 'residence', 'farm', 'sawmill', 'brickworks', 'tower', 'smithy',
                          'chapel', 'residence', 'farm', 'stonemason', 'barracks', 'storehouse', 'alchemist', 'clock',
                          'residence', 'farm', 'archery', 'bank', 'clayMine', 'stoneMine', 'ironMine'])
    o.setdefault('levels', True)
    n = page.evaluate(SETTLE, o)
    page.wait_for_timeout(o.get('wait', 6000))
    return n


def run(pw):
    # Use the preinstalled Chromium: PW_CHROMIUM=/path/to/chrome
    b = pw.chromium.launch(args=GL, executable_path=os.environ.get('PW_CHROMIUM') or None)
    init = "try { localStorage.setItem('kronland-lang', '%s'); localStorage.setItem('kronland-settings', JSON.stringify({ edgeScroll: false })); } catch (e) {}"

    # ---------- Title image of the start page (without HUD), rendered at twice the pixel density ----------
    if want('hero'):
        ctx = b.new_context(**DESK2, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=11&fog=off&quality=high&players=2')
        settle(page, ticks=1500, dist=34, pitch=0.62, yaw=0.9, dx=1, dy=1)
        page.evaluate("() => { const e = window.__kronland, h = e.sim.findBuilding(0, 'headquarters'); window.__hqc = [h.x + 2.5, h.y + 2.5]; }")
        hq = page.evaluate('() => window.__hqc')
        page.evaluate(FRAME, [hq[0], hq[1], 0.68, 0.5])
        page.wait_for_timeout(2500)
        page.evaluate(HIDE_HUD)
        page.wait_for_timeout(800)
        shot = shoot(page)
        # hero.webp 1440 px for phones and normal screens, hero-wide.webp 2880 px for large and sharp screens (srcset)
        save(shot, 'hero', small=False, size=(1440, 900))
        save(shot, 'hero-wide', small=False, quality=70)
        save_placeholder(shot)
        ctx.close()

    # ---------- Settlement (gallery with HUD) and HUD crops ----------
    hud = ['hud-resources', 'hud-status', 'hud-minimap', 'hud-commandbar', 'hud-building', 'hud-research']
    if want('settlement') or any(want(n) for n in hud):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=11&fog=off&quality=high&players=2')
        settle(page, ticks=1500, dist=34, pitch=0.62, yaw=0.9, dx=1, dy=1)
        if want('settlement'):
            page.evaluate("() => { const e = window.__kronland; e.renderer.rig.dist = 26; e.renderer.rig.pitch = 0.85; "
                          "const u = [...e.sim.entities.values()].find((x) => x.kind === 'building' && x.owner === 0 && x.type === 'university'); "
                          "if (u) { e.selected.clear(); e.selected.add(u.id); e.emitUi(); } }")
            page.wait_for_timeout(2500)
            save(shoot(page), 'settlement')
        if any(want(n) for n in hud):
            page.evaluate("() => { const e = window.__kronland; e.clearSelection(); }")
            page.wait_for_timeout(800)
            # crops at original size (the whole bar would be too small in the manual)
            if want('hud-resources'):
                save(shoot(page, page.locator('.tb-res')), 'hud-resources', small=False)
            if want('hud-status'):
                save(shoot(page, page.locator('.tb-crest')), 'hud-status', small=False)
            if want('hud-minimap'):
                save(shoot(page, page.get_by_test_id('minimap')), 'hud-minimap', small=False)
            # build menu appears as soon as serfs are selected
            page.evaluate("() => window.__kronland.selectAllSerfs()")
            page.get_by_test_id('build-menu').wait_for()
            if want('hud-commandbar'):
                save(shoot(page, page.locator('.cmdbar')), 'hud-commandbar', small=False)
            # castle selected: building panel
            page.evaluate("() => window.__kronland.focusHeadquarters()")
            page.wait_for_timeout(1200)
            if want('hud-building'):
                save(shoot(page, page.get_by_test_id('context-panel')), 'hud-building', small=False)
            # university: research
            page.evaluate("() => { const e = window.__kronland; const u = [...e.sim.entities.values()].find((x) => x.kind === 'building' && x.owner === 0 && x.type === 'university'); e.selected.clear(); e.selected.add(u.id); e.emitUi(); }")
            page.wait_for_timeout(1200)
            if want('hud-research'):
                save(shoot(page, page.get_by_test_id('context-panel')), 'hud-research', small=False)
        ctx.close()

    # ---------- Combat ----------
    if want('combat') or want('hud-army') or want('hud-selection'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=11&fog=off&quality=high&players=2&hero=nelia')
        settle(page, ticks=0, wait=500, list=['residence', 'farm', 'barracks', 'archery', 'tower'], levels=False)
        print('Fallen enemies:', page.evaluate(BATTLE, {'dist': 15, 'pitch': 0.8}), flush=True)
        # camera on the middle of the skirmish, above the command bar
        mid = page.evaluate("() => { const L = [...window.__kronland.sim.entities.values()].filter((x) => x.kind === 'leader' || x.kind === 'soldier');"
                            " const n = L.length || 1; return [L.reduce((a, x) => a + x.px, 0) / n / 1000, L.reduce((a, x) => a + x.py, 0) / n / 1000]; }")
        page.evaluate(FRAME, [mid[0], mid[1], 0.5, 0.36])
        page.wait_for_timeout(3000)
        if want('combat'):
            save(shoot(page), 'combat')
        if want('hud-army'):
            # orders (command panel below)
            save(shoot(page, page.get_by_test_id('context-panel')), 'hud-army', small=False)
        if want('hud-selection'):
            # captains and hero: selection card on the right, with the round crest that juts out of it
            page.evaluate(PLAIN_GROUND)
            sel = page.get_by_test_id('selection-card')
            save(shoot(page, [sel, sel.locator('.sc-portrait')]), 'hud-selection', small=False)
            page.evaluate("() => document.getElementById('plain')?.remove()")
        ctx.close()

    # ---------- Winter ----------
    if want('winter'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=5&fog=off&quality=high&players=2')
        settle(page, ticks=600, wait=500, dist=30, pitch=0.7, yaw=2.2,
               list=['residence', 'farm', 'university', 'residence', 'farm', 'sawmill', 'tower', 'chapel', 'smithy', 'barracks', 'clayMine', 'stoneMine'])
        page.evaluate("() => { const e = window.__kronland; e.sim.setWeather('winter', 6000); e.renderer.applyWeather('winter'); e.emitUi(); }")
        page.wait_for_timeout(9000)
        save(shoot(page), 'winter')
        ctx.close()

    # ---------- Fog of war ----------
    if want('fog'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=23&quality=high&players=2')
        page.evaluate("() => { const e = window.__kronland, s = e.sim; const hq = s.findBuilding(0, 'headquarters'); "
                      "const W = s.map.width; e.renderer.rig.lookAt(hq.x + 2 + (W / 2 - hq.x) * 0.25, hq.y + 2 + (W / 2 - hq.y) * 0.25); "
                      "e.renderer.rig.dist = 62; e.renderer.rig.pitch = 0.95; }")
        page.wait_for_timeout(7000)
        save(shoot(page), 'fog')
        ctx.close()

    # ---------- Building on a slope: yellow build preview ----------
    if want('slope'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=42&fog=off&quality=high&players=2')
        site = page.evaluate(SLOPE_SITE)
        print('Slope:', site, flush=True)
        if site:
            page.get_by_role('button', name='Alle').click()
            page.get_by_test_id('build-residence').click()
            page.wait_for_timeout(500)
            page.mouse.move(site['sx'], site['sy'])
            page.get_by_test_id('place-state').wait_for()
            page.wait_for_timeout(2500)
            save(shoot(page), 'slope')
        ctx.close()

    # ---------- Developer mode: A* search of a serf ----------
    if want('developer'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=42&fog=off&quality=high&players=2&dev=1')
        page.wait_for_function('() => !!window.__kronland.dev', timeout=120000)
        page.evaluate(DEV_MOVE)
        page.get_by_test_id('dev-tab-path').click()
        page.wait_for_function("() => { const d = window.__kronland.dev; return d.searchLayer?.visible && d.pb?.rec.result === 'found'; }", timeout=180000, polling=500)
        # search played to about two thirds: open and closed list clearly visible, path still being built
        page.evaluate(DEV_FRAME)
        page.wait_for_timeout(4000)
        save(shoot(page), 'developer')
        ctx.close()

    # ---------- Course mission: code panel with world switcher, „Prüfen“ result and a breakpoint ----------
    if want('programming'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = ctx.new_page()
        page.set_default_timeout(600000)
        # I.4 has three worlds (normal case, near, far) like e2e/worlds.spec.js
        page.goto(f'{BASE}/play/?mission=r1-4&quality=high')
        page.wait_for_function('() => !!window.__kronland', timeout=240000)
        page.get_by_test_id('script-panel').wait_for()
        # The woodcutter's note replaces the code once the stage begins: type only after it is there
        page.get_by_test_id('script-goal-predict').wait_for()
        page.wait_for_function(f"() => /guess = 0/.test(document.querySelector({CODE!r})?.value ?? '')", timeout=240000, polling=500)
        page.wait_for_timeout(2000)
        # Prediction stage solved in the world where 0 is right, then back to the normal case for the coin stage
        page.get_by_test_id('script-world-near').click()
        page.wait_for_function("() => window.__kronland.sim.mission.state.world === 'near'", timeout=120000, polling=500)
        page.get_by_test_id('script-run').click()
        page.get_by_test_id('script-goal-coin').wait_for(timeout=300000)
        page.get_by_test_id('script-world-normal').click()
        page.wait_for_function("() => window.__kronland.sim.mission.state.world === 'normal'", timeout=120000, polling=500)
        page.get_by_test_id('script-goal-coin').wait_for()
        page.wait_for_timeout(2000)
        # A hard-coded program: right in the normal case only – „Prüfen“ marks the other worlds
        page.get_by_test_id('section-player').get_by_test_id('code-input').fill(
            'for i in range(7):\n    nelia.step()\nnelia.take()\nprint("Taler!")\n')
        page.get_by_test_id('script-check').click()
        page.wait_for_function("() => ['true', 'false'].includes(document.querySelector('[data-testid=script-check-result]')?.dataset.passed)", timeout=300000, polling=500)
        # breakpoint in the loop, run, continue a few rounds (the check result stays: the code is unchanged)
        page.get_by_test_id('section-player').get_by_test_id('ce-line-2').click()
        page.get_by_test_id('script-run').click()
        paused = "() => document.querySelector('[data-testid=script-panel]')?.dataset.status === 'paused'"
        page.wait_for_function(paused, timeout=240000, polling=500)
        for _ in range(3):
            page.get_by_test_id('script-continue').click()
            page.wait_for_timeout(1500)
            page.wait_for_function(paused, timeout=240000, polling=500)
        # Nelia on her way in the middle of the game area left of the code panel
        at = page.evaluate("() => { const e = window.__kronland, h = [...e.sim.entities.values()].find((x) => x.kind === 'hero' && x.owner === 0);"
                           " e.renderer.rig.dist = 17; e.renderer.rig.pitch = 0.85; return [h.px / 1000, h.py / 1000]; }")
        page.evaluate(FRAME, [at[0], at[1], 0.27, 0.55])
        page.wait_for_timeout(3000)
        save(shoot(page), 'programming')
        ctx.close()

    # ---------- Course menu: missions grouped by rows ----------
    if want('course'):
        ctx = b.new_context(**DESK, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = ctx.new_page()
        page.set_default_timeout(600000)
        page.goto(f'{BASE}/play/')
        page.get_by_test_id('menu-adventures').click()
        page.get_by_test_id('adventure-r1-4').click()
        page.get_by_test_id('adventure-brief').wait_for()
        page.wait_for_timeout(2500)
        save(page.screenshot(type='png'), 'course')
        ctx.close()

    # ---------- Footpaths: the same village in summer (paths in the grass) and winter (footprints in the snow) ----------
    if want('paths'):
        # half the width per season, put side by side: 1440×900
        ctx = b.new_context(viewport={'width': 719, 'height': 900}, device_scale_factor=1, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=11&fog=off&quality=high&players=2')
        # A few minutes of village life: serfs and workers tread their ways
        settle(page, ticks=4200, wait=3000, pitch=0.8, yaw=0.9, levels=False,
               list=['residence', 'farm', 'residence', 'farm', 'sawmill', 'brickworks', 'residence', 'farm', 'stonemason',
                     'storehouse', 'clayMine', 'stoneMine'])
        print('Paths:', page.evaluate(PATHS_VIEW, 17), flush=True)
        page.evaluate(HIDE_HUD)
        page.wait_for_timeout(5000)
        summer = shoot(page)
        # Fresh snow covers the paths; a minute later every step has left footprints, busy ways are trodden
        page.evaluate("() => { const e = window.__kronland, s = e.sim; s.setWeather('winter', 9000); s.run(1500); e.renderer.applyWeather('winter'); e.emitUi(); }")
        print('Paths (winter):', page.evaluate(PATHS_VIEW, 17), flush=True)
        page.wait_for_timeout(9000)
        winter = shoot(page)
        both = Image.new('RGB', (1440, 900), (29, 23, 18))
        both.paste(Image.open(io.BytesIO(summer)).convert('RGB'), (0, 0))
        both.paste(Image.open(io.BytesIO(winter)).convert('RGB'), (721, 0))
        out = io.BytesIO()
        both.save(out, 'PNG')
        save(out.getvalue(), 'paths')
        ctx.close()

    # ---------- Phone ----------
    if want('phone'):
        ctx = b.new_context(**PHONE, locale='de-DE')
        ctx.add_init_script(init % 'de')
        page = boot(ctx, '?seed=11&fog=off&quality=high&players=2')
        settle(page, ticks=900, dist=24, pitch=0.8, yaw=0.9, wait=5000)
        page.evaluate("() => window.__kronland.focusHeadquarters()")
        page.wait_for_timeout(3000)
        save(shoot(page), 'phone', size=(824, 1830))
        ctx.close()
    b.close()


if __name__ == '__main__':
    with sync_playwright() as pw:
        run(pw)
