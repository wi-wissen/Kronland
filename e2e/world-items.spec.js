import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Items and tracks on tiles (coins, flowers, paths) and hints in the code panel – desktop and phone.

const SLOW = { timeout: 30_000 };

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.removeItem('kronland-editor-draft');
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-code-')) localStorage.removeItem(k);
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  return errors;
}

const phone = (page) => page.viewportSize().width < 760;

/** Open the code panel (on phones a sheet behind a button). */
async function openPanel(page) {
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  const fab = page.getByTestId('script-open');
  if (await fab.isVisible()) await fab.click();
  await expect(page.getByTestId('script-panel')).toBeVisible(SLOW);
}

const coinsDrawn = (page) => page.evaluate(() => {
  const m = window.__kronland.renderer.items.meshes.coin;
  return m?.visible ? m.count : 0;
});

test('I.5: the coins are drawn on their tiles and disappear when the program picks them up', async ({ page }) => {
  test.setTimeout(180_000); // the intro line comes before the note, then a whole stage runs
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=r1-5&no-models'));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.items, null, SLOW);
  const total = await page.evaluate(() => [...window.__kronland.sim.map.items.values()].filter((k) => k === 'coin').length);
  expect(total).toBe(24);
  await expect.poll(() => coinsDrawn(page), SLOW).toBe(total);
  await openPanel(page);
  // The woodcutter's note collects the first row (7 coins) and counts along
  await expect(page.getByTestId('script-note')).toBeVisible({ timeout: 60_000 });
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await expect(ta).toHaveValue(/count = count \+ 1/);
  await ta.fill((await ta.inputValue()).replace('guess = 0', 'guess = 7'));
  await page.getByTestId('script-run').click();
  if (phone(page)) {
    // phone: the game is shown while the program runs, the camera follows Nelia
    await expect(page.getByTestId('script-watch-strip')).toBeVisible(SLOW);
    await expect.poll(() => page.evaluate(() => !!window.__kronland.watchFollow), SLOW).toBe(true);
  }
  await expect.poll(() => coinsDrawn(page), { timeout: 90_000 }).toBeLessThan(total);
  await page.screenshot({ path: test.info().outputPath('coins.png') });
  await expect.poll(() => coinsDrawn(page), { timeout: 120_000 }).toBe(total - 7);
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.mission.state.objectives.find((o) => o.id === 'roses')?.status), { timeout: 60_000 }).toBe('active');
  expect(await page.evaluate(() => window.__kronland.sim.players[0].stock.gold)).toBe(7);
  expect(errors).toEqual([]);
});

test('Hint in the code panel: amber line and box, the program keeps running, editing clears it', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=r1-m&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  const sec = page.getByTestId('section-player');
  const ta = sec.getByTestId('code-input');
  await ta.fill('nelia.left()\nfor i in range(3):\n    nelia.step()\n');
  await page.getByTestId('script-run').click();
  if (phone(page)) {
    // the sheet closes to watch the game; an amber button leads back to the hint
    await expect(page.getByTestId('script-watch-hint')).toBeVisible(SLOW);
    await page.getByTestId('script-watch-hint').click();
  }
  const box = page.getByTestId('script-hint');
  await expect(box).toBeVisible(SLOW);
  await expect(box).toContainText('Hinweis');
  await expect(box).toContainText('turn_left');
  await expect(sec.getByTestId('ce-line-1')).toHaveClass(/hint/);
  await expect(page.getByTestId('script-error')).toHaveCount(0);
  // not stopped: Nelia walks on to the end
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', /running|done/);
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.mission.script.state.player.status), SLOW).toBe('done');
  await page.screenshot({ path: test.info().outputPath('hint.png') });
  await ta.fill('nelia.turn_left()\n');
  await expect(box).toHaveCount(0);
  await expect(sec.locator('.ce-ln.hint')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('World editor: lay coins and flowers, paint and erase tracks, test play keeps them', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-adventures').click();
  await page.getByTestId('open-editor').click();
  await expect(page.getByTestId('world-editor')).toBeVisible();
  await page.waitForFunction(() => !!window.__kronlandEditor, null, SLOW);
  const ed = (fn) => page.evaluate(fn);
  const box = await page.getByTestId('editor-canvas').boundingBox();
  const cx = box.x + box.width * 0.45, cy = box.y + box.height * 0.5;
  const tap = async (x, y) => { if (phone(page)) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };

  await page.getByTestId('tool-item').click();
  await expect(page.getByTestId('tool-item')).toHaveAttribute('aria-pressed', 'true');
  await tap(cx, cy);
  await expect.poll(() => ed(() => window.__kronlandEditor.sim.map.items.size), SLOW).toBe(1);
  await page.getByTestId('tool-item-kind').selectOption('flower');
  await tap(cx + 40, cy);
  await expect.poll(() => ed(() => [...window.__kronlandEditor.sim.map.items.values()].sort().join()), SLOW).toBe('coin,flower');
  await expect.poll(() => ed(() => window.__kronlandEditor.renderer.items.meshes.flower?.count ?? 0)).toBe(1);

  await page.getByTestId('tool-track').click();
  await tap(cx, cy + 50);
  const tracks = () => ed(() => window.__kronlandEditor.sim.map.tracks.reduce((a, b) => a + (b > 0), 0));
  await expect.poll(tracks, SLOW).toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath('editor-items.png') });
  // undo takes the stroke back, redo brings it again
  await page.getByTestId('editor-undo').click();
  await expect.poll(tracks).toBe(0);
  await page.getByTestId('editor-redo').click();
  await expect.poll(tracks).toBeGreaterThan(0);
  const painted = await tracks();

  // test play: items and tracks come along (world.terrain)
  await page.getByTestId('editor-play').click();
  await page.waitForFunction(() => window.__kronland?.sim?.mission?.def?.custom, null, SLOW);
  expect(await page.evaluate(() => window.__kronland.sim.map.items.size)).toBe(2);
  expect(await page.evaluate(() => window.__kronland.sim.map.tracks.reduce((a, b) => a + (b > 0), 0))).toBe(painted);
  await page.evaluate(() => window.__kronland.sim.mission.finish(window.__kronland.sim, true, 'test'));
  await page.getByTestId('to-campaign').click({ timeout: 20_000 });
  await expect(page.getByTestId('world-editor')).toBeVisible(SLOW);
  await page.waitForFunction(() => !!window.__kronlandEditor?.sim, null, SLOW);
  await expect.poll(() => ed(() => window.__kronlandEditor.sim.map.items.size), SLOW).toBe(2);

  // the eraser removes items and tracks
  await page.getByTestId('tool-erase').click();
  await page.getByTestId('brush-size').evaluate((el) => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap(cx, cy + 20);
  await expect.poll(() => ed(() => window.__kronlandEditor.sim.map.items.size), SLOW).toBe(0);
  await expect.poll(tracks).toBe(0);
  expect(errors).toEqual([]);
});
