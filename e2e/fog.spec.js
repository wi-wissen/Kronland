import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Fog of war: minimap, enemy castle, selection, fog off (start menu and URL).

async function boot(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 45_000 });
  return errors;
}

/** Share of minimap pixels fully covered by the fog (from the engine's fog layer). */
const blackShare = (page) => page.evaluate(() => {
  const f = window.__kronland.minimapFog();
  if (!f) return 0;
  let n = 0;
  for (let i = 3; i < f.data.length; i += 4) if (f.data[i] === 255) n++;
  return n / (f.data.length / 4);
});

/** Position of the enemy castle from the point of view of the rendering and the selection. */
const enemyHq = (page) => page.evaluate(() => {
  const e = window.__kronland, hq = e.sim.findBuilding(1, 'headquarters');
  return { drawn: e.renderer.buildings.has(hq.id), seen: e.canSee(hq), selectable: !!e.selectable(hq.id) };
});

test('Game start: minimap black except the start region, enemy castle invisible', async ({ page }) => {
  const errors = await boot(page, playUrl('?seed=42'));
  const share = await blackShare(page);
  expect(share).toBeGreaterThan(0.6);
  expect(share).toBeLessThan(0.98);
  // own castle explored, enemy one not
  const mine = await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    return e.tileVisible(hq.x + 2, hq.y + 2) && e.renderer.buildings.has(hq.id);
  });
  expect(mine).toBe(true);
  expect(await enemyHq(page)).toEqual({ drawn: false, seen: false, selectable: false });
  // No enemy buildings or figures on the minimap
  const mm = await page.evaluate(() => {
    const d = window.__kronland.minimapDynamic();
    return { b: d.buildings.filter((b) => b.owner !== 0).length, u: d.units.filter((u) => u.owner !== 0).length };
  });
  expect(mm).toEqual({ b: 0, u: 0 });
  // The minimap draws: bright in the middle of the start region, black in the opposite corner
  if (await page.getByTestId('minimap-canvas').isVisible()) {
    const px = await page.evaluate(() => {
      const cv = document.querySelector('[data-testid=minimap-canvas]');
      const ctx = cv.getContext('2d');
      const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters'), ehq = e.sim.findBuilding(1, 'headquarters');
      // Minimap: the map fills the area completely (MAP_FILL = 1 in src/ui/hud/hudLayout.js)
      const W = e.sim.map.width, s = Math.min(cv.width, cv.height) / W, ox = (cv.width - W * s) / 2, oy = (cv.height - W * s) / 2;
      const at = (x, y) => [...ctx.getImageData(Math.round(ox + x * s), Math.round(oy + y * s), 1, 1).data];
      return { mine: at(hq.x - 6, hq.y + 2), theirs: at(ehq.x + 2, ehq.y + 9) };
    });
    expect(Math.max(...px.theirs.slice(0, 3))).toBeLessThan(40);
    expect(Math.max(...px.mine.slice(0, 3))).toBeGreaterThan(60);
  }
  expect(errors).toEqual([]);
});

test('Scout reveals: enemy castle appears, stays in the fog as last seen state', async ({ page }) => {
  const errors = await boot(page, playUrl('?seed=42'));
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, ehq = s.findBuilding(1, 'headquarters');
    const L = s.spawnLeader(0, 'bow1', ehq.x + 2, ehq.y + 10, 0);
    L.order = { type: 'hold' };
    window.__spy = L.id;
    for (let i = 0; i < 6; i++) e.stepOnce();
  });
  await expect.poll(() => enemyHq(page)).toEqual({ drawn: true, seen: true, selectable: true });
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    s.entities.delete(window.__spy);
    for (let i = 0; i < 6; i++) e.stepOnce();
  });
  // drawn as last seen state, but neither visible nor selectable
  await expect.poll(() => enemyHq(page)).toEqual({ drawn: true, seen: false, selectable: false });
  // The renderer sets the marker only in the next frame - wait for it
  await expect.poll(() => page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(1, 'headquarters');
    return { ghost: !!e.renderer.buildings.get(hq.id)?.userData.ghost, mm: e.minimapDynamic().buildings.some((b) => b.owner === 1 && b.ghost) };
  })).toEqual({ ghost: true, mm: true });
  expect(errors).toEqual([]);
});

test('Fog off via URL: everything visible', async ({ page }) => {
  const errors = await boot(page, playUrl('?seed=42&fog=off'));
  expect(await blackShare(page)).toBe(0);
  expect(await enemyHq(page)).toEqual({ drawn: true, seen: true, selectable: true });
  const mm = await page.evaluate(() => window.__kronland.minimapDynamic().buildings.filter((b) => b.owner === 1).length);
  expect(mm).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('Start menu: switch off fog of war', async ({ page }) => {
  await page.goto(playUrl());
  await expect(page.getByTestId('fog-on')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('fog-off').click();
  await expect(page.getByTestId('fog-off')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__kronland);
  expect(await page.evaluate(() => window.__kronland.sim.vision.enabled)).toBe(false);
});
