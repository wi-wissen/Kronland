import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Bridges and ornaments (taken over from the extensions): start menu without extension switch, build a bridge at a
// bridge site, fountain/monument in the build menu, bridges in the walkability grid of the dev mode.

const SHOTS = process.env.E2E_SHOTS;

/** Screenshot for the docs (only with E2E_SHOTS=<folder>); desktop 1440×900, mobile with suffix "-mobile". */
async function shot(page, testInfo, name) {
  if (!SHOTS) return;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${SHOTS}/bridges-${name}${testInfo.project.name === 'mobile' ? '-mobile' : ''}.png` });
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

test('Start menu: no extension switch, the four heroes selectable', async ({ page }) => {
  await page.goto(playUrl(''));
  await expect(page.getByTestId('start-menu')).toBeVisible();
  await expect(page.getByTestId('addon-on')).toHaveCount(0);
  await expect(page.getByTestId('addon-off')).toHaveCount(0);
  for (const h of ['nelia', 'orrin', 'taran', 'malvor']) await expect(page.getByTestId(`hero-pick-${h}`)).toBeVisible();
  await expect(page.getByTestId('hero-pick-nelia')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('hero-pick-taran').click();
  await expect(page.getByTestId('hero-pick-taran')).toHaveAttribute('aria-pressed', 'true');
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

test('Build menu: fountain and monument present, no tavern; dev mode shows bridges in the walkability grid', async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const errors = await boot(page, '/?seed=42&dev=1&fog=off');
  await page.waitForFunction(() => !!window.__kronland.dev, null, { timeout: 60_000 });
  await expect(page.getByTestId('dev-panel')).toBeVisible({ timeout: 60_000 });
  const types = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    for (const u of s.entities.values()) if (u.kind === 'unit' && u.owner === 0) e.selected.add(u.id);
    e.emitUi();
    return e.uiState().buildOptions.map((b) => b.type);
  });
  expect(types).toEqual(expect.arrayContaining(['fountain', 'statue', 'bridge']));
  for (const gone of ['tavern', 'gunsmith']) expect(types).not.toContain(gone);
  // Walkability grid: legend knows bridges
  await page.getByTestId('dev-tab-grid').click();
  await page.getByTestId('dev-grid-walk').click();
  await expect(page.getByTestId('dev-grid-legend')).toContainText(/Brücke|bridge/);
  await shot(page, testInfo, 'devmode');
  expect(errors).toEqual([]);
});
