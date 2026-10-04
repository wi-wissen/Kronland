import { test, expect } from '@playwright/test';

// Building systems: building research, marketplace, weather plant, repair.

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Force German (texts in the expectations), independent of earlier runs
  await page.addInitScript(() => { try { localStorage.setItem('kronland-lang', 'de'); } catch { /* ignore */ } });
  await page.goto('/?seed=42');
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  return errors;
}

/** Place a building finished at no cost and select it. */
async function placeAndSelect(page, type, setup = {}) {
  return page.evaluate(({ type, setup }) => {
    const e = window.__kronland, s = e.sim, p = s.players[0];
    for (const t of setup.techs ?? []) p.techs.add(t);
    Object.assign(p.stock, setup.stock ?? {});
    const hq = s.findBuilding(0, 'headquarters');
    // Look for a building spot (findPlacement also checks the costs - make rich briefly)
    const keep = { ...p.stock };
    for (const r of Object.keys(p.stock)) p.stock[r] += 10000;
    const pos = s.findPlacement(0, type, hq.x + 3, hq.y + 8, 30);
    p.stock = keep;
    const b = s.createBuilding(0, type, pos.x, pos.y, true);
    if (setup.level) { b.level = setup.level; b.hp = 1000; }
    if (setup.hp) b.hp = setup.hp;
    e.renderer.rig.lookAt(b.x + b.w / 2, b.y + b.h / 2);
    e.selected.clear(); e.selected.add(b.id); e.emitUi();
    return b.id;
  }, { type, setup });
}

test('Smithy: start armour research', async ({ page }) => {
  const errors = await boot(page);
  await placeAndSelect(page, 'smithy', { techs: ['alchemy'], stock: { iron: 500 } });
  await expect(page.getByTestId('building-techs')).toBeVisible();
  await expect(page.getByTestId('btech-leatherMail')).toContainText('Kettenlederrüstung');
  // Locked technology shows the translated reason (predecessor missing)
  await expect(page.getByTestId('btech-chainMail')).toContainText('Kettenlederrüstung');
  await page.getByTestId('btech-leatherMail').click();
  await expect(page.getByTestId('btech-leatherMail')).toContainText('läuft', { timeout: 20_000 });
  await expect(page.getByTestId('res-gold')).toHaveText('350');
  expect(errors).toEqual([]);
});

test('Marketplace: buy wood', async ({ page }) => {
  await boot(page);
  await placeAndSelect(page, 'storehouse', { techs: ['education', 'trade'], level: 1, stock: { gold: 1000 } });
  // wait for traders
  await page.waitForFunction(() => { const e = window.__kronland; const b = e.sim.entities.get([...e.selected][0]); return b.workers.length > 0; }, null, { timeout: 30000 });
  await expect(page.getByTestId('market-panel')).toBeVisible();
  // Gold → wood, 100 units (two steps of 50); preview shows the costs
  await page.getByTestId('market-give-gold').click();
  await page.getByTestId('market-take-wood').click();
  await page.getByTestId('market-plus').click();
  await expect(page.getByTestId('market-amount')).toHaveText('100');
  await expect(page.getByTestId('market-preview')).toContainText('100');
  await page.getByTestId('trade-go').click();
  await expect.poll(() => page.evaluate(() => { const e = window.__kronland; return e.sim.entities.get([...e.selected][0]).trade?.amount ?? 0; }), { timeout: 20_000 }).toBe(100);
  await expect(page.getByTestId('trade-running')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('market-panel')).toContainText('Handel läuft');
});

test('Weather plant: forecast and weather change', async ({ page }) => {
  await boot(page);
  await placeAndSelect(page, 'weatherPlant', { techs: ['weatherForecast', 'meteorology'] });
  await expect(page.getByTestId('weather-panel')).toContainText('Vorhersage');
  await expect(page.getByTestId('forecast-2')).toBeVisible();
  await expect(page.getByTestId('weather-rain')).toBeDisabled();
  await page.evaluate(() => { window.__kronland.sim.players[0].weatherEnergy = 1000; window.__kronland.emitUi(); });
  await expect(page.getByTestId('weather-energy')).toContainText('1000', { timeout: 20_000 });
  await page.getByTestId('weather-rain').click();
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.weather.state), { timeout: 20_000 }).toBe('rain');
  // Cooldown locks the other weather buttons
  await expect(page.getByTestId('weather-winter')).toBeDisabled({ timeout: 20_000 });
});

test('Repair of a burning building', async ({ page }) => {
  await boot(page);
  const id = await placeAndSelect(page, 'residence', { hp: 200 });
  await expect(page.getByTestId('repair-panel')).toContainText('brennt', { timeout: 20_000 });
  await page.getByTestId('repair').click();
  await expect.poll(() => page.evaluate((id) => window.__kronland.sim.entities.get(id).builders.length, id), { timeout: 20_000 }).toBeGreaterThan(0);
});

test('Captain with experience stars and rank (English)', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('kronland-lang', 'en'); } catch { /* ignore */ } });
  await page.goto('/?seed=42');
  await page.waitForFunction(() => !!window.__kronland);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const hq = s.findBuilding(0, 'headquarters');
    const L = s.spawnLeader(0, 'sword1', hq.x + 2, hq.y + hq.h + 2);
    L.xp = 45; // 2 stars
    e.renderer.rig.lookAt(hq.x + 2, hq.y + hq.h + 2);
    e.selected.clear(); e.selected.add(L.id); e.emitUi();
  });
  await expect(page.getByTestId('leader-rank')).toHaveText('Sergeant');
  await expect(page.getByTestId('leader-cards').locator('.stars .ico')).toHaveCount(5);
});
