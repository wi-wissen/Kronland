import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Double click or double tap on an own figure selects all visible own figures of the same kind.

const SHOTS = process.env.SHOT_DIR || 'test-results';

test.describe.configure({ timeout: 150_000 });

test('Double click selects visible serfs, no distant ones and no enemies', async ({ page }, info) => {
  const mobile = info.project.name === 'mobile';
  if (!mobile) await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');

  const pos = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, hq = s.findBuilding(0, 'headquarters');
    const own = [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === 0);
    const foe = [...s.entities.values()].find((u) => u.kind === 'unit' && u.owner === 1);
    const cx = hq.x + hq.w / 2, cz = hq.y + hq.h + 4;
    const put = (u, x, z) => { u.px = Math.round(x * 1000); u.py = Math.round(z * 1000); u.job = null; u.path = []; u.goal = undefined; };
    // own serfs side by side, an enemy in the middle of them, the last one far away
    const near = own.slice(0, -1);
    near.forEach((u, i) => put(u, cx - near.length + 1 + i * 2, cz));
    put(foe, cx, cz + 1.5);
    const far = own[own.length - 1];
    put(far, cx > s.map.width / 2 ? 3.5 : s.map.width - 3.5, cz > s.map.height / 2 ? 3.5 : s.map.height - 3.5);
    const r = e.renderer.rig;
    r.lookAt(cx, cz); r.dist = Math.min(r.dist, 16); r.update(0);
    e.selected.clear(); e.emitUi();
    return { near: near.map((u) => u.id), far: far.id, foe: foe.id };
  });
  // wait until the figures are drawn at their new spots (software graphics are slow)
  await page.waitForFunction((ids) => ids.every((id) => {
    const k = window.__kronland, e = k.sim.entities.get(id), r = k.renderer.chars.records.get(id);
    return r && Math.hypot(r.position.x - e.px / 1000, r.position.z - e.py / 1000) < 0.3;
  }), pos.near, { timeout: 60_000 });
  await page.waitForTimeout(500);
  // Click point: the figure's chest; the distant one lies outside the picture
  Object.assign(pos, await page.evaluate((ids) => {
    const k = window.__kronland, r = k.renderer;
    const at = (id, h) => {
      const e = k.sim.entities.get(id), x = e.px / 1000, z = e.py / 1000;
      return r.project(x, r.terrain.heightAt(x, z) + h, z);
    };
    const p = at(ids.near[0], 0.5), fp = at(ids.far, 0);
    return { x: p.x, y: p.y, farOnScreen: !fp.behind && fp.x >= 0 && fp.x <= innerWidth && fp.y >= 0 && fp.y <= innerHeight };
  }, pos));
  expect(pos.farOnScreen).toBe(false);
  expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, pos)).toBe('CANVAS');

  const selected = () => page.evaluate(() => [...window.__kronland.selected]);
  // single click or tap: only this figure
  if (mobile) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y);
  await expect.poll(selected).toEqual([pos.near[0]]);
  await page.waitForTimeout(600); // does not count as a double click with the next one

  // Double click: software graphics are too slow for two real clicks within 400 ms, hence both clicks
  // in one go as pointer events on the map
  await page.evaluate(({ x, y, type }) => {
    const c = document.querySelector('canvas');
    c.setPointerCapture = () => {}; // an invented pointer ID could not be captured
    const ev = (name) => new PointerEvent(name, { pointerId: 7, pointerType: type, isPrimary: true, button: 0, buttons: name === 'pointerdown' ? 1 : 0, clientX: x, clientY: y, bubbles: true });
    for (let i = 0; i < 2; i++) { c.dispatchEvent(ev('pointerdown')); c.dispatchEvent(ev('pointerup')); }
  }, { x: pos.x, y: pos.y, type: mobile ? 'touch' : 'mouse' });
  const sel = (await selected()).sort((a, b) => a - b);
  expect(sel).toEqual(expect.arrayContaining(pos.near));
  expect(sel).not.toContain(pos.far);
  expect(sel).not.toContain(pos.foe);
  const kinds = await page.evaluate((ids) => ids.map((id) => {
    const u = window.__kronland.sim.entities.get(id);
    return `${u.kind}/${u.owner}/${!!u.militia}`;
  }), sel);
  expect(new Set(kinds)).toEqual(new Set(['unit/0/false']));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/doubleclick-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
