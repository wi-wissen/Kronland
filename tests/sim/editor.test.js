// World editor: tools on the preview simulation, adoption into the scenario, loading the map in the game.

import { describe, it, expect } from 'vitest';
import { applyEdit, editorSim, withTerrain, tileInfo } from '../../src/sim/editor/edit.js';
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
});
