import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';
import { quick } from './quick.js';
import { BUILDINGS } from '../src/sim/data/buildings.js';

// Serfs selected: action bar (Build, To arms, Group) or build view (build menu), remembered across selections
// and reloads. Building details as an info strip above the panel (hover, phone: long press), Esc steps back.
// Screenshots of every state to SERFBAR_SHOTS (folder) if set – then with 3D models.

const SLOW = { timeout: 20_000 };
const SHOTS = process.env.SERFBAR_SHOTS;
const URL = SHOTS ? '/?seed=42' : '/?seed=42&no-models';

async function boot(page, isMobile) {
  const errors = [];
  // Screenshots on the desktop at 1440×900 (medium width: tabs)
  if (SHOTS && !isMobile) await page.setViewportSize({ width: 1440, height: 900 });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-serfbar-init')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-serfbar-init', '1');
    }
  });
  await page.goto(playUrl(URL.replace(/^\//, '')));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  return errors;
}

async function shot(page, name, project) {
  if (!SHOTS) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/${project}-${name}.png` });
}

/** Select one serf (the camera stays where it is, so the castle is in view) */
async function selectSerf(page) {
  await quick(page, 'all');
  await page.evaluate(() => {
    const en = window.__kronland;
    const first = [...en.selected][0];
    en.selected.clear();
    en.selected.add(first);
    en.focusHeadquarters?.();
    en.selected.clear();
    en.selected.add(first);
    en.emitUi();
  });
}

const placing = (page) => page.evaluate(() => window.__kronland.placing?.type ?? null);
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kronland-settings') ?? '{}').serfBuildView);

test('Serfs: build view and action bar, remembered; Back, B and Esc step through', async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  const errors = await boot(page, isMobile);
  await selectSerf(page);
  // Default: build view (as before) with Back button
  await expect(page.getByTestId('build-menu')).toBeVisible();
  await expect(page.getByTestId('build-back')).toBeVisible();
  // Medium width (1280/1440) and phone: tabs, the first one active
  await expect(page.getByTestId('build-menu')).toHaveAttribute('data-layout', 'tabs');
  await expect(page.getByTestId('build-tab-home')).toHaveAttribute('aria-selected', 'true');
  await shot(page, '2-build-view', info.project.name);
  // Back → action bar, remembered
  await page.getByTestId('build-back').click();
  await expect(page.getByTestId('serf-actions')).toBeVisible();
  await expect(page.getByTestId('build-menu')).toHaveCount(0);
  await expect(page.getByTestId('serf-build')).toContainText('Bauen');
  await expect(page.getByTestId('serf-arm')).toContainText('Zu den Waffen');
  await expect(page.getByTestId('serf-group')).toContainText('Gruppe 1');
  expect(await stored(page)).toBe(false);
  await shot(page, '1-action-bar', info.project.name);
  // New selection and reload keep the action bar
  await page.evaluate(() => window.__kronland.clearSelection());
  await expect(page.getByTestId('context-panel')).toHaveCount(0);
  await selectSerf(page);
  await expect(page.getByTestId('serf-actions')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  await selectSerf(page);
  await expect(page.getByTestId('serf-actions')).toBeVisible();
  // Build button (desktop also key B) → build view
  if (isMobile) await page.getByTestId('serf-build').click();
  else await page.keyboard.press('b');
  await expect(page.getByTestId('build-menu')).toBeVisible();
  expect(await stored(page)).toBe(true);
  // Tap/click places as before; the build view stays remembered after placing
  await page.getByTestId('build-residence').click();
  expect(await placing(page)).toBe('residence');
  await expect(page.getByTestId('place-cancel')).toBeVisible();
  await shot(page, '4-placing', info.project.name);
  if (!isMobile) {
    // Esc: placing → build view → action bar → no selection
    await page.keyboard.press('Escape');
    expect(await placing(page)).toBeNull();
    await expect(page.getByTestId('build-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('serf-actions')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('context-panel')).toHaveCount(0);
    await expect(page.getByTestId('game-menu')).toHaveCount(0);
  } else {
    await page.getByTestId('place-cancel').click();
    await expect(page.getByTestId('build-menu')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Serfs: To arms turns the selection into militia', async ({ page, isMobile }) => {
  const errors = await boot(page, isMobile);
  await selectSerf(page);
  await page.getByTestId('build-back').click();
  await page.getByTestId('serf-arm').click();
  // The selection is now militia: army panel with "Back to work"
  await expect(page.getByTestId('militia-off')).toBeVisible(SLOW);
  expect(errors).toEqual([]);
});

test('Build info: hover shows details above the panel, click hides them and places', async ({ page, isMobile }, info) => {
  test.skip(isMobile, 'mouse hover');
  const errors = await boot(page, isMobile);
  await selectSerf(page);
  const res = BUILDINGS.residence, lvl = res.levels[0];
  await page.getByTestId('build-residence').hover();
  const strip = page.getByTestId('build-info');
  await expect(strip).toBeVisible();
  await expect(page.getByTestId('build-info-name')).toHaveText('Wohnhaus');
  await expect(strip).toContainText(`${lvl.buildTime} s mit 1 Leibeigenem`);
  await expect(strip).toContainText(`${Math.ceil(lvl.buildTime / res.builders)} s mit ${res.builders} Bauenden`);
  await expect(strip).toContainText(`${lvl.beds} Betten`);
  await expect(strip).toContainText('3×3 Felder');
  // Strip sits on the top edge of the panel, same width; no floating tooltip in addition
  const [s, p] = await Promise.all([strip.boundingBox(), page.getByTestId('context-panel').boundingBox()]);
  expect(Math.abs(s.width - p.width)).toBeLessThan(2);
  expect(Math.abs(s.y + s.height - p.y)).toBeLessThan(10);
  await expect(page.getByTestId('tooltip')).toHaveCount(0);
  await shot(page, '3a-info', info.project.name);
  // Locked: reason with where to research it (tab "Veredelung")
  await page.getByTestId('build-tab-refine').click();
  await page.getByTestId('build-brickworks').hover();
  await expect(page.getByTestId('build-info-reason')).toContainText('Konstruktion');
  await expect(page.getByTestId('build-info-reason')).toContainText('erforschen in: Hochschule');
  await shot(page, '3b-info-locked', info.project.name);
  // Leaving hides it
  await page.mouse.move(5, 300);
  await expect(strip).toHaveCount(0);
  // Click hides the info and starts placement
  await page.getByTestId('build-tab-home').click();
  await page.getByTestId('build-farm').hover();
  await expect(strip).toBeVisible();
  await page.getByTestId('build-farm').click();
  await expect(strip).toHaveCount(0);
  expect(await placing(page)).toBe('farm');
  expect(errors).toEqual([]);
});

test('Build info: too expensive marks the missing cost (screenshot)', async ({ page, isMobile }, info) => {
  test.skip(!SHOTS, 'screenshot only');
  const errors = await boot(page, isMobile);
  await page.evaluate(() => { const en = window.__kronland; en.sim.players[en.player].stock.wood = 120; });
  await selectSerf(page);
  await expect(page.getByTestId('build-farm')).toHaveClass(/poor/);
  if (isMobile) await longPress(page, page.getByTestId('build-farm'), async () => shot(page, '3c-info-too-expensive', info.project.name));
  else {
    await page.getByTestId('build-farm').hover();
    await expect(page.getByTestId('build-info-reason')).toContainText('Nicht genug');
    await shot(page, '3c-info-too-expensive', info.project.name);
  }
  expect(errors).toEqual([]);
});

/** Real touch long press via CDP; `during` runs while the finger is down. */
async function longPress(page, loc, during) {
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(700);
  await during();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('Phone: long press shows the info strip, releasing hides it, no placement', async ({ page, isMobile }, info) => {
  test.skip(!isMobile, 'touch');
  const errors = await boot(page, isMobile);
  await selectSerf(page);
  await expect(page.getByTestId('build-touch-hint')).toBeVisible();
  const strip = page.getByTestId('build-info');
  await longPress(page, page.getByTestId('build-residence'), async () => {
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Wohnhaus');
    await expect(strip).toContainText(`${BUILDINGS.residence.levels[0].buildTime} s mit 1 Leibeigenem`);
    await shot(page, '3a-info', info.project.name);
  });
  await expect(strip).toHaveCount(0);
  expect(await placing(page)).toBeNull();
  // Locked building: reason with where to research it
  await page.getByTestId('build-tab-refine').tap();
  await longPress(page, page.getByTestId('build-brickworks'), async () => {
    await expect(page.getByTestId('build-info-reason')).toContainText('erforschen in: Hochschule');
    await shot(page, '3b-info-locked', info.project.name);
  });
  await expect(strip).toHaveCount(0);
  // A normal tap places as before
  await page.getByTestId('build-tab-home').tap();
  await page.getByTestId('build-residence').tap();
  expect(await placing(page)).toBe('residence');
  expect(errors).toEqual([]);
});

test('Build menu: tabs where the groups do not fit side by side, last tab remembered; wide screens keep all groups', async ({ page, isMobile }, info) => {
  test.setTimeout(120_000);
  const errors = await boot(page, isMobile);
  await selectSerf(page);
  const menu = page.getByTestId('build-menu');
  await expect(menu).toHaveAttribute('data-layout', 'tabs');
  // Only the active group is shown; the tab is clearly marked
  await page.getByTestId('build-tab-military').click();
  await expect(page.getByTestId('build-tab-military')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('build-tab-home')).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByTestId('build-barracks')).toBeVisible();
  await expect(page.getByTestId('build-residence')).toHaveCount(0);
  await expect(page.getByTestId('build-group-home')).toHaveCount(0);
  // The tab stays after placing and across a new selection and a reload
  await page.reload();
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  await selectSerf(page);
  await expect(page.getByTestId('build-tab-military')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('build-tab-home').click();
  if (isMobile) { expect(errors).toEqual([]); return; }
  if (SHOTS) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByTestId('build-tab-refine').click();
    await shot(page, '6-1920-tabs', info.project.name);
    await page.getByTestId('build-tab-home').click();
  }
  // Wide window: all groups side by side in two rows, no tabs
  await page.setViewportSize({ width: 2560, height: 1440 });
  await expect(menu).toHaveAttribute('data-layout', 'wide');
  await expect(page.getByTestId('build-tab-home')).toHaveCount(0);
  for (const g of ['home', 'raw', 'refine', 'military', 'admin']) await expect(page.getByTestId('build-group-' + g)).toBeVisible();
  await page.getByTestId('build-residence').hover();
  await expect(page.getByTestId('build-info')).toBeVisible();
  await shot(page, '5-wide-info', info.project.name);
  await page.mouse.move(5, 300);
  await shot(page, '5-wide', info.project.name);
  // Back to a medium window: tabs again
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(menu).toHaveAttribute('data-layout', 'tabs');
  expect(errors).toEqual([]);
});
