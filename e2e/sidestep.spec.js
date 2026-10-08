import { test, expect } from './fixtures.js';
import { playUrl, SHOT_QUALITY } from './paths.js';

// Rendering-only sidestep (src/render/separation.js): two serfs walking head-on through each other in the
// simulation are drawn stepping aside, so they do not visibly pass through each other.

const SHOTS = process.env.ART_SHOTS ?? 'test-results';

test('Serfs walking head-on step aside instead of passing through each other', async ({ page }, info) => {
  test.setTimeout(480_000);
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl(`?seed=42&quality=${SHOT_QUALITY}&fog=off`));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.chars, null, { timeout: 120_000 });
  const setup = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, P = e.player, m = s.map;
    e.paused = true;
    const hq = s.findBuilding(P, 'headquarters');
    // free straight row of 7 tiles below the headquarters
    let row = null;
    for (let y = hq.y + hq.h + 2; y < hq.y + hq.h + 12 && !row; y++) {
      for (let x = hq.x - 4; x < hq.x + 4 && !row; x++) {
        let ok = true;
        for (let i = 0; i < 7; i++) ok &&= m.walkable(x + i, y) && !m.owner[m.idx(x + i, y)];
        if (ok) row = { x, y };
      }
    }
    if (!row) return null;
    const [a, b] = [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === P && !u.militia);
    for (const u of [a, b]) { u.job = null; u.path = []; u.goal = undefined; }
    a.px = (row.x) * 1000 + 500; b.px = (row.x + 6) * 1000 + 500; a.py = b.py = row.y * 1000 + 500;
    e.stepOnce();
    e.issue({ type: 'move', units: [a.id], x: row.x + 6, y: row.y });
    e.issue({ type: 'move', units: [b.id], x: row.x, y: row.y });
    e.focusPoint(row.x + 3.5, row.y + 0.5);
    e.renderer.rig.zoom(0.35);
    window.__pair = { a: a.id, b: b.id };
    // slow motion: software WebGL draws few frames, so only little game time may pass per frame
    e.setSpeed(0.1);
    return row;
  });
  expect(setup).not.toBe(null);
  // watch the encounter frame by frame (drawn positions); freeze where they are level for the picture
  const res = await page.evaluate(() => new Promise((done) => {
    const e = window.__kronland, q = window.__pair, t0 = performance.now();
    const tick = () => {
      const ra = e.renderer.chars.records.get(q.a), rb = e.renderer.chars.records.get(q.b);
      // a walks east, b west: level once a is no longer west of b
      if (ra && rb && ra.position.x >= rb.position.x) {
        e.setSpeed(0.01); // almost stand still, but not the grey pause picture
        return done({ apart: Math.abs(ra.position.z - rb.position.z) });
      }
      if (performance.now() - t0 > 120_000) return done(null);
      requestAnimationFrame(tick);
    };
    tick();
  }));
  expect(res).not.toBe(null);
  // drawn side by side at the crossing (in the simulation both walk along the same line)
  expect(res.apart).toBeGreaterThan(0.2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/sidestep-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
