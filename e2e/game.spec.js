import { test, expect } from '@playwright/test';

/** Load the game and wait for the engine. */
async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=42');
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
  await page.getByRole('button', { name: 'Burg' }).click();
  await page.getByTestId('buy-serf').click();
  await expect(page.getByTestId('res-gold')).toHaveText('450');
});

test('Place a house via the build menu', async ({ page }, info) => {
  await boot(page);
  await page.getByRole('button', { name: 'Alle' }).click();
  if (info.project.name === 'mobile') await page.getByTestId('build-toggle').click();
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
  const sites = await page.evaluate(() => [...window.__kronland.sim.entities.values()].filter((e) => e.type === 'residence').length);
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
