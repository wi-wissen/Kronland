// Deploy simulation: build A (dist/, served by the test's own server with GitHub Pages headers) is open with an
// installed service worker, then the server switches to build B (built here with KRONLAND_BUILD=b). A normal reload
// must show B at once; an open tab in the menu reloads itself; a running game gets a notice instead
// (src/pwa.js, scripts/sw-pages.js, docs/PERFORMANCE.md#updates-nach-einem-deploy); a page from before the update
// handling is reloaded once by the new worker (scripts/sw-legacy.js). Desktop only (one build B).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startStaticServer } from './static-server.js';

const PORT = (Number(process.env.E2E_PORT) || 4173) + 57;
const BASE = `http://localhost:${PORT}`;
const DIST_A = resolve('dist');
let distB, tmp, server;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({}, info) => {
  if (info.project.name !== 'desktop') return;
  test.setTimeout(400_000);
  if (!existsSync(join(DIST_A, 'play/index.html'))) throw new Error('dist/ missing (the web server builds it)');
  tmp = mkdtempSync(join(tmpdir(), 'kronland-deploy-'));
  distB = join(tmp, 'dist-b');
  execFileSync('npx', ['vite', 'build', '--outDir', distB, '--emptyOutDir', '--logLevel', 'warn'], { env: { ...process.env, KRONLAND_BUILD: 'b' }, stdio: 'inherit', timeout: 380_000 });
  server = await startStaticServer({ root: DIST_A, port: PORT });
});

test.afterAll(async () => {
  await server?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'deploy simulation runs once (desktop)');
  server.setRoot(DIST_A);
});

/** Build label of the running page ('' = A, 'b' = B); null while navigating. */
const build = (page) => page.evaluate(() => window.__kronlandBuild).catch(() => null);

/** Open build A and wait until its service worker controls the page and has filled the precache. */
async function openA(page, path = '/play/') {
  await page.goto(BASE + path);
  await page.waitForFunction(() => navigator.serviceWorker?.controller && navigator.serviceWorker.ready.then(() => true), null, { timeout: 120_000 });
  expect(await build(page)).toBe('');
}

/** Deploy B and let the open tab's worker look for it (as the browser does on the next navigation or check). */
async function deployB(page) {
  server.setRoot(distB);
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update())).catch(() => {});
}

test('a normal reload after a deploy shows the new version at once', async ({ page }) => {
  test.setTimeout(180_000);
  const broken = [];
  page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
  page.on('pageerror', (e) => broken.push(String(e)));
  await openA(page);
  server.setRoot(distB);
  await page.reload();
  expect(await build(page)).toBe('b');
  await expect(page.getByTestId('start-menu')).toBeVisible({ timeout: 30_000 });
  expect(broken).toEqual([]);
});

test('an open tab in the menu reloads itself when the new version takes over', async ({ page }) => {
  test.setTimeout(180_000);
  await openA(page);
  await deployB(page);
  await expect.poll(() => build(page), { timeout: 90_000 }).toBe('b');
});

test('a running game is not interrupted: notice in the game menu, save and reload on request', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openA(page, '/play/?seed=42&no-models');
  await page.waitForFunction(() => window.__kronland?.renderer?.frameNo > 2, null, { timeout: 120_000 });
  await deployB(page);
  // the new worker takes over, the page notices it is outdated – but stays on A
  await page.getByTestId('menu').click();
  await expect(page.getByTestId('gmenu-update')).toBeVisible({ timeout: 90_000 });
  expect(await build(page)).toBe('');
  // evidence pictures: game menu with the notice, desktop and phone width
  const shots = process.env.UPDATE_SHOTS ?? 'test-results';
  await page.screenshot({ path: `${shots}/update-notice-desktop.png`, timeout: 120_000 });
  await page.setViewportSize({ width: 412, height: 915 });
  await expect(page.getByTestId('gmenu-update-reload')).toBeVisible();
  await page.screenshot({ path: `${shots}/update-notice-phone.png`, timeout: 120_000 });
  await page.getByTestId('gmenu-update-reload').click();
  await expect.poll(() => build(page), { timeout: 60_000 }).toBe('b');
  // the game was saved first: the start menu offers to continue it
  await expect(page.getByTestId('continue')).toBeVisible({ timeout: 30_000 });
});

test('a page from before the update handling is reloaded once by the new worker, without a loop', async ({ context, page }) => {
  test.setTimeout(180_000);
  // Legacy page: no answer script, no game code (it cannot notice updates itself). Shows which build served it.
  server.setOverride((url, dir) => (url.pathname === '/play/' && url.searchParams.has('legacy')
    ? `<!doctype html><html><head><meta charset="utf-8"><title>legacy</title></head><body><p id="build">${dir === DIST_A ? 'a' : 'b'}</p></body></html>`
    : null));
  try {
    await openA(page); // installs the worker of build A
    const old = await context.newPage();
    let loads = 0;
    old.on('load', () => { loads++; });
    await old.goto(BASE + '/play/?legacy');
    await expect(old.locator('#build')).toHaveText('a');
    expect(await old.evaluate(() => document.visibilityState)).toBe('visible');
    await deployB(page);
    // the new worker greets every window; the legacy page stays silent and is reloaded – onto build B
    await expect(old.locator('#build')).toHaveText('b', { timeout: 60_000 });
    // still silent after the reload, but no second round: exactly one reload
    await old.waitForTimeout(5000);
    expect(loads).toBe(2);
  } finally {
    server.setOverride(null);
  }
});
