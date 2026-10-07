import { test, expect } from '@playwright/test';
import { playUrl, hashed } from './paths.js';

// Painted images from scripts/art/ (docs/SYMBOLE.md, "single images"): menu backdrop, loading image,
// ability icons, menu icons and herald portrait.

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
  const title = page.waitForResponse((r) => hashed('art/title.webp').test(r.url()), SLOW);
  await page.goto(playUrl());
  expect((await title).ok()).toBe(true);
  const menu = page.getByTestId('start-menu');
  await expect(menu).toBeVisible(SLOW);
  // Moving backdrop (MenuBackdrop.vue): the still lies under the clip, the menu above only darkens
  const anim = page.getByTestId('menu-anim');
  expect(await anim.evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(hashed('art/title.webp'));
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/^linear-gradient/);
  // Chromium without proprietary codecs takes the AV1 file; it runs and loops by itself, silent
  await expect(anim).toHaveClass(/playing/, SLOW);
  const vid = await anim.locator('video').evaluate((v) => ({ src: v.currentSrc, muted: v.muted, loop: v.loop, paused: v.paused, w: v.videoWidth }));
  expect(vid).toMatchObject({ muted: true, loop: true, paused: false, w: 1920 });
  expect(vid.src).toMatch(hashed('art/title-loop.av1.mp4'));
  // Menu icons coding adventure and special maps: painted single images like tutorial and campaign
  for (const [id, file] of [['menu-adventures', 'mode-adventure'], ['menu-special', 'mode-special']]) {
    const ico = page.getByTestId(id).locator('.sm-seal img.ico');
    await expect(ico).toHaveAttribute('src', hashed(`icons/${file}.webp`, '$'));
    await expect.poll(() => ico.evaluate((el) => el.complete && el.naturalWidth), SLOW).toBe(128);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/art-title-${info.project.name}.png` });

  await menu.getByRole('button', { name: /Neues Spiel starten/ }).click();
  const loading = page.getByTestId('loading');
  await expect(loading).toBeVisible(SLOW);
  const lbg = await loading.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(lbg).toMatch(hashed('art/loading.webp'));
  // load exactly the address from the CSS (with content hash in the build)
  expect(await loads(page, /url\("([^"]*loading[^"]*)"\)/.exec(lbg)[1])).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/art-loading-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Menu backdrop stays still with reduced motion and when switched off', async ({ page }, info) => {
  test.setTimeout(90_000);
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(playUrl());
  const menu = page.getByTestId('start-menu');
  await expect(menu).toBeVisible(SLOW);
  await expect(page.getByTestId('menu-anim')).toHaveCount(0);
  expect(await menu.evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(hashed('art/title.webp'));

  // System allows motion: the clip appears, the switch in the settings removes it again (and it stays off)
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.getByTestId('menu-anim')).toHaveCount(1, SLOW);
  await page.getByTestId('menu-settings').click();
  const sw = page.getByTestId('menu-motion');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('menu-anim')).toHaveCount(0);
  await page.reload();
  await expect(menu).toBeVisible(SLOW);
  await expect(page.getByTestId('menu-anim')).toHaveCount(0);
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
  expect(await img.getAttribute('src')).toMatch(hashed('icons/ab-farsight.webp'));
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
  await expect(pic).toHaveAttribute('src', hashed('portraits/sp-herald.webp', '$'));
  await expect.poll(() => pic.evaluate((el) => el.complete && el.naturalWidth), SLOW).toBe(256);
  await page.screenshot({ path: `${SHOTS}/art-herald-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
