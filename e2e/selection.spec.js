import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Groups: walk targets fanned out, selection rings on slopes, tilting the camera.

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  return errors;
}

test.describe.configure({ timeout: 150_000 }); // software graphics: clicks and camera moves wait for frames

test('several serfs walk side by side, not on top of each other', async ({ page }, info) => {
  const errors = await boot(page);
  // select all serfs and send them next to the castle (right click or tap)
  const pos = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, m = s.map;
    const hq = s.findBuilding(0, 'headquarters');
    e.selected.clear();
    for (const u of s.entities.values()) if (u.kind === 'unit' && u.owner === 0) e.selected.add(u.id);
    e.emitUi();
    let k = -1;
    for (let r = 4; r < 12 && k < 0; r++) for (let dx = -r; dx <= r && k < 0; dx++) {
      const x = hq.x + 1 + dx, y = hq.y + hq.h + r;
      if (m.walkable(x, y) && !m.owner[m.idx(x, y)]) k = m.idx(x, y);
    }
    const x = (k % m.width) + 0.5, z = ((k / m.width) | 0) + 0.5;
    e.renderer.rig.lookAt(x, z); e.renderer.rig.update(0);
    const p = e.renderer.project(x, e.renderer.terrain.heightAt(x, z), z);
    return { x: p.x, y: p.y };
  });
  await page.waitForTimeout(300);
  if (info.project.name === 'mobile') await page.touchscreen.tap(pos.x, pos.y);
  else await page.mouse.click(pos.x, pos.y, { button: 'right' });
  await page.waitForFunction(() => {
    const s = window.__kronland.sim;
    return [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0).every((u) => u.goal === undefined && !u.path.length);
  }, null, { timeout: 90_000 }); // game time runs slowly under software graphics
  const tiles = await page.evaluate(() => {
    const s = window.__kronland.sim;
    const us = [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0);
    return { n: us.length, distinct: new Set(us.map((u) => `${Math.floor(u.px / 1000)},${Math.floor(u.py / 1000)}`)).size };
  });
  expect(tiles.distinct).toBe(tiles.n);
  await page.screenshot({ path: `test-results/fan-out-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Tilt the camera with R/F, flatter when very close', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Keyboard on desktop only');
  await boot(page);
  const p0 = await page.evaluate(() => window.__kronland.renderer.rig.pitch);
  await page.keyboard.down('f');
  await page.waitForFunction((p0) => window.__kronland.renderer.rig.pitch < p0 - 0.1, p0, { timeout: 20_000 });
  await page.keyboard.up('f');
  const p1 = await page.evaluate(() => window.__kronland.renderer.rig.pitch);
  await page.mouse.move(700, 400);
  // Zoom in: very close the shown view becomes flatter (near view), immediately and without gliding on
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300);
  const p2 = await page.evaluate(() => window.__kronland.renderer.rig.shownPitch);
  expect(p2).toBeLessThan(p1 - 0.05);
  await page.screenshot({ path: `test-results/tilt-${info.project.name}.png` });
});

test('Edge scrolling ends when the mouse leaves the window', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'mouse only');
  await boot(page);
  const z = () => page.evaluate(() => window.__kronland.renderer.rig.target.z);
  await page.mouse.move(700, 300);
  await page.mouse.move(700, 0); // top edge
  const z0 = await z();
  await page.waitForFunction((z0) => Math.abs(window.__kronland.renderer.rig.target.z - z0) > 0.5, z0, { timeout: 20_000 });
  // Mouse leaves the window upwards (browser bar): mouseout without a new target
  await page.evaluate(() => window.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null })));
  const z1 = await z();
  await page.waitForTimeout(1500);
  expect(Math.abs((await z()) - z1)).toBeLessThan(0.05);
});
