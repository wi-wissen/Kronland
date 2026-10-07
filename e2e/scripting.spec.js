import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { API_DOC } from '../src/sim/scripting/api.js';
import { PY_DOC } from '../src/ui/script/reference.js';
import { playUrl } from './paths.js';

// Scripting reference (scripting/): chapters, one entry per command with example and real VM output, search,
// deep links, language switch; links from the header, the adventure menu and the in-game command help.
// Screenshots go to REF_SHOTS (folder) if set.
test.use({ locale: 'de-DE' });

const SHOTS = process.env.REF_SHOTS;
async function shot(page, testInfo, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}-${testInfo.project.name}.png`), fullPage: false });
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
});

function watch(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('http://localhost')) problems.push(`${r.status()} ${r.url()}`); });
  return problems;
}

test('Reference: a section per command, examples with output, search and deep links', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const problems = watch(page);
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.goto('/scripting/');
  await expect(page.getByTestId('nav-scripting')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('h1')).toHaveText('Programmier-Referenz');
  await shot(page, testInfo, 'scripting-top');

  // One entry per game command and per Python built-in, each with an example
  for (const e of [...API_DOC, ...PY_DOC]) await expect(page.getByTestId(`ref-${e.name}`), e.name).toHaveCount(1);
  await expect(page.locator('.ref-entry .ref-example')).toHaveCount(API_DOC.length + PY_DOC.length);
  // Python examples show the output of the real VM
  await expect(page.getByTestId('ref-divmod').locator('.ref-out')).toContainText('2 min 15 s');
  await expect(page.locator('#sec-language .ref-out').first()).toContainText('a ist kleiner');
  await expect(page.locator('.ref-out.err')).toHaveCount(0);

  // Deep link to a command (as from the in-game help)
  await page.goto('/scripting/#hero.step');
  const step = page.getByTestId('ref-hero.step');
  await expect(step).toBeInViewport();
  await expect(step).toContainText('Blickrichtung');
  await expect(step.locator('.ref-errors')).toContainText('GameError');
  await shot(page, testInfo, 'scripting-hero-step');

  // Mission-only commands are marked
  await expect(page.getByTestId('ref-spawn').locator('.ref-badge')).toHaveText('nur Mission');

  // Search finds commands by name and by text
  const search = page.getByTestId('scripting-search');
  await search.fill('trees_near');
  await expect(page.getByTestId('scripting-results')).toContainText('trees_near(target, radius=6)');
  await search.fill('Würfel');
  await expect(page.getByTestId('scripting-results')).toContainText('random.randint');
  await page.getByTestId('scripting-results').locator('a').first().click();
  await expect(page.getByTestId('ref-random.randint')).toBeInViewport();
  await shot(page, testInfo, 'scripting-random');

  // English: same anchors, English texts and example wording
  await page.getByTestId('site-lang-en').click();
  await expect(page.locator('h1')).toHaveText('Scripting reference');
  await expect(page.getByTestId('ref-hero.ahead').locator('.ref-code')).toContainText('Ahead of me:');
  await expect(page.getByTestId('ref-spawn').locator('.ref-badge')).toHaveText('mission only');
  expect(problems).toEqual([]);
});

test('Reference is linked from the home page, the adventure menu and the in-game help', async ({ page }) => {
  test.setTimeout(180_000);
  const problems = watch(page);
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.goto('/');
  await expect(page.getByTestId('home-scripting')).toHaveAttribute('href', './scripting/');

  await page.goto(playUrl());
  await expect(page.getByTestId('menu-link-scripting')).toHaveAttribute('href', '../scripting/');
  await page.getByTestId('menu-adventures').click();
  await expect(page.getByTestId('open-reference')).toHaveAttribute('href', '../scripting/');

  // Code panel: "Reference" (toolbar on the desktop, "⋯" menu on phones) links to the website
  await page.getByTestId('adventure-start').click();
  await page.waitForFunction(() => !!window.__kronland, null, { timeout: 30_000 });
  await expect(page.getByTestId('script-panel')).toBeAttached({ timeout: 30_000 });
  const fab = page.getByTestId('script-open');
  if (await fab.isVisible()) {
    await fab.click();
    await page.getByTestId('script-menu').click();
  }
  await expect(page.getByTestId('script-reference')).toHaveAttribute('href', '../scripting/');
  expect(problems.filter((p) => !p.includes('favicon'))).toEqual([]);
});
