import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';
import { quick, openQuick } from './quick.js';

// Mobile comprehensibility (issue #7): long press shows the tooltip without triggering the action,
// labels under the icons, setting "Beschriftungen anzeigen".

const SLOW = { timeout: 20_000 };

// Software graphics (SwiftShader): every frame takes time, clicks wait for it
test.describe.configure({ timeout: 150_000 });

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-labels-init')) {
      localStorage.removeItem('kronland-settings');
      localStorage.setItem('kronland-lang', 'de');
      sessionStorage.setItem('e2e-labels-init', '1');
    }
  });
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  return errors;
}

async function openBuildMenu(page) {
  await quick(page, 'all');
  await expect(page.getByTestId('build-residence')).toBeVisible(SLOW);
}

/** Long press: on mobile real touch events via CDP, on desktop pointer events of type "touch". */
async function longPress(page, locator, isMobile, ms = 700) {
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await locator.evaluate(async (el, wait) => {
      const o = { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: 0, clientY: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      await new Promise((r) => setTimeout(r, wait));
      el.dispatchEvent(new PointerEvent('pointerup', o));
      el.click();
    }, ms);
  }
}

test('Long press on a build menu icon shows name, costs and explanation without building', async ({ page, isMobile }) => {
  const errors = await boot(page);
  await openBuildMenu(page);
  const item = page.getByTestId('build-residence');
  await longPress(page, item, isMobile);
  const tip = page.getByTestId('tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Wohnhaus');
  await expect(tip.locator('.costs')).toBeVisible();
  await expect(tip.locator('.tt-text')).not.toBeEmpty();
  // No action: no placement mode
  await expect(page.getByTestId('place-cancel')).toHaveCount(0);
  expect(await page.evaluate(() => window.__kronland.placing ?? null)).toBeNull();
  // Next tap closes the tooltip
  await page.getByTestId('build-group-home').locator('.bm-ghead').click();
  await expect(tip).toHaveCount(0);
  // A short tap still triggers
  await item.click();
  await expect(page.getByTestId('place-cancel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Long press on the command and top bar triggers nothing', async ({ page, isMobile }) => {
  const errors = await boot(page);
  // Pause button: tooltip instead of pause
  await longPress(page, page.getByTestId('pause'), isMobile);
  await expect(page.getByTestId('tooltip')).toContainText('Pause');
  await expect(page.getByTestId('pause')).toHaveAttribute('aria-pressed', 'false');
  // Quick access "Alle": tooltip instead of selection
  await page.mouse.click(5, 300);
  await openQuick(page);
  await longPress(page, page.getByTestId('quick-all'), isMobile);
  await expect(page.getByTestId('tooltip')).toContainText('Leibeigenen');
  await expect(page.getByTestId('build-residence')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Labels: on by default on mobile, can be switched off in the settings', async ({ page, isMobile }) => {
  const errors = await boot(page);
  await expect(page.locator('.game')).toHaveClass(isMobile ? /show-labels/ : /^(?!.*show-labels)/);
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  const sw = page.getByTestId('labels');
  await expect(sw).toHaveAttribute('aria-checked', String(isMobile));
  if (!isMobile) {
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('settings-done').click();
    await page.getByTestId('resume').click();
    await expect(page.locator('.game')).toHaveClass(/show-labels/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kronland-settings')).labels)).toBe(true);
    return;
  }
  // Mobile: quick access carries visible names; build menu is always labelled
  await page.getByTestId('settings-done').click();
  await page.getByTestId('resume').click();
  await openQuick(page);
  const label = page.getByTestId('quick-all').locator('.cb-qlbl');
  await expect(label).toBeVisible();
  await expect(label).toHaveText('Alle');
  await expect(page.getByTestId('minimap-toggle').locator('.cb-qlbl')).toHaveText('Karte');
  await openBuildMenu(page);
  await expect(page.getByTestId('build-residence').locator('.bm-name')).toBeVisible();
  // Switching off hides them
  await page.getByTestId('menu').click();
  await page.getByTestId('open-settings').click();
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId('settings-done').click();
  await page.getByTestId('resume').click();
  // The map button is always there on mobile: its name disappears
  await expect(page.getByTestId('minimap-toggle').locator('.cb-qlbl')).toBeHidden();
  await expect(page.getByTestId('build-residence').locator('.bm-name')).toBeVisible();
  expect(errors).toEqual([]);
});
