// Showcase map (src/sim/missions/showcase.js): everything the game can draw, on one map.

import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { getMission } from '../../src/sim/missions/registry.js';
import { SHOWCASE_ID, BUILDING_ROWS, SITES, UPGRADE } from '../../src/sim/missions/showcase.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { UNITS, HERO_IDS } from '../../src/sim/data/units.js';
import { PROFESSIONS } from '../../src/sim/data/professions.js';
import { RESOURCES } from '../../src/sim/data/resources.js';
import { checkBridgeSite } from '../../src/sim/systems/bridges.js';
import { fogEnabled } from '../../src/sim/systems/vision.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { OCCUPIED } from '../../src/sim/map.js';
import * as api from '../../src/sim/missions/setupApi.js';

const all = (sim, pred) => [...sim.entities.values()].filter(pred);

describe('Showcase', () => {
  const sim = createMissionSim(SHOWCASE_ID);
  const st = sim.mission.state;

  it('is registered, without fog and sets itself up without warnings', () => {
    expect(getMission(SHOWCASE_ID)).toBeTruthy();
    expect(st.warnings).toEqual([]);
    expect(fogEnabled(sim)).toBe(false);
    for (const [k, v] of Object.entries(st.refs)) if (typeof v === 'number') expect(sim.entities.has(v), k).toBe(true);
  });

  it('shows every building type at every upgrade level (finished, player 0)', () => {
    const listed = BUILDING_ROWS.flat();
    // all types are covered: rows + bandit camp (bandits) + bridge (at the bridge site)
    expect(new Set([...listed, 'banditCamp', 'bridge'])).toEqual(new Set(Object.keys(BUILDINGS)));
    for (const type of listed) {
      for (let lv = 0; lv < BUILDINGS[type].levels.length; lv++) {
        const n = all(sim, (e) => e.kind === 'building' && e.owner === 0 && e.type === type && e.level === lv && e.done).length;
        expect(n, `${type} level ${lv + 1}`).toBeGreaterThanOrEqual(1);
      }
    }
    expect(all(sim, (e) => e.kind === 'building' && e.type === 'banditCamp' && e.owner === st.bandits)).toHaveLength(1);
    // second player with their own castle
    expect(sim.findBuilding(1, 'headquarters')).toBeTruthy();
    expect(all(sim, (e) => e.kind === 'building' && e.owner === 1).length).toBeGreaterThanOrEqual(4);
  });

  it('construction sites in several build phases and a building under upgrade', () => {
    const sites = all(sim, (e) => e.kind === 'building' && !e.done);
    const pct = sites.filter((b) => b.level === 0).map((b) => Math.round((100 * b.progress) / b.work)).sort((a, b) => a - b);
    expect(pct).toEqual(SITES.map(([, p]) => p).sort((a, b) => a - b));
    const up = sites.find((b) => b.level === 1);
    expect(up?.type).toBe(UPGRADE[0]);
    expect(up.progress).toBeGreaterThan(0);
    expect(up.progress).toBeLessThan(up.work);
  });

  it('ruins, finished bridge and free bridge site', () => {
    const ruins = all(sim, (e) => e.kind === 'ruin').map((r) => r.type);
    expect(ruins).toContain('villageCenter');
    expect(ruins).toContain('residence');
    expect(new Set(ruins).size).toBeGreaterThanOrEqual(4);
    const bridge = sim.entities.get(st.refs.bridge);
    expect(bridge).toMatchObject({ type: 'bridge', done: true });
    const free = sim.bridgeSites.filter((s) => !checkBridgeSite(sim, s.x, s.y));
    expect(free.length).toBeGreaterThanOrEqual(1);
  });

  it('shafts, settlement spots, piles of every kind, forest', () => {
    const freeRect = (s, w) => { for (let j = s.y; j < s.y + w; j++) for (let i = s.x; i < s.x + w; i++) if (sim.map.flags[sim.map.idx(i, j)] & OCCUPIED) return false; return true; };
    for (const res of ['clay', 'stone', 'iron', 'sulfur']) expect(sim.shafts.some((s) => s.res === res && freeRect(s, 3)), res).toBe(true);
    expect(sim.spots.filter((s) => freeRect(s, 4)).length).toBeGreaterThanOrEqual(2);
    for (const res of RESOURCES) expect(all(sim, (e) => e.kind === 'pile' && e.res === res).length, res).toBeGreaterThanOrEqual(1);
    const forest = st.refs.forestArea;
    expect(all(sim, (e) => e.kind === 'tree' && api.dist(e, forest) <= forest.r + 1).length).toBeGreaterThanOrEqual(30);
  });

  it('figures: troops of every unit, four heroes, workers of every profession, bandits, conversation figures, devices', () => {
    for (const id of Object.keys(UNITS)) expect(all(sim, (e) => e.kind === 'leader' && e.owner === 0 && e.def === id).length, id).toBe(1);
    expect(all(sim, (e) => e.kind === 'hero' && e.owner === 0).map((h) => h.hero).sort()).toEqual([...HERO_IDS].sort());
    for (const prof of Object.keys(PROFESSIONS)) expect(all(sim, (e) => e.kind === 'worker' && e.prof === prof).length, prof).toBeGreaterThanOrEqual(1);
    expect(all(sim, (e) => e.kind === 'unit' && e.owner === 0).length).toBeGreaterThan(0);
    expect(all(sim, (e) => e.kind === 'leader' && e.owner === st.bandits).length).toBeGreaterThanOrEqual(2);
    expect(all(sim, (e) => e.kind === 'npc')).toHaveLength(2);
    expect(all(sim, (e) => e.kind === 'turret')).toHaveLength(1);
    expect(all(sim, (e) => e.kind === 'trap')).toHaveLength(1);
  });

  it('signpost: every field is a side objective with a camera jump, without victory', () => {
    const ui = sim.mission.uiState(sim);
    expect(ui.objectives.length).toBeGreaterThanOrEqual(10);
    for (const o of ui.objectives) {
      expect(o.primary).toBe(false);
      expect(o.hint?.area, o.id).toBeTruthy();
    }
  });

  it('runs peacefully: campfire burns, no combat, no end, construction sites stay put', () => {
    const s = createMissionSim(SHOWCASE_ID);
    const hp = new Map(all(s, (e) => e.kind === 'leader' || e.kind === 'hero').map((e) => [e.id, e.hp]));
    let shots = 0;
    for (let i = 0; i < 1200; i++) { s.step(); shots += s.events.filter((e) => e.type === 'shot').length; }
    expect(shots).toBe(0);
    expect(s.mission.state.result).toBeNull();
    expect(s.winner).toBeNull();
    for (const [id, v] of hp) expect(s.entities.get(id)?.hp, `#${id}`).toBe(v);
    // campfire of the second player (workers without house and farm)
    expect(all(s, (e) => e.kind === 'camp' && e.owner === 1).length).toBeGreaterThanOrEqual(1);
    expect(all(s, (e) => e.kind === 'building' && !e.done).length).toBe(SITES.length + 1);
    expect(Object.values(s.mission.state.npcs).every((n) => n.state === 'open')).toBe(true);
  });

  it('is deterministic and survives saving/loading', () => {
    const a = createMissionSim(SHOWCASE_ID), b = createMissionSim(SHOWCASE_ID);
    expect(a.hash()).toBe(b.hash());
    a.run(300); b.run(300);
    expect(a.hash()).toBe(b.hash());
    const c = loadGame(JSON.parse(JSON.stringify(saveGame(a))));
    expect(c.hash()).toBe(a.hash());
    c.run(100); a.run(100);
    expect(c.hash()).toBe(a.hash());
  });
});
