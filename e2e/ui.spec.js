import { test, expect } from '@playwright/test';

// UI: language, settings, build menu categories, minimap, notices.

// Software rendering (swiftshader) is slow: wait generously for simulation sequences
const SLOW = { timeout: 20_000 };

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-ui-init')) {
      localStorage.removeItem('kronland-lang');
      localStorage.removeItem('kronland-settings');
      sessionStorage.setItem('e2e-ui-init', '1');
    }
  });
  return errors;
}

async function bootGame(page, url = '/?seed=42') {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
}

test('Switch language in the start menu: texts change at once and stay saved', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto('/');
  await expect(page.getByTestId('start')).toHaveText('Neues Spiel starten');
  await page.getByTestId('menu-lang-en').click();
  await expect(page.getByTestId('start')).toHaveText('Start new game');
  await expect(page.getByTestId('menu-campaign')).toContainText('Campaign');
  expect(await page.evaluate(() => localStorage.getItem('kronland-lang'))).toBe('en');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  await page.reload();
  await expect(page.getByTestId('start')).toHaveText('Start new game');
  // In game: building names and rejection reasons in English
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__kronland);
  await page.getByTestId('quick-all').click();
  if (await page.getByTestId('build-toggle').isVisible()) await page.getByTestId('build-toggle').click();
  await expect(page.getByTestId('build-residence')).toContainText('Residence');
  await page.evaluate(() => { const e = window.__kronland; e.toast('err.popLimit', null, { ttl: 20000 }); });
  await expect(page.getByTestId('toasts')).toContainText('Population limit reached', SLOW);
  expect(errors).toEqual([]);
});

test('Settings are saved and offered in the game', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto('/');
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await page.getByTestId('vol-music').fill('30');
  await page.getByTestId('edge-scroll').click();
  await expect(page.getByTestId('edge-scroll')).toHaveAttribute('aria-checked', 'false');
  // "Niedrig": higher levels make software rendering unnecessarily slow in the test
  await page.getByTestId('quality-low').click();
  await page.getByTestId('lang-en').click();
  await expect(page.getByTestId('settings-done')).toHaveText('Done');
  await page.getByTestId('settings-done').click();
  const saved = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('kronland-settings')), q: localStorage.getItem('kronland.quality'), l: localStorage.getItem('kronland-lang') }));
  expect(saved.s.music).toBeCloseTo(0.3);
  expect(saved.s.edgeScroll).toBe(false);
  expect(saved.q).toBe('low');
  expect(saved.l).toBe('en');
  // Same after reloading
  await page.reload();
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('vol-music')).toHaveValue('30');
  await expect(page.getByTestId('quality-low')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('settings-done').click();
  // Reachable in the game menu
  await bootGame(page);
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('edge-scroll')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('lang-de').click();
  await page.getByTestId('gmenu-back').click();
  await expect(page.getByTestId('resume')).toHaveText('Weiterspielen');
  expect(errors).toEqual([]);
});

test('Build menu: categories as tabs, locked buildings with reason', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await page.getByTestId('quick-all').click();
  if (await page.getByTestId('build-toggle').isVisible()) await page.getByTestId('build-toggle').click();
  await expect(page.getByTestId('build-residence')).toBeVisible();
  await expect(page.getByTestId('build-clayMine')).toHaveCount(0);
  await page.getByTestId('build-cat-raw').click();
  await expect(page.getByTestId('build-cat-raw')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('build-clayMine')).toBeVisible();
  await expect(page.getByTestId('build-residence')).toHaveCount(0);
  await page.getByTestId('build-cat-military').click();
  const barracks = page.getByTestId('build-barracks');
  await expect(barracks).toHaveAttribute('aria-disabled', 'true');
  await expect(barracks).toContainText('Wehrpflicht');
  // Locked: click starts no placement
  await barracks.click({ force: true });
  expect(await page.evaluate(() => window.__kronland.placing)).toBeNull();
  await page.getByTestId('build-cat-refine').click();
  await expect(page.getByTestId('build-brickworks')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Minimap: click moves the camera', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  if (!(await page.getByTestId('minimap-canvas').isVisible())) await page.getByTestId('minimap-toggle').click();
  const canvas = page.getByTestId('minimap-canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  const box = await canvas.boundingBox();
  // Tap the opposite corner of the map
  const tx = before.x < 64 ? 0.85 : 0.15, ty = before.z < 64 ? 0.85 : 0.15;
  await canvas.click({ position: { x: box.width * tx, y: box.height * ty } });
  const after = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(20);
  const size = await page.evaluate(() => window.__kronland.sim.map.width);
  expect(Math.abs(after.x - size * tx)).toBeLessThan(size * 0.12);
  expect(errors).toEqual([]);
});

test('Notice with location jumps there on click', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await page.evaluate(() => {
    const e = window.__kronland;
    e.toast('toast.attackBuilding', { building: 'residence', level: 0 }, { icon: 'attack', tone: 'bad', pos: { x: 10, y: 12 }, ttl: 30000 });
  });
  const t = page.getByTestId('toast').filter({ hasText: 'Angriff auf Wohnhaus!' });
  await expect(t).toBeVisible(SLOW);
  await t.click();
  const target = await page.evaluate(() => ({ ...window.__kronland.renderer.rig.target }));
  expect(Math.round(target.x)).toBe(10);
  expect(Math.round(target.z)).toBe(12);
  await expect(t).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Rejected commands show translated reasons', async ({ page }) => {
  const errors = await fresh(page);
  await bootGame(page);
  await page.evaluate(() => { const e = window.__kronland; e.sim.players[0].stock.gold = 0; e.buySerf(1); });
  await expect(page.getByTestId('toasts')).toContainText('Nicht genug Taler', SLOW);
  expect(errors).toEqual([]);
});
