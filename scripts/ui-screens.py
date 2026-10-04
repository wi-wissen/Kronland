#!/usr/bin/env python3
"""Screenshots of the UI for the design review (not part of the tests).

Usage (preview server must be running, e.g. `npx vite preview --port 4211`):
    python3 scripts/ui-screens.py [base-url] [filter]
Output: review/ui-<view>-<device>-<language>.png
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4211'
FILTER = sys.argv[2] if len(sys.argv) > 2 else ''
OUT = Path(__file__).resolve().parent.parent / 'review'
OUT.mkdir(exist_ok=True)
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
DEVICES = {
    'desk': dict(viewport={'width': 1280, 'height': 800}, device_scale_factor=1),
    'port': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
    'land': dict(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True),
}

SETUP_BUILDING = """() => {
  const e = window.__kronland, s = e.sim, p = s.players[0];
  ['education','construction','alchemy','conscription','trade','gears'].forEach(t => p.techs.add(t));
  const hq = s.findBuilding(0, 'headquarters');
  hq.level = 1;
  const pos = s.findPlacement(0, 'university', hq.x + 3, hq.y + 8, 30);
  const u = s.createBuilding(0, 'university', pos.x, pos.y, true);
  u.research = { tech: 'alloys', progress: 300 };
  e.selected.clear(); e.selected.add(u.id); e.emitUi();
}"""
SETUP_ARMY = """() => {
  const e = window.__kronland, s = e.sim;
  const hq = s.findBuilding(0, 'headquarters');
  const L1 = s.spawnLeader(0, 'sword2', hq.x + 7, hq.y + 2, 3);
  const L2 = s.spawnLeader(0, 'bow1', hq.x + 7, hq.y + 4, 4);
  const L3 = s.spawnLeader(0, 'bow1', hq.x + 8, hq.y + 5, 4);
  e.selected.clear();
  for (const x of s.entities.values()) if (x.kind === 'hero' && x.owner === 0) { e.selected.add(x.id); x.ready.whirl = s.tick + 700; }
  [L1, L2, L3].forEach(l => e.selected.add(l.id));
  e.focusSelection(); e.emitUi();
  e.toast('toast.attackBuilding', { building: 'residence', level: 0 }, { icon: 'attack', tone: 'bad', pos: { x: hq.x, y: hq.y }, ttl: 60000 });
  e.toast('toast.buildingDone', { building: 'farm', level: 0 }, { icon: 'b-farm', tone: 'good', pos: { x: hq.x, y: hq.y }, ttl: 60000 });
}"""
SETUP_RECRUIT = """() => {
  const e = window.__kronland, s = e.sim, p = s.players[0];
  p.techs.add('conscription'); p.stock.iron = 500;
  const hq = s.findBuilding(0, 'headquarters');
  const pos = s.findPlacement(0, 'barracks', hq.x + 3, hq.y + 8, 30);
  const b = s.createBuilding(0, 'barracks', pos.x, pos.y, true);
  e.selected.clear(); e.selected.add(b.id); e.renderer.rig.lookAt(b.x + 2, b.y + 2); e.emitUi();
}"""


def wait_game(page):
    page.wait_for_function('() => !!window.__kronland && !!document.querySelector("[data-testid=topbar]")', timeout=180000)
    page.wait_for_timeout(2500)


def shot(page, name, dev, lang):
    if FILTER and FILTER not in name:
        return
    p = OUT / f'ui-{name}-{dev}-{lang}.png'
    page.screenshot(path=str(p))
    print('saved', p.name, flush=True)


def run(pw, dev, lang):
    browser = pw.chromium.launch(args=GL)
    ctx = browser.new_context(**DEVICES[dev], locale='de-DE' if lang == 'de' else 'en-GB')
    ctx.add_init_script(f"try {{ localStorage.setItem('kronland-lang', '{lang}'); localStorage.setItem('kronland.quality','low'); }} catch (e) {{}}")
    page = ctx.new_page()
    page.set_default_timeout(180000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    touch = dev != 'desk'

    def want(n):
        return not FILTER or FILTER in n

    if want('start') or want('settings') or want('campaign'):
        page.goto(BASE + '/play/')
        page.wait_for_selector('[data-testid=start-menu]')
        page.wait_for_timeout(400)
        shot(page, 'start', dev, lang)
        if want('settings'):
            page.click('[data-testid=menu-settings]')
            page.wait_for_timeout(300)
            shot(page, 'settings', dev, lang)
            page.click('[data-testid=settings-done]')
        if want('campaign'):
            page.click('[data-testid=menu-campaign]')
            page.wait_for_selector('[data-testid=briefing]')
            page.wait_for_timeout(300)
            shot(page, 'campaign', dev, lang)

    if want('hud') or want('build') or want('uni') or want('army') or want('gmenu') or want('recruit') or want('hq') or want('victory'):
        page.goto(BASE + '/play/?seed=42')
        wait_game(page)
        shot(page, 'hud', dev, lang)
        page.click('[data-testid=quick-all]')
        page.wait_for_timeout(400)
        if touch:
            page.click('[data-testid=build-toggle]')
            page.wait_for_timeout(300)
        shot(page, 'build', dev, lang)
        if want('build'):
            page.click('[data-testid=build-cat-refine]')
            page.wait_for_timeout(300)
            shot(page, 'build-refine', dev, lang)
        page.evaluate("() => { const e = window.__kronland; e.focusHeadquarters(); }")
        page.wait_for_timeout(600)
        shot(page, 'hq', dev, lang)
        page.evaluate(SETUP_BUILDING)
        page.wait_for_timeout(700)
        shot(page, 'uni', dev, lang)
        page.evaluate(SETUP_RECRUIT)
        page.wait_for_timeout(700)
        shot(page, 'recruit', dev, lang)
        page.evaluate(SETUP_ARMY)
        page.wait_for_timeout(900)
        shot(page, 'army', dev, lang)
        page.click('[data-testid=menu]')
        page.wait_for_timeout(400)
        shot(page, 'gmenu', dev, lang)
        page.click('[data-testid=resume]')
        page.evaluate("() => { const e = window.__kronland; e.sim.winner = e.sim.players[0].team; e.clearSelection(); }")
        page.wait_for_timeout(600)
        shot(page, 'victory', dev, lang)

    if want('tutorial') or want('mission'):
        page.goto(BASE + '/play/?mission=tutorial')
        wait_game(page)
        page.click('[data-testid=tutorial-next]')
        page.wait_for_timeout(500)
        page.click('[data-testid=tutorial-next]')
        page.wait_for_timeout(1200)
        shot(page, 'tutorial', dev, lang)
        page.goto(BASE + '/play/?mission=c1')
        wait_game(page)
        page.wait_for_timeout(1000)
        shot(page, 'mission', dev, lang)
        page.evaluate("() => { const e = window.__kronland; e.sim.mission.finish(e.sim, true, 'objectives'); e.emitUi(); }")
        page.wait_for_timeout(600)
        shot(page, 'mission-result', dev, lang)

    if errors:
        print('PAGE ERRORS', dev, lang, errors[:5], flush=True)
    browser.close()


with sync_playwright() as pw:
    devs = [d for d in DEVICES if len(sys.argv) <= 3 or d in sys.argv[3].split(',')]
    langs = sys.argv[4].split(',') if len(sys.argv) > 4 else ['de', 'en']
    for dev in devs:
        for lang in langs:
            run(pw, dev, lang)
