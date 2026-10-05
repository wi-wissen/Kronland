import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Ice in winter: stands still (no waves) and is blue - easy to tell apart from snow.

/** Read a section in the middle of the picture right after a frame: mean colour and pixels to compare. */
const grab = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
  const r = window.__kronland.renderer, gl = r.renderer.domElement;
  r.rig.update(0); // camera at once to its position (software WebGL rarely draws under load)
  r.renderer.render(r.scene, r.camera);
  const w = 160, h = 90, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(gl, gl.width / 2 - w / 2, gl.height / 2 - h / 2, w, h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data, m = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; }
  res({ px: Array.from(d), mean: m.map((v) => v / (w * h)) });
})));

test('Ice in winter stands still and is blue instead of white', async ({ page }, info) => {
  test.setTimeout(180_000); // "high" level with software WebGL is slow
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // "high": waves and gloss are only active there (even with software WebGL)
  await page.goto(playUrl('?seed=42&quality=high&fog=off'));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.water);
  await page.evaluate(() => {
    // larger water area near the castle in the middle of the picture
    const e = window.__kronland, m = e.sim.map, hq = e.sim.findBuilding(0, 'headquarters');
    let best = null;
    for (let y = 6; y < m.height - 6; y++) for (let x = 6; x < m.width - 6; x++) {
      let w = 0;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (m.flags[m.idx(x + dx, y + dy)] & 1) w++;
      if (w < 78) continue;
      const d = Math.hypot(x - hq.x, y - hq.y);
      if (!best || d < best.d) best = { x, y, d };
    }
    const r = e.renderer;
    r.rig.lookAt(best.x + 0.5, best.y + 0.5); r.rig.dist = 12; r.rig.update(0);
    r.applyWeather('winter');
  });
  // The ambient light of winter is recalculated a few frames later: only compare after that
  await page.waitForFunction(() => !window.__kronland.renderer.env.envDirty, null, { timeout: 90_000 });
  await page.waitForTimeout(500);
  const a = await grab(page);
  await page.waitForTimeout(1200);
  const b = await grab(page);
  // unmoved: two frames more than a second apart are equal (formerly ~40 % of the pixels changed slightly)
  let changed = 0;
  for (let i = 0; i < a.px.length; i += 4) {
    if (a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1] || a.px[i + 2] !== b.px[i + 2]) changed++;
  }
  expect(changed / (a.px.length / 4)).toBeLessThan(0.01);
  // blue instead of white: clearly more blue than red and darker than snow
  const [r, , bl] = a.mean;
  expect(bl - r).toBeGreaterThan(30);
  expect(r).toBeLessThan(170);
  await page.screenshot({ path: `test-results/ice-winter-${info.project.name}.png`, timeout: 90_000 });
  expect(errors).toEqual([]);
});
