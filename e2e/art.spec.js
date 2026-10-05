import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Painted images from scripts/art/ (docs/SYMBOLE.md, "single images"): menu backdrop, loading image,
// Ability icons and herald portrait.

const SLOW = { timeout: 30_000 };
// Where the screenshots go (ART_SHOTS=folder to collect them outside test-results)
const SHOTS = process.env.ART_SHOTS ?? 'test-results';
const loads = (page, url) => page.evaluate((u) => new Promise((res) => {
  const img = new Image();
  img.onload = () => res(img.naturalWidth > 0);
  img.onerror = () => res(false);
  img.src = u;
}), url);

test('Start menu and loading screen show the painted backdrop', async ({ page }, info) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  // Slow down models so the loading screen stays up long enough
  await page.route('**/models/**', async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue(); });
  const titel = page.waitForResponse((r) => r.url().includes('art/title.webp'), SLOW);
  await page.goto(playUrl());
  expect((await title).ok()).toBe(true);
  const menu = page.getByTestId('start-menu');
  await expect(menu).toBeVisible(SLOW);
  const bg = await menu.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('art/title.webp');
  expect(bg).toContain('linear-gradient'); // darkening gradient and fallback gradients remain
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/art-title-${info.project.name}.png` });

  await menu.getByRole('button', { name: /Neues Spiel starten/ }).click();
  const loading = page.getByTestId('loading');
  await expect(loading).toBeVisible(SLOW);
  expect(await loading.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('art/loading.webp');
  expect(await loads(page, '../art/loading.webp')).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/art-loading-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Abilities and herald are painted', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);

  // Select Nelia: Farsight is a painted single image
  await page.locator('[data-testid^=quick-hero-]').first().click();
  const img = page.getByTestId('ability-farsight').locator('img.ico');
  await expect(img).toBeVisible(SLOW);
  expect(await img.getAttribute('src')).toContain('icons/ab-farsight.webp');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth), SLOW).toBe(128);
  await page.screenshot({ path: `${SHOTS}/art-abilities-${info.project.name}.png` });

  // Herald speaks (mission 5): portrait instead of a seal with initial letter
  await page.goto(playUrl('?mission=c5&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c5', null, SLOW);
  await page.evaluate(() => {
    const e = window.__kronland, st = e.sim.mission.state;
    st.messages.push({ seq: ++st.seq, tick: e.sim.tick + 1000, speaker: 'herald', text: { de: 'Hört, Leute von Morvale!', en: 'Hear, people of Morvale!' } });
    e.emitUi();
  });
  // an older line may still be fading out: take the herald's panel; check the image right away (the panel fades out after 14 s)
  const dlg = page.getByTestId('dialog').filter({ has: page.getByTestId('dialog-speaker').getByText('Herold', { exact: true }) });
  await expect(dlg).toHaveCount(1, SLOW);
  const pic = dlg.locator('.dlg-seal img');
  await expect(pic).toHaveAttribute('src', /portraits\/sp-herald\.webp$/);
  await expect.poll(() => pic.evaluate((el) => el.complete && el.naturalWidth), SLOW).toBe(256);
  await page.screenshot({ path: `${SHOTS}/art-herald-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
