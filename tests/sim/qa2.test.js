// Regression tests for the second QA round (docs/QA-BERICHT.md, findings A–E and 19–24):
// building attackers fight back against troops, buildings of eliminated players decay, AI only plans
// reachable targets.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { WATER, CLIFF } from '../../src/sim/map.js';
import { DAMAGE } from '../../src/sim/systems/damage.js';
import { pathStats } from '../../src/sim/pathfinding.js';
import { toTile } from '../../src/sim/fixed.js';
import { hqOf } from './helpers.js';

/** Clear a free area in the map centre (trees, piles, water, cliffs). */
function openField(sim, w = 16, h = 12) {
  const m = sim.map, x0 = (m.width >> 1) - (w >> 1), y0 = (m.height >> 1) - (h >> 1);
  for (const e of [...sim.entities.values()]) {
    if ((e.kind === 'tree' || e.kind === 'pile') && e.x >= x0 - 1 && e.x <= x0 + w && e.y >= y0 - 1 && e.y <= y0 + h) sim.removeEntity(e);
  }
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) m.flags[m.idx(x0 + i, y0 + j)] = 0;
  m.version++;
  return { x: x0, y: y0 };
}

const kindOf = (sim, id) => sim.entities.get(id)?.kind ?? null;

describe('Combat: building attackers turn to attacking troops', () => {
  for (const order of ['attack', 'attackMove']) {
    it(`Command ${order}: first the troop, then back to the building`, () => {
      const sim = new Sim({ seed: 42 });
      const f = openField(sim);
      const target = sim.createBuilding(1, 'residence', f.x + 10, f.y + 4, true);
      target.hp = 1e6; // holds out long enough to see the switching
      const A = sim.spawnLeader(0, 'sword1', f.x + 3, f.y + 5);
      const cmd = order === 'attack'
        ? { type: 'order', player: 0, units: [A.id], order: 'attack', target: target.id }
        : { type: 'order', player: 0, units: [A.id], order: 'attackMove', x: f.x + 11, y: f.y + 5 };
      sim.step([cmd]);
      // troop reaches the building and strikes it
      for (let t = 0; t < 200 && A.targetId !== target.id; t++) sim.step();
      sim.run(30);
      expect(A.targetId).toBe(target.id);
      // enemy archers attack from close range
      const B = sim.spawnLeader(1, 'bow1', f.x + 7, f.y + 9);
      B.order = { type: 'hold' };
      let leaderSwitched = false, soldiersSwitched = 0;
      for (let t = 0; t < 400 && sim.entities.has(B.id); t++) {
        sim.step();
        if (kindOf(sim, A.targetId) === 'leader' || kindOf(sim, A.targetId) === 'soldier') leaderSwitched = true;
        for (const id of A.soldiers) {
          const s = sim.entities.get(id);
          if (s && ['leader', 'soldier'].includes(kindOf(sim, s.targetId))) soldiersSwitched++;
        }
      }
      expect(leaderSwitched).toBe(true);
      expect(soldiersSwitched).toBeGreaterThan(0);
      expect(sim.entities.has(B.id)).toBe(false); // attacker defeated
      // … and on at the building
      sim.run(150);
      expect(A.targetId).toBe(target.id);
      expect(A.order.type).toBe(order);
    });
  }

  it('serfs and workers do not distract building attackers', () => {
    const sim = new Sim({ seed: 42 });
    const f = openField(sim);
    const target = sim.createBuilding(1, 'residence', f.x + 10, f.y + 4, true);
    target.hp = 1e6;
    const A = sim.spawnLeader(0, 'sword1', f.x + 7, f.y + 5, 0);
    sim.step([{ type: 'order', player: 0, units: [A.id], order: 'attack', target: target.id }]);
    sim.run(60);
    expect(A.targetId).toBe(target.id);
    const serf = sim.spawnSerf(1);
    serf.px = (f.x + 6) * 1000 + 500; serf.py = (f.y + 8) * 1000 + 500;
    sim.run(40);
    expect(A.targetId).toBe(target.id);
  });

  it('Hold: only enemies in range, no pursuit', () => {
    const sim = new Sim({ seed: 42 });
    const f = openField(sim);
    const A = sim.spawnLeader(0, 'sword1', f.x + 3, f.y + 5);
    sim.step([{ type: 'order', player: 0, units: [A.id], order: 'hold' }]);
    const x0 = A.px;
    const B = sim.spawnLeader(1, 'bow1', f.x + 8, f.y + 5);
    B.order = { type: 'hold' };
    sim.run(200);
    // archers shoot from afar, the swordsman stays put
    expect(Math.abs(A.px - x0)).toBeLessThan(1500);
    expect(A.targetId === 0 || kindOf(sim, A.targetId) !== 'leader').toBe(true);
  });

  it('Defend: attacks troops in sight, then returns to the anchor point', () => {
    const sim = new Sim({ seed: 42 });
    const f = openField(sim);
    const A = sim.spawnLeader(0, 'sword1', f.x + 3, f.y + 5);
    const anchor = { ...A.anchor };
    const B = sim.spawnLeader(1, 'sword1', f.x + 9, f.y + 5, 0);
    B.order = { type: 'hold' };
    sim.run(400);
    expect(sim.entities.has(B.id)).toBe(false);
    sim.run(200);
    expect(Math.abs(A.px - anchor.x) + Math.abs(A.py - anchor.y)).toBeLessThan(2500);
  });
});

describe('Eliminated players', () => {
  it('buildings decay into ruins in ~60 s, research and trade end', () => {
    const sim = new Sim({ seed: 3, players: 3 });
    const hq1 = hqOf(sim, 1);
    const extra = sim.createBuilding(1, 'tower', hq1.x + 8, hq1.y, true);
    expect(extra).toBeTruthy();
    const own = () => [...sim.entities.values()].filter((e) => e.kind === 'building' && e.owner === 1);
    expect(own().length).toBeGreaterThanOrEqual(2);
    const events = [];
    sim.destroyBuilding(hq1, null);
    expect(sim.players[1].defeated).toBe(true);
    const hp0 = own().map((b) => b.hp);
    sim.step();
    own().forEach((b, i) => expect(b.hp).toBeLessThan(hp0[i]));
    expect(own().every((b) => !b.research && !b.trade)).toBe(true);
    for (let t = 0; t < DAMAGE.decayTicks + 5; t++) events.push(...sim.step());
    expect(own()).toHaveLength(0);
    const ruins = [...sim.entities.values()].filter((e) => e.kind === 'ruin' && e.formerOwner === 1);
    expect(ruins.length).toBeGreaterThanOrEqual(2);
    expect(events.filter((e) => e.type === 'buildingDestroyed' && e.owner === 1).length).toBeGreaterThanOrEqual(1);
    // buildings of the other players stay untouched
    expect(hqOf(sim, 0).hp).toBeGreaterThan(0);
    expect(sim.winner).toBeNull();
  });

  it('AI of an eliminated player gives no more commands', () => {
    const sim = new Sim({ seed: 3, players: 3 });
    const ai = new AiPlayer(sim, 1, 'hard');
    sim.destroyBuilding(hqOf(sim, 1), null);
    let n = 0;
    const orig = sim.command.bind(sim);
    sim.command = (c) => { if (c.player === 1) n++; orig(c); };
    for (let t = 0; t < 300; t++) { ai.update(); sim.step(); }
    expect(n).toBe(0);
  });
});

describe('AI: only reachable targets', () => {
  /** Ring of water around a rectangle near the castle (island with trees). */
  function makeIsland(sim, owner = 0) {
    const hq = hqOf(sim, owner), m = sim.map;
    // look for a patch of forest near the castle
    let best = null, bn = 0;
    for (let y = hq.y - 18; y <= hq.y + 14; y++) for (let x = hq.x - 18; x <= hq.x + 14; x++) {
      if (Math.abs(x - hq.x) < 9 && Math.abs(y - hq.y) < 9) continue;
      let n = 0, ok = true;
      for (let j = -1; j <= 6 && ok; j++) for (let i = -1; i <= 6; i++) {
        const k = m.idx(x + i, y + j);
        if (!m.inBounds(x + i, y + j) || (m.owner[k] && sim.entities.get(m.owner[k])?.kind === 'building')) { ok = false; break; }
        if (sim.entities.get(m.owner[k])?.kind === 'tree') n++;
      }
      if (ok && n > bn) { bn = n; best = { x, y }; }
    }
    const { x, y } = best;
    for (let j = -1; j <= 6; j++) for (let i = -1; i <= 6; i++) {
      if (i === -1 || j === -1 || i === 6 || j === 6) {
        const k = m.idx(x + i, y + j), e = sim.entities.get(m.owner[k]);
        if (e) sim.removeEntity(e);
        m.flags[k] = (m.flags[k] & ~CLIFF) | WATER;
      }
    }
    m.version++;
    const inside = (e) => e.x >= x && e.x < x + 6 && e.y >= y && e.y < y + 6;
    return { x, y, inside, trees: [...sim.entities.values()].filter((e) => e.kind === 'tree' && inside(e)) };
  }

  it('sends no serfs to trees on an island and does not build there', () => {
    const sim = new Sim({ seed: 42 });
    const isl = makeIsland(sim);
    expect(isl.trees.length).toBeGreaterThan(3);
    const ai = new AiPlayer(sim, 0, 'hard');
    const bad = [];
    const orig = sim.command.bind(sim);
    sim.command = (c) => {
      const t = sim.entities.get(c.target);
      if (c.type === 'assignWork' && t && isl.inside(t)) bad.push(c);
      if (c.type === 'placeBuilding' && c.x + 4 > isl.x && c.x < isl.x + 6 && c.y + 4 > isl.y && c.y < isl.y + 6) bad.push(c);
      orig(c);
    };
    pathStats.unreachable = 0;
    for (let t = 0; t < 3000; t++) { ai.update(); sim.step(); }
    expect(bad).toEqual([]);
    expect(pathStats.unreachable).toBeLessThan(5);
  });

  it('demolishes a construction site that became unreachable and plans anew', () => {
    const sim = new Sim({ seed: 42 });
    const ai = new AiPlayer(sim, 0, 'hard');
    let site = null;
    for (let t = 0; t < 2000 && !site; t++) {
      ai.update();
      for (const e of sim.step()) if (e.type === 'buildingPlaced' && e.player === 0) site = sim.entities.get(e.building);
    }
    expect(site).toBeTruthy();
    // moat around the construction site (distance 2 tiles)
    const m = sim.map;
    for (let j = site.y - 3; j <= site.y + site.h + 2; j++) for (let i = site.x - 3; i <= site.x + site.w + 2; i++) {
      if (i > site.x - 3 && i < site.x + site.w + 2 && j > site.y - 3 && j < site.y + site.h + 2) continue;
      const k = m.idx(i, j), e = sim.entities.get(m.owner[k]);
      if (e && e.kind !== 'building') sim.removeEntity(e);
      if (!m.owner[k]) m.flags[k] |= WATER;
    }
    m.version++;
    let demolished = false;
    for (let t = 0; t < 200 && !demolished; t++) {
      ai.update();
      demolished = sim.step().some((e) => e.type === 'demolished' && e.building === site.id);
    }
    expect(demolished).toBe(true);
  });

  it('4 AIs, size 160: (almost) no failed pathfinding attempts', () => {
    const sim = new Sim({ seed: 1, players: 4, size: 160 });
    const ais = [0, 1, 2, 3].map((p) => new AiPlayer(sim, p, 'hard'));
    pathStats.unreachable = 0; pathStats.exhausted = 0;
    for (let t = 0; t < 600 * 15; t++) {
      for (const a of ais) if (!sim.players[a.player].defeated) a.update();
      sim.step();
    }
    // before: several hundred per 150 s (construction sites in rock niches, built-over shafts)
    expect(pathStats.unreachable + pathStats.exhausted).toBeLessThan(40);
    // AI figures never stand on water/buildings
    for (const e of sim.entities.values()) {
      if (e.px === undefined || !['unit', 'worker', 'leader', 'soldier', 'hero'].includes(e.kind) || sim.map.frozen) continue;
      expect(sim.map.walkable(toTile(e.px), toTile(e.py))).toBe(true);
    }
  }, 120_000);
});
