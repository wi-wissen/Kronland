import { describe, it, expect } from 'vitest';
import { generateMap, MAP_SIZES } from '../../src/sim/mapgen.js';
import { WATER, CLIFF } from '../../src/sim/map.js';
import { Sim } from '../../src/sim/sim.js';

/** Walkable tiles reachable from (x,y) (8-neighbourhood like the pathfinding). */
function reachable(map, x, y) {
  const S = map.width, seen = new Uint8Array(S * map.height);
  const q = [y * S + x]; seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const k = q[i], cx = k % S, cy = (k / S) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!map.walkable(nx, ny)) continue;
      if (dx && dy && (!map.walkable(cx + dx, cy) || !map.walkable(cx, cy + dy))) continue;
      const n = ny * S + nx;
      if (!seen[n]) { seen[n] = 1; q.push(n); }
    }
  }
  return seen;
}

/** First walkable tile around a building. */
const ringTile = (map, b) => map.ring(b.x, b.y, b.w, b.h)[0];
const ringReached = (map, seen, x, y, w, h) => map.ring(x, y, w, h).some((k) => seen[k]);

describe('Map generator', () => {
  it('is deterministic', () => {
    const a = generateMap(7), b = generateMap(7);
    expect(Array.from(a.map.heights)).toEqual(Array.from(b.map.heights));
    expect(Array.from(a.map.flags)).toEqual(Array.from(b.map.flags));
    expect(a.features).toEqual(b.features);
    const c = generateMap(7, { size: 160, players: 4 }), d = generateMap(7, { size: 160, players: 4 });
    expect(Array.from(c.map.heights)).toEqual(Array.from(d.map.heights));
    expect(c.features).toEqual(d.features);
  });

  it('produces different maps per seed', () => {
    const a = generateMap(1), b = generateMap(2);
    expect(Array.from(a.map.heights)).not.toEqual(Array.from(b.map.heights));
  });

  it('knows the sizes small, medium, large', () => {
    for (const s of Object.values(MAP_SIZES)) expect(generateMap(3, { size: s }).map.width).toBe(s);
  });

  for (const seed of [1, 2, 3, 42, 99]) {
    it(`Seed ${seed}: every player has start region, shafts, piles and settlement spots`, () => {
      const g = generateMap(seed);
      expect(g.starts.length).toBe(2);
      for (let p = 0; p < 2; p++) {
        const s = g.starts[p];
        for (let y = s.y - 6; y <= s.y + 6; y++) for (let x = s.x - 6; x <= s.x + 6; x++) {
          expect(g.map.flags[g.map.idx(x, y)] & (WATER | CLIFF)).toBe(0);
        }
        const own = g.features.filter((f) => f.player === p);
        expect(own.filter((f) => f.kind === 'shaft').length).toBeGreaterThanOrEqual(5);
        expect(own.filter((f) => f.kind === 'pile').length).toBeGreaterThanOrEqual(5);
        expect(own.filter((f) => f.kind === 'spot').length).toBeGreaterThanOrEqual(2);
      }
      let water = 0;
      for (const f of g.map.flags) if (f & WATER) water++;
      const pct = (water / g.map.flags.length) * 100;
      expect(pct).toBeGreaterThan(4);
      expect(pct).toBeLessThan(20);
    });
  }

  it('has real relief: mountains, valleys and cliffs', () => {
    for (const seed of [1, 5, 9, 42]) {
      const g = generateMap(seed);
      let min = Infinity, max = -Infinity, cliffs = 0;
      for (const h of g.map.heights) { min = Math.min(min, h); max = Math.max(max, h); }
      for (const f of g.map.flags) if (f & CLIFF) cliffs++;
      expect(max - g.waterLevel).toBeGreaterThan(3000); // peaks clearly above the water
      expect(cliffs).toBeGreaterThan(g.map.flags.length / 50); // at least 2 % cliffs
    }
  });

  it('cliffs are neither walkable nor buildable, not even in winter', () => {
    const sim = new Sim({ seed: 1 });
    const m = sim.map;
    const k = m.flags.findIndex((f) => f & CLIFF);
    expect(k).toBeGreaterThanOrEqual(0);
    const x = k % m.width, y = (k / m.width) | 0;
    expect(m.walkable(x, y)).toBe(false);
    m.frozen = true;
    expect(m.walkable(x, y)).toBe(false);
    m.frozen = false;
    expect(m.rectFree(x, y, 1, 1)).toBe(false);
    sim.players[0].stock.wood += 10000; sim.players[0].stock.clay += 10000;
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: x - 1, y: y - 1 }]);
    expect(ev.find((e) => e.type === 'rejected')).toBeTruthy();
  });

  it('start regions are flat and freely buildable', () => {
    for (const [seed, size, players] of [[1, 96, 2], [5, 128, 3], [9, 160, 4]]) {
      const g = generateMap(seed, { size, players });
      for (const s of g.starts) {
        let min = Infinity, max = -Infinity;
        for (let y = s.y - 7; y <= s.y + 7; y++) for (let x = s.x - 7; x <= s.x + 7; x++) {
          const h = g.map.heights[g.map.idx(x, y)];
          min = Math.min(min, h); max = Math.max(max, h);
          expect(g.map.flags[g.map.idx(x, y)] & (WATER | CLIFF)).toBe(0);
        }
        expect(max - min).toBeLessThanOrEqual(60);
      }
    }
  });

  // Connections are checked with the finished simulation (trees, piles and buildings block there).
  const cases = [];
  for (const size of [96, 128, 160]) for (const seed of [1, 4, 5, 9, 13]) cases.push([seed, size, size === 96 ? 2 : size === 128 ? 3 : 4]);
  for (const [seed, size, players] of cases) {
    it(`Seed ${seed}, size ${size}, ${players} players: all castles connected, shafts reachable`, () => {
      const sim = new Sim({ seed, size, players });
      const m = sim.map;
      const hqs = [...Array(players).keys()].map((p) => sim.findBuilding(p, 'headquarters'));
      const t0 = ringTile(m, hqs[0]);
      const seen = reachable(m, t0 % m.width, (t0 / m.width) | 0);
      for (const hq of hqs) expect(ringReached(m, seen, hq.x, hq.y, hq.w, hq.h)).toBe(true);
      for (let p = 0; p < players; p++) {
        const own = sim.shafts.filter((s) => {
          const hq = hqs[p];
          return Math.abs(s.x - hq.x) <= 30 && Math.abs(s.y - hq.y) <= 30 && ringReached(m, seen, s.x, s.y, 3, 3);
        });
        expect(own.length).toBeGreaterThanOrEqual(5);
        const kinds = new Set(own.map((s) => s.res));
        for (const r of ['clay', 'stone', 'iron', 'sulfur']) expect(kinds.has(r)).toBe(true);
        // wood nearby
        const trees = [...sim.entities.values()].filter((e) => e.kind === 'tree' && Math.abs(e.x - hqs[p].x) < 20 && Math.abs(e.y - hqs[p].y) < 20);
        expect(trees.length).toBeGreaterThanOrEqual(15);
      }
      for (const s of sim.spots) expect(ringReached(m, seen, s.x, s.y, 4, 4)).toBe(true);
    });
  }
});

describe('Wood supply', () => {
  it('every start has enough trees in the surroundings even on forest-poor maps', () => {
    for (const seed of [3, 8, 13, 15, 18]) {
      const sim = new Sim({ seed });
      for (const s of sim.starts) {
        let n = 0;
        for (const e of sim.entities.values()) if (e.kind === 'tree' && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 <= 40 * 40) n++;
        expect(n, `Seed ${seed}`).toBeGreaterThanOrEqual(140);
      }
    }
  });
});
