import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Programming window: split screen on the desktop (divider, collapse, hover docs, Ctrl+click → reference),
// sheet with "watch game" and long-press docs on phones. Screenshots also go to $SHOT_DIR if set.

const SLOW = { timeout: 90_000 };
test.describe.configure({ timeout: 300_000 });
const isMobile = (page) => page.viewportSize().width < 760;

async function shot(page, name) {
  const fs = await import('node:fs/promises');
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  if (process.env.SHOT_DIR) {
    await fs.mkdir(process.env.SHOT_DIR, { recursive: true });
    await fs.copyFile(path, `${process.env.SHOT_DIR}/${test.info().project.name}-${name}.png`);
  }
}

async function start(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.removeItem('kronland-lang');
      localStorage.removeItem('kronland-code-split');
      for (const k of Object.keys(localStorage)) if (k.startsWith('kronland-code-')) localStorage.removeItem(k);
      sessionStorage.setItem('e2e-init', '1');
    }
  });
  await page.goto(playUrl('?mission=adv1&no-models'), SLOW);
  await page.waitForFunction(() => !!window.__kronland, null, SLOW);
  await expect(page.getByTestId('script-panel')).toBeAttached(SLOW);
  return errors;
}

const canvasWidth = (page) => page.evaluate(() => window.__kronland.renderer.viewport.w);

/** Screen point in the middle of the n-th occurrence of a word in the highlighted code. */
async function wordPoint(page, editor, word, nth = 0) {
  return editor.evaluate((el, [w, n]) => {
    const pre = el.querySelector('.ce-pre');
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    let seen = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let i = node.data.indexOf(w);
      while (i >= 0) {
        if (seen++ === n) {
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + w.length);
          const b = r.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }
        i = node.data.indexOf(w, i + 1);
      }
    }
    return null;
  }, [word, nth]);
}

test.describe('desktop split screen', () => {
  test.skip(({ isMobile: m }) => m, 'desktop only');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Game left, program right: divider, collapse, HUD inside the game area', async ({ page }) => {
    const errors = await start(page);
    const panel = page.getByTestId('script-panel');
    await expect(panel).toHaveAttribute('data-layout', 'split');
    const vw = page.viewportSize().width;
    const box = await panel.boundingBox();
    expect(Math.round(box.x + box.width)).toBe(vw);
    // The canvas really shrinks (renderer size and camera aspect follow)
    await expect.poll(() => canvasWidth(page)).toBe(Math.round(vw - box.width));
    expect(await page.evaluate(() => { const r = window.__kronland.renderer; return Math.abs(r.camera.aspect - r.viewport.w / r.viewport.h) < 1e-6; })).toBe(true);
    // HUD stays left of the panel
    const left = vw - box.width;
    for (const sel of ['.topbar', '.cmdbar', '.toasts']) {
      const b = await page.locator(sel).first().boundingBox();
      if (b) expect(b.x + b.width).toBeLessThanOrEqual(left + 1);
    }
    await page.waitForTimeout(1500);
    await shot(page, 'split');

    // Drag the divider to the left: panel wider, game narrower, width stays after reload
    const div = page.getByTestId('script-divider');
    const d = await div.boundingBox();
    await page.mouse.move(d.x + d.width / 2, d.y + 40);
    await page.mouse.down();
    await page.mouse.move(d.x - 200, d.y + 40, { steps: 8 });
    await page.mouse.up();
    const wide = await panel.boundingBox();
    expect(wide.width).toBeGreaterThan(box.width + 150);
    await expect.poll(() => canvasWidth(page)).toBe(Math.round(vw - wide.width));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-code-split')));
    expect(stored.frac).toBeCloseTo(wide.width / vw, 2);
    await shot(page, 'split-dragged');

    // Collapse to the strip and back
    await page.getByTestId('script-fold').click();
    await expect(page.getByTestId('script-expand')).toBeVisible();
    expect((await panel.boundingBox()).width).toBeLessThan(50);
    await expect.poll(() => canvasWidth(page)).toBeGreaterThan(vw - 50);
    await shot(page, 'collapsed');
    await page.reload();
    await page.waitForFunction(() => !!window.__kronland, null, SLOW);
    await expect(page.getByTestId('script-expand')).toBeVisible(SLOW);
    await page.getByTestId('script-expand').click();
    await expect(page.getByTestId('script-divider')).toBeVisible();
    expect(Math.abs((await panel.boundingBox()).width - wide.width)).toBeLessThan(3);
    expect(errors).toEqual([]);
  });

  test('Hover docs after a delay, Escape hides, Ctrl+click opens the reference', async ({ page }) => {
    const errors = await start(page);
    const sec = page.getByTestId('section-player');
    const ta = sec.getByTestId('code-input');
    await ta.fill('hero.step()\nn = len("ab".split())\n');
    const editor = sec.getByTestId('code-editor');
    const p = await wordPoint(page, editor, 'step');
    await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(150);
    await expect(page.getByTestId('doc-card')).toHaveCount(0);
    await expect(page.getByTestId('doc-card')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('doc-card')).toHaveAttribute('data-name', 'hero.step');
    await expect(page.getByTestId('doc-card')).toContainText('hero.step(n=1)');
    await expect(page.getByTestId('doc-card-ref')).toHaveAttribute('href', '../scripting/#hero.step');
    await shot(page, 'hover');
    await ta.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('doc-card')).toHaveCount(0);
    await expect(page.getByTestId('game-menu')).toHaveCount(0);

    // Method on a string literal
    const q = await wordPoint(page, editor, 'split');
    await page.mouse.move(q.x, q.y);
    await expect(page.getByTestId('doc-card')).toHaveAttribute('data-name', 'str.split', { timeout: 5000 });
    // Leaving the code hides the card
    await page.mouse.move(5, 300);
    await expect(page.getByTestId('doc-card')).toHaveCount(0);

    // Ctrl held: underline and pointer cursor, click opens the reference in a new tab
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.mouse.move(p.x, p.y);
    await page.keyboard.down(mod);
    await page.mouse.move(p.x + 1, p.y);
    await expect(editor.locator('.ce-link')).toHaveText('step');
    expect(await ta.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
    await shot(page, 'ctrl-link');
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.mouse.click(p.x + 1, p.y)]);
    await page.keyboard.up(mod);
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    expect(popup.url()).toMatch(/\/scripting\/#hero\.step$/);
    await expect(editor.locator('.ce-link')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('phone sheet', () => {
  test.skip(({ isMobile: m }) => !m, 'phone only');

  test('Sheet with tabs, run switches to the game, an error returns to the code', async ({ page }) => {
    const errors = await start(page);
    await page.getByTestId('script-open').click();
    const panel = page.getByTestId('script-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('data-layout', 'sheet');
    const vp = page.viewportSize();
    const b = await panel.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(b.height).toBeGreaterThanOrEqual(vp.height - 1);
    await shot(page, 'sheet-code');
    await page.getByTestId('script-tab-help').click();
    await page.getByTestId('api-search').fill('split');
    await page.getByTestId('api-sig-str.split').click();
    await expect(page.getByTestId('doc-card')).toContainText('split');
    await shot(page, 'sheet-help');
    await page.getByTestId('script-tab-code').click();
    await page.getByTestId('script-menu').click();
    await expect(page.getByTestId('script-menu-list')).toBeVisible();
    await shot(page, 'sheet-menu');
    await page.getByTestId('script-menu').click();

    // Run: the game is shown with the run strip
    const ta = page.getByTestId('section-player').getByTestId('code-input');
    await ta.fill('for i in range(4):\n    hero.step()\n');
    await page.getByTestId('script-run').click();
    await expect(panel).toBeHidden();
    await expect(page.getByTestId('script-watch-strip')).toBeVisible();
    await expect(page.getByTestId('script-watch-line')).toContainText('hero.step()', SLOW);
    // The hero is in view above the run strip
    const strip = await page.getByTestId('script-watch-strip').boundingBox();
    const hero = await page.evaluate(() => {
      const e = window.__kronland, r = e.renderer;
      const h = [...e.sim.entities.values()].find((x) => x.kind === 'hero');
      const rec = r.chars?.records.get(h.id);
      const x = rec ? rec.position.x : h.px / 1000, z = rec ? rec.position.z : h.py / 1000;
      return r.project(x, r.terrain.heightAt(x, z) + 0.3, z);
    });
    expect(hero.behind).toBe(false);
    expect(hero.x).toBeGreaterThan(0);
    expect(hero.x).toBeLessThan(vp.width);
    expect(hero.y).toBeGreaterThan(0);
    expect(hero.y).toBeLessThan(strip.y);
    await shot(page, 'watch');
    await page.getByTestId('script-watch-code').click();
    await expect(panel).toBeVisible();

    // Error while watching: back to the code, error line marked, counter on the output tab
    await ta.fill('wood = 3\nprint(wod)\n');
    await page.getByTestId('script-run').click();
    await expect(page.getByTestId('script-error')).toBeVisible(SLOW);
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('section-player').getByTestId('ce-line-2')).toHaveClass(/error/);
    await expect(page.getByTestId('script-err-count')).toHaveText('1');
    await shot(page, 'sheet-error');
    await page.getByTestId('script-tab-output').click();
    await expect(page.getByTestId('script-output')).toContainText('NameError');
    expect(errors).toEqual([]);
  });

  test('Long press on a command shows its doc card with a link to the reference', async ({ page }) => {
    const errors = await start(page);
    await page.getByTestId('script-open').click();
    const sec = page.getByTestId('section-player');
    await sec.getByTestId('code-input').fill('hero.step()\nprint(len("ab"))\n');
    await page.evaluate(() => document.activeElement?.blur());
    const p = await wordPoint(page, sec.getByTestId('code-editor'), 'step');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(p.x), y: Math.round(p.y) }] });
    await page.waitForTimeout(900);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('doc-card')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('doc-card')).toHaveAttribute('data-name', 'hero.step');
    await expect(page.getByTestId('doc-card-ref')).toHaveAttribute('href', '../scripting/#hero.step');
    await shot(page, 'longpress');
    await page.getByTestId('doc-card-close').click();
    await expect(page.getByTestId('doc-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
