import { describe, it, expect } from 'vitest';
import { newSim, serfsOf, hqOf, nearestNode, runUntil, placeNearHq, quickBuild } from './helpers.js';
import { START_RESOURCES } from '../../src/sim/data/resources.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { BALANCE } from '../../src/sim/data/balance.js';

describe('Game start', () => {
  it('every player has castle, village centre, starting resources and serfs', () => {
    const sim = newSim();
    for (const p of [0, 1]) {
      expect(sim.findBuilding(p, 'headquarters')?.done).toBe(true);
      expect(sim.findBuilding(p, 'villageCenter')?.done).toBe(true);
      expect(sim.players[p].stock).toEqual(START_RESOURCES);
      expect(serfsOf(sim, p).length).toBe(BALANCE.startSerfs);
      expect(sim.popLimit(p)).toBe(75);
    }
  });
});

describe('Buying serfs', () => {
  it('costs 50 thalers and creates a serf', () => {
    const sim = newSim();
    sim.step([{ type: 'buySerf', player: 0 }]);
    expect(sim.players[0].stock.gold).toBe(450);
    expect(serfsOf(sim).length).toBe(BALANCE.startSerfs + 1);
  });

  it('is rejected without thalers', () => {
    const sim = newSim();
    const ev = sim.step([{ type: 'buySerf', player: 0, count: 11 }]);
    expect(serfsOf(sim).length).toBe(BALANCE.startSerfs + 10);
    expect(sim.players[0].stock.gold).toBe(0);
    expect(ev.some((e) => e.type === 'rejected' && e.reason === 'err.notEnoughGold')).toBe(true);
  });

  it('respects the population limit', () => {
    const sim = newSim();
    sim.players[0].stock.gold = 100000;
    sim.step([{ type: 'buySerf', player: 0, count: 100 }]);
    expect(sim.popUsed(0)).toBe(75);
  });
});

describe('Building', () => {
  it('placing a house deducts the costs', () => {
    const sim = newSim();
    placeNearHq(sim, 'residence');
    expect(sim.players[0].stock.wood).toBe(START_RESOURCES.wood - 150);
    expect(sim.players[0].stock.clay).toBe(START_RESOURCES.clay - 100);
  });

  it('rejects invalid spots', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const reject = (cmd) => sim.step([{ player: 0, type: 'placeBuilding', ...cmd }]).find((e) => e.type === 'rejected')?.reason;
    expect(reject({ building: 'residence', x: hq.x, y: hq.y })).toBeTruthy(); // on the castle
    expect(reject({ building: 'villageCenter', x: hq.x + 10, y: hq.y + 10 })).toBe('err.settlementOnly');
    const clayShaft = sim.shafts.find((s) => s.res === 'clay');
    expect(reject({ building: 'ironMine', x: clayShaft.x, y: clayShaft.y })).toBe('err.shaftOnly');
    expect(reject({ building: 'chapel', x: hq.x + 10, y: hq.y + 10 })).toBe('err.techMissing');
    expect(reject({ building: 'headquarters', x: hq.x + 10, y: hq.y + 10 })).toBe('err.notBuildable');
    // water
    const m = sim.map;
    let wx = -1, wy = -1;
    for (let k = 0; k < m.flags.length && wx < 0; k++) if (m.flags[k] & 1) { wx = k % m.width; wy = (k / m.width) | 0; }
    expect(reject({ building: 'residence', x: wx, y: wy })).toBeTruthy();
  });

  it('mine only works on the matching shaft', () => {
    const sim = newSim();
    const shaft = sim.shafts.find((s) => s.res === 'clay');
    const ev = sim.step([{ type: 'placeBuilding', player: 0, building: 'clayMine', x: shaft.x, y: shaft.y }]);
    expect(ev.some((e) => e.type === 'buildingPlaced')).toBe(true);
  });

  it('1 serf builds a house in about the build time (original: ConstructionInfo/Time with one serf)', () => {
    const sim = newSim();
    const [u] = serfsOf(sim);
    const id = placeNearHq(sim, 'residence', 0, [u.id]);
    const buildTicks = BUILDINGS.residence.levels[0].buildTime * 10;
    expect(sim.entities.get(id).work).toBe(buildTicks);
    const t = runUntil(sim, (s) => s.entities.get(id).done, buildTicks * 2);
    expect(t).toBeGreaterThan(buildTicks);
    expect(t).toBeLessThan(buildTicks + 150); // plus walking distance
    expect(sim.entities.get(id).hp).toBe(BUILDINGS.residence.levels[0].hp);
  });

  it('4 serfs need about a quarter of the build time', () => {
    const sim = newSim();
    const units = serfsOf(sim).slice(0, 4).map((u) => u.id);
    const id = placeNearHq(sim, 'residence', 0, units);
    const buildTicks = BUILDINGS.residence.levels[0].buildTime * 10;
    const t = runUntil(sim, (s) => s.entities.get(id).done, buildTicks);
    expect(t).toBeGreaterThan(buildTicks / 4);
    expect(t).toBeLessThan(buildTicks / 4 + 150);
  });

  it('6 serfs at a sawmill (6 builder spots) need a sixth of the build time', () => {
    const sim = newSim();
    sim.step([{ type: 'buySerf', player: 0, count: 2 }]);
    sim.run(5);
    sim.players[0].techs.add('construction');
    const units = serfsOf(sim).slice(0, 6).map((u) => u.id);
    expect(BUILDINGS.sawmill.builders).toBe(6);
    const id = placeNearHq(sim, 'sawmill', 0, units);
    expect(sim.entities.get(id).builders.length).toBe(6);
    const buildTicks = BUILDINGS.sawmill.levels[0].buildTime * 10;
    const t = runUntil(sim, (s) => s.entities.get(id).done, buildTicks);
    expect(t).toBeGreaterThan(buildTicks / 6);
    expect(t).toBeLessThan(buildTicks / 6 + 150);
  });

  it('at most 4 serfs per construction site', () => {
    const sim = newSim();
    sim.step([{ type: 'buySerf', player: 0, count: 3 }]);
    const units = serfsOf(sim).map((u) => u.id);
    expect(units.length).toBe(7);
    const id = placeNearHq(sim, 'residence', 0, units);
    expect(sim.entities.get(id).builders.length).toBe(4);
  });

  it('builder spots per building type: chapel 8, ornament 1 (original BuilderSlots)', () => {
    const sim = newSim();
    sim.step([{ type: 'buySerf', player: 0, count: 6 }]);
    sim.run(5);
    const units = serfsOf(sim).map((u) => u.id);
    expect(units.length).toBe(10);
    // construction site at level 0 without tech and cost locks
    const site = (type) => { const b = quickBuild(sim, type); b.done = false; b.progress = 0; return b; };
    const chapel = site('chapel');
    sim.step([{ type: 'assignWork', player: 0, units, target: chapel.id }]);
    expect(chapel.builders.length).toBe(BUILDINGS.chapel.builders);
    expect(chapel.builders.length).toBe(8);
    const statue = site('statue');
    const rest = units.filter((id) => !chapel.builders.includes(id));
    sim.step([{ type: 'assignWork', player: 0, units: rest, target: statue.id }]);
    expect(statue.builders.length).toBe(1);
  });

  it('builders then look for the next construction site nearby', () => {
    const sim = newSim();
    const units = serfsOf(sim).map((u) => u.id);
    const a = placeNearHq(sim, 'residence', 0, units);
    const b = placeNearHq(sim, 'farm');
    runUntil(sim, (s) => s.entities.get(a).done, 3000);
    sim.step();
    expect(sim.entities.get(b).builders.length).toBe(4);
  });
});

describe('Mining resources', () => {
  it('serfs fell wood and then go to the next tree', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const tree = nearestNode(sim, 'tree', 'wood', hq.x, hq.y);
    const [u] = serfsOf(sim);
    sim.step([{ type: 'assignWork', player: 0, units: [u.id], target: tree.id }]);
    const ticks = runUntil(sim, (s) => !s.entities.has(tree.id), 5000);
    expect(ticks).toBeGreaterThan(0);
    expect(sim.players[0].raw.wood).toBe(BALANCE.tree.wood);
    expect(u.job?.kind).toBe('gather');
    expect(u.job.target).not.toBe(tree.id);
  });

  it('serfs mine clay at a pile', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const pile = nearestNode(sim, 'pile', 'clay', hq.x, hq.y);
    const units = serfsOf(sim).map((u) => u.id);
    sim.step([{ type: 'assignWork', player: 0, units, target: pile.id }]);
    sim.run(600);
    expect(sim.players[0].raw.clay).toBeGreaterThan(30);
    expect(pile.amount).toBe(BALANCE.pile.amount - sim.players[0].raw.clay);
  });

  it('raw material is usable for building when refined goods are missing', () => {
    const sim = newSim();
    const p = sim.players[0];
    p.stock.wood = 100; p.raw.wood = 100;
    placeNearHq(sim, 'residence');
    expect(p.stock.wood).toBe(0);
    expect(p.raw.wood).toBe(50);
  });
});

describe('Walking and payday', () => {
  it('serfs walk to the goal', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const [u] = serfsOf(sim);
    const pos = sim.findPlacement(0, 'residence', hq.x + 8, hq.y + 8);
    sim.step([{ type: 'move', player: 0, units: [u.id], x: pos.x, y: pos.y }]);
    runUntil(sim, () => u.goal === undefined, 600);
    expect(Math.floor(u.px / 1000)).toBe(pos.x);
    expect(Math.floor(u.py / 1000)).toBe(pos.y);
  });

  it('payday comes every 120 seconds', () => {
    const sim = newSim();
    let paydays = 0;
    for (let i = 0; i < 2400; i++) paydays += sim.step().filter((e) => e.type === 'payday' && e.player === 0).length;
    expect(paydays).toBe(2);
  });

  it('taxes can only be changed after "education"', () => {
    const sim = newSim();
    let ev = sim.step([{ type: 'setTax', player: 0, level: 4 }]);
    expect(ev[0]?.reason).toBe('err.techFirst');
    expect(ev[0]?.params).toEqual({ tech: 'education' });
    sim.players[0].techs.add('education');
    sim.step([{ type: 'setTax', player: 0, level: 4 }]);
    expect(sim.players[0].taxLevel).toBe(4);
  });

  it('foreign units cannot be commanded', () => {
    const sim = newSim();
    const [enemy] = serfsOf(sim, 1);
    const ev = sim.step([{ type: 'move', player: 0, units: [enemy.id], x: 10, y: 10 }]);
    expect(ev[0]?.type).toBe('rejected');
  });
});
