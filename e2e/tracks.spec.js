import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Setting "Spuren im Gelände" (off / fading / permanent): in the settings on desktop and phone, taken by the
// simulation at the game start, sent as a command during the game; a level that needs tracks fixes it.

const SLOW = { timeout: 30_000 };

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-tracks-init')) {
      localStorage.removeItem('kronland-settings');
      localStorage.removeItem('kronland-lang');
      localStorage.setItem('kronland.quality', 'low');
      sessionStorage.setItem('e2e-tracks-init', '1');
    }
  });
  return errors;
}

const mode = (page) => page.evaluate(() => window.__kronland.sim.trackMode);

test('Tracks setting: three modes, saved, taken at the start and changed by command in the game', async ({ page }, info) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('tracks-fading')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('tracks-permanent').scrollIntoViewIfNeeded();
  for (const m of ['off', 'fading', 'permanent']) await expect(page.getByTestId('tracks-' + m)).toBeInViewport();
  await expect(page.getByTestId('tracks-permanent')).toHaveText('Dauerhaft');
  await page.getByTestId('tracks-permanent').click();
  await expect(page.getByTestId('tracks-permanent')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('tracks-note')).toContainText('Trampelpfaden');
  await page.screenshot({ path: info.outputPath(`tracks-setting-${info.project.name}.png`) });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-settings')).tracks)).toBe('permanent');
  await page.getByTestId('settings-done').click();
  // Game start: the simulation takes the setting
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  expect(await mode(page)).toBe('permanent');
  // During the game: a command (applied on the next tick), not a direct write
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('tracks-off').click();
  expect(await mode(page)).toBe('permanent');
  expect(await page.evaluate(() => window.__kronland.queue.some((c) => c.type === 'setTracks' && c.mode === 'off'))).toBe(true);
  await page.getByTestId('gmenu-back').click();
  await page.getByTestId('resume').click();
  await expect.poll(() => mode(page), SLOW).toBe('off');
  expect(errors).toEqual([]);
});

test('Tracks setting: a level that needs its trail fixes the mode, the setting shows it disabled', async ({ page }, info) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=r1-4&no-models'));
  await page.waitForFunction(() => !!window.__kronland?.sim, null, SLOW);
  expect(await page.evaluate(() => ({ m: window.__kronland.sim.trackMode, f: window.__kronland.sim.trackModeFixed }))).toEqual({ m: 'permanent', f: true });
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('tracks-note').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('tracks-note')).toHaveText('Dieses Level legt die Spuren fest: Dauerhaft.');
  await expect(page.getByTestId('tracks-permanent')).toHaveAttribute('aria-checked', 'true');
  for (const m of ['off', 'fading', 'permanent']) await expect(page.getByTestId('tracks-' + m)).toBeDisabled();
  await page.screenshot({ path: info.outputPath(`tracks-fixed-${info.project.name}.png`) });
  expect(errors).toEqual([]);
});
