import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Desktop: drag a box over several own figures selects all of them; Shift or Ctrl click adds and removes single ones.

test.describe.configure({ timeout: 150_000 });

test('Selection box and Ctrl/Shift click select several figures', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse only');
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&fog=off&no-models'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');

  // three serfs in a row south of the castle, camera on them
  const ids = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    const own = [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0).slice(0, 3);
    const cx = hq.x + hq.w / 2, cz = hq.y + hq.h + 4;
    own.forEach((u, i) => { u.px = Math.round((cx - 2 + i * 2) * 1000); u.py = Math.round(cz * 1000); u.job = null; u.path = []; u.goal = undefined; });
    const r = e.renderer.rig;
    r.lookAt(cx, cz); r.dist = Math.min(r.dist, 16); r.update(0);
    e.paused = true;
    e.selected.clear(); e.emitUi();
    return own.map((u) => u.id);
  });
  await page.waitForFunction((ids) => ids.every((id) => {
    const k = window.__kronland, e = k.sim.entities.get(id), r = k.renderer.chars.records.get(id);
    return r && Math.hypot(r.position.x - e.px / 1000, r.position.z - e.py / 1000) < 0.3;
  }), ids, { timeout: 60_000 });
  const pts = await page.evaluate((ids) => {
    const k = window.__kronland, r = k.renderer;
    return ids.map((id) => {
      const e = k.sim.entities.get(id), x = e.px / 1000, z = e.py / 1000;
      const p = r.project(x, r.terrain.heightAt(x, z) + 0.5, z);
      return { x: p.x, y: p.y };
    });
  }, ids);
  const selected = () => page.evaluate(() => [...window.__kronland.selected].sort((a, b) => a - b));

  // Box over all three
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 40, x1 = Math.max(...xs) + 40, y1 = Math.max(...ys) + 40;
  const box = page.locator('.selbox');
  await expect(box).toHaveCount(1); // stays in the page (own layer), only shown while dragging
  await expect(box).toBeHidden();
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // The box follows the pointer from the first moves on (after the drag threshold of 8 px)
  for (const [dx, dy] of [[12, 9], [30, 20]]) {
    await page.mouse.move(x0 + dx, y0 + dy);
    await expect(box).toBeVisible();
    const bb = await box.boundingBox();
    expect(Math.abs(bb.x - x0)).toBeLessThan(2);
    expect(Math.abs(bb.y - y0)).toBeLessThan(2);
    expect(Math.abs(bb.width - dx)).toBeLessThan(2);
    expect(Math.abs(bb.height - dy)).toBeLessThan(2);
  }
  await page.mouse.move(x1, y1, { steps: 6 });
  await page.mouse.up();
  await expect(box).toBeHidden();
  await expect.poll(selected).toEqual([...ids].sort((a, b) => a - b));

  // Click: only one; Ctrl click adds, Shift click adds, Ctrl click again removes
  await page.mouse.click(pts[0].x, pts[0].y);
  await expect.poll(selected).toEqual([ids[0]]);
  await page.waitForTimeout(600); // no double click
  await page.keyboard.down('Control');
  await page.mouse.click(pts[1].x, pts[1].y);
  await page.keyboard.up('Control');
  await expect.poll(selected).toEqual([ids[0], ids[1]].sort((a, b) => a - b));
  await page.waitForTimeout(600);
  await page.keyboard.down('Shift');
  await page.mouse.click(pts[2].x, pts[2].y);
  await page.keyboard.up('Shift');
  await expect.poll(selected).toEqual([...ids].sort((a, b) => a - b));
  await page.waitForTimeout(600);
  await page.keyboard.down('Control');
  await page.mouse.click(pts[1].x, pts[1].y);
  await page.keyboard.up('Control');
  await expect.poll(selected).toEqual([ids[0], ids[2]].sort((a, b) => a - b));
  expect(errors).toEqual([]);
});
