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
  await page.mouse.move(Math.min(...xs) - 40, Math.min(...ys) - 40);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 40, Math.max(...ys) + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(selected).toEqual([...ids].sort((a, b) => a - b));

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
  expect(errors).toEqual([]);
});
