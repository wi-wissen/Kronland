import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Click confirmation: a right click (tap on mobile) with selected serfs shows a marker at the walk target;
// on desktop the cursor announces work (axe over a tree).

test.describe.configure({ timeout: 150_000 }); // software graphics: clicks and camera moves wait for frames

test('walk command shows a marker at the target spot', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  const target = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, m = s.map;
    const hq = s.findBuilding(0, 'headquarters');
    e.selected.clear();
    for (const u of s.entities.values()) if (u.kind === 'unit' && u.owner === 0) e.selected.add(u.id);
    e.emitUi();
    let k = -1;
    for (let r = 4; r < 12 && k < 0; r++) for (let dx = -r; dx <= r && k < 0; dx++) {
      const x = hq.x + 1 + dx, y = hq.y + hq.h + r;
      // free spot without tree or pile next to it (otherwise the serfs go to work there)
      let free = m.walkable(x, y);
      for (let j = -1; j <= 1 && free; j++) for (let i = -1; i <= 1; i++) if (m.owner[m.idx(x + i, y + j)]) free = false;
      if (free) k = m.idx(x, y);
    }
    const x = (k % m.width) + 0.5, z = ((k / m.width) | 0) + 0.5;
    e.renderer.rig.lookAt(x, z); e.renderer.rig.update(0);
    // record markers and hold the animation still (software graphics run too slowly for a 0.9 s animation)
    const om = e.renderer.orderMarks, update = om.update.bind(om);
    window.__markers = [];
    const add = om.add.bind(om);
    om.add = (mx, mz) => { window.__markers.push({ x: mx, z: mz }); add(mx, mz); };
    om.update = (dt, ...rest) => update(0, ...rest);
    const p = e.renderer.project(x, e.renderer.terrain.heightAt(x, z), z);
    return { x, z, sx: p.x, sy: p.y };
  });
  // the build menu of the selected serfs covers the middle of the screen on desktop
  await page.addStyleTag({ content: '.buildmenu { display: none !important; }' });
  await page.waitForTimeout(300);
  if (info.project.name === 'mobile') await page.touchscreen.tap(target.sx, target.sy);
  else await page.mouse.click(target.sx, target.sy, { button: 'right' });
  await page.waitForFunction(() => window.__markers.length > 0, null, { timeout: 20_000 });
  const marks = await page.evaluate(() => window.__markers);
  expect(marks).toHaveLength(1);
  expect(Math.hypot(marks[0].x - target.x, marks[0].z - target.z)).toBeLessThan(1);
  // ring spreading out like a drop
  for (const [name, age] of [['start', 0.05], ['spread', 0.2]]) {
    await page.evaluate((age) => { for (const m of window.__kronland.renderer.orderMarks.list) m.age = age; }, age);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__kronland.renderer.orderMarks.active)).toBe(1);
    await page.screenshot({ path: `test-results/order-marker-${name}-${info.project.name}.png` });
  }
  expect(errors).toEqual([]);
});

test('cursor shows an axe over a tree with serfs selected', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'No cursor on touch');
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  const tree = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const hq = s.findBuilding(0, 'headquarters');
    e.selected.clear();
    for (const u of s.entities.values()) if (u.kind === 'unit' && u.owner === 0) e.selected.add(u.id);
    e.emitUi();
    let t = null, best = Infinity;
    for (const n of s.entities.values()) if (n.kind === 'tree') { const d = Math.hypot(n.x - hq.x, n.y - hq.y); if (d < best) { best = d; t = n; } }
    e.renderer.rig.lookAt(t.x + 0.5, t.y + 0.5); e.renderer.rig.update(0);
    const p = e.renderer.project(t.x + 0.5, e.renderer.terrain.heightAt(t.x + 0.5, t.y + 0.5), t.y + 0.5);
    return { sx: p.x, sy: p.y };
  });
  await page.addStyleTag({ content: '.buildmenu { display: none !important; }' });
  await page.waitForTimeout(300);
  await page.mouse.move(tree.sx - 20, tree.sy);
  await page.mouse.move(tree.sx, tree.sy, { steps: 3 });
  await expect.poll(() => page.evaluate(() => window.__kronland.cursorKind), { timeout: 10_000 }).toBe('chop');
  expect(await page.evaluate(() => window.__kronland.renderer.renderer.domElement.style.cursor)).toContain('cursor-chop');
});
