import { test, expect } from './fixtures.js';
import { playUrl, SHOT_QUALITY } from './paths.js';

// Moving building parts (src/render/movingParts.js): on the showcase the sails, wheels and the weather vane are cut
// out of the models and turn while the game runs. Photos under test-results/moving-parts/. Desktop only, heavy group (playwright.config.js).

test.describe.configure({ timeout: 300_000 });

const DIR = 'test-results/moving-parts';
/** type, level (0 = level 1) → model with moving parts */
const TARGETS = [['windwheel', 0], ['weatherTower', 0], ['farm', 1], ['farm', 2], ['sawmill', 1], ['stonemason', 1]];

test('Sails, water wheel and weather vane turn', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl(`?mission=showcase&quality=${SHOT_QUALITY}`));
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 180_000 });

  // Building ids of the targets; the models load on demand: look at each one until its parts are there
  const ids = await page.evaluate((targets) => {
    const s = window.__kronland.sim;
    return targets.map(([type, level]) => [...s.entities.values()].find((b) => b.kind === 'building' && b.type === type && b.level === level && b.done)?.id);
  }, TARGETS);
  expect(ids.every(Boolean)).toBe(true);
  for (const [k, id] of ids.entries()) {
    await page.evaluate((id) => {
      const e = window.__kronland, b = e.sim.entities.get(id), r = e.renderer.rig;
      r.dist = 14; r.lookAt(b.x + b.w / 2, b.y + b.h / 2); r.update(0);
    }, id);
    await page.waitForFunction((id) => (window.__kronland.renderer.buildings.get(id)?.userData.turning?.length ?? 0) > 0, id, { timeout: 60_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DIR}/${String(k + 1).padStart(2, '0')}-${TARGETS[k][0]}${TARGETS[k][1] + 1}.png` });
  }

  // every part turns: angle differs between two moments
  const angles = () => page.evaluate((ids) => ids.map((id) => window.__kronland.renderer.buildings.get(id).userData.turning.map((g) => g.quaternion.toArray())), ids);
  const a = await angles();
  await page.waitForTimeout(800);
  const b = await angles();
  for (const [k, parts] of a.entries()) {
    expect(parts.length, TARGETS[k].join(' ')).toBeGreaterThan(0);
    parts.forEach((q, i) => expect(q.some((v, c) => Math.abs(v - b[k][i][c]) > 1e-3), `${TARGETS[k].join(' ')} part ${i}`).toBe(true));
  }
  expect(errors).toEqual([]);
});
