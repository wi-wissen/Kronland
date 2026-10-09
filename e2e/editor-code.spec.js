import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// World editor: code from the map (double-click on the desktop, long press on phones) and building blocks in the
// code tab, preview with error and hint marks. Screenshots also go to $SHOT_DIR if set.

const SLOW = { timeout: 60_000 };
test.describe.configure({ timeout: 300_000 });
const isMobile = (page) => page.viewportSize().width < 900;

async function shot(page, name) {
  const fs = await import('node:fs/promises');
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  if (process.env.SHOT_DIR) {
    await fs.mkdir(process.env.SHOT_DIR, { recursive: true });
    await fs.copyFile(path, `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png`);
  }
}

async function openEditor(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.removeItem('kronland-lang');
      localStorage.removeItem('kronland-editor-draft');
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  if (!isMobile(page)) await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl('?no-models'));
  await page.getByTestId('menu-adventures').click();
  await page.getByTestId('open-editor').click();
  await expect(page.getByTestId('world-editor')).toBeVisible(SLOW);
  await page.waitForFunction(() => !!window.__kronlandEditor, null, SLOW);
  return errors;
}

/** Double-click (desktop) or long press (phone) on a screen point of the map. */
async function codeGesture(page, x, y) {
  if (!isMobile(page)) { await page.mouse.dblclick(x, y); return; }
  const cdp = await page.context().newCDPSession(page);
  // A toast of the previous gesture must be gone, so the answer below is this gesture's
  await page.getByTestId('editor-code-toast').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y) }] });
  // Hold until the long press has answered (menu or toast) – under load its 550 ms timer can fire late, and lifting the
  // finger earlier cancels it. A real finger also stays down until something happens.
  const answered = page.getByTestId('editor-code-menu').or(page.getByTestId('editor-code-toast'));
  await page.waitForTimeout(700);
  await answered.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Open the side panel on phones (it covers the map), close it to reach the map. */
async function panel(page, open) {
  if (!isMobile(page)) return;
  const fab = page.getByTestId('editor-panel-open');
  if (open && await fab.isVisible()) await fab.click();
  if (!open) await expect(page.getByTestId('editor-side')).toBeVisible();
  if (!open) await page.getByTestId('editor-side').getByRole('button', { name: /schließen|close/i }).first().click();
}

/** Screen point of a free tile in the visible part of the map (left of the panel, above the tool bar). */
async function freeTile(page) {
  return page.evaluate((mobile) => {
    const v = window.__kronlandEditor, W = innerWidth, H = innerHeight;
    const maxX = mobile ? W - 40 : W - 600, maxY = mobile ? H - 200 : H - 80;
    for (let r = 2; r < 14; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = 16 + dx, y = 16 + dy;
          const p = v.screenOf(x, y);
          if (!p || p.behind || p.x < (mobile ? 40 : 200) || p.x > maxX || p.y < 140 || p.y > maxY) continue;
          const g = v.renderer.pickGround(p.x, p.y);
          if (g && v.targetAt(p.x, p.y, { x: Math.floor(g.x), y: Math.floor(g.z) })?.kind === 'free') return { x: p.x, y: p.y };
        }
      }
    }
    return null;
  }, isMobile(page));
}

const missionInput =(page) => page.getByTestId('editor-section-mission').getByTestId('code-input');
const trees = (page) => page.evaluate(() => [...window.__kronlandEditor.sim.entities.values()].filter((e) => e.kind === 'tree').length);

test('World editor: code from the map – place, talk figure, coordinates', async ({ page }) => {
  const errors = await openEditor(page);
  const box = await page.getByTestId('editor-canvas').boundingBox();
  const px = box.x + box.width * 0.4, py = box.y + box.height * 0.45;

  // A place "camp"
  await page.getByTestId('tool-place').click();
  if (isMobile(page)) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
  await page.getByTestId('place-name').fill('camp');
  await page.getByTestId('place-add').click();

  // Caret inside camera.fly_to( … ) of the mission section
  await page.getByTestId('editor-tab-code').click();
  const ta = missionInput(page);
  await ta.fill('@on_start\ndef intro():\n    camera.fly_to()\n');
  await ta.evaluate((el) => { el.focus(); const k = el.value.indexOf('fly_to(') + 7; el.setSelectionRange(k, k); });
  await panel(page, false);
  await page.getByTestId('tool-camera').click();

  // On the place: place("camp") right at the caret
  const camp = await page.evaluate(() => {
    const p = window.__kronlandEditor.scenario.world.places.camp;
    return window.__kronlandEditor.screenOf(p.x, p.y);
  });
  await codeGesture(page, camp.x, camp.y);
  await expect(page.getByTestId('editor-code-toast')).toContainText('place("camp")');
  await expect(ta).toHaveValue('@on_start\ndef intro():\n    camera.fly_to(place("camp"))\n');
  await shot(page, 'code-place');

  // Free tile: menu → talk figure; the block goes behind the function, at the tile
  await panel(page, false);
  const { x: fx, y: fy } = await freeTile(page);
  await codeGesture(page, fx, fy);
  await expect(page.getByTestId('editor-code-menu')).toBeVisible();
  await expect(page.getByTestId('code-menu-npc')).toContainText('npc("figure1"');
  await shot(page, 'code-menu');
  await page.getByTestId('code-menu-npc').click();
  await expect(page.getByTestId('editor-code-menu')).toHaveCount(0);
  await expect(ta).toHaveValue(/@on_talk\("figure1"\)/);
  const code = await ta.inputValue();
  expect(code).toMatch(/^@on_start\ndef intro\(\):\n {4}camera\.fly_to\(place\("camp"\)\)\n\n# .+\nfigure1 = npc\("figure1", look="serf", at=\(\d+, \d+\)/);
  expect(code).toContain('@on_talk("figure1")\ndef talk_figure1(hero):\n    say("figure1", de=');
  if (!isMobile(page)) {
    // The browser's undo takes the block away again
    await ta.focus();
    await page.keyboard.press('Control+z');
    await expect(ta).toHaveValue('@on_start\ndef intro():\n    camera.fly_to(place("camp"))\n');
    await page.keyboard.press('Control+y');
    // The browser's redo of a multi-line insert is not exact (blank lines may differ): only check the block is back
    await expect(ta).toHaveValue(/@on_talk\("figure1"\)/);
  }

  // With the forest tool: the gesture does not plant trees, "Koordinaten" inserts (x, y) at the caret
  await expect(page.getByTestId('editor-side')).toBeVisible();
  await ta.evaluate((el) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await panel(page, false);
  await page.getByTestId('tool-forest').click();
  await codeGesture(page, fx, fy);
  await page.getByTestId('code-menu-coords').click();
  expect(await trees(page)).toBe(0);
  await expect(ta).toHaveValue(/\n\(\d+, \d+\)$/);
  expect(errors).toEqual([]);
});

test('World editor: building blocks, preview with hints and error marks', async ({ page }) => {
  const errors = await openEditor(page);
  await panel(page, true);
  await page.getByTestId('editor-tab-code').click();
  const ta = missionInput(page);
  await ta.fill('waves = 0\nwaves == waves + 1\n');
  await ta.evaluate((el) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  const blocks = page.getByTestId('editor-blocks');
  if (!(await page.getByTestId('block-coins').isVisible())) await blocks.locator('summary').click();
  await page.getByTestId('block-coins').click();
  await expect(ta).toHaveValue(/for i in range\(5\):\n {4}add_item\("coin", \d+ \+ i, \d+\)\n?$/);
  await page.getByTestId('block-talk').click();
  await expect(ta).toHaveValue(/@on_talk\("figure1"\)/);
  await page.getByTestId('block-wave').click();
  await expect(ta).toHaveValue(/@every\(120\)\ndef attack_waves1\(\):/);
  // The wave needs bandits: they join as a player
  expect(await page.evaluate(() => window.__kronlandEditor.scenario.players.some((p) => p.kind === 'bandits'))).toBe(true);
  await shot(page, 'blocks');

  // Preview: the blocks run, the comparison without effect gets an amber hint at line 2
  await page.getByTestId('editor-preview').click();
  await expect(page.getByTestId('editor-hint')).toBeVisible(SLOW);
  await expect(page.getByTestId('editor-hint')).toContainText(/2/);
  const sec = page.getByTestId('editor-section-mission');
  await expect(sec.getByTestId('ce-line-2')).toHaveClass(/hint/);
  expect(await page.evaluate(() => window.__kronlandEditor.sim.map.items.size)).toBe(5);
  await expect(page.getByTestId('editor-error')).toHaveCount(0);
  await shot(page, 'preview-hint');

  // An error marks its line
  await page.getByTestId('editor-preview-off').click();
  await ta.fill('x = 1\nplace("nowhere").x\n');
  await page.getByTestId('editor-preview').click();
  await expect(page.getByTestId('editor-error')).toBeVisible(SLOW);
  await expect(sec.getByTestId('ce-line-2')).toHaveClass(/error/);
  // Editing the section takes the out-of-date mark away
  await ta.press('End');
  await ta.pressSequentially(" ");
  await expect(sec.getByTestId('ce-line-2')).not.toHaveClass(/error/);
  expect(errors).toEqual([]);
});
