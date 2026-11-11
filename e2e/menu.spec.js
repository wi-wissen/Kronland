import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';
import { openSeries, playLevel, openFreePlay } from './menu.js';

// The start menu, the library, free play and the saves list from the player's view (docs/ARCHITEKTUR.md#startmenü-bibliothek-freies-spiel-und-spielstände).
// Without models so that games start quickly even with software graphics.

test.describe.configure({ timeout: 300_000 });
const SLOW = { timeout: 60_000 };
const isPhone = (page) => page.viewportSize().width < 760;

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-')) localStorage.removeItem(k);
      localStorage.setItem('kronland-settings', JSON.stringify({ autosave: false }));
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  return errors;
}

/** Leave a running game: the menu saves it on the way out (autosave is switched on for these tests). */
async function quitToMenu(page) {
  await page.getByTestId('menu').click();
  await page.getByTestId('quit').click();
  await page.getByTestId('quit').click();
  await expect(page.getByTestId('start-menu')).toBeVisible();
}

test('Start menu: no save game, no "continue"; the three kinds, free play and workshop; nothing technical', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await expect(page.getByTestId('start-menu')).toBeVisible();
  await expect(page.getByTestId('continue')).toHaveCount(0);
  for (const id of ['menu-kind-first', 'menu-kind-stories', 'menu-kind-code', 'menu-free', 'menu-workshop', 'menu-library', 'menu-settings']) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId('menu-kind-first')).toContainText('Erste Schritte');
  await expect(page.getByTestId('menu-kind-stories')).toContainText('Geschichten');
  await expect(page.getByTestId('menu-kind-code')).toContainText('Programmieren');
  // No server configured: no account, no sign-in
  await expect(page.getByTestId('account')).toHaveCount(0);
  const text = await page.getByTestId('start-menu').innerText();
  for (const word of [/Quelle/i, /Seed/i, /Export/i, /Import/i, /Sync/i, /Entdecken/i, /Datei öffnen/i]) expect(text).not.toMatch(word);
  // the page does not scroll sideways
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Start menu with a save game: the big "Weiterspielen" continues, "Alle Spielstände" lists it', async ({ page }) => {
  const errors = await fresh(page);
  await page.addInitScript(() => localStorage.setItem('kronland-settings', JSON.stringify({ autosave: true })));
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, { timeout: 300_000 });
  await page.evaluate(() => { window.__kronland.sim.players[0].stock.gold = 888; window.__kronland.emitUi(); });
  await quitToMenu(page);
  await expect(page.getByTestId('continue-card')).toBeVisible();
  await expect(page.getByTestId('continue-name')).toHaveText('Freies Spiel');
  await expect(page.getByTestId('continue-card')).toContainText('Karte 42');
  await expect(page.getByTestId('continue-card')).toContainText(/gespeichert/i);
  await expect(page.getByTestId('menu-saves')).toHaveText('Alle Spielstände (1)');
  await page.getByTestId('menu-saves').click();
  await expect(page.getByTestId('save-item')).toHaveCount(1);
  await expect(page.getByTestId('save-item')).toContainText('Freies Spiel');
  // not signed in and no server: no note about the account, no "where" line
  await expect(page.getByTestId('save-note')).toHaveCount(0);
  await expect(page.getByTestId('save-where')).toHaveCount(0);
  // The "…" menu knows exactly three things
  await page.getByTestId('save-more').click();
  await expect(page.getByTestId('save-menu').getByRole('menuitem')).toHaveText(['Weiterspielen', 'Herunterladen', 'Löschen']);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('save-menu')).toHaveCount(0);
  await page.getByTestId('saves-close').click();
  await page.getByTestId('continue').click();
  await page.waitForFunction(() => window.__kronland?.sim.players[0].stock.gold === 888, null, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('Library: tabs per kind, filters with counts, search, reset', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-library').click();
  await expect(page.getByTestId('library-menu')).toBeVisible();
  await expect(page.getByTestId('lib-count')).toHaveText('6 Einträge');
  await expect(page.getByTestId('lib-tab-all')).toContainText('6');
  await page.getByTestId('lib-tab-stories').click();
  await expect(page.getByTestId('lib-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('series-campaign')).toContainText('Krone aus Eis');
  await expect(page.getByTestId('series-campaign')).toContainText('ca. 6 Std');
  await page.getByTestId('lib-tab-all').click();

  // Filters (on a phone behind the "Filter" button, in a sheet from below)
  if (isPhone(page)) {
    await expect(page.getByTestId('lib-filters')).toBeHidden();
    await page.getByTestId('lib-filter-open').click();
  }
  await expect(page.getByTestId('lib-filters')).toBeVisible();
  await page.getByTestId('lib-f-difficulty-hard').check();
  if (isPhone(page)) await page.getByTestId('lib-filter-show').click();
  await expect(page.getByTestId('lib-empty')).toBeVisible(); // nothing built in is rated hard as a whole
  if (isPhone(page)) await page.getByTestId('lib-filter-open').click();
  await page.getByTestId('lib-filter-reset').click();
  await page.getByTestId('lib-f-difficulty-easy').check();
  if (isPhone(page)) await page.getByTestId('lib-filter-show').click();
  await expect(page.getByTestId('lib-list').locator('li').first()).toBeVisible();
  const easy = await page.getByTestId('lib-list').locator('li').count();
  expect(easy).toBeGreaterThan(0);
  expect(easy).toBeLessThan(6);
  if (isPhone(page)) await page.getByTestId('lib-filter-open').click();
  await page.getByTestId('lib-filter-reset').click();
  if (isPhone(page)) await page.getByTestId('lib-filter-show').click();
  await page.getByTestId('lib-search').fill('skript');
  await expect(page.getByTestId('lib-list').locator('li')).toHaveCount(1);
  await expect(page.getByTestId('series-script-missions')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Series detail: one button per level, the reason for locked ones, win unlocks the next, running level continues', async ({ page }) => {
  const errors = await fresh(page);
  await page.addInitScript(() => localStorage.setItem('kronland-settings', JSON.stringify({ autosave: true })));
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c1', null, { timeout: 300_000 });
  await page.evaluate(() => { const e = window.__kronland; e.sim.mission.finish(e.sim, true, 'objectives'); e.emitUi(); });
  await expect(page.getByTestId('mission-result-title')).toHaveText('Sieg!');
  await page.getByTestId('to-library').click();
  await page.getByTestId('series-campaign').click();
  const row = (id) => page.getByTestId('level-row-' + id);
  await expect(row('c1').getByRole('button')).toHaveText(['Nochmal spielen']);
  await expect(row('c2').getByRole('button')).toHaveText(['Spielen']);
  await expect(row('c3').getByRole('button')).toHaveCount(0);
  await expect(row('c3')).toContainText('vorigen Kapitel');
  await expect(page.getByTestId('series-play')).toContainText('Spielen – Kapitel II');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // Start chapter 2, leave: the game saves; now the row continues and offers "Von vorn beginnen"
  await playLevel(page, 'c2');
  await page.waitForFunction(() => window.__kronland?.sim.mission?.state.id === 'c2', null, SLOW);
  await page.evaluate(() => { window.__kronland.sim.players[0].stock.gold = 4242; window.__kronland.emitUi(); });
  await quitToMenu(page);
  await openSeries(page, 'stories', 'campaign');
  await expect(row('c2').getByRole('button')).toHaveText(['Weiterspielen', 'Von vorn beginnen']);
  await expect(page.getByTestId('series-play')).toContainText('Weiterspielen – Kapitel II');
  await playLevel(page, 'c2');
  await page.waitForFunction(() => window.__kronland?.sim.players[0].stock.gold === 4242, null, SLOW);
  expect(errors).toEqual([]);
});

test('Free play: random map, opponents removable with ×, start with the chosen number', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?no-models'));
  await openFreePlay(page);
  await expect(page.getByTestId('free-menu')).toBeVisible();
  await expect(page.getByTestId('map-random')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('map-number')).toBeVisible();
  await expect(page.getByTestId('opponent-1')).toBeVisible();
  await expect(page.getByTestId('opponent-2')).toHaveCount(0);
  await page.getByTestId('opp-add').click();
  await page.getByTestId('opp-add').click();
  await expect(page.getByTestId('opp-add')).toHaveCount(0); // up to three
  await page.getByTestId('opp-remove').first().click();
  await expect(page.getByTestId('opponent-3')).toHaveCount(0);
  await page.getByTestId('map-number').fill('62921');
  const removers = page.getByTestId('opp-remove');
  expect(await removers.count()).toBe(2);
  // the × is a full tap target on every device
  const box = await removers.first().boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(43);
  expect(box.height).toBeGreaterThanOrEqual(43);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__kronland, null, { timeout: 300_000 });
  expect(await page.evaluate(() => window.__kronland.sim.players.length)).toBe(3);
  expect(await page.evaluate(() => window.__kronland.sim.seed)).toBe(62921);
  expect(errors).toEqual([]);
});

test('Free play: without opponents you play alone', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?no-models'));
  await openFreePlay(page);
  await page.getByTestId('opp-remove').click();
  await expect(page.getByTestId('opponent-1')).toHaveCount(0);
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__kronland, null, { timeout: 300_000 });
  expect(await page.evaluate(() => window.__kronland.sim.players.length)).toBe(1);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  expect(errors).toEqual([]);
});
