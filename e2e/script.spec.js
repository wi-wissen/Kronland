import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Coding adventure, code panel with debugger and world editor (desktop and mobile).

async function fresh(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.removeItem('kronland-campaign-1');
      localStorage.removeItem('kronland-lang');
      localStorage.removeItem('kronland-editor-draft');
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-code-')) localStorage.removeItem(k);
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  return errors;
}

const SLOW = { timeout: 30_000 };

/** Open the code panel (on mobile it is a sheet behind a button). */
async function openPanel(page) {
  const fab = page.getByTestId('script-open');
  // The panel is loaded later: wait until the button (mobile) or panel (desktop) is there
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  if (await fab.isVisible()) await fab.click();
  await expect(page.getByTestId('script-panel')).toBeVisible(SLOW);
}

/** Button of the code panel; on phones some sit in the "⋯" menu, and after a run the sheet must be reopened. */
async function tool(page, id) {
  const back = page.getByTestId('script-watch-code');
  if (await back.isVisible()) await back.click();
  const menu = page.getByTestId('script-menu');
  if (!(await page.getByTestId(id).isVisible()) && await menu.isVisible()) await menu.click();
  await page.getByTestId(id).click();
}

const gridAttr = (page) => (page.viewportSize().width < 760 ? 'aria-checked' : 'aria-pressed');

test('Adventure from the menu: write a program, run it, win', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-adventures').click();
  await expect(page.getByTestId('adventure-menu')).toBeVisible();
  await expect(page.getByTestId('adventure-adv1')).toBeVisible();
  await page.getByTestId('adventure-start').click();
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  // World setup is folded and locked, the own program editable
  await expect(page.getByTestId('fold-world')).toBeVisible();
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await ta.fill('for i in range(10):\n    nelia.step()\nprint("arrived")\n');
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('mission-result')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('mission-result-title')).toHaveText('Sieg!');
  await expect(page.getByTestId('next-mission')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Error message with line and suggestion, single step with variables', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=adv1&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  // Grid is on in the adventure and can be switched off; the hero looks east (view = step direction)
  if (page.viewportSize().width < 760) await page.getByTestId('script-menu').click();
  await expect(page.getByTestId('script-grid')).toHaveAttribute(gridAttr(page), 'true');
  expect(await page.evaluate(() => !!window.__kronland.renderer.grid)).toBe(true);
  await tool(page, 'script-grid');
  expect(await page.evaluate(() => !!window.__kronland.renderer.grid)).toBe(false);
  await tool(page, 'script-grid');
  expect(await page.evaluate(() => [...window.__kronland.sim.entities.values()].find((e) => e.kind === 'hero').face)).toBe(1);
  const ta = page.getByTestId('section-player').getByTestId('code-input');
  await ta.fill('wood = 3\nprint(wod)\n');
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('script-error')).toContainText('NameError', SLOW);
  await expect(page.getByTestId('script-error')).toContainText('wood');
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'error');

  await ta.fill('a = 1\nb = a + 41\nprint(b)\n');
  await page.getByTestId('script-step').click();
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'paused', SLOW);
  // One step at a time: two step commands within the same tick count as one (the script only runs in the tick)
  await page.getByTestId('script-step').click();
  await expect(page.getByTestId('script-vars')).toContainText(/a\s*1/, SLOW); // a = 1
  await page.getByTestId('script-step').click();
  await expect(page.getByTestId('script-vars')).toContainText('42', SLOW);
  await page.getByTestId('script-continue').click();
  await expect(page.getByTestId('script-console')).toContainText('42', SLOW);
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'done');
  expect(errors).toEqual([]);
});

test('Call stack shows arguments and folds deep recursion, endless recursion names the function', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=adv1&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  const sec = page.getByTestId('section-player');
  const ta = sec.getByTestId('code-input');

  // Breakpoint in the deepest call: main, count(20), "… 12 more calls …", count(7) … count(0)
  await ta.fill('def count(n):\n    if n == 0:\n        return 0\n    return count(n - 1)\nprint(count(20))\n');
  await sec.getByTestId('ce-line-3').click();
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'paused', SLOW);
  const stack = page.getByTestId('script-vars').locator('.sp-frame');
  await expect(stack).toHaveCount(11);
  await expect(stack.nth(1)).toHaveText('count(20)');
  await expect(stack.nth(2)).toContainText('12');
  await expect(stack.last()).toHaveText('count(0)');
  await stack.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('stack.png') });
  await sec.getByTestId('ce-line-3').click();
  await page.getByTestId('script-continue').click();
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'done', SLOW);

  // Endless recursion: the error names the function and asks for a stop condition
  await ta.fill('def walk(n):\n    return walk(n + 1)\nwalk(0)\n');
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('script-error')).toContainText('RecursionError', SLOW);
  await expect(page.getByTestId('script-error')).toContainText('walk');
  await page.screenshot({ path: test.info().outputPath('recursion.png') });
  expect(errors).toEqual([]);
});

test('print() to the console, notify() as a notice, error clears after editing, save and open .py', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl('?mission=adv1&no-models'));
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await openPanel(page);
  const sec = page.getByTestId('section-player');
  const ta = sec.getByTestId('code-input');

  // Error: red line and box …
  await ta.fill('wood = 3\nprint(wod)\n');
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('script-error')).toContainText('NameError', SLOW);
  await expect(sec.getByTestId('ce-line-2')).toHaveClass(/error/);
  // … gone as soon as the code changes (also not moved into the console)
  await ta.fill('wood = 3\nprint(wood)\n');
  await expect(page.getByTestId('script-error')).toHaveCount(0);
  await expect(sec.locator('.ce-ln.error')).toHaveCount(0);
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'idle');
  await expect(page.getByTestId('script-console')).toHaveCount(0);

  // print(): only output in the panel (current run), no notice in the game
  const note = page.locator('[data-testid="toast"][data-cat="script"]');
  await ta.fill('print("Hallo Kronland")\nfor i in range(3):\n    print("Runde", i)\n');
  await page.getByTestId('script-run').click();
  await expect(page.getByTestId('script-console')).toContainText('Hallo Kronland', SLOW);
  await expect(page.getByTestId('script-console')).toContainText('Runde 2');
  await expect(page.getByTestId('script-console')).not.toContainText('NameError');
  await expect(page.getByTestId('script-panel')).toHaveAttribute('data-status', 'done', SLOW);
  await expect(note).toHaveCount(0);
  // notify(): one notice in the game (newest wins, bundled), not in the console
  await ta.fill('print("Hallo Kronland")\nfor i in range(3):\n    notify(f"Meldung {i}")\n    wait(0.1)\n');
  await page.getByTestId('script-run').click();
  await expect(note).toHaveCount(1, SLOW);
  await expect(note).toContainText('Meldung 2', SLOW);
  await expect(page.getByTestId('script-console')).toContainText('Hallo Kronland');
  await expect(page.getByTestId('script-console')).not.toContainText('Meldung');
  await page.screenshot({ path: test.info().outputPath('notify.png') });

  // Save as .py
  const [dl] = await Promise.all([page.waitForEvent('download'), tool(page, 'script-download')]);
  expect(dl.suggestedFilename()).toBe('adv1.py');
  const fs = await import('node:fs/promises');
  expect(await fs.readFile(await dl.path(), 'utf8')).toContain('notify(f"Meldung {i}")');

  // Open a .py file from the device
  await page.getByTestId('script-file').setInputFiles({ name: 'weg.py', mimeType: 'text/x-python', buffer: Buffer.from('\uFEFFfor i in range(2):\r\n    nelia.step()\r\n') });
  await expect(ta).toHaveValue('for i in range(2):\n    nelia.step()\n');
  expect(errors).toEqual([]);
});

test('World editor: paint forest, place a spot, test play and back', async ({ page }) => {
  const errors = await fresh(page);
  await page.goto(playUrl());
  await page.getByTestId('menu-adventures').click();
  await page.getByTestId('open-editor').click();
  await expect(page.getByTestId('world-editor')).toBeVisible();
  await page.waitForFunction(() => !!window.__kronlandEditor, null, SLOW);
  // Grid in the editor too
  await page.getByTestId('editor-grid').click();
  expect(await page.evaluate(() => !!window.__kronlandEditor.renderer.grid)).toBe(true);
  const trees = () => page.evaluate(() => [...window.__kronlandEditor.sim.entities.values()].filter((e) => e.kind === 'tree').length);
  expect(await trees()).toBe(0);
  await page.getByTestId('tool-forest').click();
  const box = await page.getByTestId('editor-canvas').boundingBox();
  const cx = box.x + box.width * 0.4, cy = box.y + box.height * 0.5;
  if (page.viewportSize().width < 900) await page.touchscreen.tap(cx, cy);
  else { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 60, cy + 10, { steps: 6 }); await page.mouse.up(); }
  await expect.poll(trees, SLOW).toBeGreaterThan(0);
  // Undo takes it away again
  await page.getByTestId('editor-undo').click();
  await expect.poll(trees).toBe(0);

  // Place a spot
  await page.getByTestId('tool-place').click();
  if (page.viewportSize().width < 900) await page.touchscreen.tap(cx, cy);
  else await page.mouse.click(cx, cy);
  await page.getByTestId('place-name').fill('goal');
  await page.getByTestId('place-add').click();

  await page.getByTestId('editor-play').click();
  await page.waitForFunction(() => window.__kronland?.sim?.mission?.def?.custom, null, SLOW);
  // In the test play all sections are visible (also the mission logic)
  await openPanel(page);
  await expect(page.getByTestId('section-mission')).toBeVisible();
  const places = await page.evaluate(() => Object.keys(window.__kronland.sim.mission.script.state.places));
  expect(places).toContain('goal');
  await page.evaluate(() => window.__kronland.sim.mission.finish(window.__kronland.sim, true, 'test'));
  await page.getByTestId('to-campaign').click({ timeout: 20_000 });
  await expect(page.getByTestId('world-editor')).toBeVisible(SLOW);
  expect(errors).toEqual([]);
});
