import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Worlds of a coding mission (docs/SKRIPTE.md#welten) on I.4: the switcher starts the stage in another world (code
// stays), „Prüfen“ plays the program through all worlds without pictures and names the world that fails; once all
// worlds pass, the next stage begins; the same on the first stage of I.M. Desktop and phone (sheet).

const SLOW = { timeout: 30_000 };
const SHOTS = process.env.WORLD_SHOTS ?? null;

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-code-')) localStorage.removeItem(k);
      localStorage.removeItem('kronland-lang');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  return errors;
}

async function openPanel(page) {
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  const back = page.getByTestId('script-watch-code');
  if (await back.isVisible()) await back.click();
  const fab = page.getByTestId('script-open');
  if (!(await page.getByTestId('script-panel').isVisible()) && await fab.isVisible()) await fab.click();
  await expect(page.getByTestId('script-panel')).toBeVisible(SLOW);
}

const mission = (page) => page.evaluate(() => {
  const m = window.__kronland.sim.mission;
  const h = [...window.__kronland.sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
  return { world: m.state.world, active: m.state.objectives.filter((o) => o.status === 'active').map((o) => o.id), tile: [Math.floor(h.px / 1000), Math.floor(h.py / 1000)] };
});

test('I.4: world switcher keeps the code, „Prüfen“ names the failing world, all worlds solved → next stage', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = await fresh(page);
  // Evidence pictures (WORLD_SHOTS=dir): desktop at 1440×900
  if (SHOTS && !info.project.use.hasTouch) await page.setViewportSize({ width: 1440, height: 900 });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-${name}.png` }); };
  await page.goto(playUrl('?mission=r1-4&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  await expect(page.getByTestId('script-goal-predict')).toBeVisible({ timeout: 60_000 });

  // Three worlds, the normal case is on
  const worlds = page.getByTestId('script-worlds');
  await expect(worlds).toBeVisible();
  await expect(worlds.getByRole('radio')).toHaveCount(3);
  await expect(page.getByTestId('script-world-normal')).toHaveAttribute('aria-checked', 'true');

  // Predict in the world "Alles ganz nah": the forest stands right in front of Nelia – 0 steps
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await expect(ta).toHaveValue(/guess = 0/);
  await page.getByTestId('script-world-near').click();
  await expect.poll(async () => (await mission(page)).world, SLOW).toBe('near');
  await expect(page.getByTestId('script-world-near')).toHaveAttribute('aria-checked', 'true');
  await expect(ta).toHaveValue(/guess = 0/);
  await shot('switcher');
  await page.getByTestId('script-run').click();
  await expect.poll(async () => (await mission(page)).active, { timeout: 60_000 }).toEqual(['coin']);
  await openPanel(page);
  await expect(page.getByTestId('script-goal-coin')).toBeVisible(SLOW);

  // A hard-coded program: right in one world only – the check names the others and the line
  await ta.fill('for i in range(7):\n    nelia.step()\nnelia.take()\n');
  await page.getByTestId('script-check').click();
  const res = page.getByTestId('script-check-result');
  await expect(res).toHaveAttribute('data-passed', 'false', { timeout: 60_000 });
  await expect(page.getByTestId('script-check-normal')).toHaveAttribute('data-status', 'solved');
  await expect(page.getByTestId('script-check-near')).toHaveAttribute('data-status', 'error');
  await expect(page.getByTestId('script-check-near')).toContainText(/Zeile 3/);
  await expect(page.getByTestId('script-world-far')).toHaveClass(/bad/);
  await expect(page.getByTestId('script-goal-coin')).toBeVisible();
  await shot('check-failed');

  // "Ansehen" switches to a failing world, the stage starts there
  await page.getByTestId('script-check-show-far').click();
  await expect.poll(async () => (await mission(page)).world, SLOW).toBe('far');
  await expect.poll(async () => (await mission(page)).tile, SLOW).toEqual([2, 13]);
  await expect(ta).toHaveValue(/range\(7\)/);
  await expect(page.getByTestId('script-goal-coin')).toBeVisible(SLOW);

  // The general program passes in all worlds: the coin stage is done, the track follows
  await ta.fill('while nelia.here() != "coin":\n    nelia.step()\nnelia.take()\n');
  await page.getByTestId('script-check').click();
  await expect(res).toHaveAttribute('data-passed', 'true', { timeout: 60_000 });
  await expect(res).toContainText(/alle(n)? 3 Welten/);
  await shot('check-passed');
  await expect.poll(async () => (await mission(page)).active, { timeout: 60_000 }).toEqual(['hut']);
  await expect(page.getByTestId('script-goal-hut')).toBeVisible(SLOW);
  expect(errors).toEqual([]);
});

test('I.M: the first stretch of undergrowth in three worlds – a written-out way fails, the general rule passes', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = await fresh(page);
  if (SHOTS && !info.project.use.hasTouch) await page.setViewportSize({ width: 1440, height: 900 });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-r1-m-${name}.png` }); };
  await page.goto(playUrl('?mission=r1-m&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  await expect(page.getByTestId('script-goal-edge')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('script-worlds').getByRole('radio')).toHaveCount(3);

  // "Alles ganz nah": a tree right in front of Nelia
  await page.getByTestId('script-world-near').click();
  await expect.poll(async () => (await mission(page)).world, SLOW).toBe('near');
  await expect.poll(async () => (await mission(page)).tile, SLOW).toEqual([7, 2]);
  await openPanel(page);
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  // The way of the normal case, written out: blocked at once in the near world, lost in the far one
  await ta.fill('nelia.step(19)\nnelia.turn_right()\nnelia.step(6)\nnelia.turn_right()\nnelia.step(17)\nnelia.turn_right()\nnelia.step(4)\nnelia.turn_right()\nnelia.step(10)\n');
  await page.getByTestId('script-check').click();
  const res = page.getByTestId('script-check-result');
  await expect(res).toHaveAttribute('data-passed', 'false', { timeout: 90_000 });
  await expect(page.getByTestId('script-check-normal')).toHaveAttribute('data-status', 'solved');
  await expect(page.getByTestId('script-check-near')).toHaveAttribute('data-status', 'error');
  await expect(page.getByTestId('script-check-near')).toContainText(/Zeile 1/);
  await expect(page.getByTestId('script-check-far')).toHaveAttribute('data-status', 'error');
  await shot('check-failed');

  // Walk, otherwise turn right: every world passes, the thicket follows
  await ta.fill('while not nelia.is_at(place("exit")):\n    if nelia.can_step():\n        nelia.step()\n    else:\n        nelia.turn_right()\n');
  await page.getByTestId('script-check').click();
  await expect(res).toHaveAttribute('data-passed', 'true', { timeout: 90_000 });
  await shot('check-passed');
  await expect.poll(async () => (await mission(page)).active, { timeout: 60_000 }).toEqual(['thicket']);
  expect(errors).toEqual([]);
});

test('World editor: worlds list in the scenario tab, test play in the chosen world with the switcher', async ({ page }, info) => {
  test.skip(!!info.project.use.hasTouch, 'desktop only: the scenario tab is the same form on phones');
  test.setTimeout(240_000);
  const errors = await fresh(page);
  await page.addInitScript(() => localStorage.removeItem('kronland-editor-draft'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl('?no-models'));
  await page.getByTestId('menu-adventures').click();
  await page.getByTestId('open-editor').click();
  await expect(page.getByTestId('world-editor')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('editor-tab-scenario').click();
  // The first world added brings the normal case along
  await page.getByTestId('editor-world-add').click();
  await expect(page.getByTestId('editor-world-0').getByTestId('editor-world-id')).toHaveValue('normal');
  await expect(page.getByTestId('editor-world-1').getByTestId('editor-world-id')).toHaveValue('world2');
  await page.getByTestId('editor-world-1').getByTestId('editor-world-id').fill('edge');
  await page.getByTestId('editor-play-world').selectOption('edge');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${info.project.name}-editor-worlds.png` });
  await page.getByTestId('editor-play').click();
  await page.waitForFunction(() => window.__kronland?.sim?.mission?.state.world === 'edge', null, { timeout: 60_000 });
  await openPanel(page);
  await expect(page.getByTestId('script-world-edge')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('script-world-normal')).toBeVisible();
  expect(errors).toEqual([]);
});
