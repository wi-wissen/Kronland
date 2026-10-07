import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import MILESTONES from '../docs/milestones.json' with { type: 'json' };
import { PLAY } from './paths.js';

// Blog: overview (story in order), one article per milestone with key figures, source links and paging, DE and EN,
// links from header, home page and start menu. Screenshots go to BLOG_SHOTS (folder) if set.
test.use({ locale: 'de-DE' });

const SHOTS = process.env.BLOG_SHOTS;
async function shot(page, testInfo, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}-${testInfo.project.name}.png`), fullPage: false });
}

/** Desktop at 1440×900 like in the other evidence, mobile stays Pixel 7. */
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
});

function watch(page) {
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('http://localhost')) problems.push(`${r.status()} ${r.url()}`); });
  return problems;
}

for (const lang of ['de', 'en']) {
  test(`Blog ${lang}: overview, article, paging`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const problems = watch(page);
    await page.addInitScript((l) => localStorage.setItem('kronland-lang', l), lang);
    await page.goto('/blog/');
    await expect(page.getByTestId('nav-blog')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('h1')).toHaveText('Blog');
    // Story in order: one article per milestone, oldest first; the pinned intro comes before
    const items = page.getByTestId('blog-list').locator('[data-slug]');
    await expect(items).toHaveCount(MILESTONES.length);
    expect(await items.evaluateAll((els) => els.map((e) => e.dataset.slug))).toEqual(MILESTONES.map((m) => m.id));
    await expect(page.locator('.bl-pinned')).toHaveAttribute('data-slug', 'about');
    await expect(items.first()).toContainText(MILESTONES[0][`title_${lang}`]);
    await shot(page, testInfo, `blog-index-${lang}`);

    // First milestone: key figures and source links, next to the second
    await items.first().locator('a').click();
    await expect(page).toHaveURL(new RegExp(`/blog/${MILESTONES[0].id}/$`));
    await expect(page.getByTestId('blog-title')).toHaveText(MILESTONES[0][`title_${lang}`]);
    const facts = page.getByTestId('blog-facts');
    await expect(facts).toContainText(lang === 'de' ? `${MILESTONES[0].files_changed} Dateien` : `${MILESTONES[0].files_changed} files`);
    await expect(facts).not.toContainText(/pull request|#\d/i);
    const repo = 'https://github.com/wi-wissen/Kronland';
    const c = MILESTONES[0].commit;
    await expect(page.getByTestId('blog-src-commit')).toHaveText(lang === 'de' ? /Code dieses Meilensteins/ : /Code of this milestone/);
    await expect(page.getByTestId('blog-src-commit')).toHaveAttribute('href', c ? `${repo}/commit/${c}` : `${repo}/tree/main`);
    await expect(page.getByTestId('blog-src-tree')).toHaveText(lang === 'de' ? /Projekt zu diesem Stand/ : /Project at this state/);
    await expect(page.getByTestId('blog-src-tree')).toHaveAttribute('href', `${repo}/tree/${c || 'main'}`);
    await expect(page.locator('.bl-kicker')).toContainText(lang === 'de' ? `Meilenstein 1 von ${MILESTONES.length}` : `Milestone 1 of ${MILESTONES.length}`);
    await expect(page.getByTestId('blog-article').locator('h2#what')).toBeVisible();
    await expect(page.getByTestId('blog-prev')).toHaveAttribute('href', /about\/$/);
    await page.getByTestId('blog-next').click();
    await expect(page).toHaveURL(new RegExp(`/blog/${MILESTONES[1].id}/$`));
    await expect(page.getByTestId('blog-title')).toHaveText(MILESTONES[1][`title_${lang}`]);

    // An article with working time on top (first wave of parallel tasks), opened directly
    const wave = MILESTONES.find((m) => m.id === 'first-wave');
    await page.goto(`/blog/${wave.id}/`);
    await expect(page.getByTestId('blog-facts')).toContainText(lang === 'de' ? 'Arbeitszeit' : 'Working time');
    await expect(page).toHaveTitle(new RegExp(wave[`title_${lang}`].slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await shot(page, testInfo, `blog-article-${lang}`);
    await page.getByTestId('blog-article').locator('h2#problems').scrollIntoViewIfNeeded();
    await shot(page, testInfo, `blog-article-problems-${lang}`);

    // Intro with key figures and way back to the overview
    await page.goto('/blog/about/');
    await expect(page.getByTestId('blog-article')).not.toContainText('{{');
    await expect(page.getByTestId('blog-next')).toHaveAttribute('href', new RegExp(`${MILESTONES[0].id}/$`));
    await page.getByTestId('blog-back').click();
    await expect(page).toHaveURL(/\/blog\/$/);

    // Unknown article: overview with a notice
    await page.goto('/blog/?post=does-not-exist');
    await expect(page.locator('.bl-missing')).toBeVisible();
    expect(problems).toEqual([]);
  });
}

test('Blog article: figures load, code blocks are highlighted', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const problems = watch(page);
  await page.goto('/blog/simulation-core/');
  const article = page.getByTestId('blog-article');
  await expect(article.locator('figure.code figcaption').first()).toHaveText('src/sim/sim.js');
  await expect(article.locator('pre.lang-js .tk-k').first()).toBeVisible();
  const figures = article.locator('figure:not(.code) img');
  expect(await figures.count()).toBeGreaterThanOrEqual(3);
  for (const img of await figures.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i) => (i.complete ? i.naturalWidth : 0)), { timeout: 30_000 }).toBeGreaterThan(0);
  }
  await article.locator('h2#pathfinding').scrollIntoViewIfNeeded();
  await shot(page, testInfo, 'blog-figures');
  expect(problems).toEqual([]);
});

test('Blog is reachable from the home page and the start menu', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await expect(page.getByTestId('home-blog')).toHaveAttribute('href', /blog\/$/);
  await page.goto(PLAY);
  await expect(page.getByTestId('start-menu')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('menu-link-blog')).toHaveAttribute('href', '../blog/');
  await page.getByTestId('menu-link-blog').click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.getByTestId('blog-list')).toBeVisible();
});
