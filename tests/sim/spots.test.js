// Fixed spots: builders stand on their own tile at the footprint; resting units at the campfire,
// waiting units in front of buildings and serfs at tree and pile on their own point in the ring around their target.

import { describe, it, expect } from 'vitest';
import { newSim, serfsOf, hqOf, nearestNode, placeNearHq, quickBuild, runUntil, workersOfPlayer } from './helpers.js';
import { WATER } from '../../src/sim/map.js';
import { toTile, isqrt } from '../../src/sim/fixed.js';
import { REASONS } from '../../src/sim/reasons.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { assignJob } from '../../src/sim/systems/serfs.js';
import { DIR72 } from '../../src/sim/dirs.js';
import { SPOTS } from '../../src/sim/data/spots.js';
import {
  heldSpot, heldPoint, ringsOf, slotPoint, slotPoints, centerOf, pickSlot, takenSpots, freeSlots,
} from '../../src/sim/systems/spots.js';

const rejectOf = (ev) => ev.find((e) => e.type === 'rejected')?.reason;
const tileOf = (sim, e) => sim.map.idx(toTile(e.px), toTile(e.py));
const camps = (sim) => [...sim.entities.values()].filter((e) => e.kind === 'camp' && e.owner === 0);
const dist = (a, b) => isqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/** No spot assigned twice: all held points at least minGap apart. */
function expectApart(sim) {
  const pts = [...sim.entities.values()].map((e) => heldPoint(sim, e)).filter(Boolean);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    expect(dist(pts[i], pts[j])).toBeGreaterThanOrEqual(SPOTS.minGap);
  }
}

/** Is the tile directly around the rectangle? */
function onRing(sim, k, r) {
  const x = k % sim.map.width, y = (k / sim.map.width) | 0;
  const inside = x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  return !inside && x >= r.x - 1 && x <= r.x + r.w && y >= r.y - 1 && y <= r.y + r.h;
}

/** Does the figure stand exactly on a point of a ring around the target? */
function onCircle(t, e) {
  const c = centerOf(t), d = dist(c, { x: e.px, y: e.py });
  return ringsOf(t).some((r) => Math.abs(d - r.radius) <= 2);
}

/** Single tree without other trees in the search radius (otherwise the lumberjacks spread out). */
function loneTree(sim) {
  const hq = hqOf(sim);
  const tree = nearestNode(sim, 'tree', 'wood', hq.x, hq.y);
  for (const e of [...sim.entities.values()]) {
    if (e.kind === 'tree' && e !== tree && (e.x - tree.x) ** 2 + (e.y - tree.y) ** 2 <= 30 * 30) sim.removeEntity(e);
  }
  return tree;
}

describe('Rings: directions and points', () => {
  it('DIR72: 72 unit vectors (±1 ‰), every third direction is the old 15° grid', () => {
    expect(DIR72.length).toBe(72);
    for (const v of DIR72) expect(Math.abs(isqrt(v.x * v.x + v.y * v.y) - 1000)).toBeLessThanOrEqual(1);
    expect(DIR72[0]).toEqual({ x: 1000, y: 0 });
    expect(DIR72[18]).toEqual({ x: 0, y: 1000 });
    expect(DIR72[3]).toEqual({ x: 966, y: 259 });
    expect(DIR72[36]).toEqual({ x: -1000, y: 0 });
  });

  it('spots lie on the ring, all different and at least minGap apart', () => {
    const targets = [
      { kind: 'tree', x: 10, y: 10 }, { kind: 'pile', x: 10, y: 10 }, { kind: 'camp', x: 10, y: 10, w: 1, h: 1 },
      { kind: 'building', x: 10, y: 10, w: 4, h: 4 }, { kind: 'building', x: 10, y: 10, w: 3, h: 4 },
      { kind: 'building', x: 10, y: 10, w: 6, h: 6 },
    ];
    for (const t of targets) {
      const c = centerOf(t), rings = ringsOf(t), pts = [];
      for (let r = 0; r < rings.length; r++) {
        expect(72 % rings[r].n).toBe(0);
        for (let k = 0; k < rings[r].n; k++) {
          const p = slotPoint(t, r * 72 + k);
          expect(Math.abs(dist(c, p) - rings[r].radius)).toBeLessThanOrEqual(2);
          pts.push(p);
        }
      }
      expect(slotPoint(t, rings[0].n)).toBeNull(); // invalid number
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(dist(pts[i], pts[j])).toBeGreaterThanOrEqual(SPOTS.minGap);
      // building: spots outside the footprint
      if (t.kind === 'building') for (const p of pts) {
        const tx = toTile(p.x), ty = toTile(p.y);
        expect(tx >= t.x && tx < t.x + t.w && ty >= t.y && ty < t.y + t.h).toBe(false);
      }
    }
    // campfire: 8 spots in 8 different neighbouring tiles
    const f = { kind: 'camp', x: 10, y: 10, w: 1, h: 1 };
    const tiles = new Set(ringsOf(f).flatMap((r, i) => Array.from({ length: r.n }, (_, k) => {
      const p = slotPoint(f, i * 72 + k); return `${toTile(p.x)},${toTile(p.y)}`;
    })));
    expect(tiles.size).toBe(8);
    expect(tiles.has('10,10')).toBe(false);
  });

  it('spots on blocked tiles are dropped', () => {
    const sim = newSim();
    const tree = loneTree(sim);
    const all = slotPoints(sim.map, tree);
    expect(all.length).toBeGreaterThan(2);
    const blocked = all[0].k;
    sim.map.flags[blocked] |= WATER;
    sim.map.version++;
    const rest = slotPoints(sim.map, tree);
    expect(rest.some((p) => p.k === blocked)).toBe(false);
    expect(rest.length).toBeLessThan(all.length);
  });
});

describe('Spots at the construction site (tiles)', () => {
  it('four serfs build from four different tiles around the footprint', () => {
    const sim = newSim();
    const serfs = serfsOf(sim).slice(0, 4);
    const id = placeNearHq(sim, 'residence', 0, serfs.map((u) => u.id));
    const b = sim.entities.get(id);
    expect(b.builders.length).toBe(4);
    expectApart(sim);
    runUntil(sim, () => serfs.every((u) => !u.path.length && tileOf(sim, u) === u.spot), 600);
    const tiles = serfs.map((u) => tileOf(sim, u));
    expect(new Set(tiles).size).toBe(4);
    for (const k of tiles) expect(onRing(sim, k, b)).toBe(true);
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
    const ring = sim.map.ring(b.x, b.y, b.w, b.h);
    for (const k of ring.slice(2)) sim.map.flags[k] |= WATER;
    sim.map.version++;
    const ev = sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(0, 3).map((u) => u.id), target: id }]);
    expect(rejectOf(ev)).toBeUndefined();
    expect(b.builders.length).toBe(2);
    expect(new Set(b.builders.map((i) => sim.entities.get(i).spot))).toEqual(new Set(ring.slice(0, 2)));
    const third = sim.step([{ type: 'assignWork', player: 0, units: [serfs[2].id], target: id }]);
    expect(rejectOf(third)).toBe(REASONS.siteFull);
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
    const hq = hqOf(sim);
    const k = sim.map.ring(hq.x, hq.y, hq.w, hq.h).find((t) => !ring.includes(t));
    sim.step([{ type: 'move', player: 0, units: [serfs[0].id], x: k % sim.map.width, y: (k / sim.map.width) | 0 }]);
    expect(heldSpot(serfs[0])).toBe(-1);
    expect(rejectOf(sim.step([{ type: 'assignWork', player: 0, units: [serfs[1].id], target: id }]))).toBeUndefined();
    expect(serfs[1].spot).toBe(ring[0]);
  });
});

describe('Ring slots when mining', () => {
  it('serfs at a pile stand on different points in the ring', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const pile = nearestNode(sim, 'pile', 'clay', hq.x, hq.y);
    const serfs = serfsOf(sim);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: pile.id }]);
    const on = serfs.filter((u) => u.job?.target === pile.id);
    expect(on.length).toBeGreaterThan(1);
    expect(on.every((u) => u.slot >= 0 && u.spot === -1)).toBe(true);
    expectApart(sim);
    expect(runUntil(sim, () => on.every((u) => { const p = slotPoint(pile, u.slot); return u.px === p.x && u.py === p.y; }), 1500)).toBeGreaterThan(0);
    for (const u of on) expect(onCircle(pile, u)).toBe(true);
  });

  it('lumberjacks at a single tree stand in the ring around the trunk', () => {
    const sim = newSim();
    sim.players[0].stock.gold = 100000;
    sim.step([{ type: 'buySerf', player: 0, count: 4 }]);
    const tree = loneTree(sim);
    const serfs = serfsOf(sim).slice(0, 6);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: tree.id }]);
    const on = serfs.filter((u) => u.job?.target === tree.id);
    expect(on.length).toBeGreaterThanOrEqual(4);
    const atPoint = (u) => { const p = slotPoint(tree, u.slot); return p && u.px === p.x && u.py === p.y; };
    expect(runUntil(sim, () => on.every(atPoint), 1500)).toBeGreaterThan(0);
    for (const u of on) expect(onCircle(tree, u)).toBe(true);
    expectApart(sim);
    // when felling everyone stays on their point
    sim.run(20);
    expect(on.filter((u) => u.job).every(atPoint)).toBe(true);
  });

  it('lumberjacks at neighbouring trees do not get too close to each other', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    sim.players[0].stock.gold = 100000;
    sim.step([{ type: 'buySerf', player: 0, count: 8 }]);
    const serfs = serfsOf(sim);
    const tree = nearestNode(sim, 'tree', 'wood', hq.x, hq.y);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: tree.id }]);
    for (let i = 0; i < 40; i++) { sim.run(25); expectApart(sim); }
  });

  it('full ring: no spot left, the tree accepts nobody', () => {
    const sim = newSim();
    const tree = loneTree(sim);
    const serfs = serfsOf(sim);
    const pts = slotPoints(sim.map, tree);
    // occupy all spots with serfs standing exactly there
    pts.forEach((p, i) => {
      const u = serfs[i] ?? { ...structuredClone(serfs[0]), id: sim.nextId++ };
      if (!sim.entities.has(u.id)) sim.entities.set(u.id, u);
      u.px = p.x; u.py = p.y; u.path = []; u.job = { kind: 'gather', target: tree.id, res: 'wood' }; u.slot = p.slot;
    });
    const extra = { ...structuredClone(serfs[0]), id: sim.nextId++, job: null, slot: -1, spot: -1 };
    sim.entities.set(extra.id, extra);
    expect(freeSlots(sim.map, tree, takenSpots(sim, extra.id)).length).toBe(0);
    expect(pickSlot(sim, extra, tree)).toBe(-1);
    expect(assignJob(sim, extra, tree)).toBe(false);
    // one leaves: their spot becomes free
    const leaver = [...sim.entities.values()].find((e) => e.job?.target === tree.id);
    leaver.job = null;
    const s = pickSlot(sim, extra, tree);
    expect(s).toBe(leaver.slot);
  });
});

describe('Ring slots at the campfire', () => {
  it('resting units sit exactly in the ring around the fire, never too close together', () => {
    const sim = newSim();
    sim.players[0].raw.stone = 100000;
    quickBuild(sim, 'stonemason'); quickBuild(sim, 'stonemason');
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      sim.run(10);
      const camping = workersOfPlayer(sim).filter((w) => w.state === 'camping');
      seen = Math.max(seen, camping.length);
      for (const w of camping) {
        const f = sim.entities.get(w.target);
        if (f?.kind !== 'camp') continue;
        expect(w.slot).toBeGreaterThanOrEqual(0);
        const p = slotPoint(f, w.slot);
        expect([w.px, w.py]).toEqual([p.x, p.y]);
        expect(onCircle(f, w)).toBe(true);
      }
      expectApart(sim);
    }
    expect(seen).toBeGreaterThan(1);
  });

  it('if the ring is full, another fire is lit', () => {
    const sim = newSim();
    sim.players[0].raw.stone = 100000;
    const wp = quickBuild(sim, 'stonemason');
    runUntil(sim, () => camps(sim).length > 0, 4000);
    const [f] = camps(sim);
    const proto = workersOfPlayer(sim)[0];
    for (const p of freeSlots(sim.map, f, takenSpots(sim))) {
      const id = sim.nextId++;
      sim.entities.set(id, {
        ...structuredClone(proto), id, workplace: wp.id, home: 0, farm: 0, path: [], inside: false,
        px: p.x, py: p.y, state: 'camping', intent: 'campSleep', target: f.id, timer: 100000, slot: p.slot,
      });
    }
    expect(runUntil(sim, () => camps(sim).length >= 2, 4000)).toBeGreaterThan(0);
    expectApart(sim);
  });
});

describe('Ring slots in front of buildings', () => {
  it('workers without resource wait in the ring in front of their workshop', () => {
    const sim = newSim();
    sim.players[0].raw.stone = 0;
    const wp = quickBuild(sim, 'stonemason');
    const waiting = () => workersOfPlayer(sim).filter((w) => w.workplace === wp.id && w.state === 'waiting' && w.slot >= 0);
    expect(runUntil(sim, () => waiting().length >= 3, 3000)).toBeGreaterThan(0);
    for (const w of waiting()) {
      expect(w.target).toBe(wp.id);
      const p = slotPoint(wp, w.slot);
      expect([w.px, w.py]).toEqual([p.x, p.y]);
      expect(onCircle(wp, w)).toBe(true);
    }
    expectApart(sim);
    // when waiting next time everyone stays on their spot
    const before = new Map(waiting().map((w) => [w.id, w.slot]));
    sim.run(60);
    for (const w of waiting()) if (before.has(w.id)) expect(w.slot).toBe(before.get(w.id));
  });
});

describe('Spots: determinism and save game', () => {
  const scenario = () => {
    const sim = newSim(7);
    sim.players[0].raw.stone = 100000;
    quickBuild(sim, 'stonemason');
    const serfs = serfsOf(sim);
    placeNearHq(sim, 'residence', 0, serfs.slice(0, 2).map((u) => u.id));
    const hq = hqOf(sim);
    const pile = nearestNode(sim, 'pile', 'clay', hq.x, hq.y);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(2).map((u) => u.id), target: pile.id }]);
    return sim;
  };

  it('same sequence, same hash; the ring slot counts towards the hash', () => {
    const a = scenario(), b = scenario();
    a.run(1500); b.run(1500);
    expect(a.hash()).toBe(b.hash());
    const u = serfsOf(b).find((x) => x.slot >= 0);
    u.slot += 1;
    expect(a.hash()).not.toBe(b.hash());
  });

  it('spots are saved and continue the same after loading', () => {
    const sim = scenario();
    sim.run(300);
    expect(serfsOf(sim).some((u) => u.slot >= 0)).toBe(true);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    sim.run(1500); sim2.run(1500);
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('old save game (tile spots for mining and resting) loads and continues', () => {
    const sim = scenario();
    sim.run(600);
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    // recreate the old format: no `slot`, miners and workers with tile spot
    let gatherers = 0, workers = 0;
    for (const e of data.entities) {
      if (e.kind === 'unit' && e.job?.kind === 'gather') { delete e.slot; e.spot = sim.map.idx(toTile(e.px), toTile(e.py)); gatherers++; }
      if (e.kind === 'worker') { delete e.slot; e.spot = sim.map.idx(toTile(e.px), toTile(e.py)); workers++; }
    }
    expect(gatherers).toBeGreaterThan(0);
    expect(workers).toBeGreaterThan(0);
    const old = loadGame(data);
    for (const e of old.entities.values()) {
      if (e.kind === 'worker') { expect(e.slot).toBe(-1); expect(e.spot).toBeUndefined(); }
      if (e.kind === 'unit' && e.job?.kind === 'gather') { expect(e.slot).toBe(-1); expect(e.spot).toBe(-1); }
    }
    old.run(600);
    // miners have a ring slot again and stand on it
    const g = serfsOf(old).filter((u) => u.job?.kind === 'gather');
    expect(g.length).toBeGreaterThan(0);
    for (const u of g) expect(u.slot).toBeGreaterThanOrEqual(0);
    expectApart(old);
  });
});
