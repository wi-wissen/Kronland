import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Expansion content: start menu switch, recruit thief and scout at the tavern and use their
// abilities via the specialist panel, build a bridge at a bridge site.

const SHOTS = process.env.E2E_SHOTS;

/** Screenshot for the docs (only with E2E_SHOTS=<folder>); desktop 1440×900, mobile with suffix "-mobile". */
async function shot(page, testInfo, name) {
  if (!SHOTS) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${SHOTS}/addon-${name}${testInfo.project.name === 'mobile' ? '-mobil' : ''}.png` });
}

async function boot(page, url) {
  const errors = [];
  if (page.viewportSize()?.width >= 1000) await page.setViewportSize({ width: 1440, height: 900 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl(url));
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 60_000 });
  return errors;
}

/** Point the camera at a tile and return its screen position. */
async function screenAt(page, x, y) {
  return page.evaluate(([x, y]) => {
    const e = window.__kronland;
    e.renderer.rig.lookAt(x, y);
    e.renderer.rig.update(0);
    e.renderer.camera.updateMatrixWorld();
    const p = e.renderer.project(x, e.renderer.terrain.heightAt(x, y) + 0.5, y);
    return { x: p.x, y: p.y };
  }, [x, y]);
}

test('Start menu: expansion content always included, no switch; all heroes selectable', async ({ page }) => {
  await page.goto(playUrl(''));
  await expect(page.getByTestId('start-menu')).toBeVisible();
  await expect(page.getByTestId('addon-on')).toHaveCount(0);
  await expect(page.getByTestId('addon-off')).toHaveCount(0);
  await expect(page.getByTestId('hero-pick-falk')).toBeVisible();
  await page.getByTestId('hero-pick-morla').click();
  await expect(page.getByTestId('hero-pick-morla')).toHaveAttribute('aria-pressed', 'true');
});

test('Tavern: recruit thief and scout, steal, search resources, throw torch', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors = await boot(page, '/?seed=42&fog=off');
  // Place a finished tavern and select it
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    for (const r of Object.keys(s.players[0].stock)) s.players[0].stock[r] += 3000;
    const hq = s.findBuilding(0, 'headquarters');
    const pos = s.findPlacement(0, 'residence', hq.x + 2, hq.y + 8, 20);
    const t = s.createBuilding(0, 'tavern', pos.x, pos.y, true);
    e.selected.clear(); e.selected.add(t.id); e.emitUi();
    window.__tavern = t.id;
  });
  await expect(page.getByTestId('section-tavern')).toBeVisible();
  await page.getByTestId('action-tavern-thief').click();
  await page.getByTestId('action-tavern-scout').click();
  await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__kronland.stepOnce(); });
  await expect.poll(() => page.evaluate(() => [...window.__kronland.sim.entities.values()].filter((x) => x.kind === 'specialist' && x.owner === 0).map((x) => x.spec).sort().join(','))).toBe('scout,thief');

  // Select the thief: panel, steal mode, target enemy castle
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const th = [...s.entities.values()].find((x) => x.kind === 'specialist' && x.spec === 'thief' && x.owner === 0);
    const ehq = s.findBuilding(1, 'headquarters');
    // place close to the enemy castle (otherwise the walk takes too long in the test)
    th.px = (ehq.x + 2) * 1000 + 500; th.py = (ehq.y + ehq.h + 3) * 1000 + 500; th.path = [];
    e.selected.clear(); e.selected.add(th.id); e.emitUi();
    window.__thief = th.id;
  });
  await expect(page.getByTestId('specialist-panel')).toBeVisible();
  await expect(page.getByTestId('specialist-thief')).toBeVisible();
  await page.getByTestId('special-steal').click();
  await expect(page.getByTestId('specialist-mode')).toBeVisible();
  const hqPos = await page.evaluate(() => { const h = window.__kronland.sim.findBuilding(1, 'headquarters'); return { x: h.x + h.w / 2, y: h.y + h.h / 2 }; });
  const at = await screenAt(page, hqPos.x, hqPos.y);
  await page.evaluate(([x, y]) => { window.__kronland.commandAt(x, y); for (let i = 0; i < 2; i++) window.__kronland.stepOnce(); }, [at.x, at.y]);
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.entities.get(window.__thief)?.order.type)).toMatch(/steal|deliver/);
  // wait for the loot
  await page.evaluate(() => { const e = window.__kronland; for (let i = 0; i < 400 && !e.sim.entities.get(window.__thief)?.carry; i++) e.stepOnce(); e.emitUi(); });
  await expect(page.getByTestId('specialist-carry')).toBeVisible();
  await screenAt(page, hqPos.x, hqPos.y + 4);
  await shot(page, testInfo, 'thief');

  // Scout: search resources (instant) and torch (target mode, then ground)
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const sc = [...s.entities.values()].find((x) => x.kind === 'specialist' && x.spec === 'scout' && x.owner === 0);
    e.selected.clear(); e.selected.add(sc.id); e.emitUi();
    window.__scout = sc.id;
  });
  await expect(page.getByTestId('specialist-scout')).toBeVisible();
  await page.getByTestId('special-findResources').click();
  await expect.poll(() => page.evaluate(() => (window.__kronland.stepOnce(), (window.__kronland.sim.entities.get(window.__scout).ready.findResources ?? 0) > 0))).toBe(true);
  await page.getByTestId('special-torch').click();
  const sp = await page.evaluate(() => { const s = window.__kronland.sim.entities.get(window.__scout); return { x: s.px / 1000 + 3, y: s.py / 1000 }; });
  const at2 = await screenAt(page, sp.x, sp.y);
  await page.evaluate(([x, y]) => { window.__kronland.commandAt(x, y); window.__kronland.stepOnce(); }, [at2.x, at2.y]);
  await expect.poll(() => page.evaluate(() => [...window.__kronland.sim.entities.values()].some((x) => x.kind === 'torch'))).toBe(true);
  expect(errors).toEqual([]);
});

test('Build a bridge at a bridge site: walkable afterwards', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors = await boot(page, '/?seed=42&fog=off');
  const site = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    for (const r of Object.keys(s.players[0].stock)) s.players[0].stock[r] += 3000;
    s.players[0].techs.add('mathematics');
    // Select serfs: build menu with bridge
    for (const u of s.entities.values()) if (u.kind === 'unit' && u.owner === 0) e.selected.add(u.id);
    e.emitUi();
    return s.bridgeSites[0];
  });
  expect(site).toBeTruthy();
  const opt = await page.evaluate(() => window.__kronland.uiState().buildOptions.find((b) => b.type === 'bridge'));
  expect(opt?.reason ?? null).toBeNull();
  // Build preview over the site: snaps in and is valid
  await page.evaluate(() => window.__kronland.startPlacement('bridge'));
  const at = await screenAt(page, site.x + site.w / 2, site.y + site.h / 2);
  await page.evaluate(([x, y]) => { window.__kronland.hover(x, y); window.__kronland.emitUi(); }, [at.x, at.y]);
  const placing = await page.evaluate(() => ({ ...window.__kronland.placing }));
  expect([placing.x, placing.y, placing.w, placing.h, placing.valid]).toEqual([site.x, site.y, site.w, site.h, true]);
  await page.evaluate(() => { window.__kronland.confirmPlacement(); window.__kronland.stepOnce(); });
  const id = await page.evaluate(() => [...window.__kronland.sim.entities.values()].find((b) => b.kind === 'building' && b.type === 'bridge')?.id);
  expect(id).toBeTruthy();
  // finish building (fast-forward construction progress) and check walkability
  await page.evaluate((id) => {
    const e = window.__kronland, b = e.sim.entities.get(id);
    b.progress = b.work - 1;
    // put the builders on the bank in front of the bridge (otherwise the walk takes too long in the test)
    const end = b.w >= b.h ? { x: b.x - 1, y: b.y } : { x: b.x, y: b.y - 1 };
    for (const uid of b.builders) { const u = e.sim.entities.get(uid); u.px = end.x * 1000 + 500; u.py = end.y * 1000 + 500; u.path = []; }
    for (let i = 0; i < 300 && !b.done; i++) e.stepOnce();
  }, id);
  await expect.poll(() => page.evaluate((s) => window.__kronland.sim.map.walkable(s.x, s.y), site)).toBe(true);
  await expect.poll(() => page.evaluate((id) => window.__kronland.renderer.buildings.has(id), id)).toBe(true);
  // Bridge heads: reserved, the bank was not levelled
  const heads = await page.evaluate((s) => {
    const m = window.__kronland.sim.map, horiz = s.w >= s.h;
    const t = horiz ? [[s.x - 1, s.y], [s.x + s.w, s.y]] : [[s.x, s.y - 1], [s.x, s.y + s.h]];
    return t.map(([x, y]) => m.flags[m.idx(x, y)] & 4);
  }, site);
  expect(heads).toEqual([4, 4]);
  // send serfs onto the bridge and photograph
  await page.evaluate((s) => {
    const e = window.__kronland;
    e.selected.clear(); e.emitUi();
    const serfs = [...e.sim.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0).slice(0, 3);
    serfs.forEach((u, i) => { u.job = null; u.px = (s.x + (s.w >= s.h ? i + 1 : 0)) * 1000 + 500; u.py = (s.y + (s.w >= s.h ? 0 : i + 1)) * 1000 + 500; u.path = []; });
    e.stepOnce();
  }, site);
  await page.evaluate((s) => { const r = window.__kronland.renderer.rig; r.lookAt(s.x + s.w / 2, s.y + s.h / 2); r.dist = Math.min(r.dist, 16); r.update(0); }, site);
  await shot(page, testInfo, 'bridge');
  expect(errors).toEqual([]);
});

test('Developer mode: figure info for thief and scout, bridge in the walkability grid', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors = await boot(page, '/?seed=42&dev=1&fog=off');
  await page.waitForFunction(() => !!window.__kronland.dev, null, { timeout: 60_000 });
  await expect(page.getByTestId('dev-panel')).toBeVisible({ timeout: 60_000 });
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const hq = s.findBuilding(0, 'headquarters');
    const t = s.createBuilding(0, 'tavern', ...Object.values(s.findPlacement(0, 'residence', hq.x + 2, hq.y + 8, 20)), true);
    for (const r of Object.keys(s.players[0].stock)) s.players[0].stock[r] += 3000;
    e.issue({ type: 'recruitSpecial', building: t.id, spec: 'thief' });
    e.stepOnce(); e.stepOnce();
    const th = [...s.entities.values()].find((x) => x.kind === 'specialist' && x.owner === 0);
    e.selected.clear(); e.selected.add(th.id); e.emitUi();
  });
  await page.getByTestId('dev-tab-units').click();
  await expect(page.getByTestId('dev-figure')).toContainText(/Spezialist|Specialist/, { timeout: 30_000 });
  await expect(page.getByTestId('dev-figure')).toContainText('thief:idle');
  await shot(page, testInfo, 'devmode');
  // Walkability grid: legend knows bridges
  await page.getByTestId('dev-tab-grid').click();
  await page.getByTestId('dev-grid-walk').click();
  await expect(page.getByTestId('dev-grid-legend')).toContainText(/Brücke|bridge/);
  expect(errors).toEqual([]);
});
