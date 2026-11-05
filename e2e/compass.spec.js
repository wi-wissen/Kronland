import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Camera without a middle mouse button: compass at the minimap (click opens the camera buttons),
// touchpad swipe moves the map, Alt + left drag rotates.

const SLOW = { timeout: 20_000 };

async function boot(page, isMobile) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { localStorage.removeItem('kronland-settings'); localStorage.setItem('kronland-lang', 'de'); });
  await page.goto(playUrl('?seed=42&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', SLOW);
  if (isMobile) await page.getByTestId('minimap-toggle').click();
  return errors;
}

const rig = (page) => page.evaluate(() => { const r = window.__kronland.renderer.rig; return { yaw: r.yaw, pitch: r.pitch, dist: r.dist, x: r.target.x, z: r.target.z }; });

test('compass: opens the camera buttons, rotates, zooms and puts north up', async ({ page, isMobile }) => {
  test.setTimeout(120_000);
  const errors = await boot(page, isMobile);
  const toggle = page.getByTestId('compass-toggle');
  await expect(toggle).toBeVisible(SLOW);
  await expect(page.getByTestId('compass-panel')).toHaveCount(0);
  await toggle.click();
  const panel = page.getByTestId('compass-panel');
  await expect(panel).toBeVisible();
  const vp = page.viewportSize(), b = await panel.boundingBox();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
  await page.screenshot({ path: test.info().outputPath('compass.png') });

  const r0 = await rig(page);
  await page.getByTestId('compass-left').click();
  await expect.poll(async () => (await rig(page)).yaw, SLOW).toBeGreaterThan(r0.yaw);
  await page.getByTestId('compass-zoomIn').click();
  await expect.poll(async () => (await rig(page)).dist, SLOW).toBeLessThan(r0.dist);
  await page.getByTestId('compass-north').click();
  await expect.poll(async () => Math.abs((await rig(page)).yaw), SLOW).toBeLessThan(0.01);
  // The panel folds with a second click
  await toggle.click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('touchpad: a sideways swipe moves the map, Alt + left drag rotates', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only (pointer and wheel)');
  test.setTimeout(120_000);
  const errors = await boot(page, false);
  const vp = page.viewportSize();
  await page.mouse.move(vp.width / 2, vp.height / 3);
  const r0 = await rig(page);
  await page.mouse.wheel(40, 30);
  await expect.poll(async () => { const r = await rig(page); return Math.hypot(r.x - r0.x, r.z - r0.z); }, SLOW).toBeGreaterThan(0.1);
  expect((await rig(page)).dist).toBeCloseTo(r0.dist, 5);
  // Alt + left drag
  const r1 = await rig(page);
  await page.keyboard.down('Alt');
  await page.mouse.down();
  await page.mouse.move(vp.width / 2 + 120, vp.height / 3, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await expect.poll(async () => Math.abs((await rig(page)).yaw - r1.yaw), SLOW).toBeGreaterThan(0.2);
  await expect(page.locator('.selbox.on')).toHaveCount(0);
  expect(errors).toEqual([]);
});
