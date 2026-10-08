import { test, expect } from './fixtures.js';
import { playUrl, SHOT_QUALITY } from './paths.js';

// Ring slots: resting workers at the campfire, waiting workers in front of a building and woodcutters at a tree stand on
// exact points of a circle around their target and look at it. The simulation is fast-forwarded
// (software WebGL is too slow for real time), then a picture of the spot.
// CIRCLE_SHOTS: folder of the evidence images, CIRCLE_TAG: name prefix (before/after). With CIRCLE_TAG=before
// only images are produced (comparison with the old state without ring slots).

const SHOTS = process.env.CIRCLE_SHOTS ?? 'test-results';
const TAG = process.env.CIRCLE_TAG ?? 'after';
const CHECK = TAG !== 'before';

async function boot(page, info) {
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl(`?seed=42&quality=${SHOT_QUALITY}&fog=off`));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.chars, null, { timeout: 120_000 });
  return errors;
}

/** Figures in the picture: position on the circle (distance to the target centre) and deviation of the facing from the target. */
async function circleStats(page, kind) {
  return page.evaluate((kind) => {
    const e = window.__kronland, s = e.sim, P = e.player;
    const figs = [...s.entities.values()].filter((f) => f.owner === P && (kind === 'camp' ? f.kind === 'worker' && f.state === 'camping'
      : kind === 'wait' ? f.kind === 'worker' && f.state === 'waiting' && f.slot >= 0 : f.kind === 'unit' && f.job?.kind === 'gather' && !f.path.length));
    return figs.map((f) => {
      const t = s.entities.get(kind === 'tree' ? f.job.target : f.target);
      const cx = t.x + (t.w ?? 1) / 2, cz = t.y + (t.h ?? 1) / 2;
      const x = f.px / 1000, z = f.py / 1000, r = e.renderer.chars.records.get(f.id);
      const want = Math.atan2(cx - x, cz - z);
      let d = Math.abs(want - (r?.yaw ?? want)) % (2 * Math.PI);
      return { target: t.id, dist: Math.hypot(x - cx, z - cz), yawOff: Math.min(d, 2 * Math.PI - d), slot: f.slot };
    });
  }, kind);
}

function expectCircle(stats, n) {
  expect(stats.length).toBeGreaterThanOrEqual(n);
  if (!CHECK) return;
  const byTarget = new Map();
  for (const st of stats) (byTarget.get(st.target) ?? byTarget.set(st.target, []).get(st.target)).push(st);
  const [group] = [...byTarget.values()].sort((a, b) => b.length - a.length);
  expect(group.length).toBeGreaterThanOrEqual(n);
  // all on one of at most two rings, different slots, facing the target (< 30°)
  const radii = [...new Set(group.map((g) => g.dist.toFixed(2)))];
  expect(radii.length).toBeLessThanOrEqual(2);
  expect(new Set(group.map((g) => g.slot)).size).toBe(group.length);
  for (const g of group) expect(g.yawOff).toBeLessThan(Math.PI / 6);
}

test('Campfire: resting workers sit in a circle and look into the fire', async ({ page }, info) => {
  test.setTimeout(600_000);
  const errors = await boot(page, info);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, P = e.player;
    e.paused = true;
    const pl = s.players[P];
    pl.raw.stone = 100000;
    pl.techs.add('gears');
    const hq = s.findBuilding(P, 'headquarters');
    for (let k = 0; k < 2; k++) {
      const p = s.findPlacement(P, 'stonemason', hq.x + 2, hq.y + 2, 30);
      s.createBuilding(P, 'stonemason', p.x, p.y, true);
    }
    const atCamp = () => [...s.entities.values()].filter((w) => w.kind === 'worker' && w.owner === P && w.state === 'camping');
    let best = [];
    for (let i = 0; i < 8000; i++) {
      e.stepOnce();
      const c = atCamp();
      const counts = new Map();
      for (const w of c) counts.set(w.target, (counts.get(w.target) ?? 0) + 1);
      const max = Math.max(0, ...counts.values());
      if (max > best.length) best = c;
      if (max >= 6) break;
    }
    const f = s.entities.get(best[0]?.target);
    if (f) { e.focusPoint(f.x + 0.5, f.y + 0.5); e.renderer.rig.zoom(0.4); }
  });
  await page.waitForTimeout(2000);
  expectCircle(await circleStats(page, 'camp'), 4);
  await page.screenshot({ path: `${SHOTS}/${TAG}-campfire-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Building: waiting workers stand in a circle in front of it and look at it', async ({ page }, info) => {
  test.setTimeout(600_000);
  const errors = await boot(page, info);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, P = e.player;
    e.paused = true;
    const pl = s.players[P];
    pl.raw.stone = 0; // without raw stone the stonemasons wait outside
    pl.techs.add('gears');
    const hq = s.findBuilding(P, 'headquarters');
    const p = s.findPlacement(P, 'stonemason', hq.x + 4, hq.y + 6, 30);
    const b = s.createBuilding(P, 'stonemason', p.x, p.y, true);
    for (let i = 0; i < 3000; i++) {
      e.stepOnce();
      const w = [...s.entities.values()].filter((x) => x.kind === 'worker' && x.workplace === b.id && x.state === 'waiting' && !x.path.length);
      if (w.length >= 5 && i > 400) break;
    }
    e.focusPoint(b.x + b.w / 2, b.y + b.h / 2);
    e.renderer.rig.zoom(0.5);
  });
  await page.waitForTimeout(2000);
  if (CHECK) expectCircle(await circleStats(page, 'wait'), 3);
  await page.screenshot({ path: `${SHOTS}/${TAG}-waiting-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Tree: woodcutters stand in a circle around the trunk', async ({ page }, info) => {
  test.setTimeout(600_000);
  const errors = await boot(page, info);
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, P = e.player;
    e.paused = true;
    for (let k = 0; k < 4; k++) s.spawnSerf(P);
    const hq = s.findBuilding(P, 'headquarters');
    // tree nearest to the castle, all other trees nearby removed (otherwise the woodcutters spread out)
    let tree = null, bd = Infinity;
    for (const t of s.entities.values()) {
      if (t.kind !== 'tree') continue;
      const d = (t.x - hq.x) ** 2 + (t.y - hq.y) ** 2;
      if (d < bd) { bd = d; tree = t; }
    }
    for (const t of [...s.entities.values()]) if (t.kind === 'tree' && t !== tree && (t.x - tree.x) ** 2 + (t.y - tree.y) ** 2 <= 900) s.removeEntity(t);
    const serfs = [...s.entities.values()].filter((u) => u.kind === 'unit' && u.owner === P && !u.militia).slice(0, 6);
    e.issue({ type: 'assignWork', units: serfs.map((u) => u.id), target: tree.id });
    for (let i = 0; i < 1500; i++) {
      e.stepOnce();
      if (i > 50 && serfs.every((u) => u.job?.target === tree.id && !u.path.length)) { for (let k = 0; k < 15; k++) e.stepOnce(); break; }
    }
    e.focusPoint(tree.x + 0.5, tree.y + 0.5);
    e.renderer.rig.zoom(0.3);
  });
  await page.waitForTimeout(2000);
  expectCircle(await circleStats(page, 'tree'), 4);
  await page.screenshot({ path: `${SHOTS}/${TAG}-tree-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
