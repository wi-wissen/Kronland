import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Close zoom (issue #6): mouse wheel or two-finger gesture all the way in, flatter view, camera above the
// terrain, figures and buildings at full LOD level.
// Controls like a map app: zoom to the pointer, dragging grabs the ground, nothing glides on.

async function boot(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  // Look at the castle, serfs stand in front of it
  await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    e.renderer.rig.lookAt(hq.x + hq.w / 2 + 1, hq.y + hq.h + 1.5);
    e.renderer.rig.dist = 28;
  });
  await page.waitForTimeout(300);
  return errors;
}

/** Camera state after the next frame. */
const camState = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
  const r = window.__kronland.renderer, c = r.camera;
  const dir = c.getWorldDirection(c.position.clone());
  res({
    dist: r.rig.dist, pitch: Math.asin(-dir.y), near: c.near,
    clearance: c.position.y - r.terrain.heightAt(c.position.x, c.position.z),
    lod: r.lodStats().lod,
  });
})));

/** Ground point under a screen position (world coordinates). */
const groundUnder = (page, x, y) => page.evaluate(([x, y]) => {
  const r = window.__kronland.renderer, g = r.pickGround(x, y);
  return g && { x: g.x, y: r.terrain.heightAt(g.x, g.z), z: g.z };
}, [x, y]);

/** Pixel distance between a world point and a screen position. */
const offBy = (page, p, x, y) => page.evaluate(([p, x, y]) => {
  const s = window.__kronland.renderer.project(p.x, p.y, p.z);
  return Math.hypot(s.x - x, s.y - y);
}, [p, x, y]);

/** How far the camera still moves in the next frames (drift). */
const drift = (page) => page.evaluate(() => new Promise((res) => {
  const c = window.__kronland.renderer.camera, p0 = c.position.clone(), q0 = c.quaternion.clone();
  let n = 0;
  const f = () => {
    if (++n < 12) requestAnimationFrame(f);
    else res(c.position.distanceTo(p0) + Math.abs(1 - Math.abs(c.quaternion.dot(q0))));
  };
  requestAnimationFrame(f);
}));

/** One finger drags via real touch events (CDP). */
async function swipe(page, from, to, steps = 10) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps, y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Two-finger gesture via real touch events (CDP). */
async function pinch(page, cx, cy, from, to, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  const pts = (d) => [{ x: cx - d / 2, y: cy, id: 1 }, { x: cx + d / 2, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + ((to - from) * i) / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('Close zoom up to figures and buildings', async ({ page, isMobile }) => {
  test.setTimeout(150_000); // SwiftShader: every wheel event waits for a frame
  const errors = await boot(page);
  const far = await camState(page);
  const vp = page.viewportSize();
  const cx = vp.width / 2, cy = vp.height / 2;
  if (isMobile) {
    // pinch apart several times
    for (let i = 0; i < 6; i++) await pinch(page, cx, cy, 60, 300);
  } else {
    await page.mouse.move(cx, cy);
    for (let i = 0; i < 14; i++) await page.mouse.wheel(0, -300);
  }
  await page.waitForTimeout(400);
  const near = await camState(page);
  expect(near.dist).toBeLessThan(4);
  expect(near.dist).toBeLessThan(far.dist / 5);
  // View clearly flatter than at game height
  expect(near.pitch).toBeLessThan(far.pitch - 0.35);
  // not inside the terrain, near clipping plane below
  expect(near.clearance).toBeGreaterThan(near.near + 0.2);
  // full LOD level for the figures and buildings up close
  expect(near.lod.character?.[0] ?? 0).toBeGreaterThan(0);
  expect(near.lod.building?.[0] ?? 0).toBeGreaterThan(0);

  // zoom out again: usual view back
  if (isMobile) for (let i = 0; i < 6; i++) await pinch(page, cx, cy, 300, 60);
  else for (let i = 0; i < 14; i++) await page.mouse.wheel(0, 300);
  await page.waitForTimeout(400);
  const back = await camState(page);
  expect(back.dist).toBeGreaterThan(20);
  // (at game height the line of sight over mountains can additionally raise the camera, hence only "steep again")
  expect(back.pitch).toBeGreaterThan(near.pitch + 0.4);
  expect(errors).toEqual([]);
});

test('Close zoom on a slope: camera stays above the terrain', async ({ page }) => {
  const errors = await boot(page);
  // find the steepest spot of the map and get very close there from all directions
  const worst = await page.evaluate(async () => {
    const r = window.__kronland.renderer, t = r.terrain, map = window.__kronland.sim.map;
    let best = { s: -1, x: 0, z: 0 };
    for (let x = 4; x < map.width - 4; x += 2) for (let z = 4; z < map.height - 4; z += 2) {
      const s = Math.abs(t.heightAt(x + 1, z) - t.heightAt(x - 1, z)) + Math.abs(t.heightAt(x, z + 1) - t.heightAt(x, z - 1));
      if (s > best.s) best = { s, x, z };
    }
    let min = Infinity;
    for (let yaw = 0; yaw < 6.28; yaw += 0.4) {
      r.rig.lookAt(best.x, best.z); r.rig.yaw = yaw; r.rig.dist = 3; r.rig.pitch = 0.5;
      r.rig.update(0);
      const c = r.camera.position;
      for (const [ox, oz] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) min = Math.min(min, c.y - t.heightAt(c.x + ox, c.z + oz) - r.camera.near);
    }
    return { slope: best.s, min };
  });
  expect(worst.slope).toBeGreaterThan(0.3);
  expect(worst.min).toBeGreaterThan(0.1);
  expect(errors).toEqual([]);
});

test('Mouse wheel zooms to the pointer, middle button grabs the ground, nothing glides on', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse on desktop only');
  test.setTimeout(150_000);
  const errors = await boot(page);
  // Set the camera position immediately (under SwiftShader more than a second often passes until the next frame)
  await page.evaluate(() => { const rig = window.__kronland.renderer.rig; rig.dist = 40; rig.update(0); });
  // Zoom to the pointer: the ground under the pointer stays there
  const cur = { x: 1000, y: 460 };
  const p = await groundUnder(page, cur.x, cur.y);
  const d0 = await page.evaluate(() => window.__kronland.renderer.rig.dist);
  await page.mouse.move(cur.x, cur.y);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -100);
  expect(await page.evaluate(() => window.__kronland.renderer.rig.dist)).toBeLessThan(d0 * 0.8);
  expect(await offBy(page, p, cur.x, cur.y)).toBeLessThan(8);
  expect(await drift(page)).toBeLessThan(1e-6);

  // Middle button: grabbed ground follows the mouse
  const from = { x: 600, y: 520 }, to = { x: 820, y: 380 };
  const q = await groundUnder(page, from.x, from.y);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'middle' });
  for (let i = 1; i <= 10; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
  await page.mouse.up({ button: 'middle' });
  expect(await offBy(page, q, to.x, to.y)).toBeLessThan(12);
  expect(await drift(page)).toBeLessThan(1e-6);
  await page.screenshot({ path: 'test-results/camera-pointer-desktop.png' });
  expect(errors).toEqual([]);
});

test('Finger grabs the ground, pinch zooms around the finger centre without rotating or tilting', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch on mobile only');
  test.setTimeout(150_000);
  const errors = await boot(page);
  // Set the camera position immediately (under SwiftShader more than a second often passes until the next frame)
  await page.evaluate(() => { const rig = window.__kronland.renderer.rig; rig.dist = 40; rig.update(0); });
  // One finger: grabbed ground follows the finger, no tap triggered
  const from = { x: 150, y: 520 }, to = { x: 240, y: 400 };
  const q = await groundUnder(page, from.x, from.y);
  await swipe(page, from, to);
  expect(await offBy(page, q, to.x, to.y)).toBeLessThan(12);
  expect(await drift(page)).toBeLessThan(1e-6);

  // Two fingers spread around a centre away from the screen centre
  const mid = { x: 180, y: 470 };
  const p = await groundUnder(page, mid.x, mid.y);
  const before = await page.evaluate(() => { const r = window.__kronland.renderer.rig; return { yaw: r.yaw, pitch: r.pitch, dist: r.dist }; });
  await pinch(page, mid.x, mid.y, 100, 180);
  const after = await page.evaluate(() => { const r = window.__kronland.renderer.rig; return { yaw: r.yaw, pitch: r.pitch, dist: r.dist }; });
  expect(after.dist).toBeLessThan(before.dist * 0.7);
  expect(after.yaw).toBeCloseTo(before.yaw, 6);
  expect(after.pitch).toBeCloseTo(before.pitch, 6);
  expect(await offBy(page, p, mid.x, mid.y)).toBeLessThan(12);
  expect(await drift(page)).toBeLessThan(1e-6);
  await page.screenshot({ path: 'test-results/camera-pointer-phone.png' });
  expect(errors).toEqual([]);
});

test('Very close to the castle: camera stays outside, from every direction', async ({ page }, info) => {
  const errors = await boot(page);
  await page.waitForFunction(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    return !!e.renderer.buildings.get(hq.id)?.userData.height;
  });
  const res = await page.evaluate(() => {
    const e = window.__kronland, r = e.renderer, rig = r.rig, hq = e.sim.findBuilding(0, 'headquarters');
    const g = r.buildings.get(hq.id), top = g.position.y + g.userData.height;
    const out = [];
    for (const yaw of [0, 0.785, 1.6, 2.4, 3.9, 5.5]) {
      rig.yaw = yaw; rig.dist = 3; rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h / 2); rig.update(0);
      const c = r.camera.position;
      const inFoot = c.x > hq.x && c.x < hq.x + hq.w && c.z > hq.y && c.z < hq.y + hq.h;
      out.push({ yaw, ok: !inFoot || c.y > top + 0.2 });
    }
    rig.yaw = 0.785; rig.update(0);
    return out;
  });
  expect(res.filter((r) => !r.ok)).toEqual([]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/castle-near-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

test('Nature LOD levels: trees at game height not only far form, far away no invisible decoration', async ({ page }, info) => {
  const errors = await boot(page);
  await page.waitForFunction(() => !!window.__kronland.renderer.treeGroups);
  const at = async (d) => {
    await page.evaluate((d) => { window.__kronland.renderer.rig.dist = d; }, d);
    await page.waitForTimeout(600);
    return page.evaluate(() => new Promise((res) => requestAnimationFrame(() => {
      const r = window.__kronland.renderer, cam = r.camera, fade = r.natureUniforms.uFade.value.y;
      // small decoration in chunks that lie entirely beyond the end of shrinking (invisible there)
      let hidden = 0;
      for (const ci of r.chunked) if (ci.kind === 'scatterSmall') for (const c of ci.chunks) {
        if (c.lod.level >= 0 && r.frustum.intersectsSphere(c.sphere) && c.sphere.center.distanceTo(cam.position) - c.sphere.radius > fade) hidden += c.n;
      }
      res({ tree: r.lodStats().lod.tree ?? [], hidden });
    })));
  };
  // E2E runs on "low" (software WebGL): trees there have [simple, far]. At game height the near
  // trees are simple instead of all far form (formerly on mobile in portrait almost always far form)
  const play = await at(28);
  expect(play.tree[0] ?? 0).toBeGreaterThan(0);
  await page.screenshot({ path: `test-results/nature-gameheight-${info.project.name}.png` });
  // at every zoom level: no decoration chunks that lie entirely beyond the end of shrinking
  for (const d of [22, 40, 55, 75]) expect((await at(d)).hidden, `Zoom ${d}`).toBe(0);
  expect(errors).toEqual([]);
});

test('Script camera turns so that no tree hides the figure it looks at', async ({ page }, info) => {
  test.setTimeout(120_000);
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500');
  // A serf at the edge of a forest, game halted; rotation chosen so that a tree stands between camera and serf
  const setup = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, W = s.map.width;
    const trees = [...s.entities.values()].filter((t) => t.kind === 'tree');
    const occ = new Set(trees.map((t) => t.y * W + t.x));
    const serf = [...s.entities.values()].find((u) => u.kind === 'unit' && u.owner === 0);
    const rig = e.renderer.rig;
    rig.dist = 14; rig.pitch = 0.75;
    for (const t of trees) {
      let n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (occ.has((t.y + dy) * W + t.x + dx)) n++;
      if (n < 9) continue;
      for (const [dx, dy] of [[0, 2], [2, 0], [0, -2], [-2, 0]]) {
        const x = t.x + dx, y = t.y + dy;
        if (occ.has(y * W + x)) continue;
        serf.px = (x * 1000) + 500; serf.py = (y * 1000) + 500; serf.path = [];
        for (let k = 0; k < 24; k++) {
          rig.yaw = (k / 24) * 2 * Math.PI;
          if (e.viewTurn(x + 0.5, y + 0.5, rig.dist)) return { x: x + 0.5, z: y + 0.5, yaw: rig.yaw };
        }
      }
    }
    return null;
  });
  expect(setup).not.toBeNull();
  // Before: camera simply placed over the serf with the old rotation – a crown in front of it
  await page.evaluate((p) => { const rig = window.__kronland.renderer.rig; rig.yaw = p.yaw; rig.lookAt(p.x, p.z); }, setup);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/script-camera-before-${info.project.name}.png` });
  // Script jump: the camera turns until the view is clear
  const after = await page.evaluate((p) => {
    const e = window.__kronland, rig = e.renderer.rig;
    rig.yaw = p.yaw; rig.lookAt(p.x - 20, p.z - 20);
    e.scriptCamera(p.x, p.z, 0);
    return { yaw: rig.yaw, still: e.viewTurn(p.x, p.z, rig.dist) };
  }, setup);
  expect(after.yaw).not.toBeCloseTo(setup.yaw, 3);
  expect(after.still).toBeNull();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/script-camera-after-${info.project.name}.png` });
});
