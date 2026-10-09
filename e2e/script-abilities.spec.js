import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Player program uses "To arms!" and a hero ability – the HUD shows the same as after the buttons (desktop).

const SLOW = { timeout: 30_000 };

// Desktop only (DESKTOP_ONLY in playwright.config.js): the commands are the same as the buttons, whose phone layout
// hud.spec.js and serfbar.spec.js cover.
test('call_to_arms() and nelia.use() from the code panel show in the HUD', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-code-')) localStorage.removeItem(k);
  });
  await page.goto(playUrl('?mission=r3-m&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await expect(page.getByTestId('script-panel')).toBeVisible(SLOW);
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await ta.fill('print("armed", call_to_arms())\nnelia.use("courage")\nprint("ready", nelia.ready("courage"))\n');
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('script-console')).toContainText('ready False', SLOW);
  await expect(page.getByTestId('script-console')).toContainText(/armed [1-9]/);
  await expect(page.getByTestId('script-error')).toHaveCount(0);

  // The serfs are militia: selecting the army offers "Back to work"
  await page.evaluate(() => {
    const e = window.__kronland;
    e.selected.clear();
    for (const u of e.sim.entities.values()) if (u.kind === 'unit' && u.owner === e.player && u.militia) e.selected.add(u.id);
    e.emitUi();
  });
  await expect(page.getByTestId('militia-off')).toBeVisible(SLOW);

  // Nelia's ability button counts down like after a click
  await page.evaluate(() => {
    const e = window.__kronland;
    e.selectHero([...e.sim.entities.values()].find((h) => h.kind === 'hero' && h.owner === e.player).id);
  });
  const btn = page.getByTestId('ability-courage');
  await expect(btn).toHaveAttribute('aria-disabled', 'true', SLOW);
  await expect(btn).toContainText(/\d+ s/);
  await page.screenshot({ path: test.info().outputPath('script-abilities.png') });
  expect(errors).toEqual([]);
});
