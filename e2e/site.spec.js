import { test, expect } from '@playwright/test';
import { BUILDINGS } from '../src/sim/data/buildings.js';
import de from '../src/i18n/de.js';
import en from '../src/i18n/en.js';
import { PLAY } from './paths.js';

// Website: home page, manual, compendium and the way into the game. German as browser language so the texts are fixed.
test.use({ locale: 'de-DE' });

/** Collect errors of the own site: script errors, console errors, responses ≥ 400 (external fonts excepted). */
function watch(page) {
  const problems = [];
  const own = (url) => url.startsWith('http://localhost');
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text() + (m.location()?.url ?? ''))) problems.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && own(r.url())) problems.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { if (own(r.url())) problems.push(`failed ${r.url()}`); });
  return problems;
}

test('Home page loads with title image, features, gallery and footer', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await expect(page.getByTestId('home-hero')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Kronland');
  await expect(page.getByTestId('home-play')).toHaveText(/Jetzt spielen/);
  // Gallery images really loaded
  const gallery = page.getByTestId('gallery');
  await gallery.scrollIntoViewIfNeeded();
  const imgs = gallery.locator('img');
  await expect(imgs).toHaveCount(6);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
  // Open and close the lightbox
  await gallery.locator('button').first().click();
  await expect(page.locator('dialog.lightbox')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.lightbox')).toBeHidden();
  // For school: dev mode with image and link into the game with ?dev=1
  const school = page.getByTestId('home-school');
  await school.scrollIntoViewIfNeeded();
  await expect(school.locator('h2')).toHaveText('Informatik zum Anfassen');
  await expect(page.getByTestId('home-dev-play')).toHaveAttribute('href', /play\/\?dev=1$/);
  const devImg = school.locator('.school-shot img');
  await expect.poll(() => devImg.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.features')).toContainText('Bauen am Hang');
  await expect(page.getByTestId('credits')).toContainText('KayKit');
  expect(problems).toEqual([]);
});

test('"Jetzt spielen" leads into the game, the start menu links back', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await page.getByTestId('home-play').click();
  await expect(page).toHaveURL(new RegExp(`${PLAY}$`));
  await expect(page.getByTestId('start-menu')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('menu-link-manual')).toHaveAttribute('href', '../manual/');
  await page.getByTestId('menu-link-wiki').click();
  await expect(page).toHaveURL(/\/compendium\/$/);
  await expect(page.getByTestId('compendium')).toBeVisible();
  expect(problems).toEqual([]);
});

test('Manual: Inhaltsverzeichnis, Anker, Suche', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/manual/#saving');
  const manual = page.getByTestId('manual');
  await expect(manual.locator('h2#getting-started')).toHaveText('Erste Schritte');
  await expect(manual.locator('h2#saving')).toBeInViewport();
  await expect(manual).toContainText('JSON');
  // Placeholders from the game data are filled
  await expect(manual).not.toContainText('{{');
  await expect(manual.locator('h2')).toHaveCount(await manual.locator('section.doc-sec').count());
  // new chapters: building on slopes, dev mode, autosave
  await expect(manual.locator('h2#slope')).toHaveText('Bauen am Hang');
  await expect(manual.locator('h2#developer-mode')).toHaveText('Entwicklermodus');
  await expect(manual.locator('#sec-developer-mode')).toContainText('A*-Suche');
  await expect(manual.locator('#sec-saving')).toContainText('Autosave');
  await page.getByTestId('manual-search').fill('Winter');
  await expect(manual.locator('h2#weather')).toBeVisible();
  await expect(manual.locator('h2#saving')).toHaveCount(0);
  // Images of the manual present
  await page.getByTestId('manual-search').fill('');
  // Images retrievable (without rasterising all - that cripples software graphics for minutes); one really loaded
  const srcs = await manual.locator('img').evaluateAll((els) => els.map((el) => el.currentSrc || el.src));
  expect(srcs.length).toBeGreaterThan(5);
  for (const src of new Set(srcs)) {
    const r = await page.request.get(src);
    expect(r.status(), src).toBe(200);
    expect(r.headers()['content-type'], src).toMatch(/image\//);
  }
  const first = manual.locator('figure img').first();
  await first.scrollIntoViewIfNeeded();
  await expect.poll(() => first.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  expect(problems).toEqual([]);
});

test('Compendium: building table from the game data, deep link, search', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/compendium/');
  const table = page.getByTestId('wiki-table-buildings-table');
  await expect(table).toBeVisible();
  // every building type from src/sim/data/buildings.js has a row with its translated name
  const types = Object.keys(BUILDINGS);
  await expect(table.locator('tbody tr')).toHaveCount(types.length);
  for (const type of types) {
    await expect(table.locator(`tr#row-${type}`)).toContainText(de[`building.${type}.0`] ?? BUILDINGS[type].levels[0].name);
  }
  // Deep link to an entry
  await page.goto('/compendium/#b-farm');
  await expect(page.locator('#b-farm h3')).toBeInViewport();
  // Search finds a technology and jumps there
  await page.getByTestId('wiki-search').fill(de['tech.education']);
  const hit = page.getByTestId('wiki-results').getByRole('link', { name: de['tech.education'] }).first();
  await hit.click();
  await expect(page.locator('#t-education')).toBeInViewport();
  // Building on slopes: rules and worked example from the simulation
  await page.goto('/compendium/#slope');
  await expect(page.locator('#slope h2')).toBeInViewport();
  await expect(page.getByTestId('wiki-table-slope-after')).toBeVisible();
  // Map generator draws a preview
  await expect(page.getByTestId('map-preview').locator('.mp-stats')).toBeVisible({ timeout: 20_000 });
  expect(problems).toEqual([]);
});

test('Language switch applies to all pages and the game', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/compendium/');
  await expect(page.getByTestId('nav-manual')).toHaveText('Manual');
  await page.getByTestId('site-lang-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('nav-manual')).toHaveText('Manual');
  await expect(page.getByTestId('wiki-table-buildings-table').locator('tr#row-residence')).toContainText(en['building.residence.0']);
  await page.getByTestId('nav-manual').click();
  await expect(page.getByTestId('manual').locator('h2#getting-started')).toHaveText('Getting started');
  await page.getByTestId('nav-home').click();
  await expect(page.getByTestId('home-play')).toHaveText(/Play now/);
  // The game takes over the chosen language
  await page.goto(PLAY);
  await expect(page.getByTestId('start')).toHaveText(en['menu.start']);
  await page.goto('/');
  await page.getByTestId('site-lang-de').click();
  await expect(page.getByTestId('home-play')).toHaveText(/Jetzt spielen/);
  expect(problems).toEqual([]);
});

test('Without a saved choice the browser language applies', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'en-GB' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByTestId('home-play')).toHaveText(/Play now/);
  await ctx.close();
});
