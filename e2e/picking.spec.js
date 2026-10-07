import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Picking: a click or tap on empty ground selects nothing - not even a figure standing below or behind
// the camera (depth in front of the near clipping plane: the projection returned huge screen coordinates and thus
// a huge pick radius, a distant serf was selected and ran in from outside the picture).
// Checked on the stress map "bustle" and a normal map, desktop and mobile.

const SHOTS = process.env.SHOT_DIR || 'test-results';

test.describe.configure({ timeout: 360_000 });

/** Set the camera, first draw an own serf visibly, then put it under the camera. */
async function setup(page, query, at, dist) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl(query));
  await page.waitForFunction(() => !!window.__kronland && window.__kronland.renderer.frameNo > 2, null, { timeout: 240_000 });
  const serf = await page.evaluate(([at, dist]) => {
    const k = window.__kronland, s = k.sim, r = k.renderer.rig;
    const a = at ?? (() => { const hq = s.findBuilding(0, 'headquarters'); return { x: hq.x + hq.w / 2, y: hq.y + hq.h + 5 }; })();
    r.dist = dist; r.yaw = 0; r.lookAt(a.x, a.y); r.update(0);
    const [u, v] = [...s.entities.values()].filter((e) => e.kind === 'unit' && e.owner === k.player && !e.militia);
    const put = (e, x, y) => { e.px = Math.round(x * 1000); e.py = Math.round(y * 1000); e.job = null; e.path = []; e.goal = undefined; };
    put(u, a.x, a.y); put(v, a.x + 1.5, a.y);
    k.selected.clear(); k.emitUi();
    return { id: u.id, other: v.id, at: a };
  }, [at, dist]);
  // drawn (LOD level set) ...
  await page.waitForFunction((ids) => ids.every((id) => window.__kronland.renderer.chars.records.get(id)?.meshLvl >= 0), [serf.id, serf.other], { timeout: 60_000 });
  // ... then put it just below or behind the camera: head point at depth 0.1 tiles (in front of the near
  // clipping plane), offset sideways
  const placed = await page.evaluate((id) => {
    const k = window.__kronland, R = k.renderer, cam = R.camera, u = k.sim.entities.get(id);
    const f = cam.getWorldDirection(cam.position.clone());
    const h = Math.hypot(f.x, f.z), hx = f.x / h, hz = f.z / h;
    const side = 2; // sideways (across the viewing direction)
    let s = 0, x = 0, z = 0;
    for (let i = 0; i < 20; i++) {
      x = cam.position.x + hx * s - hz * side; z = cam.position.z + hz * s + hx * side;
      const y = R.terrain.heightAt(x, z) + 0.95;
      const d = (x - cam.position.x) * f.x + (y - cam.position.y) * f.y + (z - cam.position.z) * f.z;
      s += (0.1 - d) / (hx * f.x + hz * f.z);
    }
    u.px = Math.round(x * 1000); u.py = Math.round(z * 1000);
    return { x, z };
  }, serf.id);
  await page.waitForFunction(([id, p]) => {
    const r = window.__kronland.renderer.chars.records.get(id);
    return r && Math.hypot(r.position.x - p.x, r.position.z - p.z) < 0.3;
  }, [serf.id, placed], { timeout: 60_000 });
  // Hold the game: otherwise figures of the crowd walk onto the free spots between finding them and the click
  // (game time runs in real time even with slow frames)
  await page.evaluate(() => { const k = window.__kronland; k.paused = true; k.emitUi(); });
  await page.waitForTimeout(300);
  return { errors, serf: serf.id, other: serf.other };
}

/** Screen points on open ground: map (canvas) and no drawn figure within 90 px. */
async function emptySpots(page, n) {
  return page.evaluate((n) => {
    const k = window.__kronland, R = k.renderer, out = [];
    const figs = [];
    for (const r of R.chars.records.values()) {
      if (!(r.meshLvl >= 0)) continue;
      const p = R.project(r.position.x, r.position.y + 0.5, r.position.z);
      if (!p.behind) figs.push(p);
    }
    for (let y = innerHeight * 0.25; y < innerHeight * 0.8 && out.length < n; y += innerHeight * 0.11) {
      for (let x = innerWidth * 0.1; x < innerWidth * 0.9 && out.length < n; x += innerWidth * 0.13) {
        if (document.elementFromPoint(x, y)?.tagName !== 'CANVAS') continue;
        if (figs.some((p) => Math.hypot(p.x - x, p.y - y) < 90)) continue;
        const id = R.pickEntity(x, y);
        if (id && k.sim.entities.get(id)?.kind === 'building') continue;
        out.push({ x: Math.round(x), y: Math.round(y) });
      }
    }
    return out;
  }, n);
}

async function clickEmpty(page, info, { serf, other }, name) {
  const mobile = info.project.name === 'mobile';
  const spots = await emptySpots(page, 8);
  expect(spots.length).toBeGreaterThanOrEqual(4);
  for (const p of spots) {
    await page.evaluate(() => { const k = window.__kronland; k.selected.clear(); k.emitUi(); });
    if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(450); // no double click with the next one
    const sel = await page.evaluate(() => [...window.__kronland.selected]);
    expect(sel, `Click on empty ground at ${p.x},${p.y} (figure under the camera: ${serf})`).toEqual([]);
  }
  await page.screenshot({ path: `${SHOTS}/picking-${name}-${info.project.name}.png` });
  // A figure in the picture stays selectable where it is drawn
  const vis = await page.evaluate((id) => {
    const R = window.__kronland.renderer, r = R.chars.records.get(id);
    return R.project(r.position.x, r.position.y + 0.5, r.position.z);
  }, other);
  await page.evaluate(() => { const k = window.__kronland; k.selected.clear(); k.emitUi(); });
  if (mobile) await page.touchscreen.tap(vis.x, vis.y); else await page.mouse.click(vis.x, vis.y);
  await expect.poll(() => page.evaluate(() => [...window.__kronland.selected])).toEqual([other]);
  expect(await page.evaluate(() => [...window.__kronland.selected])).not.toContain(serf);
}

test('Bustle: click on empty grass selects no figure under the camera', async ({ page }, info) => {
  if (info.project.name !== 'mobile') await page.setViewportSize({ width: 1440, height: 900 });
  const { errors, ...ids } = await setup(page, '?mission=bustle', null, 12);
  await clickEmpty(page, info, ids, 'bustle');
  expect(errors).toEqual([]);
});

test('Normal map: click on empty ground selects no figure under the camera', async ({ page }, info) => {
  if (info.project.name !== 'mobile') await page.setViewportSize({ width: 1440, height: 900 });
  const { errors, ...ids } = await setup(page, '?seed=42&fog=off', null, 14);
  await clickEmpty(page, info, ids, 'map');
  expect(errors).toEqual([]);
});
