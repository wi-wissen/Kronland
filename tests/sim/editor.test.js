// World editor: tools on the preview simulation, adoption into the scenario, loading the map in the game.

import { describe, it, expect } from 'vitest';
import { applyEdit, editorSim, withTerrain, tileInfo, groundSnapshot, restoreGround } from '../../src/sim/editor/edit.js';
import { itemList } from '../../src/sim/systems/ground.js';
import { emptyScenario, validateScenario } from '../../src/sim/scripting/scenario.js';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { WATER, CLIFF } from '../../src/sim/map.js';

const fresh = () => emptyScenario({ size: 32 });

describe('World editor', () => {
  it('raise, lower, level, smooth change the height and report the area', () => {
    const sim = editorSim(fresh());
    const k = sim.map.idx(20, 20);
    const h0 = sim.map.heights[k];
    const r = applyEdit(sim, { tool: 'raise', x: 20, y: 20, r: 2, strength: 100 });
    expect(r.changed).toBe(true);
    expect(sim.map.heights[k]).toBe(h0 + 100);
    expect(r.events.find((e) => e.type === 'terrainChanged')).toMatchObject({ x: 16, y: 16 });
    applyEdit(sim, { tool: 'lower', x: 20, y: 20, r: 0, strength: 50 });
    expect(sim.map.heights[k]).toBe(h0 + 50);
    // smooth the peak: becomes lower
    applyEdit(sim, { tool: 'raise', x: 8, y: 8, r: 0, strength: 300 });
    const spike = sim.map.heights[sim.map.idx(8, 8)];
    applyEdit(sim, { tool: 'smooth', x: 8, y: 8, r: 2 });
    expect(sim.map.heights[sim.map.idx(8, 8)]).toBeLessThan(spike);
    applyEdit(sim, { tool: 'flatten', x: 25, y: 25, r: 6 });
    applyEdit(sim, { tool: 'raise', x: 24, y: 25, r: 0, strength: 90 });
    applyEdit(sim, { tool: 'flatten', x: 25, y: 25, r: 3 });
    expect(sim.map.heights[sim.map.idx(24, 25)]).toBe(sim.map.heights[sim.map.idx(25, 25)]);
  });

  it('water and rocks follow from the height; trees on them disappear', () => {
    const sim = editorSim(fresh());
    applyEdit(sim, { tool: 'forest', x: 16, y: 16, r: 4, seed: 3 });
    const trees = [...sim.entities.values()].filter((e) => e.kind === 'tree').length;
    expect(trees).toBeGreaterThan(3);
    const r = applyEdit(sim, { tool: 'water', x: 16, y: 16, r: 2 });
    expect(sim.map.flags[sim.map.idx(16, 16)] & WATER).toBeTruthy();
    expect(tileInfo(sim, 16, 16).kind).toBe('water');
    expect([...sim.entities.values()].filter((e) => e.kind === 'tree').length).toBeLessThan(trees);
    expect(r.events.some((e) => e.type === 'nodeDepleted')).toBe(true);
    applyEdit(sim, { tool: 'land', x: 16, y: 16, r: 2 });
    expect(sim.map.flags[sim.map.idx(16, 16)] & WATER).toBeFalsy();
    for (let i = 0; i < 12; i++) applyEdit(sim, { tool: 'raise', x: 8, y: 26, r: 0, strength: 400 });
    expect(sim.map.flags[sim.map.idx(8, 26)] & CLIFF).toBeTruthy();
  });

  it('piles, shafts, settlement spots can be set and erased', () => {
    const sim = editorSim(fresh());
    expect(applyEdit(sim, { tool: 'pile', x: 20, y: 10, res: 'iron', amount: 250 }).changed).toBe(true);
    expect(tileInfo(sim, 20, 10)).toMatchObject({ kind: 'pile', res: 'iron' });
    expect(applyEdit(sim, { tool: 'shaft', x: 25, y: 25, res: 'stone' }).changed).toBe(true);
    expect(applyEdit(sim, { tool: 'spot', x: 15, y: 25 }).changed).toBe(true);
    expect(sim.shafts.length).toBe(1);
    expect(sim.spots.length).toBe(1);
    applyEdit(sim, { tool: 'erase', x: 20, y: 10, r: 0 });
    applyEdit(sim, { tool: 'erase', x: 25, y: 25, r: 1 });
    expect(tileInfo(sim, 20, 10).kind).toBe('free');
    expect(sim.shafts.length).toBe(0);
  });

  it('edited map ends up in the scenario and is loaded the same way in the game', () => {
    const sc = fresh();
    const sim = editorSim(sc);
    applyEdit(sim, { tool: 'forest', x: 10, y: 20, r: 3 });
    applyEdit(sim, { tool: 'water', x: 24, y: 8, r: 2 });
    applyEdit(sim, { tool: 'pile', x: 6, y: 6, res: 'gold', amount: 123 });
    const saved = withTerrain(sc, sim);
    expect(validateScenario(saved)).toEqual([]);
    expect(saved.world.base).toBe('terrain');
    const json = JSON.parse(JSON.stringify(saved));
    const game = createScenarioSim(json);
    const count = (s, kind) => [...s.entities.values()].filter((e) => e.kind === kind).length;
    expect(count(game, 'tree')).toBe(count(sim, 'tree'));
    expect(game.map.flags[game.map.idx(24, 8)] & WATER).toBeTruthy();
    expect([...game.entities.values()].find((e) => e.kind === 'pile')).toMatchObject({ res: 'gold', amount: 123, x: 6, y: 6 });
    expect(Array.from(game.map.heights)).toEqual(Array.from(sim.map.heights));
  });

  it('tool item lays coins and flowers on walkable tiles, the eraser takes them away', () => {
    const sim = editorSim(fresh());
    expect(applyEdit(sim, { tool: 'item', x: 10, y: 10, item: 'coin' }).changed).toBe(true);
    expect(applyEdit(sim, { tool: 'item', x: 11, y: 10, item: 'flower' }).changed).toBe(true);
    // same item again: nothing changes; another kind replaces it
    expect(applyEdit(sim, { tool: 'item', x: 10, y: 10, item: 'coin' }).changed).toBe(false);
    expect(applyEdit(sim, { tool: 'item', x: 11, y: 10, item: 'coin' }).changed).toBe(true);
    expect(tileInfo(sim, 10, 10).kind).toBe('coin');
    // not on water and not under a tree
    applyEdit(sim, { tool: 'water', x: 24, y: 24, r: 1 });
    expect(applyEdit(sim, { tool: 'item', x: 24, y: 24, item: 'coin' }).changed).toBe(false);
    applyEdit(sim, { tool: 'pile', x: 5, y: 5, res: 'stone' });
    expect(applyEdit(sim, { tool: 'item', x: 5, y: 5, item: 'coin' }).changed).toBe(false);
    expect(itemList(sim.map).map((i) => i.kind)).toEqual(['coin', 'coin']);
    applyEdit(sim, { tool: 'erase', x: 10, y: 10, r: 1 });
    expect(sim.map.items.size).toBe(0);
  });

  it('tool track paints strength with the brush, not on water; water and the eraser remove it', () => {
    const sim = editorSim(fresh());
    const m = sim.map;
    expect(applyEdit(sim, { tool: 'track', x: 16, y: 16, r: 1, level: 12 }).changed).toBe(true);
    expect(m.tracks[m.idx(16, 16)]).toBe(12);
    expect(m.tracks[m.idx(17, 16)]).toBe(12);
    expect(m.tracks[m.idx(18, 16)]).toBe(0);
    expect(tileInfo(sim, 16, 16)).toMatchObject({ kind: 'track', track: 12 });
    // level is clamped to the strongest track
    applyEdit(sim, { tool: 'track', x: 4, y: 4, r: 0, level: 500 });
    expect(m.tracks[m.idx(4, 4)]).toBe(48);
    applyEdit(sim, { tool: 'water', x: 16, y: 16, r: 0 });
    expect(m.tracks[m.idx(16, 16)]).toBe(0);
    expect(applyEdit(sim, { tool: 'track', x: 16, y: 16, r: 0 }).changed).toBe(false);
    applyEdit(sim, { tool: 'erase', x: 17, y: 16, r: 1 });
    expect(m.tracks[m.idx(17, 16)]).toBe(0);
    expect(m.tracks[m.idx(4, 4)]).toBe(48);
  });

  it('undo snapshot of the ground restores items and tracks', () => {
    const sim = editorSim(fresh());
    applyEdit(sim, { tool: 'item', x: 3, y: 3, item: 'flower' });
    const snap = groundSnapshot(sim.map);
    const v = sim.map.groundVersion;
    applyEdit(sim, { tool: 'item', x: 4, y: 3, item: 'coin' });
    applyEdit(sim, { tool: 'track', x: 8, y: 8, r: 0, level: 5 });
    restoreGround(sim.map, snap);
    expect(itemList(sim.map)).toEqual([{ x: 3, y: 3, kind: 'flower' }]);
    expect(sim.map.tracks[sim.map.idx(8, 8)]).toBe(0);
    expect(sim.map.groundVersion).toBeGreaterThan(v);
  });

  it('items and tracks are saved in world.terrain and come back in the game', () => {
    const sc = fresh();
    const sim = editorSim(sc);
    applyEdit(sim, { tool: 'item', x: 7, y: 9, item: 'coin' });
    applyEdit(sim, { tool: 'item', x: 8, y: 9, item: 'flower' });
    applyEdit(sim, { tool: 'track', x: 12, y: 12, r: 0, level: 20 });
    const saved = JSON.parse(JSON.stringify(withTerrain(sc, sim)));
    expect(validateScenario(saved)).toEqual([]);
    expect(saved.world.terrain.features).toEqual(expect.arrayContaining([
      { kind: 'coin', x: 7, y: 9 }, { kind: 'flower', x: 8, y: 9 }, { kind: 'track', x: 12, y: 12, strength: 20 },
    ]));
    const game = createScenarioSim(saved);
    expect(itemList(game.map)).toEqual([{ x: 7, y: 9, kind: 'coin' }, { x: 8, y: 9, kind: 'flower' }]);
    expect(game.map.tracks[game.map.idx(12, 12)]).toBe(20);
    // and back into the editor
    const again = editorSim(saved);
    expect(itemList(again.map).length).toBe(2);
    expect(again.map.tracks[again.map.idx(12, 12)]).toBe(20);
  });
});
