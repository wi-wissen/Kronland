import { test, expect } from '@playwright/test';
import { playUrl, hashed } from './paths.js';
import { quick } from './quick.js';

// Colourful icons from the AI atlas (public/icons/symbols.webp, docs/SYMBOLE.md):
// resources and build menu show atlas crops, control icons stay vector masks.

const SLOW = { timeout: 30_000 };

test('Icons come from the atlas', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);

  // Resource icon in the bar is an atlas crop
  const gold = page.locator('.ico.atlas[data-icon="gold"]').first();
  await expect(gold).toBeVisible(SLOW);
  const bg = await gold.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toMatch(hashed('icons/symbols.webp'));
  // Atlas actually loaded
  const ok = await page.evaluate((src) => new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img.naturalWidth > 0);
    img.onerror = () => res(false);
    img.src = src; // address from the CSS (relative to play/, with content hash in the build)
  }), /url\("([^"]*symbols[^"]*)"\)/.exec(bg)[1]);
  expect(ok).toBe(true);
  // Control icon (menu) stays a mask in text colour
  await expect(page.locator('.ico.glyph').first()).toBeVisible();

  // Build menu: building icons from the atlas
  await quick(page, 'all');
  await expect(page.getByTestId('build-residence')).toBeVisible(SLOW);
  await expect(page.getByTestId('build-residence').locator('.ico.atlas[data-icon="b-residence"]')).toHaveCount(1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/symbols-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
