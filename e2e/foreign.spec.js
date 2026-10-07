import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Foreign selection: diplomacy named correctly (enemy / neutral / ally), foreign buildings without inner life.

const SLOW = { timeout: 20_000 };

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.removeItem('kronland-settings'); localStorage.setItem('kronland-lang', 'de'); });
  await page.goto(playUrl('?seed=42&no-models&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  return errors;
}

/** Select a foreign castle or foreign serf; diplomacy: state between player 0 and 1 */
const pick = (page, what, diplomacy) => page.evaluate(([what, diplomacy]) => {
  const e = window.__kronland, s = e.sim;
  if (diplomacy) s.setDiplomacy(0, 1, diplomacy);
  const t = what === 'hq' ? s.findBuilding(1, 'headquarters') : [...s.entities.values()].find((u) => u.kind === 'unit' && u.owner === 1);
  e.selected.clear(); e.selected.add(t.id); e.emitUi();
}, [what, diplomacy]);

test('Foreign castle: enemy with player number, no workers and beds; neutral means neutral', async ({ page }) => {
  const errors = await boot(page);
  await pick(page, 'hq');
  await expect(page.getByTestId('foreign-building')).toBeVisible(SLOW);
  await expect(page.getByTestId('foreign-building').getByTestId('relation')).toHaveText('Feind · Spieler 2');
  await expect(page.getByTestId('foreign-building').getByTestId('relation')).toHaveAttribute('data-rel', 'hostile');
  await expect(page.getByTestId('stat-beds')).toHaveCount(0);
  await expect(page.getByTestId('stat-workers')).toHaveCount(0);
  await pick(page, 'hq', 'neutral');
  await expect(page.getByTestId('foreign-building').getByTestId('relation')).toHaveText('Neutral · Spieler 2');
  await pick(page, 'serf', 'neutral');
  await expect(page.getByTestId('context-panel').getByTestId('relation')).toHaveText('Neutral · Spieler 2');
  // Title names the figure, not the diplomacy
  await expect(page.getByTestId('context-panel').locator('.cx-title')).toHaveText('Leibeigener');
  await pick(page, 'serf', 'allied');
  await expect(page.getByTestId('context-panel').getByTestId('relation')).toHaveText('Verbündeter · Spieler 2');
  expect(errors).toEqual([]);
});
