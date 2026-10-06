import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Special maps: menu on the start screen and the stress test "Gewimmel" (many figures, two battles).
// Screenshots (desktop 1440×900 and mobile) and measurements (draw calls, triangles, figures) under
// test-results/special-maps/.

test.describe.configure({ timeout: 360_000 });

const DIR = 'test-results/special-maps';

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-special-maps')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-special-maps', '1');
    }
  });
  if (page.viewportSize()?.width >= 1000) await page.setViewportSize({ width: 1440, height: 900 });
  return errors;
}

const running = (page) => page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 240_000 });

test('Start menu lists the special maps with description and places', async ({ page }, info) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-special').click();
  await expect(page.getByTestId('special-menu')).toBeVisible();
  await expect(page.getByTestId('special-showcase')).toContainText('Schaukasten');
  await page.getByTestId('special-bustle').click();
  await expect(page.getByTestId('special-briefing')).toContainText('Gewimmel');
  await expect(page.getByTestId('special-briefing')).toContainText('Schlacht im Norden');
  await page.screenshot({ path: `${DIR}/menu-${info.project.name}.png` });
  await page.getByTestId('special-back').click();
  await expect(page.getByTestId('start-menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Bustle: stress test runs, battles and towns in the picture', async ({ page }, info) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=bustle'));
  await running(page);
  const st = await page.evaluate(() => {
    const sim = window.__kronland.sim;
    const c = {};
    for (const e of sim.entities.values()) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return { id: sim.mission.state.id, warnings: sim.mission.state.warnings, refs: sim.mission.state.refs, c };
  });
  expect(st.id).toBe('bustle');
  expect(st.warnings).toEqual([]);
  expect(st.c.building).toBeGreaterThanOrEqual(150);
  expect((st.c.unit ?? 0) + (st.c.worker ?? 0) + (st.c.leader ?? 0) + (st.c.soldier ?? 0)).toBeGreaterThanOrEqual(1000);
  const stats = {};
  for (const [name, at, dist] of [['battle', st.refs.battle1, 34], ['town', st.refs.town1, 30], ['overview', { x: 80, y: 80 }, 90]]) {
    await page.evaluate(([x, y, d]) => {
      const r = window.__kronland.renderer.rig;
      r.dist = d; r.lookAt(x, y); r.clamp?.(); r.update(0);
    }, [at.x + 0.5, at.y + 0.5, dist]);
    await page.waitForTimeout(2500);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    stats[name] = await page.evaluate(() => { const s = window.__kronland.renderer.debugStats(); return { calls: s.calls, triangles: s.triangles, chars: s.chars }; });
    await page.screenshot({ path: `${DIR}/bustle-${name}-${info.project.name}.png` });
  }
  // Figures are drawn (instanced: few calls for very many figures)
  expect(stats.battle.calls).toBeGreaterThan(0);
  console.log(`Bustle (${info.project.name}):`, JSON.stringify(stats));
  expect(errors).toEqual([]);
});
