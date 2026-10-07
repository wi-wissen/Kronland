import { describe, it, expect } from 'vitest';
import { newSim, hqOf } from './helpers.js';
import { EXPERIENCE as XP, starsOf } from '../../src/sim/data/experience.js';
import { combatStats } from '../../src/sim/systems/military.js';
import { UNITS } from '../../src/sim/data/units.js';

describe('Experience of captains', () => {
  it('stars by thresholds', () => {
    expect(starsOf(undefined)).toBe(0);
    expect(starsOf(XP.thresholds[0] - 1)).toBe(0);
    expect(starsOf(XP.thresholds[0])).toBe(1);
    expect(starsOf(XP.thresholds[4])).toBe(5);
    expect(starsOf(99999)).toBe(5);
  });

  it('hits of the squad give the captain experience and promotions', () => {
    const sim = newSim(7);
    const hq = hqOf(sim);
    const a = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8);
    // target dummy with lots of HP
    const dummy = sim.spawnLeader(1, 'sword4', hq.x + 10, hq.y + 8, 0);
    dummy.hp = 1e6; dummy.order = { type: 'hold' };
    sim.command({ type: 'order', player: 0, units: [a.id], order: 'attack', target: dummy.id });
    const promos = [];
    for (let i = 0; i < 2000; i++) for (const e of sim.step()) if (e.type === 'promoted') promos.push(e);
    expect(a.xp).toBeGreaterThan(XP.thresholds[1]);
    expect(promos[0]).toMatchObject({ player: 0, leader: a.id, stars: 1 });
    expect(starsOf(a.xp)).toBeGreaterThanOrEqual(2);
  });

  it('effects per level: ranged range/vision, attack, armour, critical hits', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const bow = sim.spawnLeader(0, 'bow1', hq.x + 8, hq.y + 8, 0);
    const sw = sim.spawnLeader(0, 'sword1', hq.x + 9, hq.y + 8, 0);
    const b0 = combatStats(sim, bow), s0 = combatStats(sim, sw);
    expect(b0.crit).toBe(0);
    bow.xp = XP.thresholds[0]; sw.xp = XP.thresholds[0];
    expect(combatStats(sim, bow).crit).toBe(XP.critPercent);
    bow.xp = XP.thresholds[1]; sw.xp = XP.thresholds[1];
    expect(combatStats(sim, bow).range).toBe(b0.range + XP.rangeBonus);
    expect(combatStats(sim, bow).sight).toBe(b0.sight + XP.sightBonus);
    expect(combatStats(sim, sw).range).toBe(s0.range); // melee fighters not
    bow.xp = XP.thresholds[3]; sw.xp = XP.thresholds[3];
    expect(combatStats(sim, sw).attack).toBe(s0.attack + XP.attackBonus);
    bow.xp = XP.thresholds[4]; sw.xp = XP.thresholds[4];
    expect(combatStats(sim, bow).attack).toBe(b0.attack + XP.attackBonus + XP.rangedAttackBonus);
    expect(combatStats(sim, sw).armor).toBe(s0.armor + XP.meleeArmorBonus);
  });

  it('soldiers adopt the values of their captain', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const L = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8, 2);
    const s = sim.entities.get(L.soldiers[0]);
    const before = combatStats(sim, s).attack;
    L.xp = XP.thresholds[3];
    expect(combatStats(sim, s).attack).toBe(before + XP.attackBonus);
  });

  it('from 3 stars the squad regenerates', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const L = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8, 1);
    const s = sim.entities.get(L.soldiers[0]);
    s.hp = 50; L.hp = 100;
    sim.run(100);
    expect(s.hp).toBe(50);
    L.xp = XP.thresholds[2];
    sim.run(100);
    expect(s.hp).toBe(50 + 5 * XP.regenHp);
    expect(L.hp).toBe(100 + 5 * XP.regenHp);
    sim.run(100000);
    expect(L.hp).toBe(UNITS.sword1.hp);
  }, 180_000); // 100 000 ticks

  it('experience flows into the state hash', () => {
    const sim = newSim();
    const hq = hqOf(sim);
    const L = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8, 0);
    const h = sim.hash();
    L.xp = 3;
    expect(sim.hash()).not.toBe(h);
  });
});
