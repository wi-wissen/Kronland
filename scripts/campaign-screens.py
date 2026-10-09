#!/usr/bin/env python3
"""Take the pictures of docs/KAMPAGNE.md (docs/images/campaign/<name>-desktop.webp and -phone.webp) from the running game.

Usage (preview server with a current build, like scripts/site-screens.py):
    python3 scripts/campaign-screens.py [base-url] [filter]
Desktop 1440×900, phone like the E2E project "mobile" (Pixel 7, 412×839, stored at half the device pixels).
Filter e.g. `c3,start` or `phone`. Uses the helpers of site-screens.py (frozen frame, wait for figure models).
"""
import importlib.util
import io
import os
import sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location('site_screens', ROOT / 'scripts' / 'site-screens.py')
S = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S)

BASE = S.BASE
FILTER = S.FILTER
OUT = ROOT / 'docs' / 'images' / 'campaign'
OUT.mkdir(parents=True, exist_ok=True)
DESK = dict(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
PHONE = dict(viewport={'width': 412, 'height': 839}, device_scale_factor=2.625, is_mobile=True, has_touch=True)
INIT = ("try { localStorage.setItem('kronland-lang', 'de'); localStorage.setItem('kronland-settings', JSON.stringify({ edgeScroll: false }));"
        " localStorage.removeItem('kronland-campaign-1'); } catch (e) {}"
        # Dialogue lines advance on wall-clock timers: window.__hold keeps them (and every other timeout) waiting
        "const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st(function g() {"
        " if (window.__hold) return st(g, 300); return typeof fn === 'function' ? fn(...a) : undefined; }, ms);")

# Point the camera at a place of the level and reveal it (like lookAt in e2e/missions.spec.js)
LOOK = """([ref, dist, pitch]) => {
  const e = window.__kronland, p = e.sim.mission.pointOf(e.sim, ref), r = e.renderer.rig;
  e.camFly = null; e.dialogCam = null; // no dialogue camera moving it away again
  e.sim.mission.script.apis.mission.natives.reveal({}, [ref], { radius: 34, seconds: 120 });
  for (let i = 0; i < 6; i++) e.stepOnce();
  r.lookAt(p.x, p.y); if (dist) r.dist = dist; if (pitch) r.pitch = pitch; r.update(0);
}"""
ELDER_VIEW = """() => { const e = window.__kronland, npc = e.sim.entities.get(e.sim.mission.state.npcs.elder.entity), r = e.renderer.rig;
  e.camFly = null; e.dialogCam = null;
  r.lookAt(npc.px / 1000, npc.py / 1000 + 1); r.dist = 15; r.update(0); return [npc.px / 1000, npc.py / 1000]; }"""
HERO = "(h) => [...window.__kronland.sim.entities.values()].find((x) => x.kind === 'hero' && x.hero === h && x.owner === 0)"


def want(name, dev):
    return not FILTER or any(f and f in f'{name}-{dev}' for f in FILTER.split(','))


def save(png, name, dev):
    im = Image.open(io.BytesIO(png)).convert('RGB')
    if dev == 'phone':
        im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    im.save(OUT / f'{name}-{dev}.webp', 'WEBP', quality=78, method=6)
    print('saved', f'{name}-{dev}', im.size, flush=True)


def mission(ctx, mid):
    page = ctx.new_page()
    page.set_default_timeout(240000)
    page.on('pageerror', lambda e: print('pageerror', e, flush=True))
    page.goto(f'{BASE}/play/?mission={mid}&quality=high')
    page.wait_for_function(f"() => window.__kronland?.sim.mission?.state.id === '{mid}' && window.__kronland.renderer.frameNo > 2", timeout=240000, polling=500)
    page.wait_for_timeout(3000)
    return page


def objectives(page):
    """Unfold the objectives list (collapsed at first on phones)."""
    page.get_by_test_id('objectives').wait_for()
    if page.get_by_test_id('objectives-toggle').get_attribute('aria-expanded') != 'true':
        page.get_by_test_id('objectives-toggle').click()
        page.wait_for_timeout(800)


def close_objectives(page, dev):
    """Phones: the unfolded list is a sheet over the game; close it for the view of the scene."""
    if dev == 'phone' and page.get_by_test_id('objectives-close').is_visible():
        page.get_by_test_id('objectives-close').click()
        page.wait_for_timeout(800)


def look(page, args):
    """Hold the game and its dialogue timers, then point the camera (twice: a dialogue camera may still be under way)."""
    page.evaluate("() => { window.__hold = true; window.__kronland.paused = true; }")
    for _ in range(2):
        page.evaluate(LOOK, args)
        page.wait_for_timeout(2000)


def start_heroes(page, dev):
    page.goto(f'{BASE}/play/')
    page.get_by_test_id('start-menu').wait_for()
    page.get_by_test_id('hero-pick-nelia').scroll_into_view_if_needed()
    page.wait_for_timeout(2000)
    return page.screenshot(type='png')


def c1_square(ctx, dev):
    page = mission(ctx, 'c1')
    # Orrin calls from the square (second line of the arrival); pause there so the line stays
    page.wait_for_function("() => document.querySelector('[data-testid=dialog-speaker]')?.textContent.includes('Orrin')", timeout=300000, polling=200)
    page.evaluate("() => { window.__hold = true; window.__kronland.paused = true; }")
    if dev == 'desktop':
        objectives(page)
    return page, S.shoot(page)


def c1_elder(ctx, dev):
    page = mission(ctx, 'c1')
    skip = "() => window.__kronland?.skipDialog(true)"
    # Nelia meets Orrin and finds the shard at the old tree (walks shortened as in e2e/missions.spec.js)
    page.evaluate("(h) => { const e = window.__kronland, st = e.sim.mission.state, n = (" + HERO + ")('nelia'); const o = e.sim.entities.get(st.npcs.stranger.entity);"
                  " n.px = o.px + 1000; n.py = o.py; n.path = []; e.issue({ type: 'order', units: [n.id], order: 'talk', target: o.id }); }")
    page.wait_for_function("() => { window.__kronland.skipDialog(true); return !!(" + HERO + ")('orrin'); }", timeout=300000, polling=1000)
    page.evaluate("() => { const e = window.__kronland, n = (" + HERO + ")('nelia'), r = e.sim.mission.script.places.oldRoot; n.px = r.x * 1000 + 500; n.py = r.y * 1000 + 1500; n.path = []; }")
    page.wait_for_function("() => { window.__kronland.skipDialog(true); return !!window.__kronland.sim.mission.state.npcs.elder; }", timeout=300000, polling=1000)
    for _ in range(20):
        page.evaluate(skip)
        page.wait_for_timeout(500)
    page.evaluate(skip)
    page.evaluate("() => { window.__kronland.paused = true; }")
    if dev == 'desktop':
        objectives(page)
    # the village next door, revealed for the picture; camera on the elder (twice: a dialogue may still move it)
    page.evaluate(LOOK, ['villageArea', 16])
    for _ in range(2):
        page.wait_for_timeout(2000)
        print('elder at', page.evaluate(ELDER_VIEW), flush=True)
    return page, S.shoot(page)


def c2_unlocks(ctx, dev):
    page = mission(ctx, 'c2')
    if not page.get_by_test_id('quick-all').is_visible():
        page.get_by_test_id('minimap-toggle').click()
    page.get_by_test_id('quick-all').click()
    page.get_by_test_id('build-farm').wait_for()
    page.get_by_test_id('ui-pointer').wait_for()
    locked = page.locator('[data-testid^=build-].locked')
    if dev == 'desktop' and locked.count() and locked.first.is_visible():
        # tooltip of a locked building in the open tab: "In dieser Mission nicht verfügbar"
        locked.first.hover()
    page.wait_for_timeout(2500)
    return page, S.shoot(page)


def c4_offers(ctx, dev):
    page = mission(ctx, 'c4')
    page.get_by_test_id('tributes').wait_for()
    if not page.get_by_test_id('tribute-mercs').is_visible():
        page.get_by_test_id('tributes-toggle').click()
    page.get_by_test_id('tribute-mercs').wait_for()
    page.wait_for_timeout(2000)
    return page, S.shoot(page)


def c3_gorge(ctx, dev):
    page = mission(ctx, 'c3')
    objectives(page)
    page.get_by_test_id('objective-works').wait_for()
    close_objectives(page, dev)
    look(page, ['gorge', 30])
    return page, S.shoot(page)


def c3_thaw(ctx, dev):
    page = mission(ctx, 'c3')
    page.evaluate("() => { const e = window.__kronland, h = e.sim.mission.script; h.takeOut(e.sim.entities.get(h.vms.mission.globals.get('works').id)); }")
    objectives(page)
    page.get_by_test_id('objective-escape').wait_for()
    look(page, ['isle', 28])
    return page, S.shoot(page)


def c6_plant(ctx, dev):
    page = mission(ctx, 'c6')
    # Malvor's greeting would cover the objectives (with its progress bar): skip the conversation first
    for _ in range(8):
        page.evaluate("() => window.__kronland.skipDialog(true)")
        page.wait_for_timeout(700)
    objectives(page)
    page.get_by_test_id('objective-malvorPlant').wait_for()
    look(page, ["worksIsle", 16, 1.45])  # steep: the island trees hide the plant from the side
    # centre on the plant itself (the place is the middle of the wooded island)
    print('plant', page.evaluate("() => { const e = window.__kronland, s = e.sim, b = s.entities.get(s.mission.script.vms.mission.globals.get('malvor_plant').id), r = e.renderer.rig;"
                                 " e.camFly = null; e.dialogCam = null; r.lookAt(b.x + b.w / 2, b.y + b.h / 2); r.update(0); return [b.x, b.y, r.target.x, r.target.z, r.pitch, r.dist]; }"), flush=True)
    # a late line of Malvor squeezes the objectives: close it and unfold them again
    for _ in range(3):
        if page.get_by_test_id('dialog-close').is_visible():
            page.get_by_test_id('dialog-close').click(force=True, timeout=15000)  # the box keeps animating
            page.wait_for_timeout(1000)
    objectives(page)
    page.wait_for_timeout(2000)
    return page, S.shoot(page)


SCENES = [('start-heroes', None), ('c1-square', c1_square), ('c1-elder', c1_elder), ('c2-unlocks', c2_unlocks),
          ('c4-offers', c4_offers), ('c3-gorge', c3_gorge), ('c3-thaw', c3_thaw), ('c6-plant', c6_plant)]


def run(pw):
    b = pw.chromium.launch(args=S.GL, executable_path=os.environ.get('PW_CHROMIUM') or None)
    for dev, opts in (('desktop', DESK), ('phone', PHONE)):
        for name, fn in SCENES:
            if not want(name, dev):
                continue
            for attempt in range(2):
                ctx = b.new_context(**opts, locale='de-DE')
                ctx.add_init_script(INIT)
                try:
                    if fn is None:
                        page = ctx.new_page()
                        page.set_default_timeout(120000)
                        png = start_heroes(page, dev)
                    else:
                        _, png = fn(ctx, dev)
                    save(png, name, dev)
                    break
                except Exception as e:  # SwiftShader on a busy machine: one more try
                    print('failed', name, dev, attempt, repr(e)[:300], flush=True)
                finally:
                    ctx.close()
    b.close()


if __name__ == '__main__':
    with sync_playwright() as pw:
        run(pw)
