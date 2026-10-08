// Groups spread out: move targets fanned out, serfs onto several trees/piles,
// notice when nothing is left nearby.

import { describe, it, expect } from 'vitest';
import { formationTiles } from '../../src/sim/systems/movement.js';
import { TileMap, WATER } from '../../src/sim/map.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import { toTile, tileCenter } from '../../src/sim/fixed.js';
import { newSim, serfsOf, hqOf, nearestNode } from './helpers.js';

describe('formationTiles', () => {
  it('gives every unit its own walkable tile near the goal', () => {
    const map = new TileMap(30, 30);
    const units = Array.from({ length: 9 }, (_, i) => ({ px: tileCenter(2 + i), py: tileCenter(2) }));
    const goals = formationTiles(map, 15, 15, units, 1);
    expect(new Set(goals).size).toBe(9);
    for (const k of goals) {
      expect(Math.abs((k % 30) - 15)).toBeLessThanOrEqual(1);
      expect(Math.abs(((k / 30) | 0) - 15)).toBeLessThanOrEqual(1);
    }
  });

  it('avoids water and other regions, distance is kept', () => {
    const map = new TileMap(30, 30);
    for (let y = 0; y < 30; y++) map.flags[map.idx(17, y)] |= WATER; // river east of the goal
    map.version++;
    const units = Array.from({ length: 6 }, () => ({ px: tileCenter(5), py: tileCenter(5) }));
    const goals = formationTiles(map, 15, 15, units, 3);
    expect(new Set(goals).size).toBe(6);
    for (const k of goals) expect(k % 30).toBeLessThan(17);
  });

  it('skips taken tiles: a single unit stops next to the occupied goal', () => {
    const map = new TileMap(20, 20);
    const units = [{ px: tileCenter(2), py: tileCenter(10) }];
    const [k] = formationTiles(map, 10, 10, units, 1, new Set([map.idx(10, 10)]));
    expect(k).not.toBe(map.idx(10, 10));
    expect(Math.max(Math.abs((k % 20) - 10), Math.abs(((k / 20) | 0) - 10))).toBe(1);
    expect(formationTiles(map, 10, 10, units, 1, new Set())).toEqual([map.idx(10, 10)]);
  });

  it('is deterministic', () => {
    const map = new TileMap(20, 20);
    const units = Array.from({ length: 5 }, (_, i) => ({ px: tileCenter(i), py: tileCenter(0) }));
    expect(formationTiles(map, 10, 10, units, 1)).toEqual(formationTiles(map, 10, 10, units, 1));
  });
});

describe('Move commands fan out', () => {
  it('serfs walk to different tiles', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const serfs = serfsOf(sim);
    const tx = hq.x + 2, ty = hq.y + hq.h + 3;
    const m = sim.map;
    const target = m.walkable(tx, ty) ? { x: tx, y: ty } : (() => { const k = m.ring(hq.x, hq.y, hq.w, hq.h)[0]; return { x: k % m.width, y: (k / m.width) | 0 }; })();
    sim.step([{ type: 'move', player: 0, units: serfs.map((u) => u.id), ...target }]);
    sim.run(300);
    const tiles = new Set(serfs.map((u) => m.idx(toTile(u.px), toTile(u.py))));
    expect(tiles.size).toBe(serfs.length);
  });
});

describe('Clicked move avoids standing figures', () => {
  const setup = () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const [a, b] = serfsOf(sim);
    const m = sim.map;
    const k = m.ring(hq.x, hq.y, hq.w, hq.h).find((i) => m.walkable(i % m.width, ((i / m.width) | 0) + 3));
    const t = { x: k % m.width, y: ((k / m.width) | 0) + 3 };
    sim.step([{ type: 'move', player: 0, units: [a.id], ...t }]);
    sim.run(400);
    expect(m.idx(toTile(a.px), toTile(a.py))).toBe(m.idx(t.x, t.y));
    return { sim, m, a, b, t };
  };

  it('with avoid the second serf stops on a neighbouring tile', () => {
    const { sim, m, a, b, t } = setup();
    sim.step([{ type: 'move', player: 0, units: [b.id], ...t, avoid: true }]);
    sim.run(400);
    const bt = { x: toTile(b.px), y: toTile(b.py) };
    expect(m.idx(bt.x, bt.y)).not.toBe(m.idx(toTile(a.px), toTile(a.py)));
    expect(Math.max(Math.abs(bt.x - t.x), Math.abs(bt.y - t.y))).toBe(1);
  });

  it('without avoid (scripts) the goal is exact', () => {
    const { sim, m, b, t } = setup();
    sim.step([{ type: 'move', player: 0, units: [b.id], ...t }]);
    sim.run(400);
    expect(m.idx(toTile(b.px), toTile(b.py))).toBe(m.idx(t.x, t.y));
  });
});

describe('Serfs spread out when gathering', () => {
  it('only one per tree, the others take free trees nearby', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const tree = nearestNode(sim, 'tree', 'wood', hq.x, hq.y);
    const serfs = serfsOf(sim);
    expect(serfs.length).toBeGreaterThan(2);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: tree.id }]);
    const targets = serfs.map((u) => u.job?.target);
    expect(targets.every(Boolean)).toBe(true);
    expect(new Set(targets).size).toBe(serfs.length);
    expect(targets).toContain(tree.id);
    expect(BALANCE.serf.gatherersPerTree).toBe(1);
  });

  it('at one pile up to the limit', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const pile = nearestNode(sim, 'pile', 'clay', hq.x, hq.y);
    const serfs = serfsOf(sim);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: pile.id }]);
    const on = serfs.filter((u) => u.job?.target === pile.id).length;
    expect(on).toBe(Math.min(serfs.length, BALANCE.serf.gatherersPerPile));
  });

  it('reports when no tree is left nearby', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const tree = nearestNode(sim, 'tree', 'wood', hq.x, hq.y);
    // remove all other trees
    for (const e of [...sim.entities.values()]) if (e.kind === 'tree' && e.id !== tree.id) sim.removeEntity(e);
    const [u] = serfsOf(sim);
    sim.step([{ type: 'assignWork', player: 0, units: [u.id], target: tree.id }]);
    let ev = null;
    for (let i = 0; i < 6000 && !ev; i++) ev = sim.step().find((e) => e.type === 'noMoreNodes') ?? null;
    expect(ev).toMatchObject({ player: 0, res: 'wood', unit: u.id });
    expect(u.job).toBe(null);
  });
});
