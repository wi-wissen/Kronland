import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Far level of the buildings (scripts/build-lods.mjs, "bake"): at the widest zoom the castle shows its lod2 with corner colours
// (self-contained, without UV and texture) - formerly the texture smeared across the island borders of the atlas.

const SHOTS = process.env.LOD_SHOTS ?? 'test-results';

test('Castle at the far level: corner colours instead of smeared texture', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('kronland-lang', 'de'));
  await page.goto(playUrl('?seed=42'));
  await page.waitForFunction(() => !!window.__kronland);
  await expect(page.getByTestId('res-gold')).toHaveText('500', { timeout: 60_000 });
  // Castle including LOD levels loaded (original, lod1, lod2)
  await page.waitForFunction(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    return e.renderer.buildings.get(hq.id)?.userData.lods?.length === 3;
  }, null, { timeout: 90_000 });
  // zoom all the way out, castle in the middle of the picture
  await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    e.renderer.rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h / 2);
    e.renderer.rig.dist = 200; // is limited to the greatest distance
    e.renderer.rig.clamp();
  });
  await page.waitForFunction(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    return e.renderer.buildings.get(hq.id)?.userData.lodLevel === 2;
  }, null, { timeout: 30_000 });
  const far = await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    const lod = e.renderer.buildings.get(hq.id).userData.lods[2], out = [];
    lod.traverse((m) => {
      if (m.isMesh) out.push({ color: !!m.geometry.attributes.color, uv: !!m.geometry.attributes.uv, map: !!m.material.map, vc: !!m.material.vertexColors, visible: lod.visible });
    });
    return out;
  });
  expect(far.length).toBeGreaterThan(0);
  for (const m of far) expect(m).toEqual({ color: true, uv: false, map: false, vc: true, visible: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/lod-castle-far-${info.project.name}.png` });

  // Near view: original with full texture (1024 colour texture with mipmaps), no LOD level
  await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    e.renderer.rig.lookAt(hq.x + hq.w / 2, hq.y + hq.h + 1);
    e.renderer.rig.dist = 12;
    e.renderer.rig.clamp();
  });
  await page.waitForFunction(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    return e.renderer.buildings.get(hq.id)?.userData.lodLevel === 0;
  }, null, { timeout: 30_000 });
  const near = await page.evaluate(() => {
    const e = window.__kronland, hq = e.sim.findBuilding(0, 'headquarters');
    let map = null;
    e.renderer.buildings.get(hq.id).userData.lods[0].traverse((m) => { if (m.isMesh && m.material.map) map = m.material.map; });
    return map && { w: map.image.width, mips: map.generateMipmaps, min: map.minFilter, mag: map.magFilter, pixelRatio: e.renderer.renderer.getPixelRatio(), tier: e.renderer.quality.tier };
  });
  expect(near.w).toBe(1024);
  expect(near.mips).toBe(true);
  expect(near.mag).toBe(1006); // THREE.LinearFilter
  expect(near.min).toBe(1008); // THREE.LinearMipmapLinearFilter
  console.log('Near view', info.project.name, JSON.stringify(near));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/lod-castle-near-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
