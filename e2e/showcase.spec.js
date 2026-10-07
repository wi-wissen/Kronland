import { test, expect } from '@playwright/test';
import { playUrl, SHOT_QUALITY } from './paths.js';

// Showcase: all buildings, figures and map objects on one map, without fog. Start via the URL and
// via the "Sonderkarten" menu; screenshots of the areas (desktop 1440×900, phone with E2E_ALL_PROJECTS=1) under
// test-results/showcase/, graphics level from E2E_SHOT_QUALITY (default low, see paths.js).

// Software graphics (SwiftShader) with many models: wait generously
test.describe.configure({ timeout: 300_000 });

const DIR = 'test-results/showcase';

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-showcase')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-showcase', '1');
    }
  });
  if (page.viewportSize()?.width >= 1000) await page.setViewportSize({ width: 1440, height: 900 });
  return errors;
}

const running = (page) => page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 180_000 });

/** Point the camera at a tile, wait a few frames (models load later), photo. */
async function shot(page, info, name, at, dist) {
  await page.evaluate(([x, y, d]) => {
    const r = window.__kronland.renderer.rig;
    if (d) r.dist = d;
    r.lookAt(x, y); r.clamp?.(); r.update(0);
  }, [at.x + 0.5, at.y + 0.5, dist ?? 0]);
  await page.waitForTimeout(1500);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${DIR}/${name}-${info.project.name}.png` });
}

test('Showcase via URL: no fog, everything drawn, areas reachable via signposts', async ({ page }, info) => {
  test.setTimeout(SHOT_QUALITY === 'high' ? 1_200_000 : 600_000); // ten photos of the full map under SwiftShader
  const errors = await fresh(page);
  await page.goto(playUrl(`?mission=showcase&quality=${SHOT_QUALITY}`));
  await running(page);
  const st = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const ids = [...s.entities.values()].filter((b) => b.kind === 'building').map((b) => b.id);
    return {
      mission: s.mission.state.id, fogLifted: e.fogLifted(), warnings: s.mission.state.warnings,
      buildings: ids.length, drawn: ids.filter((id) => e.renderer.buildings.has(id)).length,
      result: s.mission.state.result, refs: s.mission.state.refs,
    };
  });
  expect(st.mission).toBe('showcase');
  expect(st.fogLifted).toBe(true);
  expect(st.warnings).toEqual([]);
  expect(st.result).toBeNull();
  expect(st.buildings).toBeGreaterThan(60);
  // Without fog all buildings are in the scene (also far outside the picture)
  expect(st.drawn).toBe(st.buildings);
  // Signposts: side objectives with "Ziel zeigen"
  const panel = page.getByTestId('objectives');
  await expect(panel).toBeVisible({ timeout: 20_000 });
  if (!(await page.getByTestId('objective-see-troopArea').isVisible())) await page.getByTestId('objectives-toggle').click();
  await expect(page.getByTestId('objective-see-troopArea')).toBeVisible();
  const before = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  await page.getByTestId('objective-go-see-buildingArea').click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  expect(Math.abs(after.x - before.x) + Math.abs(after.z - before.z)).toBeGreaterThan(3);

  // Screenshots of the areas
  const r = st.refs;
  const mobile = info.project.name === 'mobile';
  const near = mobile ? 26 : 30, far = mobile ? 48 : 55;
  await shot(page, info, '01-start', r.heroArea, near);
  await shot(page, info, '02-troops-left', { x: r.troopArea.x - 22, y: r.troopArea.y }, near);
  await shot(page, info, '03-troops-right', { x: r.troopArea.x + 22, y: r.troopArea.y }, near);
  await shot(page, info, '04-buildings', r.buildingArea, far);
  await shot(page, info, '05-buildings-left', { x: r.buildingArea.x - 25, y: r.buildingArea.y - 4 }, near);
  await shot(page, info, '07-workers-sites', { x: r.siteArea.x, y: r.siteArea.y - 3 }, near);
  await shot(page, info, '09-player2-campfire', r.rivalArea, near);
  await shot(page, info, '10-resources-forest', { x: r.resourceArea.x + 8, y: r.resourceArea.y }, near);
  await shot(page, info, '11-bridge', r.bridgeArea, near);
  await shot(page, info, '12-bandits', r.robbersArea, near);
  expect(errors).toEqual([]);
});

test('Start the showcase from the "Sonderkarten" menu', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?quality=low'));
  await page.getByTestId('menu-special').click();
  const btn = page.getByTestId('special-showcase');
  await expect(btn).toBeVisible();
  await expect(btn).toContainText('Schaukasten');
  await btn.click();
  await page.getByTestId('special-start').click();
  await running(page);
  expect(await page.evaluate(() => window.__kronland.sim.mission.state.id)).toBe('showcase');
  expect(errors).toEqual([]);
});
