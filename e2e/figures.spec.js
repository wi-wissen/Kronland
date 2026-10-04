import { test, expect } from '@playwright/test';
import { playUrl } from './paths.js';

// Figures from the asset pipeline: serf male/female as variants, mask texture, tools per clip.
// ?quality=high forces the GLB figures even on the software renderer of the tests.

test('Serfs appear as male and female variant with tools', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&quality=high&fog=off'));
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
    e.renderer.rig.lookAt(tree.x, tree.y);
  });
  await page.waitForFunction(() => {
    const c = window.__kronland.renderer.chars;
    return c.variants.get('serf#0')?.model && c.variants.get('serf#1')?.model;
  }, null, { timeout: 60_000 });
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
