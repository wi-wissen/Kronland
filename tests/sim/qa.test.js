// Regression tests for bugs from the QA review (docs/QA-BERICHT.md).

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { WATER } from '../../src/sim/map.js';
import { tileCenter } from '../../src/sim/fixed.js';
import { hqOf, serfsOf, quickBuild } from './helpers.js';

const heroOf = (sim, owner = 0) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === owner);

describe('QA: commands with prototype keys', () => {
  it('throw no exception but are rejected', () => {
    const sim = new Sim({ seed: 3 });
    const hq = hqOf(sim);
    const h = heroOf(sim);
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const ev = sim.step([
        { type: 'placeBuilding', player: 0, building: key, x: hq.x + 8, y: hq.y },
        { type: 'research', player: 0, building: hq.id, tech: key },
        { type: 'recruit', player: 0, building: hq.id, line: key, full: true },
        { type: 'upgradeLine', player: 0, line: key },
        { type: 'bless', player: 0, building: hq.id, blessing: key },
        { type: 'changeWeather', player: 0, building: hq.id, state: key },
        { type: 'ability', player: 0, hero: h.id, ability: key },
      ]);
      expect(ev.filter((e) => e.type === 'rejected')).toHaveLength(7);
    }
    expect(sim.weather.state).toBe('summer');
  });
});

describe('QA: hero ability with target point', () => {
  it('foot traps outside the map or far away are rejected, close to the hero allowed', () => {
    const sim = new Sim({ seed: 3, heroes: ['malvor', 'nelia'] });
    const h = heroOf(sim);
    const tx = (h.px / 1000) | 0, ty = (h.py / 1000) | 0;
    let ev = sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'caltrops', x: -40, y: ty }]);
    expect(ev.some((e) => e.type === 'rejected' && e.reason === 'err.notWalkable')).toBe(true);
    ev = sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'caltrops', x: tx + 40, y: ty }]);
    expect(ev.some((e) => e.type === 'rejected')).toBe(true);
    ev = sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'caltrops', x: tx + 2, y: ty }]);
    expect(ev.some((e) => e.type === 'ability')).toBe(true);
    // without a target point (as the UI sends it): at the hero position
    const sim2 = new Sim({ seed: 3, heroes: ['malvor', 'nelia'] });
    const h2 = heroOf(sim2);
    sim2.step([{ type: 'ability', player: 0, hero: h2.id, ability: 'caltrops' }]);
    const trap = [...sim2.entities.values()].find((e) => e.kind === 'trap');
    expect(trap.px).toBe(h2.px);
  });
});

describe('QA: eliminated players', () => {
  it('towers of a defeated player no longer shoot; no new workers', () => {
    const sim = new Sim({ seed: 5, players: 3 });
    const hq1 = hqOf(sim, 1);
    const tower = quickBuild(sim, 'tower', 1, { x: hq1.x - 4, y: hq1.y });
    tower.level = 1;
    // player 1 loses their castle
    sim.destroyBuilding(hq1, null);
    expect(sim.players[1].defeated).toBe(true);
    // place an enemy troop directly next to the tower
    const L = sim.spawnLeader(0, 'sword1', tower.x - 1, tower.y);
    const hp = L.hp + L.soldiers.reduce((s, id) => s + sim.entities.get(id).hp, 0);
    for (let i = 0; i < 300; i++) sim.step();
    const after = sim.entities.get(L.id);
    expect(after).toBeTruthy();
    expect(after.hp + after.soldiers.reduce((s, id) => s + sim.entities.get(id).hp, 0)).toBe(hp);
    expect([...sim.entities.values()].some((e) => e.kind === 'worker' && e.owner === 1)).toBe(false);
    for (const b of sim.entities.values()) if (b.kind === 'building') for (const id of b.workers) expect(sim.entities.has(id)).toBe(true);
  });
});

describe('QA: thaw', () => {
  it('drowned serfs release their building site', () => {
    const sim = new Sim({ seed: 1 });
    const hq = hqOf(sim);
    sim.step([{ type: 'buySerf', player: 0, count: 4 }]);
    const serfs = serfsOf(sim).slice(0, 4);
    const site = sim.createBuilding(0, 'residence', ...Object.values(sim.findPlacement(0, 'residence', hq.x + 2, hq.y + 2)), false);
    sim.step([{ type: 'assignWork', player: 0, units: serfs.map((u) => u.id), target: site.id }]);
    expect(site.builders).toHaveLength(4);
    // winter, place all four on the ice, then it thaws
    sim.setWeather('winter', 10);
    let water = -1;
    for (let i = 0; i < sim.map.flags.length; i++) if (sim.map.flags[i] & WATER) { water = i; break; }
    expect(water).toBeGreaterThanOrEqual(0);
    for (const u of serfs) { u.px = tileCenter(water % sim.map.width); u.py = tileCenter((water / sim.map.width) | 0); u.path = []; }
    sim.setWeather('summer', 6000);
    for (const u of serfs) expect(sim.entities.has(u.id)).toBe(false);
    expect(site.builders).toEqual([]);
  });
});

describe('QA: militia', () => {
  it('militia cannot be sent to work (would block building sites)', () => {
    const sim = new Sim({ seed: 2 });
    const hq = hqOf(sim);
    sim.step([{ type: 'militia', player: 0, on: true }]);
    const ids = serfsOf(sim).map((u) => u.id);
    const pos = sim.findPlacement(0, 'residence', hq.x + 2, hq.y + 2);
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'residence', x: pos.x, y: pos.y, units: ids }]);
    const placed = ev.find((e) => e.type === 'buildingPlaced');
    expect(sim.entities.get(placed.building).builders).toEqual([]);
  });
});

describe('QA: save game', () => {
  it('the same save loaded twice yields independent simulations', () => {
    const sim = new Sim({ seed: 4 });
    sim.run(50);
    const data = saveGame(sim);
    // save game is a copy: continuing does not change it
    const gold = data.players[0].stock.gold;
    sim.players[0].stock.gold += 123;
    expect(data.players[0].stock.gold).toBe(gold);
    const a = loadGame(data), b = loadGame(data);
    a.players[0].stock.gold = 1;
    a.players[0].unitTier.sword = 3;
    a.market.prices.wood = 1;
    expect(b.players[0].stock.gold).toBe(gold);
    expect(b.players[0].unitTier.sword).toBe(1);
    expect(b.market.prices.wood).not.toBe(1);
  });
});

describe('QA: pathfinding with region numbers', () => {
  it('delivers exactly the same as the full search, also after building/demolishing and in frost', async () => {
    const { findPath } = await import('../../src/sim/pathfinding.js');
    const sim = new Sim({ seed: 9, size: 96 });
    const m = sim.map;
    // same map without regionAt ⇒ pure A* search
    const plain = { width: m.width, height: m.height, walkable: (x, y) => m.walkable(x, y) };
    let x = 12345;
    const rnd = (n) => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x % n; };
    for (let round = 0; round < 6; round++) {
      if (round === 2) m.occupy(40, 40, 6, 6, 999999);
      if (round === 3) m.release(40, 40, 6, 6);
      if (round === 4) m.frozen = true;
      if (round === 5) m.frozen = false;
      for (let i = 0; i < 60; i++) {
        const sx = rnd(m.width), sy = rnd(m.height);
        const goals = [m.idx(rnd(m.width), rnd(m.height)), m.idx(rnd(m.width), rnd(m.height))];
        expect(findPath(m, sx, sy, goals)).toEqual(findPath(plain, sx, sy, goals));
      }
    }
  });
});
