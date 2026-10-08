import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';
import { quick } from './quick.js';

// UI: language, settings, build menu categories, minimap, notices.

// Software rendering (swiftshader) is slow: wait generously for simulation sequences
const SLOW = { timeout: 20_000 };

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-ui-init')) {
      localStorage.removeItem('kronland-lang');
      localStorage.removeItem('kronland-settings');
      sessionStorage.setItem('e2e-ui-init', '1');
    }
  });
  return errors;
}

async function bootGame(page, url = playUrl('?seed=42')) {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
}

test('Switch language in the start menu: texts change at once and stay saved', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await expect(page.getByTestId('start')).toHaveText('Neues Spiel starten');
  await page.getByTestId('menu-lang-en').click();
  await expect(page.getByTestId('start')).toHaveText('Start new game');
  await expect(page.getByTestId('menu-campaign')).toContainText('Campaign');
  expect(await page.evaluate(() => localStorage.getItem('kronland-lang'))).toBe('en');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await page.reload();
  await expect(page.getByTestId('start')).toHaveText('Start new game');
  // In game: building names and rejection reasons in English
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__kronland);
  await quick(page, 'all');
  await expect(page.getByTestId('build-residence')).toContainText('Residence');
  await page.evaluate(() => { const e = window.__kronland; e.toast('err.popLimit', null, { ttl: 20000 }); });
  await expect(page.getByTestId('toasts')).toContainText('Population limit reached', SLOW);
  expect(errors).toEqual([]);
});

test('Settings are saved and offered in the game', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await page.getByTestId('vol-music').fill('30');
  await page.getByTestId('edge-scroll').click();
  await expect(page.getByTestId('edge-scroll')).toHaveAttribute('aria-checked', 'false');
  // "Niedrig": higher levels make software rendering unnecessarily slow in the test
  await page.getByTestId('quality-low').click();
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('settings-done')).toHaveText('Done');
  await page.getByTestId('settings-done').click();
  const saved = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('kronland-settings')), q: localStorage.getItem('kronland.quality'), l: localStorage.getItem('kronland-lang') }));
  expect(saved.s.music).toBeCloseTo(0.3);
  expect(saved.s.edgeScroll).toBe(false);
  expect(saved.q).toBe('low');
  expect(saved.l).toBe('en');
  // Same after reloading
  await page.reload();
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('vol-music')).toHaveValue('30');
  await expect(page.getByTestId('quality-low')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings-done').click();
  // Reachable in the game menu
  await bootGame(page);
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('edge-scroll')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('lang-de').click();
  await page.getByTestId('gmenu-back').click();
  await expect(page.getByTestId('resume')).toHaveText('Weiterspielen');
  expect(errors).toEqual([]);
});

test('Build menu: all groups reachable (side by side or as tabs), tiles labelled, locked ones with reason', async ({ page, isMobile }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await quick(page, 'all');
  await expect(page.getByTestId('build-residence')).toBeVisible();
  // Every group is reachable (wide: all at once, otherwise one tab each), every tile carries its name
  const tabs = (await page.getByTestId('build-menu').getAttribute('data-layout')) === 'tabs';
  for (const g of ['home', 'raw', 'refine', 'military', 'admin']) await expect(page.getByTestId((tabs ? 'build-tab-' : 'build-group-') + g)).toHaveCount(1);
  await expect(page.getByTestId('build-residence').locator('.bm-name')).toHaveText('Wohnhaus');
  if (tabs) await page.getByTestId('build-tab-raw').click();
  await expect(page.getByTestId('build-clayMine')).toHaveCount(1);
  if (tabs) await page.getByTestId('build-tab-military').click();
  const barracks = page.getByTestId('build-barracks');
  await expect(barracks).toBeInViewport();
  await expect(barracks).toHaveAttribute('aria-disabled', 'true');
  await expect(barracks).toHaveAttribute('aria-label', /Wehrpflicht/);
  // Locked: click starts no placement
  await barracks.click({ force: true });
  expect(await page.evaluate(() => window.__kronland.placing)).toBeNull();
  // Desktop: info strip shows costs or reason of the hovered building
  if (!isMobile) {
    await barracks.hover();
    await expect(page.getByTestId('build-info')).toContainText('Wehrpflicht');
    if (tabs) await page.getByTestId('build-tab-home').click();
    await page.getByTestId('build-farm').hover();
    await expect(page.getByTestId('build-info')).toContainText('Bauernhof');
  }
  expect(errors).toEqual([]);
});

test('Minimap: click moves the camera', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  if (!(await page.getByTestId('minimap-canvas').isVisible())) await page.getByTestId('minimap-toggle').click();
  const canvas = page.getByTestId('minimap-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  const box = await canvas.boundingBox();
  // Tap the opposite corner of the map
  const tx = before.x < 64 ? 0.85 : 0.15, ty = before.z < 64 ? 0.85 : 0.15;
  await canvas.click({ position: { x: box.width * tx, y: box.height * ty } });
  const after = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(20);
  const size = await page.evaluate(() => window.__kronland.sim.map.width);
  expect(Math.abs(after.x - size * tx)).toBeLessThan(size * 0.12);
  expect(errors).toEqual([]);
});

test('Notice with a location jumps there on click', async ({ page, isMobile }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await page.evaluate(() => {
    const e = window.__kronland;
    e.toast('toast.attackBuilding', { building: 'residence', level: 0 }, { icon: 'attack', tone: 'bad', pos: { x: 10, y: 12 }, ttl: 30000 });
  });
  const t = page.getByTestId('toast').filter({ hasText: 'Angriff auf Wohnhaus!' });
  await expect(t).toBeVisible(SLOW);
  await t.click();
  await expect(t).toHaveCount(0);
  // Location lies visibly in the free picture area (desktop: picture centre; mobile: above the context panel)
  const v = await visibleSpot(page, 10, 12);
  expect(v.inside, JSON.stringify(v)).toBe(true);
  if (!isMobile) { expect(Math.round(v.target.x)).toBe(10); expect(Math.round(v.target.z)).toBe(12); }
  expect(errors).toEqual([]);
});

/** Where does the ground point (x,z) appear - in the free area between top bar and command bar? */
async function visibleSpot(page, x, z) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(([x, z]) => {
    const e = window.__kronland, r = e.renderer;
    r.rig.update(0); r.camera.updateMatrixWorld();
    const p = r.project(x, r.terrain.heightAt(x, z), z);
    const rect = e.canvas.getBoundingClientRect();
    const { top, bottom } = e.hudInsets();
    const panel = document.querySelector('[data-testid="context-panel"]')?.getBoundingClientRect();
    const free = Math.min(rect.bottom - bottom, panel ? panel.top : Infinity);
    return { x: p.x, y: p.y, top, free, target: { ...r.rig.target }, inside: !p.behind && p.x > rect.left && p.x < rect.right && p.y > rect.top && p.y < free };
  }, [x, z]);
}

test('Portrait: camera jump to the castle puts it above the open panel', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile portrait only');
  const errors = await fresh(page);
  await bootGame(page);
  // Move the camera away, then "Burg": castle gets selected, its panel opens
  await page.evaluate(() => window.__kronland.renderer.rig.lookAt(60, 60));
  await quick(page, 'hq');
  await expect(page.getByTestId('context-panel')).toBeVisible();
  const hq = await page.evaluate(() => { const b = window.__kronland.sim.findBuilding(0, 'headquarters'); return { x: b.x + b.w / 2, z: b.y + b.h / 2 }; });
  await page.waitForTimeout(300);
  const v = await visibleSpot(page, hq.x, hq.z);
  expect(v.inside, JSON.stringify(v)).toBe(true);
  expect(errors).toEqual([]);
});

test('Graphics level in a running game takes effect at once', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  const before = await page.evaluate(() => {
    const r = window.__kronland.renderer;
    return { tier: r.quality.tier, ratio: r.renderer.getPixelRatio(), shadows: r.renderer.shadowMap.enabled, scatter: r.scatter.reduce((n, c) => n + c.count, 0) };
  });
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  const other = before.tier === 'medium' ? 'high' : 'medium';
  await page.getByTestId('quality-' + other).click();
  const after = await page.evaluate(() => {
    const r = window.__kronland.renderer;
    return { tier: r.quality.tier, ratio: r.renderer.getPixelRatio(), shadows: r.renderer.shadowMap.enabled, scatter: r.scatter.reduce((n, c) => n + c.count, 0), later: r.pendingQuality };
  });
  expect(after.tier).toBe(other);
  expect(after.shadows).toBe(true);
  expect(after.scatter).toBeGreaterThan(before.scatter);
  expect(after.later).toEqual(expect.arrayContaining(['textureSize']));
  // Back to "Niedrig" (software rendering in the test)
  await page.getByTestId('quality-low').click();
  const low = await page.evaluate(() => ({ tier: window.__kronland.renderer.quality.tier, scatter: window.__kronland.renderer.scatter.reduce((n, c) => n + c.count, 0) }));
  expect(low.tier).toBe('low');
  expect(low.scatter).toBeLessThan(after.scatter);
  await page.getByTestId('gmenu-back').click();
  // Game keeps running and draws without errors
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('Rejected commands show translated reasons', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await page.evaluate(() => { const e = window.__kronland; e.sim.players[0].stock.gold = 0; e.buySerf(1); });
  await expect(page.getByTestId('toasts')).toContainText('Nicht genug Taler', SLOW);
  expect(errors).toEqual([]);
});

test('Minimap: right click or tap sends selected figures there', async ({ page, isMobile }) => {
  const errors = await fresh(page);
  await bootGame(page);
  if (!(await page.getByTestId('minimap-canvas').isVisible())) await page.getByTestId('minimap-toggle').click();
  const canvas = page.getByTestId('minimap-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(500);
  const serf = await page.evaluate(() => {
    const e = window.__kronland;
    const u = [...e.sim.entities.values()].find((x) => x.kind === 'unit' && x.owner === e.player && !x.militia);
    e.selected.clear(); e.selected.add(u.id); e.emitUi();
    window.__mmCmds = [];
    const issue = e.issue.bind(e);
    e.issue = (cmd) => { window.__mmCmds.push(cmd); issue(cmd); };
    return u.id;
  });
  const before = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  const box = await canvas.boundingBox();
  const pos = { x: box.width * 0.5, y: box.height * 0.5 };
  if (isMobile) await canvas.tap({ position: pos });
  else await canvas.click({ position: pos, button: 'right' });
  const cmds = await page.evaluate(() => window.__mmCmds);
  const size = await page.evaluate(() => window.__kronland.sim.map.width);
  expect(cmds.length).toBe(1);
  expect(cmds[0].type).toBe('move');
  expect(cmds[0].units).toEqual([serf]);
  expect(Math.abs(cmds[0].x - size / 2)).toBeLessThan(size * 0.12);
  // Camera stays, feedback is at the target
  const after = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.5);
  await expect(canvas).toHaveAttribute('data-order', `${cmds[0].x},${cmds[0].y}`);
  if (!isMobile) await page.screenshot({ path: 'test-results/minimap-order-desktop.png' });
  else await page.screenshot({ path: 'test-results/minimap-order-mobile.png' });
  expect(errors).toEqual([]);
});

test('Construction site shows a progress bar', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  const site = await page.evaluate(() => {
    const e = window.__kronland, sim = e.sim;
    const hq = sim.findBuilding(e.player, 'headquarters');
    const serfs = [...sim.entities.values()].filter((x) => x.kind === 'unit' && x.owner === e.player).map((x) => x.id);
    for (let r = 4; r < 16; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = hq.x + dx, y = hq.y + dy;
      if (sim.checkPlacement(e.player, 'residence', x, y) === null) {
        e.issue({ type: 'placeBuilding', building: 'residence', x, y, units: serfs });
        e.focusPoint(x + 1, y + 1);
        return { x, y };
      }
    }
    return null;
  });
  expect(site).not.toBeNull();
  // Bar of kind 1 (construction progress) is drawn and grows
  const progressBar = () => page.evaluate(() => {
    const b = window.__kronland.renderer.bars;
    for (let i = 0; i < b.n; i++) if (b.aSize.getZ(i) === 1) return b.aPos.getW(i);
    return -1;
  });
  await expect.poll(progressBar, SLOW).toBeGreaterThanOrEqual(0);
  await expect.poll(progressBar, { timeout: 60_000 }).toBeGreaterThan(0.05);
  await page.screenshot({ path: `test-results/build-beams-${test.info().project.name}.png` });
  expect(errors).toEqual([]);
});

test('Campfire appears where houses are missing and goes out with house and farm', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await page.evaluate(() => {
    const e = window.__kronland, sim = e.sim, hq = sim.findBuilding(e.player, 'headquarters');
    const pl = sim.players[e.player];
    pl.raw.stone = 100000;
    // Place a stonemason hut without research (only for the test)
    pl.techs.add('gears');
    const p = sim.findPlacement(e.player, 'stonemason', hq.x + 2, hq.y + 2, 30);
    sim.createBuilding(e.player, 'stonemason', p.x, p.y, true);
    e.focusPoint(p.x + 1, p.y + 1);
    // Fast-forward instead of real time: under software WebGL the game manages only a few ticks per second
    // (fire after ~25 s of game time). The simulation needs the same number of ticks without graphics.
    e.paused = true;
    const lit = () => [...sim.entities.values()].some((x) => x.kind === 'camp' && x.owner === e.player);
    for (let i = 0; i < 3000 && !lit(); i++) e.stepOnce();
    e.paused = false;
  });
  const camp = () => page.evaluate(() => {
    const e = window.__kronland;
    const f = [...e.sim.entities.values()].find((x) => x.kind === 'camp' && x.owner === e.player);
    return f ? { id: f.id, drawn: !!e.renderer.camps?.get(f.id), mm: e.minimapDynamic().camps.length } : null;
  });
  await expect.poll(camp, SLOW).not.toBeNull();
  await expect.poll(async () => (await camp())?.drawn, SLOW).toBe(true);
  expect((await camp()).mm).toBe(1);
  await expect(page.getByTestId('toast').filter({ hasText: 'Lagerfeuer' })).toBeVisible(SLOW);
  await page.evaluate(() => { const e = window.__kronland; e.focusPoint(...(() => { const f = [...e.sim.entities.values()].find((x) => x.kind === 'camp'); return [f.x + 0.5, f.y + 0.5]; })()); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `test-results/campfire-${test.info().project.name}.png` });
  // House and farm: fire goes out and disappears from the rendering
  await page.evaluate(() => {
    const e = window.__kronland, sim = e.sim, hq = sim.findBuilding(e.player, 'headquarters');
    for (const t of ['residence', 'farm']) { const p = sim.findPlacement(e.player, t, hq.x + 2, hq.y + 2, 30); sim.createBuilding(e.player, t, p.x, p.y, true); }
    e.paused = true;
    const lit = () => [...sim.entities.values()].some((x) => x.kind === 'camp' && x.owner === e.player);
    for (let i = 0; i < 3000 && lit(); i++) e.stepOnce();
    e.paused = false;
  });
  await expect.poll(camp, SLOW).toBeNull();
  // The rendering cleans up in the next frame
  await expect.poll(() => page.evaluate(() => window.__kronland.renderer.camps?.size ?? 0), SLOW).toBe(0);
  expect(errors).toEqual([]);
});
