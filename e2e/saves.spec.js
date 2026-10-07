import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';
import { readFileSync } from 'node:fs';

// Save games: save, list, load, rename, delete, export, import, error messages.
// Without models so that the start is quick even with software graphics.

test.describe.configure({ timeout: 600_000 });

/**
 * Start a game. Autosave off unless a test checks it: the first autosave comes 30 game seconds after the start and
 * would otherwise appear as an extra entry in the lists (game time runs in real time even with slow frames).
 */
async function boot(page, url = '/?seed=42&no-models', { autosave = false } = {}) {
  if (!autosave) {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('kronland-settings') || '{}');
      localStorage.setItem('kronland-settings', JSON.stringify({ ...s, autosave: false }));
    });
  }
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && /Spielstände|[Ss]ave/.test(m.text())) console.log('[Browser]', m.text()); });
  await page.goto(playUrl(url), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__kronland, null, { timeout: 300_000 });
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  return errors;
}

const setGold = (page, n) => page.evaluate((n) => { window.__kronland.sim.players[0].stock.gold = n; window.__kronland.emitUi(); }, n);

/** Save under a name via the game menu. */
async function saveAs(page, name) {
  await page.getByTestId('menu').click();
  await page.getByTestId('save').click();
  const input = page.getByTestId('save-name');
  await expect(input).toHaveValue(/Freies Spiel Seed 42 – \d+:\d\d/);
  await input.fill(name);
  await page.getByTestId('save-new').click();
  // Menu closes, notice appears
  await expect(page.getByTestId('game-menu')).toBeHidden();
}

async function quitToMenu(page) {
  await page.getByTestId('menu').click();
  await page.getByTestId('quit').click();
  await page.getByTestId('quit').click();
  await expect(page.getByTestId('start-menu')).toBeVisible();
}

test('save, list with preview image, load with confirmation', async ({ page }) => {
  const errors = await boot(page);
  await setGold(page, 777);
  await saveAs(page, 'Testburg');
  await setGold(page, 1);

  await page.getByTestId('menu').click();
  await page.getByTestId('load').click();
  const item = page.getByTestId('save-item').filter({ hasText: 'Testburg' });
  await expect(item).toHaveCount(1);
  await expect(item.locator('.sv-thumb img')).toHaveAttribute('src', /^data:image\/(webp|png)/);
  await expect(item).toContainText('Freies Spiel Seed 42');
  await expect(page.getByTestId('save-store')).toContainText('IndexedDB');
  await expect(page.getByTestId('save-usage')).toContainText(/MB/);
  await item.getByTestId('save-load').click();
  // own confirmation dialog, cancel leaves everything as it was
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-cancel').click();
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  expect(await page.evaluate(() => window.__kronland.sim.players[0].stock.gold)).toBe(1);
  await item.getByTestId('save-load').click();
  await page.getByTestId('confirm-ok').click();
  await page.waitForFunction(() => window.__kronland?.sim.players[0].stock.gold === 777, null, { timeout: 60_000 });
  await expect(page.getByTestId('res-gold')).toHaveText('777');
  expect(errors).toEqual([]);
});

test('overwrite, rename and delete', async ({ page }) => {
  await boot(page);
  await saveAs(page, 'Erster Stand');
  await page.getByTestId('menu').click();
  await page.getByTestId('save').click();
  const item = page.getByTestId('save-item').filter({ hasText: 'Erster Stand' });
  await item.getByTestId('save-overwrite').click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('Erster Stand');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('game-menu')).toBeHidden();

  await page.getByTestId('menu').click();
  await page.getByTestId('load').click();
  await expect(page.getByTestId('save-item')).toHaveCount(1);
  await page.getByTestId('save-rename').click();
  await page.getByTestId('rename-input').fill('Umbenannt');
  await page.getByTestId('rename-ok').click();
  await expect(page.getByTestId('save-item-name')).toHaveText('Umbenannt');

  await page.getByTestId('save-delete').click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('Umbenannt');
  // Esc closes only the confirmation dialog, not the menu
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-dialog')).toBeHidden();
  await expect(page.getByTestId('save-browser')).toBeVisible();
  await page.getByTestId('save-delete').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('save-empty')).toBeVisible();
});

test('export (download) and import again', async ({ page }) => {
  await boot(page);
  await setGold(page, 4321);
  await saveAs(page, 'Exportburg');
  await page.getByTestId('menu').click();
  await page.getByTestId('load').click();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^kronland-exportburg-\d{4}-\d\d-\d\d\.json$/);
  const text = readFileSync(await download.path(), 'utf8');
  const doc = JSON.parse(text);
  expect(doc).toMatchObject({ format: 'kronland-save', formatVersion: 1, meta: { name: 'Exportburg', mode: 'free', seed: 42 } });
  expect(doc.gameVersion).toMatch(/^\d+\.\d+\.\d+/);
  expect(doc.state.players[0].stock.gold).toBe(4321);
  // readable, indented
  expect(text).toContain('\n  "meta": {');

  // Delete the save and restore it from the file
  await page.getByTestId('save-delete').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('save-empty')).toBeVisible();
  await page.getByTestId('save-file').setInputFiles({ name: 'my-save.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.getByTestId('save-message')).toContainText('Importiert: Exportburg', { timeout: 30_000 });
  await expect(page.getByTestId('save-item')).toHaveCount(1);
  // Preview image also for imported files (computed from the state)
  await expect(page.locator('.sv-thumb img')).toHaveAttribute('src', /^data:image\/(webp|png)/);
  await setGold(page, 2);
  await page.getByTestId('save-load').click();
  await page.getByTestId('confirm-ok').click();
  await page.waitForFunction(() => window.__kronland?.sim.players[0].stock.gold === 4321, null, { timeout: 60_000 });
});

test('Start menu: continue (autosave on leaving) and error messages on import', async ({ page }) => {
  const errors = await boot(page, undefined, { autosave: true });
  await setGold(page, 999);
  // Leaving saves automatically
  await quitToMenu(page);
  const cont = page.getByTestId('continue');
  await expect(cont).toBeVisible();
  await expect(page.getByTestId('continue-name')).toContainText('Freies Spiel Seed 42');

  await page.getByTestId('menu-saves').click();
  await expect(page.getByTestId('saves-dialog')).toBeVisible();
  await expect(page.getByTestId('save-item').filter({ hasText: 'Autosave' })).toHaveCount(1);
  const file = page.getByTestId('save-file');
  await file.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"kronland-save","formatVersion":1,"st') });
  await expect(page.getByTestId('save-message')).toContainText('keine lesbare JSON-Datei');
  await file.setInputFiles({ name: 'foreign.json', mimeType: 'application/json', buffer: Buffer.from('{"name":"anything"}') });
  await expect(page.getByTestId('save-message')).toContainText('kein Kronland-Spielstand');
  await file.setInputFiles({ name: 'new.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'kronland-save', formatVersion: 99, gameVersion: '9.9.9', meta: {}, state: {} })) });
  await expect(page.getByTestId('save-message')).toContainText('neueren Spielversion (9.9.9');
  await expect(page.getByTestId('save-item')).toHaveCount(1);
  await page.getByTestId('saves-close').click();

  await cont.click();
  await page.waitForFunction(() => window.__kronland?.sim.players[0].stock.gold === 999, null, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test('Autosave can be switched off in the settings', async ({ page }) => {
  await page.goto(playUrl(''), { waitUntil: 'domcontentloaded' });
  await page.getByTestId('menu-settings').click();
  const sw = page.getByTestId('autosave');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-settings')).autosave)).toBe(false);
  await page.goto(playUrl('?seed=42&no-models'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__kronland, null, { timeout: 300_000 });
  await quitToMenu(page);
  await expect(page.getByTestId('continue')).toHaveCount(0);
});

test('Import via drag & drop (desktop)', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'Drag & drop on desktop only');
  await boot(page);
  await saveAs(page, 'Ziehburg');
  await page.getByTestId('menu').click();
  await page.getByTestId('load').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-export').click()]);
  const text = readFileSync(await download.path(), 'utf8');
  const drop = async (content) => {
    const dt = await page.evaluateHandle((c) => {
      const d = new DataTransfer();
      d.items.add(new File([c], 'dropped.json', { type: 'application/json' }));
      return d;
    }, content);
    const target = page.getByTestId('save-browser');
    await target.dispatchEvent('dragenter', { dataTransfer: dt });
    await expect(page.locator('.sv-drop')).toBeVisible();
    await target.dispatchEvent('drop', { dataTransfer: dt });
  };
  await drop(text);
  await expect(page.getByTestId('save-message')).toContainText('Importiert: Ziehburg', { timeout: 30_000 });
  await expect(page.getByTestId('save-item')).toHaveCount(2);
  await drop('broken');
  await expect(page.getByTestId('save-message')).toContainText('keine lesbare JSON-Datei');
});
