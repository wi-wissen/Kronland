import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Player colour selectable: setting "Spielerfarbe" (red), then game start - own figures, minimap and
// buildings in red, the opponent who would otherwise be red gets blue. The simulation stays untouched.

test.describe.configure({ timeout: 240_000 });
const SLOW = { timeout: 120_000 };
const RED = 0xa8323a, BLUE = 0x2f5d9e;

test('Choose player colour red and see it in the game', async ({ page, isMobile }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-color-init')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-color-init', '1');
    }
  });
  const shot = (name) => page.screenshot({ path: `${process.env.SHOTS_DIR ?? 'test-results'}/color-${name}-${info.project.name}.png` });

  // Setting in the start menu
  await page.goto(playUrl());
  await page.getByTestId('menu-settings').click();
  await expect(page.getByTestId('player-color-blue')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('player-color-red').click();
  await expect(page.getByTestId('player-color-red')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('player-color-blue')).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('player-color-red').scrollIntoViewIfNeeded();
  await shot('settings');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-settings')).playerColor)).toBe(1);
  await page.getByTestId('settings-done').click();

  // Free game with models
  await page.goto(playUrl('?seed=42'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  // Team colour of the figures (the rendering reads the mapping player -> colour)
  const teams = await page.waitForFunction(() => {
    const k = window.__kronland, out = {};
    for (const e of k.sim.entities.values()) {
      const r = k.renderer.chars.records.get(e.id);
      if (r && out[e.owner] === undefined) out[e.owner] = r.team;
    }
    return out[0] !== undefined ? out : null;
  }, null, SLOW).then((h) => h.jsonValue());
  expect(teams[0]).toBe(RED);
  if (teams[1] !== undefined) expect(teams[1]).toBe(BLUE);
  // Minimap: own castle and figures in red (CSS colour #c03a3f)
  await page.waitForTimeout(1500);
  const px = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="minimap-canvas"]');
    if (!c || !c.offsetParent) return null; // mobile: minimap folded
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    // Dots are small and anti-aliased: count "strongly red" instead of the exact colour
    let red = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 90) red++;
    return { red };
  });
  if (px || !isMobile) expect(px.red).toBeGreaterThan(0);
  await shot('game');

  // Mission: human red, all other players with other colours
  await page.goto(playUrl('?mission=c1&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  const m = await page.waitForFunction(() => {
    const k = window.__kronland, out = {};
    for (const e of k.sim.entities.values()) {
      const r = k.renderer.chars.records.get(e.id);
      if (r) out[e.owner] = r.team;
    }
    return out[0] !== undefined ? out : null;
  }, null, SLOW).then((h) => h.jsonValue());
  expect(m[0]).toBe(RED);
  for (const [o, team] of Object.entries(m)) if (o !== '0') expect(team).not.toBe(RED);
  expect(errors).toEqual([]);
});
