import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Coding missions (phase 3): the active sub-goal at the top of the code panel, a note of a figure with "back to my
// code", Run restarts the stage, moving lines (Alt+↑/↓, key bar on phones) and "waits for events" (desktop and phone).

const SLOW = { timeout: 30_000 };

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-code-')) localStorage.removeItem(k);
      localStorage.removeItem('kronland-lang');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  return errors;
}

/** Open the code panel (on phones a sheet; after a run the sheet must be reopened). */
async function openPanel(page) {
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  const back = page.getByTestId('script-watch-code');
  if (await back.isVisible()) await back.click();
  const fab = page.getByTestId('script-open');
  if (!(await page.getByTestId('script-panel').isVisible()) && await fab.isVisible()) await fab.click();
  await expect(page.getByTestId('script-panel')).toBeVisible(SLOW);
}

const heroTile = (page) => page.evaluate(() => {
  const h = [...window.__kronland.sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
  return [Math.floor(h.px / 1000), Math.floor(h.py / 1000)];
});
const status = (page) => page.evaluate(() => window.__kronland.sim.mission.script.state.player.status);

test('I.4: goal at the top, the maid\'s note, back to my code, Run restarts the stage', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=r1-4&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  // The active sub-goal stands at the top of the panel
  await expect(page.getByTestId('script-goal-predict')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('script-goal')).toContainText('guess');
  // The note replaces the program and carries the seal of the maid
  const note = page.getByTestId('script-note');
  await expect(note).toBeVisible(SLOW);
  await expect(page.getByTestId('script-note-title')).toHaveText('Zettel der Magd');
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await expect(ta).toHaveValue(/while nelia\.can_step\(\):/);
  // Back to my code and to the note again
  await page.getByTestId('script-note-back').click();
  await expect(ta).toHaveValue(/# Mein Programm/);
  await page.getByTestId('script-note-show').click();
  await expect(ta).toHaveValue(/steps = steps \+ 1/);

  // Wrong guess: Nelia walks to the forest edge
  await ta.fill((await ta.inputValue()).replace('guess = 0', 'guess = 4'));
  await page.getByTestId('script-run').click();
  await expect.poll(() => heroTile(page), { timeout: 60_000 }).toEqual([11, 3]);
  await expect.poll(() => status(page), SLOW).toBe('done');
  // Run again: the stage starts over – Nelia is back at the start at once, the note and its code stay
  await openPanel(page);
  await page.getByTestId('script-run').click();
  // (the new run starts right away: Nelia may already be a step on her way)
  const [x, y] = await heroTile(page);
  expect(x).toBeLessThanOrEqual(4);
  expect(y).toBe(3);
  expect(await page.evaluate(() => window.__kronland.restarts)).toBe(1);
  await openPanel(page);
  await expect(ta).toHaveValue(/guess = 4/);
  await expect(page.getByTestId('script-note')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Moving lines: Alt+↑ on the desktop, the key bar on phones', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=adv1&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await ta.fill('a = 1\nb = 2\nc = 3\n');
  await ta.focus();
  // Caret into line 3 ("c = 3")
  await ta.evaluate((el) => { el.selectionStart = el.selectionEnd = el.value.indexOf('c'); });
  if (page.viewportSize().width < 760) {
    await expect(page.getByTestId('keybar')).toBeVisible(SLOW);
    await page.getByTestId('key-line-up').click();
    await expect(ta).toHaveValue('a = 1\nc = 3\nb = 2\n');
    await page.getByTestId('key-line-down').click();
  } else {
    await page.keyboard.press('Alt+ArrowUp');
    await expect(ta).toHaveValue('a = 1\nc = 3\nb = 2\n');
    await page.keyboard.press('Alt+ArrowDown');
  }
  await expect(ta).toHaveValue('a = 1\nb = 2\nc = 3\n');
  expect(errors).toEqual([]);
});

test('Events in the player program: the panel shows "waits for events"', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=adv1&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await ta.fill('@every(1)\ndef turn():\n    nelia.turn_left()\nprint("ready")\n');
  await page.getByTestId('script-run').click();
  await expect.poll(() => page.evaluate(() => window.__kronland.sim.mission.script.state.player.listening), SLOW).toBe(true);
  if (page.viewportSize().width < 760) await expect(page.getByTestId('script-watch-status')).toHaveText('wartet auf Ereignisse', SLOW);
  else await expect(page.getByTestId('script-listening')).toBeVisible(SLOW);
  await openPanel(page);
  await page.getByTestId('script-stop').click();
  await expect.poll(() => status(page), SLOW).toBe('stopped');
  expect(errors).toEqual([]);
});
