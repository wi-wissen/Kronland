import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Figures from the asset pipeline: serf male/female as variants, mask texture, tools per clip.
// ?quality=medium forces the GLB figures even on the software renderer of the tests (only "low" falls back to the
// procedural figures there). The near model (large file)
// only comes in when zooming in; until then the figure shows the game model (animations live there).

test('Serfs appear as male and female variant with tools', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = [], near = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Near models of the serfs: Serf.<hash>.glb (not .lod1)
  page.on('request', (r) => { const m = /characters\/(SerfF?)(\.[0-9a-f]{10})?\.glb$/.exec(r.url()); if (m) near.push(m[1]); });
  await page.goto(playUrl('?seed=42&quality=medium&fog=off'));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.chars, null, { timeout: 120_000 });
  // Send serfs to the nearest tree, fast-forward the simulation (software WebGL is too slow for real time)
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const serfs = [...s.entities.values()].filter((x) => x.kind === 'unit' && x.owner === 0 && !x.militia);
    const hq = s.findBuilding(0, 'headquarters');
    const tree = [...s.entities.values()].filter((x) => x.kind === 'tree')
      .sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y))[0];
    e.issue({ type: 'assignWork', units: serfs.map((u) => u.id), target: tree.id });
    for (let i = 0; i < 160; i++) e.stepOnce();
    // far away: figures small, only the game model is needed
    const r = e.renderer.rig;
    r.dist = 60; r.lookAt(tree.x, tree.y); r.clamp?.(); r.update(0);
  });
  await page.waitForFunction(() => {
    const c = window.__kronland.renderer.chars;
    return c.variants.get('serf#0')?.model && c.variants.get('serf#1')?.model;
  }, null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const far = await page.evaluate(() => window.__kronland.renderer.chars.variants.get('serf#0').levels.length);
  expect(far, 'from afar only the game model').toBe(1);
  expect(near, 'near model not yet loaded').toEqual([]);
  // zoom in: near model is loaded later, the figure gets both levels
  await page.evaluate(() => {
    const e = window.__kronland, s = e.sim;
    const serf = [...s.entities.values()].find((x) => x.kind === 'unit' && x.owner === 0 && !x.militia);
    const r = e.renderer.rig;
    r.dist = 6; r.lookAt(serf.px / 1000, serf.py / 1000); r.clamp?.(); r.update(0);
  });
  await page.waitForFunction(() => {
    const c = window.__kronland.renderer.chars;
    return c.variants.get('serf#0')?.levels.length >= 2 || c.variants.get('serf#1')?.levels.length >= 2;
  }, null, { timeout: 120_000, polling: 500 }).catch(async (err) => {
    console.log('Near model missing:', JSON.stringify(await page.evaluate(() => {
      const c = window.__kronland.renderer.chars;
      return { stats: c.stats, dist: window.__kronland.renderer.rig.dist, v: [...c.variants.entries()].map(([k, v]) => [k, v?.levels.length, v?.nearPending]) };
    })), near);
    throw err;
  });
  expect(near.length).toBeGreaterThan(0);
  // the serfs work at the same tree: both variants are in the picture and get their near model
  await page.waitForFunction(() => {
    const c = window.__kronland.renderer.chars;
    return c.variants.get('serf#0')?.levels.length >= 2 && c.variants.get('serf#1')?.levels.length >= 2;
  }, null, { timeout: 120_000, polling: 500 });
  const info = await page.evaluate(() => {
    const c = window.__kronland.renderer.chars;
    const bake = c.modelBakes.get('Serf');
    const clips = [...c.records.values()].filter((r) => r.roleKey.startsWith('serf#')).map((r) => r.clip);
    // Tool vertices in every LOD level (near and game model)
    const v = c.variants.get('serf#0');
    const propVerts = ['Axe', 'Hammer', 'Pickaxe'].map((p) => {
      const bi = bake.boneIndex.get('@prop:' + p);
      return v.levels.map((g) => { let n = 0; const b = g.attributes.aBoneIdx; for (let i = 0; i < b.count; i++) if (b.getX(i) === bi) n++; return n; });
    });
    return {
      models: [c.variants.get('serf#0').model, c.variants.get('serf#1').model],
      props: ['Axe', 'Hammer', 'Pickaxe'].map((p) => bake.boneIndex.has('@prop:' + p)),
      propVerts,
      levels: v.levels.length,
      // Team area: mask texture or magenta directly in the texture (teamMarker)
      mask: !!c.variants.get('serf#0').material.userData.charUniforms.uMaskMap.value || !!c.variants.get('serf#0').material.userData.teamMarker,
      clips,
    };
  });
  expect(info.models).toEqual(['Serf', 'SerfF']);
  expect(info.props).toEqual([true, true, true]);
  expect(info.levels).toBeGreaterThanOrEqual(2);
  for (const counts of info.propVerts) for (const n of counts) expect(n).toBeGreaterThan(0);
  expect(info.mask).toBe(true);
  expect(info.clips).toContain('chop');
  expect(errors).toEqual([]);
});
