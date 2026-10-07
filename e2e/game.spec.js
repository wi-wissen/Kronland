import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';
import { UNITS } from '../src/sim/data/units.js';
import { quick } from './quick.js';

/** Load the game and wait for the engine. */
async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  return errors;
}

/** Screen position for the middle of a building spot. */
async function screenPosFor(page, type) {
  return page.evaluate((type) => {
    const e = window.__kronland;
    const hq = e.sim.findBuilding(0, 'headquarters');
    const p = e.sim.findPlacement(0, type, hq.x + 2, hq.y + 6);
    const def = { residence: [3, 3] }[type];
    const x = p.x + def[0] / 2, z = p.y + def[1] / 2;
    e.renderer.rig.lookAt(x, z);
    e.renderer.rig.update(0);
    const s = e.renderer.project(x, e.renderer.terrain.heightAt(x, z), z);
    return { x: s.x, y: s.y, tile: p };
  }, type);
}

test('Game starts without errors and shows resources', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await expect(page.getByTestId('res-wood')).toHaveText('1750');
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('Buy a serf in the castle', async ({ page }) => {
  await boot(page);
  await quick(page, 'hq');
  await page.getByTestId('buy-serf').click();
  await expect(page.getByTestId('res-gold')).toHaveText('450');
});

test('Place a house via the build menu', async ({ page }, info) => {
  await boot(page);
  await quick(page, 'all');
  await page.getByTestId('build-residence').click();
  const pos = await screenPosFor(page, 'residence');
  await page.waitForTimeout(200);
  if (info.project.name === 'mobile') {
    await page.touchscreen.tap(pos.x, pos.y);
    await page.getByRole('button', { name: 'Hier bauen' }).click();
  } else {
    await page.mouse.move(pos.x, pos.y);
    await page.mouse.click(pos.x, pos.y);
  }
  await expect(page.getByTestId('res-wood')).toHaveText('1600');
  // Only the own residences: the computer opponents build their first residence early as well (game time runs in real time)
  const sites = await page.evaluate(() => [...window.__kronland.sim.entities.values()].filter((e) => e.type === 'residence' && e.owner === window.__kronland.player).length);
  expect(sites).toBe(1);
});

test('Start research in the university', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const hq = s.findBuilding(0, 'headquarters');
    const p = s.findPlacement(0, 'university', hq.x + 3, hq.y + 8, 30);
    const u = s.createBuilding(0, 'university', p.x, p.y, true);
    e.selected.clear(); e.selected.add(u.id); e.emitUi();
  });
  await page.getByTestId('tech-education').click();
  await expect(page.getByTestId('tech-education')).toContainText('läuft');
  await expect(page.getByTestId('res-gold')).toHaveText('450');
});

test('Recruit squads in the barracks', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, p = s.players[0];
    p.techs.add('conscription');
    p.stock.iron = 500;
    const hq = s.findBuilding(0, 'headquarters');
    const pos = s.findPlacement(0, 'barracks', hq.x + 3, hq.y + 8, 30);
    const b = s.createBuilding(0, 'barracks', pos.x, pos.y, true);
    e.selected.clear(); e.selected.add(b.id); e.emitUi();
  });
  await page.getByTestId('recruit-full-sword').click();
  await expect.poll(() => page.evaluate(() => [...window.__kronland.sim.entities.values()].filter((e) => e.kind === 'soldier' && e.owner === 0).length), { timeout: 45_000 }).toBe(4);
  await expect(page.getByTestId('res-gold')).toHaveText(String(500 - UNITS.sword1.leaderCost.gold - 4 * UNITS.sword1.soldierCost.gold));
});

test('Start menu: start a new game, save and load again', async ({ page }) => {
  // Saving compresses and writes asynchronously (IndexedDB); with software graphics the process takes longer
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl());
  await page.getByTestId('diff-easy').click();
  await page.getByTestId('start').click();
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  await page.evaluate(() => { window.__kronland.sim.players[0].stock.gold = 777; window.__kronland.emitUi(); });
  await page.getByTestId('menu').click();
  await page.getByTestId('save').click();
  await page.getByTestId('save-new').click();
  await expect(page.getByTestId('game-menu')).toBeHidden();
  await page.evaluate(() => { window.__kronland.sim.players[0].stock.gold = 1; });
  await page.getByTestId('menu').click();
  await page.getByRole('button', { name: 'Spiel laden' }).click();
  await page.getByTestId('save-load').click();
  await page.getByTestId('confirm-ok').click();
  await page.waitForFunction(() => window.__kronland?.sim.players[0].stock.gold === 777);
  await expect(page.getByTestId('res-gold')).toHaveText('777');
  expect(errors).toEqual([]);
});
