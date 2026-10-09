import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Robust game loop: a single exception does not stop the game; a persistent error in the simulation
// stops it and offers "Letzten Spielstand laden" (autosave) or "Seite neu laden" - afterwards the
// start menu points to "Weiterspielen". Screenshots under test-results/crash/.

test.describe.configure({ timeout: 600_000 });

const DIR = 'test-results/crash';

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-crash')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-crash', '1');
    }
  });
  if (page.viewportSize()?.width >= 1000) await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl('?seed=42&no-models'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 300_000 });
  return errors;
}

/** Wait for the first autosave (30 game seconds; triple speed). */
async function firstAutosave(page) {
  await page.evaluate(() => window.__kronland.setSpeed(3));
  await page.waitForFunction(() => window.__kronland.autosaveStats?.totalMs !== undefined, null, { timeout: 300_000 });
  return page.evaluate(() => window.__kronland.autosaveStats);
}

test('single exceptions in rendering and AI do not stop the game', async ({ page }) => {
  const errors = await boot(page);
  const before = await page.evaluate(() => {
    const e = window.__kronland;
    // one exception in drawing, one in the AI, an infinite angle (formerly an endless loop)
    const frame = e.renderer.frame.bind(e.renderer);
    let once = true;
    e.renderer.frame = (...a) => { if (once) { once = false; throw new Error('Test error rendering'); } return frame(...a); };
    // the AI runs inside sim.step: the simulation drops the failed decision and reports it (event aiError)
    const ai = e.ais[0];
    const run = ai.run.bind(ai);
    let aiOnce = true;
    ai.run = () => { if (aiOnce) { aiOnce = false; throw new Error('Test error AI'); } return run(); };
    window.__kronland.renderer.unitYaw?.set([...e.sim.entities.values()].find((x) => x.kind === 'unit')?.id ?? 0, Infinity);
    e.setSpeed(2);
    return { tick: e.sim.tick, frame: e.renderer.frameNo };
  });
  await page.waitForFunction((b) => window.__kronland.sim.tick > b.tick + 20 && window.__kronland.renderer.frameNo > b.frame + 10, before, { timeout: 120_000 });
  const st = await page.evaluate(() => ({ crash: window.__kronland.crash, faults: window.__kronland.faults.total, aiDisabled: window.__kronland.sim.ai[0].disabled }));
  expect(st.crash).toBe(null);
  expect(st.faults.render).toBeGreaterThanOrEqual(1);
  expect(st.faults.ai).toBe(1);
  expect(st.aiDisabled).toBe(false);
  await expect(page.getByTestId('crash-dialog')).toBeHidden();
  expect(errors).toEqual([]);
});

test('persistent simulation error: dialog, load autosave, after reload "Weiterspielen"', async ({ page }, info) => {
  const errors = await boot(page);
  const auto = await firstAutosave(page);
  // Autosave is cheap (no deep copy, preview image without GPU readback)
  console.log(`Autosave (${info.project.name}):`, JSON.stringify(auto));
  expect(auto.tick).toBeGreaterThanOrEqual(300);
  expect(auto.chars).toBeGreaterThan(10_000);
  await page.evaluate(() => { const s = window.__kronland.sim; s.step = () => { throw new Error('Test error simulation'); }; });
  const dialog = page.getByTestId('crash-dialog');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await expect(dialog).toContainText('Das Spiel ist hängen geblieben');
  await expect(page.getByTestId('crash-latest')).toContainText('Freies Spiel Seed 42');
  await expect(page.getByTestId('crash-message')).toContainText('Test error simulation');
  expect(await page.evaluate(() => window.__kronland.paused)).toBe(true);
  await page.screenshot({ path: `${DIR}/dialog-${info.project.name}.png` });

  // Load the last save game: new engine on the state of the autosave, dialog gone
  await page.getByTestId('crash-load').click();
  await expect(dialog).toBeHidden({ timeout: 120_000 });
  await page.waitForFunction((t) => window.__kronland && window.__kronland.sim.tick >= t && !window.__kronland.crash, auto.tick, { timeout: 120_000 });
  const tick = await page.evaluate(() => window.__kronland.sim.tick);
  expect(tick).toBeLessThan(auto.tick + 200);

  // Crash again and reload the page: start menu with hint and continue (autosave)
  await page.evaluate(() => { const s = window.__kronland.sim; s.step = () => { throw new Error('Test error simulation'); }; });
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('crash-reload').click();
  await expect(page.getByTestId('start-menu')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('recovered-hint')).toContainText('Weiterspielen');
  await expect(page.getByTestId('continue-name')).toContainText('Autosave');
  await page.screenshot({ path: `${DIR}/start-menu-${info.project.name}.png` });
  await page.getByTestId('continue').click();
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.sim.tick >= 300, null, { timeout: 300_000 });
  expect(errors).toEqual([]);
});
