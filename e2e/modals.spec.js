import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Modal dialogs (save games, settings, game menu) lie over the whole screen as an overlay – not below the start
// menu content (.backdrop) and not only over the game area next to the code panel (.game.split, contain: layout).
// Screenshots also go to $SHOT_DIR if set.

const SLOW = { timeout: 90_000 };
test.describe.configure({ timeout: 300_000 });

async function shot(page, name) {
  if (!process.env.SHOT_DIR) return;
  const fs = await import('node:fs/promises');
  await fs.mkdir(process.env.SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png` });
}

/** The dialog's scrim covers the viewport, the dialog is on screen, and the points in the middle and at the right edge hit the scrim. */
async function expectOverlay(page, testId) {
  const dialog = page.getByTestId(testId);
  await expect(dialog).toBeVisible();
  const r = await dialog.evaluate((el) => {
    const scrim = el.closest('.scrim');
    const s = scrim.getBoundingClientRect();
    const d = el.getBoundingClientRect();
    const hits = [[innerWidth / 2, innerHeight / 2], [innerWidth - 4, innerHeight / 2]]
      .map(([x, y]) => scrim.contains(document.elementFromPoint(x, y)));
    return { pos: getComputedStyle(scrim).position, s: [s.left, s.top, s.width, s.height], d: [d.left, d.top, d.right, d.bottom], w: innerWidth, h: innerHeight, hits };
  });
  expect(r.pos).toBe('fixed');
  expect(r.s).toEqual([0, 0, r.w, r.h]);
  expect(r.d[0]).toBeGreaterThanOrEqual(0);
  expect(r.d[1]).toBeGreaterThanOrEqual(0);
  expect(r.d[2]).toBeLessThanOrEqual(r.w);
  expect(r.d[3]).toBeLessThanOrEqual(r.h);
  expect(r.hits).toEqual([true, true]);
}

test('Start menu: save games and settings open as an overlay', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl(''), { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-saves').click();
  await expectOverlay(page, 'saves-dialog');
  await shot(page, 'start-saves');
  await page.getByTestId('saves-close').click();
  await expect(page.getByTestId('saves-dialog')).toHaveCount(0);

  await page.getByTestId('menu-settings').click();
  await expectOverlay(page, 'settings-dialog');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('Game menu: load, save, settings and controls cover the whole screen', async ({ page }) => {
  await page.goto(playUrl('?seed=42&no-models'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  for (const view of ['load', 'save', 'open-settings', 'open-controls']) {
    await page.getByTestId('menu').click();
    await page.getByTestId(view).click();
    await expectOverlay(page, 'game-menu');
    if (view === 'load') await shot(page, 'game-load');
    await page.getByTestId('gmenu-back').click();
    await page.getByTestId('resume').click();
    await expect(page.getByTestId('game-menu')).toHaveCount(0);
  }
});

test('Split screen: the game menu also covers the code panel', async ({ page }) => {
  test.skip(page.viewportSize().width < 760, 'phones show the code as a sheet');
  await page.addInitScript(() => localStorage.removeItem('kronland-code-split'));
  await page.goto(playUrl('?mission=adv1&no-models'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await expect(page.locator('.game.split')).toBeAttached(SLOW);
  await page.getByTestId('menu').click();
  await page.getByTestId('load').click();
  await expectOverlay(page, 'game-menu');
  await shot(page, 'split-load');
});
