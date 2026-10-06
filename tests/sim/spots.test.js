// Fixed spots: whoever builds, mines, waits or rests stands on their own tile.

import { describe, it, expect } from 'vitest';
import { newSim, serfsOf, hqOf, nearestNode, placeNearHq, quickBuild, runUntil, workersOfPlayer } from './helpers.js';
import { WATER } from '../../src/sim/map.js';
import { toTile } from '../../src/sim/fixed.js';
import { REASONS } from '../../src/sim/reasons.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { heldSpot } from '../../src/sim/systems/spots.js';

const rejectOf = (ev) => ev.find((e) => e.type === 'rejected')?.reason;
const tileOf = (sim, e) => sim.map.idx(toTile(e.px), toTile(e.py));
const camps = (sim) => [...sim.entities.values()].filter((e) => e.kind === 'camp' && e.owner === 0);

/** No spot assigned twice (across all figures). */
function expectUniqueSpots(sim) {
  const held = [...sim.entities.values()].map(heldSpot).filter((k) => k >= 0);
  expect(new Set(held).size).toBe(held.length);
}

/** Is the tile directly around the rectangle? */
function onRing(sim, k, r) {
  const x = k % sim.map.width, y = (k / sim.map.width) | 0;
  const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  return !inside && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
}

describe('Spots at the construction site', () => {
  it('four serfs build from four different tiles around the footprint', () => {
    const sim = newSim();
    const serfs = serfsOf(sim).slice(0, 4);
    const id = placeNearHq(sim, 'residence', 0, serfs.map((u) => u.id));
    const b = sim.entities.get(id);
    expect(b.builders.length).toBe(4);
    expectUniqueSpots(sim);
    runUntil(sim, () => serfs.every((u) => !u.path.length && tileOf(sim, u) === u.spot), 600);
    const tiles = serfs.map((u) => tileOf(sim, u));
    expect(new Set(tiles).size).toBe(4);
    for (const k of tiles) expect(onRing(sim, k, b)).toBe(true);
    // While building, everyone stays on their own spot
    for (let i = 0; i < 20 && !b.done; i++) {
      sim.run(10);
      if (b.done) break;
      expect(new Set(serfs.map((u) => tileOf(sim, u))).size).toBe(4);
    }
  });

  it('when no spot is free all around, further serfs are rejected', () => {
    const sim = newSim();
    const serfs = serfsOf(sim);
    const id = placeNearHq(sim, 'residence', 0, []);
    const b = sim.entities.get(id);
    // Make everything around the construction site impassable except for two tiles
    const ring = sim.map.ring(b.x, b.y, b.w, b.h);
    expect(ring.length).toBeGreaterThan(4);
    for (const k of ring.slice(2)) sim.map.flags[k] |= WATER;
    sim.map.version++;
    const ev = sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(0, 3).map((u) => u.id), target: id }]);
    expect(rejectOf(ev)).toBeUndefined();
    expect(b.builders.length).toBe(2);
    expect(new Set(b.builders.map((i) => sim.entities.get(i).spot))).toEqual(new Set(ring.slice(0, 2)));
    const third = sim.step([{ type: 'assignWork', player: 0, units: [serfs[2].id], target: id }]);
    expect(rejectOf(third)).toBe(REASONS.siteFull);
    expect(serfs[2].job).toBeNull();
  });

  it('the spot becomes free on leaving and is reassigned', () => {
    const sim = newSim();
    const serfs = serfsOf(sim);
    const id = placeNearHq(sim, 'residence', 0, []);
    const b = sim.entities.get(id);
    const ring = sim.map.ring(b.x, b.y, b.w, b.h);
    for (const k of ring.slice(1)) sim.map.flags[k] |= WATER;
    sim.map.version++;
    sim.step([{ type: 'assignWork', player: 0, units: [serfs[0].id], target: id }]);
    expect(rejectOf(sim.step([{ type: 'assignWork', player: 0, units: [serfs[1].id], target: id }]))).toBe(REASONS.siteFull);
    // The first one is sent away: spot free
    const hq = hqOf(sim);
    const k = sim.map.ring(hq.x, hq.y, hq.w, hq.h).find((t) => !ring.includes(t));
    expect(rejectOf(sim.step([{ type: 'move', player: 0, units: [serfs[0].id], x: k % sim.map.width, y: (k / sim.map.width) | 0 }]))).toBeUndefined();
    expect(heldSpot(serfs[0])).toBe(-1);
    expect(rejectOf(sim.step([{ type: 'assignWork', player: 0, units: [serfs[1].id], target: id }]))).toBeUndefined();
    expect(serfs[1].spot).toBe(ring[0]);
  });
});

describe('Ring slots when mining', () => {
  it('Serfs at one pile stand on different tiles', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const pile = nearestNode(sim, 'pile', 'clay', hq.x, hq.y);
    const serfs = serfsOf(sim);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: pile.id }]);
    expectUniqueSpots(sim);
    const on = serfs.filter((u) => u.job?.target === pile.id);
    expect(on.length).toBeGreaterThan(1);
    runUntil(sim, () => on.every((u) => tileOf(sim, u) === u.spot), 1500);
    expect(new Set(on.map((u) => tileOf(sim, u))).size).toBe(on.length);
  });

  it('Woodcutters at neighbouring trees do not share a tile', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    sim.players[0].stock.gold = 100000;
    sim.step([{ type: 'buySerf', player: 0, count: 8 }]);
    const serfs = serfsOf(sim);
    const tree = nearestNode(sim, 'tree', 'wood', hq.x, hq.y);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: tree.id }]);
    for (let i = 0; i < 40; i++) {
      sim.run(25);
      expectUniqueSpots(sim);
      const working = serfs.filter((u) => u.job && !u.path.length && u.spot >= 0 && tileOf(sim, u) === u.spot);
      expect(new Set(working.map((u) => tileOf(sim, u))).size).toBe(working.length);
    }
  });
});

describe('Ring slots at the campfire', () => {
  it('Resting units sit in a circle around the fire, never two on one tile', () => {
    const sim = newSim();
    sim.players[0].raw.stone = 100000;
    quickBuild(sim, 'stonemason'); quickBuild(sim, 'stonemason');
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      sim.run(10);
      const camping = workersOfPlayer(sim).filter((w) => w.state === 'camping');
      seen = Math.max(seen, camping.length);
      expect(new Set(camping.map((w) => tileOf(sim, w))).size).toBe(camping.length);
      for (const w of camping) {
        const f = sim.entities.get(w.target);
        if (f?.kind === 'camp') expect(onRing(sim, tileOf(sim, w), f)).toBe(true);
      }
      expectUniqueSpots(sim);
    }
    expect(seen).toBeGreaterThan(1);
  });

  it('if the ring is full, another fire is lit', () => {
    const sim = newSim();
    sim.players[0].raw.stone = 100000;
    const wp = quickBuild(sim, 'stonemason');
    runUntil(sim, () => camps(sim).length > 0, 4000);
    const [f] = camps(sim);
    // Occupy all spots at the fire with resting units that stay for a long time
    const proto = workersOfPlayer(sim)[0];
    const seated = new Set(workersOfPlayer(sim).map(heldSpot).filter((k) => k >= 0));
    for (const k of sim.map.ring(f.x, f.y, 1, 1)) {
      if (seated.has(k)) continue;
      const id = sim.nextId++;
      sim.entities.set(id, {
        ...structuredClone(proto), id, workplace: wp.id, home: 0, farm: 0, path: [], inside: false,
        px: (k % sim.map.width) * 1000 + 500, py: ((k / sim.map.width) | 0) * 1000 + 500,
        state: 'camping', intent: 'campSleep', target: f.id, timer: 100000, spot: k,
      });
    }
    expect(runUntil(sim, () => camps(sim).length >= 2, 4000)).toBeGreaterThan(0);
    expectUniqueSpots(sim);
  });
});

describe('Spots: determinism and save game', () => {
  const scenario = () => {
    const sim = newSim(7);
    sim.players[0].raw.stone = 100000;
    quickBuild(sim, 'stonemason');
    const serfs = serfsOf(sim);
    placeNearHq(sim, 'residence', 0, serfs.slice(0, 4).map((u) => u.id));
    return sim;
  };

  it('gleicher Ablauf, gleicher Hash', () => {
    const a = scenario(), b = scenario();
    a.run(1500); b.run(1500);
    expect(a.hash()).toBe(b.hash());
  });

  it('spots are saved and continue the same after loading', () => {
    const sim = scenario();
    sim.run(300);
    expect(serfsOf(sim).some((u) => u.spot >= 0)).toBe(true);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    sim.run(1500); sim2.run(1500);
    expect(sim2.hash()).toBe(sim.hash());
  });
});
