import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Share maps via link: game start puts the start link into the address bar, the game menu shows the map and
// "Link kopieren", the same link starts the same map. Screenshots to SHOTS (optional).

const SHOTS = process.env.SHOTS_DIR;

/** Fingerprint of the map: seed, players, heroes, castles, height checksum. */
const mapPrint = (page) => page.evaluate(() => {
  const s = window.__kronland.sim;
  let h = 0;
  for (let i = 0; i < s.map.heights.length; i++) h = (h * 31 + s.map.heights[i]) | 0;
  const hqs = s.players.map((_, i) => { const b = s.findBuilding(i, 'headquarters'); return b ? [b.x, b.y] : null; });
  return { seed: s.seed, players: s.players.length, heights: h, hqs, fog: s.vision.enabled };
});

const waitGame = (page) => page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 90_000 });

test('Free game from the menu: start link in the address, same link = same map', async ({ page, context }, info) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Evidence images on desktop at 1440×900
  if (SHOTS && info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl());
  await page.getByTestId('opp-2').click();
  await page.getByTestId('diff-hard').click();
  await page.getByTestId('hero-pick-orrin').click();
  await page.getByTestId('fog-off').click();
  await page.locator('#seed').fill('62921');
  await page.getByTestId('start').click();
  await waitGame(page);

  const url = new URL(page.url());
  expect(url.pathname).toBe('/play/');
  expect(Object.fromEntries(url.searchParams)).toEqual({ seed: '62921', ai: 'hard', players: '3', hero: 'orrin', fog: 'off' });
  const first = await mapPrint(page);
  expect(first).toMatchObject({ seed: 62921, players: 3, fog: false });

  // Game menu: map and copy button
  await page.getByTestId('menu').click();
  await expect(page.getByTestId('gmenu-map-name')).toHaveText('62921');
  await expect(page.getByTestId('copy-link')).toBeVisible();
  await expect(page.getByTestId('gmenu-map')).toContainText('von vorn');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/gamemenu-${info.project.name}.png` });

  // Copying: clipboard (desktop) or fallback to the selected text field; the canonical address is always shared
  await page.evaluate(() => {
    window.__shared = null;
    // Replace the system share menu (mobile) with the clipboard in the test
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__shared = t; } }, configurable: true });
  });
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('copy-link')).toContainText('Link kopiert');
  const shared = await page.evaluate(() => window.__shared);
  expect(shared).toBe(url.href);

  // Without clipboard API: text field with the link appears
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  await page.waitForTimeout(2700);
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('link-field')).toHaveValue(url.href);

  // The same link in a new page: the same map
  const other = await context.newPage();
  await other.goto(shared);
  await waitGame(other);
  expect(await mapPrint(other)).toEqual(first);
  expect(new URL(other.url()).search).toBe(url.search);
  await other.close();

  // Leaving: address without query again
  await page.getByTestId('quit').click();
  await page.getByTestId('quit').click();
  await expect(page.getByTestId('start-menu')).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  expect(errors).toEqual([]);
});

test('Mission via link: tutorial starts via ?mission=tutorial, menu shows the name', async ({ page }, info) => {
  test.setTimeout(180_000);
  if (SHOTS && info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl());
  await page.getByTestId('menu-tutorial').click();
  await waitGame(page);
  expect(new URL(page.url()).search).toBe('?mission=tutorial');
  await page.evaluate(() => window.__kronland.skipDialog?.());
  await page.getByTestId('menu').click();
  await expect(page.getByTestId('gmenu-map-name')).toHaveText('Erste Schritte');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tutorial-${info.project.name}.png` });
});

test('Invalid values in the link: default instead of error, address is cleaned up', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=77&ai=extreme&players=12&hero=nobody&quality=low&no-models'));
  await waitGame(page);
  const q = Object.fromEntries(new URL(page.url()).searchParams);
  expect(q).toEqual({ seed: '77', ai: 'normal', players: '4', hero: 'nelia', quality: 'low', 'no-models': '' });
  expect(await page.evaluate(() => window.__kronland.sim.players.length)).toBe(4);
  // Shared link contains only the start, no local parameters
  await page.getByTestId('menu').click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__shared = t; } }, configurable: true });
  });
  await page.getByTestId('copy-link').click();
  await expect(page.getByTestId('copy-link')).toContainText('Link kopiert');
  expect(new URL(await page.evaluate(() => window.__shared)).search).toBe('?seed=77&ai=normal&players=4&hero=nelia');
  expect(errors).toEqual([]);
});
