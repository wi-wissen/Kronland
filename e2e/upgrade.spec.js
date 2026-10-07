import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';
import { quick } from './quick.js';

// Upgrade runs on its own (no serfs, original behaviour): the panel shows the remaining time,
// construction sites show serfs present / builder spots. Screenshots under test-results/build-times/.

const SLOW = { timeout: 30_000 };
const DIR = 'test-results/build-times';

test('Upgrade runs without serfs and shows the remaining time', async ({ page, isMobile }, info) => {
  test.setTimeout(180_000);
  if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).not.toHaveText('', SLOW);
  // Enough resources for the fortress (test setup only)
  await page.evaluate(() => { const s = window.__kronland.sim.players[0].stock; s.gold += 1000; s.clay += 1000; s.stone += 1000; });
  await quick(page, 'hq');
  const up = page.getByTestId('upgrade');
  await expect(up).toBeVisible(SLOW);
  await up.click();
  await expect(page.getByTestId('stat-progress')).toContainText(/noch \d+ s/, SLOW);
  const state = await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    const serfs = [...e.sim.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0 && u.type === 'serf');
    return { level: hq.level, done: hq.done, builders: hq.builders.length, working: serfs.filter((u) => u.job?.target === hq.id).length };
  });
  expect(state).toEqual({ level: 1, done: false, builders: 0, working: 0 });
  await page.screenshot({ path: `${DIR}/upgrade-${info.project.name}.png` });
  // Progress advances on its own
  const p0 = await page.evaluate(() => window.__kronland.sim.findBuilding(0, 'headquarters').progress);
  await page.waitForFunction((p) => window.__kronland.sim.findBuilding(0, 'headquarters').progress > p + 20, p0, SLOW);
  expect(errors).toEqual([]);
});
