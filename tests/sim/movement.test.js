// Movement: never over water/building corners, never onto blocked tiles, freeing stuck units,
// soldiers far from the captain (docs/QA-BERICHT.md, findings 19–21).

import { describe, it, expect } from 'vitest';
import { TileMap, WATER, OCCUPIED } from '../../src/sim/map.js';
import { canStep, moveAlong, nearestWalkable } from '../../src/sim/systems/movement.js';
import { targetable } from '../../src/sim/systems/military.js';
import { tileCenter, toTile } from '../../src/sim/fixed.js';
import { newSim, serfsOf } from './helpers.js';

/** Free area (w×h tiles) in the map centre: trees, piles, water and cliffs are cleared. */
function openField(sim, w = 14, h = 10) {
  const m = sim.map, x0 = (m.width >> 1) - (w >> 1), y0 = (m.height >> 1) - (h >> 1);
  for (const e of [...sim.entities.values()]) {
    if ((e.kind === 'tree' || e.kind === 'pile') && e.x >= x0 - 1 && e.x <= x0 + w && e.y >= y0 - 1 && e.y <= y0 + h) sim.removeEntity(e);
  }
  for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
    const k = m.idx(x0 + i, y0 + j);
    if (m.owner[k]) throw new Error('Building in the test field');
    m.flags[k] = 0;
  }
  m.version++;
  return { x: x0, y: y0 };
}

const setWater = (sim, x, y) => { sim.map.flags[sim.map.idx(x, y)] |= WATER; };
const MOBILE = new Set(['unit', 'worker', 'leader', 'soldier', 'hero']);

/** All figures on walkable tiles? Returns the first exception or null. */
function offGround(sim) {
  for (const e of sim.entities.values()) {
    if (!MOBILE.has(e.kind)) continue;
    if (!sim.map.walkable(toTile(e.px), toTile(e.py))) return e;
  }
  return null;
}

describe('canStep / moveAlong: no corner cutting', () => {
  const map = new TileMap(10, 10);
  // water corner: (5,4) and (4,5) wet – diagonally from (4,4) to (5,5) would go over water
  map.flags[map.idx(5, 4)] |= WATER;
  map.flags[map.idx(4, 5)] |= WATER;

  it('forbids the diagonal step over a water corner, allows straight steps', () => {
    expect(canStep(map, tileCenter(4), tileCenter(4), tileCenter(5) + 10, tileCenter(5) + 10)).toBe(false);
    expect(canStep(map, 4990, 4990, 5010, 5010)).toBe(false);
    expect(canStep(map, tileCenter(4), tileCenter(4), tileCenter(3), tileCenter(4))).toBe(true);
    expect(canStep(map, tileCenter(4), tileCenter(4), tileCenter(5), tileCenter(4))).toBe(false); // water
    expect(canStep(map, tileCenter(4) + 100, tileCenter(4), tileCenter(4) - 300, tileCenter(4) + 200)).toBe(true); // within the tile
  });

  it('moveAlong discards a path with corner cutting instead of walking through water', () => {
    const e = { px: tileCenter(4), py: tileCenter(4), path: [map.idx(5, 5), map.idx(6, 6)] };
    const sim = { map };
    for (let i = 0; i < 20; i++) moveAlong(sim, e, 200);
    expect(e.path).toEqual([]);
    expect([toTile(e.px), toTile(e.py)]).toEqual([4, 4]);
  });

  it('moveAlong discards a path whose next point is not a neighbouring tile (stale)', () => {
    const e = { px: tileCenter(1), py: tileCenter(1), path: [map.idx(7, 7)] };
    moveAlong({ map }, e, 200);
    expect(e.path).toEqual([]);
    expect([e.px, e.py]).toEqual([tileCenter(1), tileCenter(1)]);
  });

  it('nearestWalkable finds the nearest free tile (also in the same region)', () => {
    const m = new TileMap(12, 12);
    for (let y = 0; y < 12; y++) m.flags[m.idx(6, y)] |= WATER; // river separates left/right
    m.flags[m.idx(5, 5)] |= OCCUPIED;
    expect(nearestWalkable(m, 5, 5, tileCenter(5), tileCenter(5))).toBe(m.idx(5, 4)); // tie: smallest index
    expect(nearestWalkable(m, 5, 5, tileCenter(5) - 400, tileCenter(5) + 300)).toBe(m.idx(4, 5));
    const right = m.regionAt(m.idx(8, 5));
    expect(nearestWalkable(m, 5, 5, tileCenter(5), tileCenter(5), 12, right)).toBe(m.idx(7, 5));
  });
});

describe('Squads at water corners (simulation)', () => {
  it('captain and soldiers walk around a lake chain with diagonal gaps without entering water', () => {
    const sim = newSim(42);
    const f = openField(sim, 16, 12);
    // diagonal water chain across the field: connected only via corners (A* avoids them, the
    // formation moves directly to the captain and would cut the corners)
    for (let i = 0; i < 8; i++) setWater(sim, f.x + 4 + i, f.y + 1 + i);
    for (let i = 0; i < 7; i++) setWater(sim, f.x + 5 + i, f.y + 1 + i);
    sim.map.version++;
    const L = sim.spawnLeader(0, 'sword1', f.x + 2, f.y + 8);
    let bad = null;
    const orders = [[f.x + 13, f.y + 2], [f.x + 2, f.y + 9], [f.x + 14, f.y + 3]];
    for (const [x, y] of orders) {
      sim.step([{ type: 'order', player: 0, units: [L.id], order: 'move', x, y }]);
      for (let t = 0; t < 300 && !bad; t++) { sim.step(); bad = offGround(sim); }
    }
    expect(bad).toBeNull();
    // squad has arrived at the last goal and is together
    expect(L.order.type).toBe('idle');
    expect(toTile(L.px)).toBeGreaterThan(f.x + 8);
    for (const id of L.soldiers) {
      const s = sim.entities.get(id);
      expect(Math.abs(s.px - L.px) + Math.abs(s.py - L.py)).toBeLessThan(5000);
    }
  });

  it('pursuit at short distance (direct approach) does not cut a water corner', () => {
    const sim = newSim(42);
    const f = openField(sim, 12, 10);
    // water wall with a gap only via a diagonal
    for (let y = 0; y < 10; y++) if (y !== 4) setWater(sim, f.x + 5, f.y + y);
    setWater(sim, f.x + 6, f.y + 4);
    sim.map.version++;
    const A = sim.spawnLeader(0, 'sword1', f.x + 3, f.y + 4, 0);
    const B = sim.spawnLeader(1, 'sword1', f.x + 7, f.y + 5, 0);
    B.order = { type: 'hold' };
    let bad = null;
    sim.step([{ type: 'order', player: 0, units: [A.id], order: 'attack', target: B.id }]);
    for (let t = 0; t < 400 && !bad; t++) { sim.step(); bad = offGround(sim); }
    expect(bad).toBeNull();
  });
});

describe('Stuck figures', () => {
  it('figures on blocked tiles move to the nearest free tile on the next tick', () => {
    const sim = newSim(42);
    const f = openField(sim);
    const L = sim.spawnLeader(0, 'sword1', f.x + 3, f.y + 3, 2);
    const serf = serfsOf(sim)[0];
    serf.px = tileCenter(f.x + 7); serf.py = tileCenter(f.y + 3);
    // mission script blocks the tiles under the figures (flags directly + version++)
    for (const e of [L, serf, sim.entities.get(L.soldiers[0])]) sim.map.flags[sim.map.idx(toTile(e.px), toTile(e.py))] |= OCCUPIED;
    sim.map.version++;
    expect(offGround(sim)).not.toBeNull();
    sim.step();
    expect(offGround(sim)).toBeNull();
    expect(Math.abs(toTile(serf.px) - (f.x + 7)) + Math.abs(toTile(serf.py) - (f.y + 3))).toBeLessThanOrEqual(1);
  });

  it('a new building also pushes squads, heroes and workers to the edge', () => {
    const sim = newSim(42);
    const f = openField(sim);
    const L = sim.spawnLeader(0, 'sword1', f.x + 4, f.y + 4, 1);
    const hero = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
    hero.px = tileCenter(f.x + 5); hero.py = tileCenter(f.y + 5);
    sim.createBuilding(0, 'residence', f.x + 3, f.y + 3, true);
    expect(offGround(sim)).toBeNull();
    sim.run(50);
    expect(offGround(sim)).toBeNull();
    expect(sim.entities.has(L.id)).toBe(true);
  });

  it('soldier beyond the water walks to the nearest reachable spot near the captain; the captain stays attackable', () => {
    const sim = newSim(42);
    const f = openField(sim, 20, 12);
    const L = sim.spawnLeader(0, 'sword1', f.x + 16, f.y + 5, 1);
    const s = sim.entities.get(L.soldiers[0]);
    s.px = tileCenter(f.x + 1); s.py = tileCenter(f.y + 5);
    // water wall across the whole map between soldier and captain
    for (let y = 0; y < sim.map.height; y++) for (const x of [f.x + 10, f.x + 11]) setWater(sim, x, y);
    sim.map.version++;
    expect(targetable(sim, L)).toBe(true); // DETACHED rule stays as a safeguard
    sim.run(200);
    expect(offGround(sim)).toBeNull();
    // stands at the shore (directly in front of the water wall), no longer at the start
    expect(toTile(s.px)).toBe(f.x + 9);
    expect(Math.abs(toTile(s.py) - toTile(L.py))).toBeLessThanOrEqual(1);
    // soldier within sight, but beyond the water: does not protect the captain
    expect(Math.abs(s.px - L.px) + Math.abs(s.py - L.py)).toBeLessThan(12000);
    expect(targetable(sim, L)).toBe(true);
  });
});

describe('Serfs and workers stay on land', () => {
  it('AI economy 6 min on maps with rivers: nobody stands on water or buildings', async () => {
    const { AiPlayer } = await import('../../src/ai/AiPlayer.js');
    for (const seed of [3, 7]) {
      const sim = newSim(seed);
      const ais = [new AiPlayer(sim, 0, 'hard'), new AiPlayer(sim, 1, 'hard')];
      let bad = null;
      for (let t = 0; t < 3600 && !bad; t++) {
        for (const a of ais) a.update();
        sim.step();
        if (sim.map.frozen) continue; // ice is walkable in winter
        if (t % 5 === 0) bad = offGround(sim);
      }
      expect(bad, `seed ${seed}`).toBeNull();
    }
  });
});
