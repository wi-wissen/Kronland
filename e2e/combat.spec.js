import { test, expect } from './fixtures.js';
import { playUrl } from './paths.js';

// Melee: attackers surround their target (own spots in the ring), and figures at the same point are drawn with a
// small rendering offset - nobody visibly stands on top of another.

test.describe.configure({ timeout: 180_000 }); // software graphics

test('Melee: attackers stand around their target, not on top of each other', async ({ page }, info) => {
  if (info.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(playUrl('?seed=42&fog=off'));
  await page.waitForFunction(() => !!window.__kronland?.renderer?.chars, null, { timeout: 120_000 });
  await expect(page.getByTestId('res-gold')).toHaveText('500');

  // Two sword squads against a cavalry squad on open ground next to the castle, game paused,
  // ticks by hand until the swords stand close around the cavalry
  const fight = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, m = s.map;
    e.paused = true;
    const hq = s.findBuilding(0, 'headquarters');
    let f = null;
    for (let r = 4; r < 30 && !f; r++) for (let dx = -r; dx <= r && !f; dx++) {
      const x = hq.x + dx, y = hq.y + hq.h + r;
      let ok = true;
      for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 8 && ok; i++) if (!m.walkable(x + i, y + j)) ok = false;
      if (ok) f = { x, y };
    }
    s.spawnLeader(0, 'sword4', f.x, f.y); s.spawnLeader(0, 'sword4', f.x, f.y + 2);
    const C = s.spawnLeader(1, 'sword4', f.x + 5, f.y + 1);
    for (const id of C.soldiers) s.entities.get(id).hp *= 4; // enemies hold out longer (for the picture)
    C.hp *= 4;
    let n = 0;
    for (let t = 0; t < 120; t++) {
      e.stepOnce();
      n = 0;
      for (const u of s.entities.values()) {
        const tg = u.owner === 0 && u.targetId ? s.entities.get(u.targetId) : null;
        if (tg && Math.hypot(tg.px - u.px, tg.py - u.py) <= 1300) n++;
      }
      if (t > 50 && n >= 10) break;
    }
    // Camera on the middle of the melee, steeply from above
    let sx = 0, sz = 0, k = 0;
    for (const u of s.entities.values()) if (u.kind === 'soldier' || u.kind === 'leader') { sx += u.px / 1000; sz += u.py / 1000; k++; }
    const rig = e.renderer.rig;
    rig.lookAt(sx / k, sz / k); rig.dist = 10; rig.pitch = 1.3; rig.update(0);
    return { inRange: n };
  });
  expect(fight.inRange).toBeGreaterThanOrEqual(6);
  await page.waitForTimeout(1500); // frames under software graphics
  await page.screenshot({ path: `test-results/combat-${info.project.name}.png` });

  const r = await page.evaluate(() => {
    const e = window.__kronland, s = e.sim, recs = e.renderer.chars.records;
    const figs = [...s.entities.values()].filter((u) => u.kind === 'soldier' || u.kind === 'leader');
    // Simulation: attackers at the same target do not stand on top of each other
    const byT = new Map();
    for (const u of figs) {
      const tg = u.owner === 0 && u.targetId ? s.entities.get(u.targetId) : null;
      if (!tg || Math.hypot(tg.px - u.px, tg.py - u.py) > 1300) continue;
      if (!byT.has(tg.id)) byT.set(tg.id, []);
      byT.get(tg.id).push(u);
    }
    let pairs = 0, stacked = 0;
    for (const list of byT.values()) for (let i = 0; i < list.length; i++) for (let k = i + 1; k < list.length; k++) {
      pairs++;
      if (Math.hypot(list[i].px - list[k].px, list[i].py - list[k].py) < 200) stacked++;
    }
    // Rendering: drawn position = simulation + small offset; no two figures on the same spot
    let maxOff = 0, minGap = Infinity;
    const pts = [];
    for (const u of figs) {
      const rec = recs.get(u.id);
      if (!rec) continue;
      maxOff = Math.max(maxOff, Math.hypot(rec.position.x - u.px / 1000, rec.position.z - u.py / 1000));
      pts.push(rec.position);
    }
    for (let i = 0; i < pts.length; i++) for (let k = i + 1; k < pts.length; k++) minGap = Math.min(minGap, Math.hypot(pts[i].x - pts[k].x, pts[i].z - pts[k].z));
    // Selection follows the drawn position: tapping the figure selects its squad
    const L = figs.find((u) => u.kind === 'leader' && u.owner === 0);
    const rec = recs.get(L.id);
    const p = e.renderer.project(rec.position.x, rec.position.y + 0.5, rec.position.z);
    const picked = e.renderer.pickEntity(p.x, p.y);
    return { pairs, stacked, maxOff, minGap, picked, leader: L.id, figures: pts.length };
  });
  expect(r.pairs).toBeGreaterThan(3);
  expect(r.stacked / r.pairs).toBeLessThan(0.2);
  expect(r.maxOff).toBeLessThan(0.2);
  expect(r.minGap).toBeGreaterThan(0.03);
  expect(r.picked).toBe(r.leader);
  expect(errors).toEqual([]);
});
