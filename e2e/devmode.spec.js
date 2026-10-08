import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Dev mode: activation (?dev=1, keyboard shortcut, settings), path/A* of a figure, wireframe,
// grid overlay, stats for nerds. Desktop and mobile (bottom sheet).

test.setTimeout(240_000);

async function boot(page, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 90_000 });
  return errors;
}

/** Select an own serf and send it to a walkable tile; returns its ID. */
const selectAndMove = (page) => page.evaluate(() => {
  const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters'), m = e.sim.map;
  const s = [...e.sim.entities.values()].find((x) => x.kind === 'unit' && x.owner === 0);
  let to = null;
  for (let r = 0; r < 30 && !to; r++) for (let dx = -r; dx <= r && !to; dx++) { const x = hq.x - 10 + dx, y = hq.y + 10 - r; if (m.walkable(x, y)) to = { x, y }; }
  e.selected.clear(); e.selected.add(s.id);
  e.issue({ type: 'move', units: [s.id], ...to });
  // Compute ticks directly (software graphics are very slow) and pause so the path stays
  e.stepOnce(); e.stepOnce();
  e.paused = true;
  e.emitUi();
  return s.id;
});

test('?dev=1: panel, stats, path and A* search of the selected figure', async ({ page }) => {
  const errors = await boot(page, playUrl('?seed=42&dev=1'));
  await page.waitForFunction(() => !!window.__kronland.dev, null, { timeout: 60_000 });
  await expect(page.getByTestId('dev-panel')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('dev-stats')).toBeVisible();
  await expect(page.getByTestId('dev-stats')).toContainText(/State-Hash/);
  await expect(page.getByTestId('dev-stats')).toContainText(/[0-9a-f]{8} @\d+/);

  const id = await selectAndMove(page);
  expect(await page.evaluate((id) => window.__kronland.sim.entities.get(id).path.length, id)).toBeGreaterThan(2);
  await page.getByTestId('dev-tab-path').click();
  await expect(page.getByTestId('dev-search-info')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => {
    const d = window.__kronland.dev;
    return d.pathGroup?.visible && d.pathLine.geometry.instanceCount > 0 && d.searchLayer?.visible && d.pb?.rec.result === 'found';
  }, null, { timeout: 60_000, polling: 500 });
  // Step by step: to the start, one step forward
  await page.getByTestId('dev-restart').click();
  await page.getByTestId('dev-step').click();
  await expect(page.getByTestId('dev-steps')).toContainText(/1\b/);
  expect(await page.evaluate(() => window.__kronland.dev.pb.step)).toBe(1);
  // Playback runs forward
  await page.getByTestId('dev-play').click();
  await page.waitForFunction(() => window.__kronland.dev.pb.step > 5, null, { timeout: 60_000, polling: 500 });
  // Info above the figure
  await expect(page.locator('.dev-label').first()).toContainText(`#${id}`);
  expect(errors).toEqual([]);
});

test('Shortcut F3 / Ctrl+Shift+D and toggling the wireframe', async ({ page }) => {
  const errors = await boot(page, playUrl('?seed=42'));
  expect(await page.evaluate(() => window.__kronland.dev)).toBeNull();
  await expect(page.getByTestId('dev-panel')).toHaveCount(0);
  await page.locator('canvas').first().focus().catch(() => {});
  await page.keyboard.press('F3');
  await expect(page.getByTestId('dev-panel')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !!window.__kronland.dev, null, { timeout: 60_000 });

  // Wireframe for buildings with LOD colours, mode "edges only"
  await page.getByTestId('dev-tab-render').click();
  await page.getByTestId('dev-wire-buildings').click();
  await page.getByTestId('dev-wiremode-wire').click();
  await page.getByTestId('dev-lodcolors').click();
  await page.waitForFunction(() => window.__kronland.dev.wire.count > 0 && window.__kronland.dev.wire.clones.size > 0, null, { timeout: 60_000 });
  // After the frame the original materials are back (picking and game logic see none of it)
  const restored = await page.evaluate(() => {
    let ok = true;
    for (const g of window.__kronland.renderer.buildings.values()) g.traverse((o) => { if (o.isMesh && o.material?.wireframe) ok = false; });
    return ok;
  });
  expect(restored).toBe(true);
  // Building selected: triangles per LOD level
  await page.evaluate(() => { const e = window.__kronland; e.selected.clear(); e.selected.add(e.sim.findBuilding(0, 'headquarters').id); e.emitUi(); });
  await expect(page.getByTestId('dev-poly')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('dev-poly-tris')).toHaveText(/\d/);
  // off
  await page.getByTestId('dev-wire-buildings').click();
  await page.waitForFunction(() => window.__kronland.dev.wireOpts() === null);

  // Grid: height map
  await page.getByTestId('dev-tab-grid').click();
  await page.getByTestId('dev-grid-height').click();
  await page.waitForFunction(() => window.__kronland.dev.gridLayer?.visible && !!window.__kronland.dev.heightRange, null, { timeout: 60_000 });

  await page.keyboard.press('Control+Shift+D');
  await expect(page.getByTestId('dev-panel')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(() => window.__kronland.dev === null);
  // Cleaned up: no dev objects left in the scene
  const left = await page.evaluate(() => {
    let n = 0;
    window.__kronland.renderer.scene.traverse((o) => { if (/^dev-/.test(o.name)) n++; });
    return n + document.querySelectorAll('.dev-labels, .dev-tip').length;
  });
  expect(left).toBe(0);
  expect(errors).toEqual([]);
});

test('Settings: "Entwicklermodus" switch, copy stats', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const errors = await boot(page, playUrl('?seed=42'));
  await page.evaluate(() => { window.__kronland.paused = false; });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('game-menu')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('open-settings').click();
  await page.getByTestId('dev-mode').click();
  await expect(page.getByTestId('dev-mode')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings-done').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('dev-stats')).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => !!window.__kronland.dev, null, { timeout: 60_000 });
  await page.getByTestId('dev-stats-copy').click();
  await expect(page.getByTestId('dev-stats-copy')).toHaveText(/Kopiert|Copied/);
  // Collapse the panel and open it again
  await page.getByTestId('dev-collapse').click();
  await expect(page.getByTestId('dev-open')).toBeVisible();
  await page.getByTestId('dev-open').click();
  await expect(page.getByTestId('dev-panel')).toBeVisible();
  expect(errors).toEqual([]);
});
