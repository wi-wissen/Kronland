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
  // Ready only after the first frames: the world is built at the first frame and the canvas takes its final size,
  // screen points computed before that no longer match the picture
  await page.waitForFunction(() => window.__kronland?.renderer.frameNo > 2, null, { timeout: 60_000 });
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
    window.__placedAt = e.renderer.frameNo;
    return own.map((u) => u.id);
  });
  // drawn at the new spots (two frames after placing)
  await page.waitForFunction((ids) => window.__kronland.renderer.frameNo > window.__placedAt + 1 && ids.every((id) => {
    const k = window.__kronland, e = k.sim.entities.get(id), r = k.renderer.chars.records.get(id);
    // picking only hits figures drawn in the last frame (in the view volume, with a mesh level)
    return r && r.visible && r.meshLvl >= 0 && Math.hypot(r.position.x - e.px / 1000, r.position.z - e.py / 1000) < 0.3;
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
  // Before every click: the canvas is on top there and picking finds the figure (otherwise the cause shows up here)
  const clickOn = async (i) => {
    const at = await page.evaluate(([p, id]) => ({ el: document.elementFromPoint(p.x, p.y)?.tagName, pick: window.__kronland.renderer.pickEntity(p.x, p.y), id }), [pts[i], ids[i]]);
    expect(at, `point of figure ${i}`).toEqual({ el: 'CANVAS', pick: ids[i], id: ids[i] });
    await page.mouse.click(pts[i].x, pts[i].y);
  };

  // Box over all three
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs) - 40, y0 = Math.min(...ys) - 40, x1 = Math.max(...xs) + 40, y1 = Math.max(...ys) + 40;
  const box = page.locator('.selbox');
  await expect(box).toHaveCount(1); // stays in the page (own layer), only shown while dragging
  await expect(box).toBeHidden();
  // The map cancels the primary mousedown: no native drag/selection gesture (Firefox evaluates it after a few
  // pixels, right when the box starts)
  await page.evaluate(() => { window.__md = []; window.addEventListener('mousedown', (e) => window.__md.push(e.defaultPrevented)); });
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
  expect(await page.evaluate(() => window.__md)).toEqual([true]);

  // Click: only one; Ctrl click adds, Shift click adds, Ctrl click again removes
  await clickOn(0);
  await expect.poll(selected).toEqual([ids[0]]);
  await page.waitForTimeout(600); // no double click
  await page.keyboard.down('Control');
  await clickOn(1);
  await page.keyboard.up('Control');
  await expect.poll(selected).toEqual([ids[0], ids[1]].sort((a, b) => a - b));
  await page.waitForTimeout(600);
  await page.keyboard.down('Shift');
  await clickOn(2);
  await page.keyboard.up('Shift');
  await expect.poll(selected).toEqual([...ids].sort((a, b) => a - b));
  await page.waitForTimeout(600);
  await page.keyboard.down('Control');
  await clickOn(1);
  await page.keyboard.up('Control');
  await expect.poll(selected).toEqual([ids[0], ids[2]].sort((a, b) => a - b));

  // A click on the map still takes the focus out of a field (the mousedown default is cancelled)
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'focus-probe'; document.body.appendChild(i); i.focus(); });
  await expect(page.locator('#focus-probe')).toBeFocused();
  await page.mouse.click(x1 + 120, y1 + 60);
  await expect(page.locator('#focus-probe')).not.toBeFocused();
  expect(errors).toEqual([]);
});
