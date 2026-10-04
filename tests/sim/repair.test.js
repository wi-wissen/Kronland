import { describe, it, expect } from 'vitest';
import { newSim, quickBuild, serfsOf, hqOf } from './helpers.js';
import { DAMAGE, isBurning } from '../../src/sim/systems/damage.js';
import { kill } from '../../src/sim/systems/military.js';
import { REASONS } from '../../src/sim/reasons.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { OCCUPIED } from '../../src/sim/map.js';

const rejectOf = (ev) => ev.find((e) => e.type === 'rejected')?.reason;

describe('Building damage, fire and repair', () => {
  it('below 50 % a building burns and loses HP; above it does not', () => {
    const sim = newSim();
    const b = quickBuild(sim, 'residence');
    b.hp = 301; // > 50 % of 600
    sim.run(100);
    expect(b.hp).toBe(301);
    expect(b.burning).toBe(false);
    b.hp = 299;
    const ev = sim.step();
    expect(ev.some((e) => e.type === 'buildingBurning' && e.building === b.id)).toBe(true);
    expect(isBurning(sim, b)).toBe(true);
    sim.run(100);
    expect(b.hp).toBeLessThan(299);
    expect(299 - b.hp).toBeGreaterThanOrEqual(Math.floor(100 / DAMAGE.burnTicks) * DAMAGE.burnHp - 1);
  });

  it('construction sites do not burn', () => {
    const sim = newSim();
    const b = sim.createBuilding(0, 'residence', 10, 10, false);
    sim.run(50);
    expect(b.burning).toBe(false);
    expect(b.hp).toBe(60);
  });

  it('a burning building burns down and leaves a ruin that disappears later', () => {
    const sim = newSim();
    const b = quickBuild(sim, 'residence');
    b.hp = 3;
    const events = [];
    for (let i = 0; i < 40; i++) events.push(...sim.step());
    const d = events.find((e) => e.type === 'buildingDestroyed');
    expect(d).toMatchObject({ building: b.id, buildingType: 'residence', owner: 0 });
    expect(sim.entities.has(b.id)).toBe(false);
    const ruin = sim.entities.get(d.ruin);
    expect(ruin).toMatchObject({ kind: 'ruin', type: 'residence', x: b.x, y: b.y, w: b.w, h: b.h, formerOwner: 0 });
    expect(sim.map.flags[sim.map.idx(b.x, b.y)] & OCCUPIED).toBeTruthy();
    expect(sim.checkPlacement(0, 'residence', b.x, b.y)).not.toBe(null);
    sim.run(DAMAGE.ruinTicks + 1);
    expect(sim.entities.has(ruin.id)).toBe(false);
    expect(sim.map.flags[sim.map.idx(b.x, b.y)] & OCCUPIED).toBeFalsy();
  });

  it('buildings destroyed in combat also leave a ruin; the castle defeats the player', () => {
    const sim = newSim();
    const hq = hqOf(sim, 1);
    kill(sim, hq, null);
    expect([...sim.entities.values()].some((e) => e.kind === 'ruin' && e.type === 'headquarters')).toBe(true);
    expect(sim.players[1].defeated).toBe(true);
    expect(sim.winner).toBe(0);
  });

  it('serfs repair a damaged building for free and extinguish the fire', () => {
    const sim = newSim();
    const b = quickBuild(sim, 'residence');
    b.hp = 200;
    const serfs = serfsOf(sim).slice(0, 3).map((u) => u.id);
    const stock = { ...sim.players[0].stock };
    const ev = sim.step([{ type: 'assignWork', player: 0, units: serfs, target: b.id }]);
    expect(rejectOf(ev)).toBeUndefined();
    expect(sim.entities.get(serfs[0]).job).toMatchObject({ kind: 'repair', target: b.id });
    expect(b.builders.length).toBe(3);
    let t = 0;
    const events = [];
    while (b.hp < 600 && t < 3000) { events.push(...sim.step()); t++; }
    expect(b.hp).toBe(600);
    expect(b.burning).toBe(false);
    expect(b.builders.length).toBe(0);
    expect(events.some((e) => e.type === 'repaired')).toBe(true);
    expect(events.some((e) => e.type === 'buildingExtinguished')).toBe(true);
    expect(sim.players[0].stock).toEqual(stock);
    expect(sim.entities.get(serfs[0]).job).toBe(null);
  });

  it('after a repair serfs look for the next damaged building', () => {
    const sim = newSim();
    const a = quickBuild(sim, 'residence');
    const b = quickBuild(sim, 'farm');
    a.hp = 590; b.hp = 500;
    const u = serfsOf(sim)[0];
    sim.step([{ type: 'assignWork', player: 0, units: [u.id], target: a.id }]);
    let t = 0;
    while (b.hp < 600 && t < 3000) { sim.step(); t++; }
    expect(a.hp).toBe(600);
    expect(b.hp).toBe(600);
  });

  it('undamaged or fully staffed buildings reject repair', () => {
    const sim = newSim();
    sim.step([{ type: 'buySerf', player: 0, count: 2 }]);
    const b = quickBuild(sim, 'residence');
    const serfs = serfsOf(sim).map((u) => u.id);
    expect(rejectOf(sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(0, 1), target: b.id }]))).toBe(REASONS.noRepairNeeded);
    b.hp = 100;
    sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(0, 4), target: b.id }]);
    expect(rejectOf(sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(4, 5), target: b.id }]))).toBe(REASONS.repairFull);
    // foreign buildings cannot be repaired
    const enemy = hqOf(sim, 1);
    enemy.hp = 100;
    expect(rejectOf(sim.step([{ type: 'assignWork', player: 0, units: serfs.slice(5, 6), target: enemy.id }]))).toBe('err.noWork');
  });

  it('fire, repair and ruins are deterministic and survive saving/loading', () => {
    const sim = newSim();
    const a = quickBuild(sim, 'residence');
    const b = quickBuild(sim, 'farm');
    a.hp = 100; b.hp = 5;
    sim.step([{ type: 'assignWork', player: 0, units: serfsOf(sim).slice(0, 2).map((u) => u.id), target: a.id }]);
    sim.run(30);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    sim.run(800); sim2.run(800);
    expect(sim2.hash()).toBe(sim.hash());
    expect([...sim2.entities.values()].filter((e) => e.kind === 'ruin').length).toBe(0); // ruin already gone again
  });
});
