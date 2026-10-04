import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Building on slopes: preview yellow (gets levelled) or red (too steep), after placing the terrain is flat.
const SHOTS = process.env.SHOT_DIR ?? '/tmp/claude-0/-home-claude/507a1adc-dbb4-5a8a-b008-6e4014dac886/scratchpad/shots2';

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  return errors;
}

/** Find a slope building spot (explored, allowed) or a steep slope near the castle and point the camera at it. */
async function findSite(page, steep) {
  return page.evaluate((steep) => {
    const e = window.__kronland, sim = e.sim, m = sim.map;
    const hq = sim.findBuilding(0, 'headquarters');
    const max = 400; // BALANCE.maxSlope
    let best = null, bd = Infinity;
    for (let y = 8; y < m.height - 12; y++) for (let x = 8; x < m.width - 12; x++) {
      if (!e.tileExplored(x + 1, y + 1) || !m.rectFree(x - 1, y - 1, 5, 5)) continue;
      const s = m.slope(x, y, 3, 3);
      const err = sim.checkPlacement(0, 'residence', x, y);
      const ok = steep ? err === 'err.tooSteep' : !err && s >= 250;
      if (!ok || (!steep && s > max)) continue;
      const d = (x - hq.x) ** 2 + (y - hq.y) ** 2;
      if (d < bd) { bd = d; best = { x, y, slope: s }; }
    }
    if (!best) return null;
    const cx = best.x + 1.5, cz = best.y + 1.5;
    e.renderer.rig.lookAt(cx, cz);
    e.renderer.rig.dist = 15;
    e.renderer.rig.pitch = 0.55; // flatter view so the slope is visible
    e.renderer.rig.update(0);
    e.renderer.camera.updateMatrixWorld();
    const s = e.renderer.project(cx, e.renderer.terrain.heightAt(cx, cz), cz);
    return { ...best, sx: s.x, sy: s.y };
  }, steep);
}

async function openResidence(page, mobile) {
  await page.getByRole('button', { name: 'Alle' }).click();
  if (mobile) await page.getByTestId('build-toggle').click();
  await page.getByTestId('build-residence').click();
}

async function hoverAt(page, mobile, p) {
  if (mobile) await page.touchscreen.tap(p.sx, p.sy);
  else await page.mouse.move(p.sx, p.sy);
}

test('Building on slopes: yellow preview, afterwards the ground is flat', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  test.setTimeout(300_000);
  const errors = await boot(page);
  const site = await findSite(page, false);
  expect(site).not.toBeNull();
  await page.waitForTimeout(400);
  const before = await page.evaluate((s) => window.__kronland.groundProbe(s.x, s.y, 3, 3), site);
  expect(before.simSlope).toBeGreaterThan(0);
  if (!mobile) await page.screenshot({ path: `${SHOTS}/slope-1-before.png` });

  await openResidence(page, mobile);
  await page.waitForTimeout(200);
  await hoverAt(page, mobile, site);
  // Preview: spot fits, terrain gets levelled (yellow)
  await expect(page.getByTestId('place-state')).toContainText('eingeebnet');
  const placing = await page.evaluate(() => { const p = window.__kronland.placing; return { x: p.x, y: p.y, state: p.slope?.state }; });
  expect(placing.state).toBe('level');
  if (!mobile) await page.screenshot({ path: `${SHOTS}/slope-2-preview-yellow.png` });

  if (mobile) await page.getByRole('button', { name: 'Hier bauen' }).click();
  else await page.mouse.click(site.sx, site.sy);
  await expect.poll(() => page.evaluate((p) => [...window.__kronland.sim.entities.values()]
    .some((e) => e.type === 'residence' && e.x === p.x && e.y === p.y), placing), { timeout: 60_000 }).toBe(true);
  // Simulation: area flat; rendering: mesh over the area flat and at the simulation's height
  await expect.poll(() => page.evaluate((p) => window.__kronland.groundProbe(p.x, p.y, 3, 3).meshSpread, placing), { timeout: 60_000 }).toBeLessThan(0.005);
  const after = await page.evaluate((p) => window.__kronland.groundProbe(p.x, p.y, 3, 3), placing);
  expect(after.simSlope).toBe(0);
  expect(Math.abs(after.meshY - after.simHeight / 360)).toBeLessThan(0.005);
  if (!mobile) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/slope-3-after.png` });
  }
  expect(errors).toEqual([]);
});

test('Steep slope: red preview with notice "zu steil"', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  test.setTimeout(300_000);
  await boot(page);
  const site = await findSite(page, true);
  test.skip(!site, 'no steep slope in the explored region');
  await openResidence(page, mobile);
  await page.waitForTimeout(200);
  await hoverAt(page, mobile, site);
  await expect(page.getByTestId('place-state')).toContainText('zu steil');
  expect(await page.evaluate(() => window.__kronland.placing.slope?.state)).toBe('steep');
  if (!mobile) await page.screenshot({ path: `${SHOTS}/slope-4-too-steep.png` });
});
