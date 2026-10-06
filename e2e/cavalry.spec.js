import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Cavalry: riders sit on the horse from the pipeline (Horse.lod1.glb, own clips), no longer on the
// procedural blocky horse. Standing, walk/gallop switch by speed, run speed coupled to the hooves.
// ?quality=high forces the GLB figures even on the software renderer of the tests.

test('Riders sit on the horse model and gallop in rhythm', async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&quality=high&fog=off'));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.chars, null, { timeout: 120_000 });
  const ids = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const hq = s.findBuilding(0, 'headquarters');
    const x = hq.x + hq.w + 3, y = hq.y + 1;
    const light = s.spawnLeader(0, 'lightCav1', x, y);
    const heavy = s.spawnLeader(0, 'heavyCav1', x, y + 3);
    for (let k = 0; k < 5; k++) e.stepOnce();
    const r = e.renderer.rig;
    r.dist = 9; r.lookAt(x + 1, y + 2); r.clamp?.(); r.update(0);
    return { light: light.id, heavy: heavy.id, x, y };
  });
  // Horse and rider are loaded later; after that the rendering rebuilds with the model
  await page.waitForFunction(({ light, heavy }) => {
    const c = window.__kronland.renderer.chars;
    return [light, heavy].every((id) => { const r = c.records.get(id); return r?.variant?.model && r.variant.mount?.variant.model === 'Horse'; });
  }, ids, { timeout: 120_000 });
  const stand = await page.evaluate(({ light, heavy }) => {
    const c = window.__kronland.renderer.chars;
    return [light, heavy].map((id) => {
      const r = c.records.get(id), v = r.variant, m = v.mount;
      return { model: v.model, horse: m.variant.model, seat: v.seat, saddle: m.variant.saddle * m.scale, clip: r.clip,
        track: m.variant.saddleDy?.length ?? 0, run: v.moveSpeed('run'), walk: v.moveSpeed('walk'), height: m.variant.worldHeight * m.scale };
    });
  }, ids);
  for (const s of stand) {
    expect(s.horse).toBe('Horse');
    expect(s.clip).toBe('idle');
    // Seat just below the saddle (rider's feet hang down the horse), horse bigger than a foot soldier
    expect(s.seat).toBeGreaterThan(s.saddle - 0.45);
    expect(s.seat).toBeLessThan(s.saddle);
    expect(s.height).toBeGreaterThan(0.95);
    expect(s.height).toBeLessThan(1.4);
    expect(s.track).toBeGreaterThan(10);
    expect(s.run).toBeGreaterThan(s.walk * 2);
  }
  await page.screenshot({ path: info.outputPath('rider-standing.png') });
  // ride off: gallop, playback speed from ground speed / the horse's gallop speed
  await page.evaluate(({ light, heavy, x, y }) => {
    const e = window.__kronland;
    e.issue({ type: 'order', order: 'move', units: [light, heavy], x: x + 30, y: y + 1 });
  }, ids);
  await page.waitForFunction(({ light }) => window.__kronland.renderer.chars.records.get(light)?.clip === 'run', ids, { timeout: 60_000 });
  const ride = await page.evaluate(({ light }) => {
    const e = window.__kronland, c = e.renderer.chars, r = c.records.get(light);
    const L = e.sim.entities.get(light);
    e.renderer.rig.lookAt(L.px / 1000, L.py / 1000); e.renderer.rig.update(0);
    return { clip: r.clip, speed: r.speed, horseClip: r.variant.mount.variant.clip('run').key };
  }, ids);
  expect(ride.clip).toBe('run');
  expect(ride.horseClip).toBe('run');
  expect(ride.speed).toBeGreaterThan(0.6);
  expect(ride.speed).toBeLessThan(2.3);
  await page.waitForTimeout(800);
  await page.screenshot({ path: info.outputPath('rider-gallop.png') });
  // Riders always look in the direction of their horse - when riding, turning and in combat (enemy next to them to shoot at)
  await page.evaluate(({ light, heavy }) => {
    const e = window.__kronland, s = e.sim, L = e.sim.entities.get(light);
    const foe = s.spawnLeader(1, 'lightCav1', Math.round(L.px / 1000) + 3, Math.round(L.py / 1000) + 2);
    e.issue({ type: 'order', order: 'move', units: [light, heavy], x: Math.round(L.px / 1000) - 6, y: Math.round(L.py / 1000) - 4 });
    window.__foe = foe.id;
  }, ids);
  const seen = new Set();
  let worst = 0;
  for (let k = 0; k < 16; k++) {
    await page.waitForTimeout(400);
    const f = await page.evaluate(() => {
      const c = window.__kronland.renderer.chars, out = [];
      for (const r of c.records.values()) if (/Cav/.test(r.roleKey) && !r.dying) { const x = c.facing(r.id); if (x?.horse !== null) out.push(x); }
      return out;
    });
    for (const x of f) {
      seen.add(x.clip);
      const d = Math.abs(Math.atan2(Math.sin(x.rider - x.horse), Math.cos(x.rider - x.horse)));
      worst = Math.max(worst, (d * 180) / Math.PI);
    }
  }
  console.log('Rider clips seen:', [...seen].join(', '), 'largest deviation', worst.toFixed(1), '°');
  expect(worst, 'Rider and horse look the same way').toBeLessThan(25);
  expect(errors).toEqual([]);
});
