// Bridges, wells and monument (taken over from the extensions, src/sim/systems/bridges.js): bridge sites,
// construction, collapse, interplay with building on a slope, AI, determinism and save games.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { addAi } from '../../src/ai/runner.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { TileMap, WATER, BRIDGE, OCCUPIED, RESERVED, CLIFF } from '../../src/sim/map.js';
import { findPath } from '../../src/sim/pathfinding.js';
import { generateMap } from '../../src/sim/mapgen.js';
import { BRIDGE_SITES } from '../../src/sim/data/bridges.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { bridgeheads } from '../../src/sim/systems/bridges.js';
import { kill } from '../../src/sim/systems/military.js';
import { maxMotivation } from '../../src/sim/systems/workers.js';
import { tileCenter } from '../../src/sim/fixed.js';
import { quickBuild, serfsOf, runUntil } from './helpers.js';

const newSim = (seed = 42, extra = {}) => new Sim({ seed, ...extra });
const rich = (sim, p = 0) => { for (const r of Object.keys(sim.players[p].stock)) sim.players[p].stock[r] += 5000; };
const step = (sim, cmd) => sim.step(cmd ? [{ player: 0, ...cmd }] : []);

/** Bridge ends (land tiles before and behind the site, middle of the first row/column). */
function bridgeEnds(s) {
  return s.w >= s.h ? [{ x: s.x - 1, y: s.y }, { x: s.x + s.w, y: s.y }] : [{ x: s.x, y: s.y - 1 }, { x: s.x, y: s.y + s.h }];
}

/** Free 2×2 area whose transition edge touches a bridgehead. */
function siteNextToHead(sim, s) {
  const m = sim.map;
  for (const [hx, hy] of bridgeheads(s)) {
    for (let y = hy - 3; y <= hy + 2; y++) for (let x = hx - 3; x <= hx + 2; x++) {
      if (!m.rectFree(x, y, 2, 2, WATER | OCCUPIED | RESERVED | CLIFF)) continue;
      const touches = hx >= x - 1 && hx <= x + 2 && hy >= y - 1 && hy <= y + 2;
      if (touches) return { x, y, head: [hx, hy] };
    }
  }
  return null;
}

describe('Bridges', () => {
  it('map generator delivers bridge sites made of water with shore at both ends, without changing the map', () => {
    let total = 0;
    for (const seed of [1, 2, 3, 42, 99]) {
      const g = generateMap(seed, { size: 96, players: 2 });
      const g2 = generateMap(seed, { size: 96, players: 2 });
      expect(g2.bridges).toEqual(g.bridges);
      for (const s of g.bridges) {
        total++;
        const len = Math.max(s.w, s.h);
        expect(Math.min(s.w, s.h)).toBe(2);
        expect(len).toBeGreaterThanOrEqual(BRIDGE_SITES.minLen);
        expect(len).toBeLessThanOrEqual(BRIDGE_SITES.maxLen);
        let water = 0;
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) if (g.map.flags[g.map.idx(i, j)] & WATER) water++;
        expect(water).toBeGreaterThan(s.w * s.h / 2);
        for (const e of bridgeEnds(s)) expect(g.map.flags[g.map.idx(e.x, e.y)] & WATER).toBe(0);
      }
    }
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('bridge connects separated regions (region numbers and pathfinding)', () => {
    const m = new TileMap(12, 8);
    for (let y = 0; y < 8; y++) for (const x of [5, 6]) m.flags[m.idx(x, y)] = WATER;
    expect(m.regionAt(m.idx(2, 3))).not.toBe(m.regionAt(m.idx(9, 3)));
    expect(findPath(m, 2, 3, [m.idx(9, 3)])).toBeNull();
    for (const x of [5, 6]) for (const y of [3, 4]) m.flags[m.idx(x, y)] |= BRIDGE;
    m.version++;
    expect(m.walkable(5, 3)).toBe(true);
    expect(m.regionAt(m.idx(2, 3))).toBe(m.regionAt(m.idx(9, 3)));
    expect(findPath(m, 2, 3, [m.idx(9, 3)])?.length).toBeGreaterThan(5);
  });

  it('construction at a bridge site: first maths, then serfs build, afterwards a shorter path; collapse drowns', () => {
    const sim = newSim(42);
    const site = sim.bridgeSites[0];
    expect(site).toBeTruthy();
    rich(sim);
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toEqual({ code: 'err.techMissing', params: { tech: 'mathematics' } });
    sim.players[0].techs.add('mathematics');
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toBeNull();
    expect(sim.checkPlacement(0, 'bridge', site.x + 1, site.y)).toBe('err.bridgeSiteOnly');
    const [a, b] = bridgeEnds(site);
    const before = findPath(sim.map, a.x, a.y, [sim.map.idx(b.x, b.y)]);
    // bring serfs to the site (shore A) and let them build
    const serfs = serfsOf(sim).slice(0, 4);
    for (const u of serfs) { u.px = tileCenter(a.x); u.py = tileCenter(a.y); }
    const ev = step(sim, { type: 'placeBuilding', building: 'bridge', x: site.x, y: site.y, units: serfs.map((u) => u.id) });
    const placed = ev.find((e) => e.type === 'buildingPlaced');
    expect(placed).toBeTruthy();
    const bridge = sim.entities.get(placed.building);
    expect([bridge.w, bridge.h]).toEqual([site.w, site.h]);
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toBe('err.spotTaken');
    const t = runUntil(sim, () => bridge.done, 4000);
    expect(t).toBeGreaterThan(0);
    for (let j = site.y; j < site.y + site.h; j++) for (let i = site.x; i < site.x + site.w; i++) {
      expect(sim.map.walkable(i, j)).toBe(true);
      expect(sim.map.flags[sim.map.idx(i, j)] & OCCUPIED).toBe(0);
    }
    const after = findPath(sim.map, a.x, a.y, [sim.map.idx(b.x, b.y)]);
    expect(after).toBeTruthy();
    expect(after.length).toBeLessThan(before ? before.length : Infinity);
    expect(after.length).toBeLessThanOrEqual(Math.max(site.w, site.h) + 2);

    // figure on the bridge, bridge destroyed: water, figure drowns, no ruin
    const u = serfs[0];
    u.job = null; u.px = tileCenter(site.x); u.py = tileCenter(site.y); u.path = [];
    kill(sim, bridge, null);
    expect(sim.map.walkable(site.x, site.y)).toBe(false);
    expect(sim.entities.has(u.id)).toBe(false);
    expect([...sim.entities.values()].some((e) => e.kind === 'ruin' && e.x === site.x && e.y === site.y)).toBe(false);
    expect(sim.checkPlacement(0, 'bridge', site.x, site.y)).toBeNull();
  });
});

describe('Bridges × building on a slope', () => {
  it('bridgeheads and land tiles of the site are reserved and free of trees/piles', () => {
    for (const seed of [1, 2, 3, 42]) {
      const sim = newSim(seed);
      const m = sim.map;
      for (const s of sim.bridgeSites) {
        for (const [x, y] of bridgeheads(s)) {
          const f = m.flags[m.idx(x, y)];
          expect(f & RESERVED).toBe(RESERVED);
          expect(f & OCCUPIED).toBe(0);
          expect(m.walkable(x, y)).toBe(true);
        }
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) expect(m.flags[m.idx(i, j)] & OCCUPIED).toBe(0);
      }
    }
  });

  it('bridge levels nothing; buildings next to it change neither shore nor bridge', () => {
    let checked = 0;
    for (const seed of [42, 1, 2, 3, 5, 7]) {
      const sim = newSim(seed);
      const m = sim.map;
      for (const s of sim.bridgeSites) {
        const heads = bridgeheads(s);
        const before = [...m.heights];
        const hv = m.heightVersion;
        const b = sim.createBuilding(0, 'bridge', s.x, s.y, true);
        expect(m.heightVersion).toBe(hv);
        expect([...m.heights]).toEqual(before);
        expect(m.walkable(s.x, s.y)).toBe(true);
        // building next to a bridgehead: levelling leaves the shores and the bridge untouched
        const pos = siteNextToHead(sim, s);
        if (!pos) continue;
        const headH = heads.map(([x, y]) => m.heights[m.idx(x, y)]);
        const deck = [];
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) deck.push([m.heights[m.idx(i, j)], m.flags[m.idx(i, j)]]);
        sim.createBuilding(0, 'fountain', pos.x, pos.y, true);
        expect(heads.map(([x, y]) => m.heights[m.idx(x, y)])).toEqual(headH);
        const deck2 = [];
        for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) deck2.push([m.heights[m.idx(i, j)], m.flags[m.idx(i, j)]]);
        expect(deck2).toEqual(deck);
        expect(m.flags[m.idx(s.x, s.y)] & BRIDGE).toBe(BRIDGE);
        expect(sim.entities.has(b.id)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2);
  });

  it('nobody may build on bridgeheads (access stays free)', () => {
    const sim = newSim(42);
    sim.players[0].techs.add('construction');
    for (const r of Object.keys(sim.players[0].stock)) sim.players[0].stock[r] += 5000;
    const s = sim.bridgeSites[0];
    const [hx, hy] = bridgeheads(s)[0];
    // every 2×2 area that contains the bridgehead is blocked
    for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
      expect(sim.checkPlacement(0, 'fountain', hx + dx, hy + dy)).not.toBeNull();
    }
  });
});

describe('AI and bridges', () => {
  it('AI builds a bridge as a shortcut when a site is near the centre and it can afford it', () => {
    let built = 0, tried = 0;
    for (let seed = 1; seed <= 12 && built < 1; seed++) {
      const sim = newSim(seed, { fog: false });
      const ai = new AiPlayer(sim, 0, 'hard');
      ai.scan();
      const near = ai.spotNear('bridge');
      if (!sim.bridgeSites.some((s) => Math.hypot(s.x - near.x, s.y - near.y) <= 20 && Math.hypot(s.x - ai.home.x, s.y - ai.home.y) <= 60)) continue;
      tried++;
      sim.players[0].techs.add('mathematics');
      for (const r of Object.keys(sim.players[0].stock)) sim.players[0].stock[r] += 5000;
      ai.cmds = [];
      expect(ai.tryBuild('bridge')).toBe(true);
      const cmd = ai.cmds.find((c) => c.type === 'placeBuilding');
      expect(sim.bridgeSites.some((s) => s.x === cmd.x && s.y === cmd.y)).toBe(true);
      const ev = sim.step([{ ...cmd, player: 0 }]);
      if (ev.some((e) => e.type === 'buildingPlaced')) built++;
    }
    expect(tried).toBeGreaterThan(0);
    expect(built).toBe(1);
  });
});

describe('Decorations', () => {
  it('well and monument raise the maximum motivation', () => {
    const sim = newSim(42);
    const m0 = maxMotivation(sim, 0);
    quickBuild(sim, 'fountain', 0);
    quickBuild(sim, 'statue', 0);
    expect(maxMotivation(sim, 0)).toBe(Math.min(m0 + BUILDINGS.fountain.motivationEffect + BUILDINGS.statue.motivationEffect, maxMotivation(sim, 0) + 1000));
    expect(maxMotivation(sim, 0)).toBeGreaterThan(m0);
  });
});

describe('Bridges: determinism, save games, AI', () => {

  it('save game with bridge and reserved bridgeheads continues exactly the same', () => {
    const sim = newSim(42, { heroes: ['nelia', 'taran'] });
    addAi(sim, 0, 'hard'); addAi(sim, 1, 'normal');
    sim.run(600);
    const site = sim.bridgeSites[0];
    sim.createBuilding(0, 'bridge', site.x, site.y, true);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.bridgeSites).toEqual(sim.bridgeSites);
    const [hx, hy] = bridgeheads(sim2.bridgeSites[1] ?? site)[0];
    expect(sim2.map.flags[sim2.map.idx(hx, hy)] & RESERVED).toBe(RESERVED);
    expect(sim2.map.flags[sim2.map.idx(site.x, site.y)] & BRIDGE).toBe(BRIDGE);
    expect(sim2.hash()).toBe(sim.hash());
    sim.run(1500); sim2.run(1500);
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('AI vs AI: hard beats easy, only own valid commands', () => {
    const sim = newSim(1, { heroes: ['nelia', 'taran'] });
    addAi(sim, 0, 'hard'); addAi(sim, 1, 'easy');
    const rejects = [];
    for (let t = 0; t < 36000 && sim.winner === null; t++) {
      for (const e of sim.step()) if (e.type === 'rejected') rejects.push(e.reason);
    }
    expect(sim.winner).toBe(0);
    expect(rejects.filter((r) => /notOwn|noSerfs|noUnits|noTroops|unknown/.test(r))).toEqual([]);
    expect(rejects.length).toBeLessThan(80);
  }, 600_000);

  it('nonsensical bridge commands are rejected without disturbing the simulation', () => {
    const sim = newSim(42);
    rich(sim);
    sim.players[0].techs.add('mathematics');
    const s = sim.bridgeSites[0];
    for (const c of [
      { type: 'placeBuilding', building: 'bridge', x: 0.5, y: NaN },
      { type: 'placeBuilding', building: 'bridge', x: s.x + 1, y: s.y },
      { type: 'placeBuilding', building: 'bridge', x: -5, y: 3 },
      { type: 'placeBuilding', building: 'tavern', x: 10, y: 10 },
      { type: 'recruitSpecial', building: 1, spec: 'thief' },
    ]) expect(step(sim, c).some((e) => e.type === 'rejected')).toBe(true);
    sim.run(50);
    expect(Number.isInteger(sim.hash())).toBe(true);
  });
});
