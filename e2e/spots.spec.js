import { test, expect } from '@playwright/test';
import { playUrl, SHOT_QUALITY } from './paths.js';

// Fixed spots: serfs at a construction site and resting workers at the campfire each stand on their
// own tile, never on top of each other. The simulation is fast-forwarded (software WebGL is too slow
// for real time), then a picture of the spot.

const SHOTS = process.env.ART_SHOTS ?? 'test-results';

async function boot(page, info) {
  // Evidence images on desktop at 1440×900
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl(`?seed=42&quality=${SHOT_QUALITY}&fog=off`));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.chars, null, { timeout: 120_000 });
  return errors;
}

test('Construction site: every serf builds from its own tile', async ({ page }, info) => {
  test.setTimeout(480_000);
  const errors = await boot(page, info);
  const res = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, P = e.player;
    e.paused = true;
    for (let k = 0; k < 4; k++) s.spawnSerf(P);
    const hq = s.findBuilding(P, 'headquarters');
    const p = s.findPlacement(P, 'residence', hq.x + 2, hq.y + 2, 30);
    const b = s.createBuilding(P, 'residence', p.x, p.y, false);
    const serfs = [...s.entities.values()].filter((x) => x.kind === 'unit' && x.owner === P && !x.militia);
    e.issue({ type: 'assignWork', units: serfs.map((u) => u.id), target: b.id });
    const tileOf = (u) => s.map.idx(Math.floor(u.px / 1000), Math.floor(u.py / 1000));
    let ready = false;
    for (let i = 0; i < 600 && !ready; i++) {
      e.stepOnce();
      const bs = b.builders.map((id) => s.entities.get(id));
      ready = bs.length === 4 && bs.every((u) => !u.path.length && tileOf(u) === u.spot);
    }
    const bs = b.builders.map((id) => s.entities.get(id));
    // More serfs: the construction site is full with 4
    const rest = serfs.filter((u) => !b.builders.includes(u.id));
    const ev = s.step([{ type: 'assignWork', player: P, units: rest.slice(0, 1).map((u) => u.id), target: b.id }]);
    e.focusPoint(b.x + b.w / 2, b.y + b.h / 2);
    e.renderer.rig.zoom(0.55);
    return {
      ready, builders: bs.length, tiles: new Set(bs.map(tileOf)).size,
      onRing: bs.every((u) => { const x = Math.floor(u.px / 1000), y = Math.floor(u.py / 1000); return x >= b.x - 1 && x <= b.x + b.w && y >= b.y - 1 && y <= b.y + b.h && !(x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h); }),
      rejected: ev.find((x) => x.type === 'rejected')?.reason ?? null,
    };
  });
  expect(res.ready).toBe(true);
  expect(res.builders).toBe(4);
  expect(res.tiles).toBe(4);
  expect(res.onRing).toBe(true);
  expect(res.rejected).toBe('err.siteFull');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/spots-site-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Campfire: resting workers sit in a circle, each on its own tile', async ({ page }, info) => {
  test.setTimeout(480_000);
  const errors = await boot(page, info);
  const res = await page.evaluate(() => {
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
    const tileOf = (w) => s.map.idx(Math.floor(w.px / 1000), Math.floor(w.py / 1000));
    const atCamp = () => [...s.entities.values()].filter((w) => w.kind === 'worker' && w.owner === P && w.state === 'camping');
    let best = 0, maxSame = 0;
    for (let i = 0; i < 6000; i++) {
      e.stepOnce();
      const c = atCamp();
      if (new Set(c.map(tileOf)).size !== c.length) maxSame++;
      if (c.length >= 4) { best = c.length; break; }
      best = Math.max(best, c.length);
    }
    const c = atCamp();
    const f = s.entities.get(c[0]?.target);
    if (f) { e.focusPoint(f.x + 0.5, f.y + 0.5); e.renderer.rig.zoom(0.45); }
    return { best, overlaps: maxSame, camp: f?.kind ?? null, tiles: new Set(c.map(tileOf)).size, n: c.length };
  });
  expect(res.camp).toBe('camp');
  expect(res.best).toBeGreaterThanOrEqual(2);
  expect(res.overlaps).toBe(0);
  expect(res.tiles).toBe(res.n);
  await page.waitForTimeout(1500);
  // every resting worker looks at the fire (facing deviation < 30°)
  const off = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const c = [...s.entities.values()].filter((w) => w.kind === 'worker' && w.owner === e.player && w.state === 'camping');
    return c.map((w) => {
      const f = s.entities.get(w.target), r = e.renderer.chars.records.get(w.id);
      if (!f || !r) return 0;
      const want = Math.atan2(f.x + 0.5 - w.px / 1000, f.y + 0.5 - w.py / 1000);
      let d = Math.abs(want - r.yaw) % (2 * Math.PI);
      return Math.min(d, 2 * Math.PI - d);
    });
  });
  for (const d of off) expect(d).toBeLessThan(Math.PI / 6);
  await page.screenshot({ path: `${SHOTS}/spots-campfire-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
