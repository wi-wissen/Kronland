import { describe, it, expect } from 'vitest';
import { newSim, quickBuild, hqOf, runUntil, serfsOf } from './helpers.js';
import { Sim } from '../../src/sim/sim.js';
import { UNITS, fullCost } from '../../src/sim/data/units.js';
import { WATER } from '../../src/sim/map.js';
import { BALANCE } from '../../src/sim/data/balance.js';
import * as api from '../../src/sim/missions/setupApi.js';
import { applyDamage } from '../../src/sim/systems/military.js';

/** Free tile near the map centre with room to the right. */
function openField(sim) {
  const m = sim.map, c = m.width >> 1;
  for (let r = 0; r < 30; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = c + dx, y = c + dy;
    let ok = true;
    for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 8 && ok; i++) if (!m.walkable(x + i, y + j)) ok = false;
    if (ok) return { x, y };
  }
  throw new Error('no field');
}

const alive = (sim, L) => sim.entities.has(L.id);
const groupHp = (sim, L) => (alive(sim, L) ? L.soldiers.length + 1 : 0);

function battle(seed, a, b, ticks = 1500) {
  const sim = newSim(seed);
  const f = openField(sim);
  const A = sim.spawnLeader(0, a, f.x, f.y);
  const B = sim.spawnLeader(1, b, f.x + 5, f.y);
  sim.run(ticks);
  return { sim, A, B };
}

describe('Recruiting', () => {
  it('full unit of short swords in the barracks', () => {
    const sim = newSim();
    sim.players[0].stock.iron = 1000;
    const bar = quickBuild(sim, 'barracks');
    const p = sim.players[0];
    const gold0 = p.stock.gold, iron0 = p.stock.iron, pop0 = sim.popUsed(0);
    const ev = sim.step([{ type: 'recruit', player: 0, building: bar.id, line: 'sword', full: true }]);
    const L = sim.entities.get(ev.find((e) => e.type === 'recruited').leader);
    const cost = fullCost(UNITS.sword1);
    expect(p.stock.gold).toBe(gold0 - cost.gold);
    expect(p.stock.iron).toBe(iron0 - cost.iron);
    expect(L.soldiers.length).toBe(4);
    expect(sim.popUsed(0)).toBe(pop0 + 5);
  });

  it('does not work without a matching building', () => {
    const sim = newSim();
    const bar = quickBuild(sim, 'barracks');
    const ev = sim.step([{ type: 'recruit', player: 0, building: bar.id, line: 'bow' }]);
    expect(ev[0].reason).toBe('err.militaryBuildingNeeded');
  });

  it('re-buying soldiers only near the barracks', () => {
    const sim = newSim();
    sim.players[0].stock.iron = 1000;
    const bar = quickBuild(sim, 'barracks');
    const ev = sim.step([{ type: 'recruit', player: 0, building: bar.id, line: 'sword' }]);
    const L = sim.entities.get(ev.find((e) => e.type === 'recruited').leader);
    expect(L.soldiers.length).toBe(0);
    sim.step([{ type: 'buySoldiers', player: 0, leader: L.id }]);
    expect(L.soldiers.length).toBe(4);
    const L2 = sim.spawnLeader(0, 'sword1', 5, 5, 0);
    const r = sim.step([{ type: 'buySoldiers', player: 0, leader: L2.id }]);
    expect(r[0]).toMatchObject({ reason: 'err.leaderNotNear', params: { building: 'barracks' } });
  });

  it('level 2 sword needs a smithy and upgrades existing troops', () => {
    const sim = newSim();
    sim.players[0].stock.iron = 2000;
    quickBuild(sim, 'barracks');
    const L = sim.spawnLeader(0, 'sword1', 10, 10, 2);
    let ev = sim.step([{ type: 'upgradeLine', player: 0, line: 'sword' }]);
    expect(ev[0]).toMatchObject({ reason: 'err.buildingNeeded', params: { building: 'smithy' } });
    quickBuild(sim, 'smithy');
    sim.step([{ type: 'upgradeLine', player: 0, line: 'sword' }]);
    expect(sim.players[0].unitTier.sword).toBe(2);
    expect(L.def).toBe('sword2');
  });
});

describe('Combat', () => {
  it('swordsmen beat archers in melee', () => {
    const { sim, A, B } = battle(42, 'sword1', 'bow1');
    expect(alive(sim, B)).toBe(false);
    expect(groupHp(sim, A)).toBeGreaterThan(0);
  });

  it('swordsmen beat spearmen', () => {
    const { sim, A, B } = battle(42, 'sword1', 'spear1');
    expect(alive(sim, B)).toBe(false);
    expect(alive(sim, A)).toBe(true);
  });

  it('heavy cavalry beats swordsmen', () => {
    const { sim, A, B } = battle(42, 'heavyCav1', 'sword1');
    expect(alive(sim, B)).toBe(false);
    expect(alive(sim, A)).toBe(true);
  });

  it('the captain stays invulnerable while soldiers live', () => {
    const sim = newSim();
    const f = openField(sim);
    const A = sim.spawnLeader(0, 'sword1', f.x, f.y);
    const B = sim.spawnLeader(1, 'sword4', f.x + 2, f.y, 8);
    for (let i = 0; i < 400 && A.soldiers.length; i++) {
      sim.step();
      if (A.soldiers.length) expect(A.hp).toBe(UNITS.sword1.hp);
    }
    expect(B).toBeTruthy();
  });

  it('ballista tower shoots enemies in range', () => {
    const sim = newSim();
    sim.players[0].techs.add('construction');
    const tower = quickBuild(sim, 'tower');
    tower.level = 1;
    const L = sim.spawnLeader(1, 'spear1', tower.x + 4, tower.y + 1, 0);
    L.order = { type: 'hold' };
    let shots = 0;
    for (let i = 0; i < 200; i++) shots += sim.step().filter((e) => e.type === 'shot' && e.owner === 0).length;
    expect(shots).toBeGreaterThan(0);
    expect(alive(sim, L)).toBe(false);
  });

  it('ranged units shoot a building across the water from the shore, melee units cannot get there', () => {
    const sim = newSim(4);
    const f = openField(sim);
    const t = sim.createBuilding(1, 'residence', f.x + 12, f.y - 1, true);
    const c = api.centerOf(t);
    expect(api.moat(sim, c, f, { inner: 3, width: 2 })).not.toBeNull();
    const hp0 = t.hp;
    const bows = sim.spawnLeader(0, 'bow1', f.x, f.y);
    const swords = sim.spawnLeader(0, 'sword1', f.x, f.y + 2);
    sim.step([{ type: 'order', player: 0, units: [bows.id, swords.id], order: 'attack', target: t.id }]);
    sim.run(900);
    expect(t.hp).toBeLessThan(hp0);
    // the shooters stand at the shore, nobody in the water
    for (const id of [bows.id, ...bows.soldiers]) {
      const e = sim.entities.get(id);
      if (e) expect(sim.map.flags[sim.map.idx(Math.floor(e.px / 1000), Math.floor(e.py / 1000))] & WATER).toBe(0);
    }
  });

  it('castle destroyed: player is eliminated, the other wins', () => {
    const sim = newSim();
    const hq1 = hqOf(sim, 1);
    hq1.hp = 30;
    // remove defenders: foot troops do hardly any damage to buildings (as in the original)
    for (const e of [...sim.entities.values()]) if (e.owner === 1 && (e.kind === 'hero' || e.kind === 'unit')) sim.entities.delete(e.id);
    const L = sim.spawnLeader(0, 'sword1', hq1.x - 2, hq1.y + 1, 0);
    sim.step([{ type: 'order', player: 0, units: [L.id], order: 'attack', target: hq1.id }]);
    const t = runUntil(sim, (s) => s.winner !== null, 2000);
    expect(t).toBeGreaterThan(0);
    expect(sim.players[1].defeated).toBe(true);
    expect(sim.winner).toBe(0);
    expect(serfsOf(sim, 1).length).toBe(0);
  });

  it('pay costs thalers per captain on payday', () => {
    const sim = newSim();
    sim.spawnLeader(0, 'sword1', 10, 10, 0);
    sim.spawnLeader(0, 'sword1', 12, 10, 0);
    let ev = [];
    runUntil(sim, (s) => (ev = s.events.filter((e) => e.type === 'payday' && e.player === 0)).length > 0, 1300);
    expect(ev[0].wages).toBe(2 * BALANCE.wagePerLeader);
  });
});

describe('Heroes', () => {
  const heroOf = (sim, p) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === p);

  it('every player starts with a hero', () => {
    const sim = newSim();
    expect(heroOf(sim, 0)?.hero).toBe('nelia');
    expect(heroOf(sim, 1)?.hero).toBe('orrin');
  });

  it('defeated heroes fall unconscious and get up again after 10 s', () => {
    const sim = newSim();
    const h = heroOf(sim, 0);
    h.hp = 1;
    const f = openField(sim);
    h.px = f.x * 1000 + 500; h.py = f.y * 1000 + 500;
    h.anchor = { x: h.px, y: h.py };
    const L = sim.spawnLeader(1, 'sword1', f.x + 1, f.y, 0);
    runUntil(sim, () => h.down, 300);
    expect(h.down).toBe(true);
    expect(sim.entities.has(h.id)).toBe(true);
    sim.entities.delete(L.id);
    sim.run(105);
    expect(h.down).toBe(false);
    expect(h.hp).toBe(300);
  });

  it('shield bash hits enemies in the vicinity, then cooldown', () => {
    const sim = new Sim({ seed: 42, heroes: ['taran', 'orrin'] });
    const h = heroOf(sim, 0);
    const f = openField(sim);
    h.px = f.x * 1000 + 500; h.py = f.y * 1000 + 500;
    const L = sim.spawnLeader(1, 'sword1', f.x + 1, f.y, 4);
    const hp0 = L.soldiers.map((id) => sim.entities.get(id).hp);
    sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'shieldBash' }]);
    const hits = L.soldiers.filter((id, i) => sim.entities.get(id).hp < hp0[i]).length;
    expect(hits).toBeGreaterThan(0);
    const ev = sim.step([{ type: 'ability', player: 0, hero: h.id, ability: 'shieldBash' }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.notReady');
  });

  it('healing salve restores hit points of own troops', () => {
    const sim = newSim();
    const h = heroOf(sim, 1);
    const L = sim.spawnLeader(1, 'sword1', Math.floor(h.px / 1000) + 1, Math.floor(h.py / 1000), 0);
    L.hp = 50;
    sim.step([{ type: 'ability', player: 1, hero: h.id, ability: 'salve' }]);
    expect(L.hp).toBe(UNITS.sword1.hp);
  });
});

describe('Militia and weather', () => {
  it('serfs become militia and workers again', () => {
    const sim = newSim();
    sim.step([{ type: 'militia', player: 0, on: true }]);
    expect(serfsOf(sim).every((u) => u.militia)).toBe(true);
    sim.step([{ type: 'militia', player: 0, on: false }]);
    expect(serfsOf(sim).every((u) => !u.militia)).toBe(true);
  });

  it('"To arms" only for the selected serfs', () => {
    const sim = newSim();
    const [a, b] = serfsOf(sim);
    sim.step([{ type: 'militia', player: 0, on: true, units: [a.id] }]);
    expect(a.militia).toBe(true);
    expect(b.militia).toBeFalsy();
    sim.step([{ type: 'militia', player: 0, on: false, units: [a.id] }]);
    expect(a.militia).toBe(false);
  });

  it('serfs attack an opponent like a tree (work order), strike and do not flee while doing so', () => {
    const sim = newSim();
    const [a, b] = serfsOf(sim);
    const foe = [...sim.entities.values()].find((e) => e.kind === 'unit' && e.owner === 1);
    // place the opponent next to the own serfs so that the way is short
    foe.px = a.px + 3000; foe.py = a.py; foe.job = null; foe.path = []; foe.goal = undefined;
    const hp0 = foe.hp;
    sim.step([{ type: 'assignWork', player: 0, units: [a.id, b.id], target: foe.id }]);
    expect(a.job).toEqual({ kind: 'fight', target: foe.id });
    sim.run(60);
    expect(sim.entities.has(foe.id) ? foe.hp : 0).toBeLessThan(hp0);
    expect(a.fleeUntil).toBeUndefined();
    // own or non-hostile figures are no target
    expect(sim.step([{ type: 'assignWork', player: 0, units: [a.id], target: b.id }]).some((e) => e.type === 'rejected')).toBe(true);
    sim.setDiplomacy(0, 1, 'neutral');
    if (sim.entities.has(foe.id)) expect(sim.step([{ type: 'assignWork', player: 0, units: [a.id], target: foe.id }]).some((e) => e.type === 'rejected')).toBe(true);
  });

  it('attacked serfs flee and work again afterwards; militia does not flee', () => {
    const sim = newSim();
    const u = serfsOf(sim)[0];
    const hq = hqOf(sim, 0);
    // far from the castle, attacker between castle and serf → away from the attacker
    const foe = sim.spawnLeader(1, 'sword1', Math.floor(u.px / 1000) + 1, Math.floor(u.py / 1000), 0);
    const job = u.job;
    const d0 = Math.hypot(u.px - foe.px, u.py - foe.py);
    applyDamage(sim, u, 5, foe);
    expect(u.fleeUntil).toBe(sim.tick + BALANCE.serf.fleeTicks);
    foe.order = { type: 'hold' }; foe.hp = 1e6;
    sim.entities.delete(foe.id);
    sim.run(30);
    expect(Math.hypot(u.px - foe.px, u.py - foe.py)).toBeGreaterThan(d0 + 2000);
    sim.run(BALANCE.serf.fleeTicks);
    expect(u.fleeUntil).toBeUndefined();
    expect(u.job).toBe(job);
    expect(hq).toBeTruthy();
    // militia fights back instead of fleeing
    const m = serfsOf(sim)[1];
    sim.step([{ type: 'militia', player: 0, on: true, units: [m.id] }]);
    applyDamage(sim, m, 5, foe);
    expect(m.fleeUntil).toBeUndefined();
  });

  it('in winter water freezes, on thaw whoever stands on it drowns', () => {
    const sim = new (newSim().constructor)({ seed: 42, weatherCycle: [['summer', 10], ['winter', 10]] });
    const m = sim.map;
    let w = -1;
    for (let k = 0; k < m.flags.length; k++) if (m.flags[k] & WATER) { w = k; break; }
    sim.run(11);
    expect(sim.weather.state).toBe('winter');
    expect(m.walkable(w % m.width, (w / m.width) | 0)).toBe(true);
    const L = sim.spawnLeader(0, 'sword1', w % m.width, (w / m.width) | 0, 0);
    L.order = { type: 'hold' };
    sim.run(10);
    expect(sim.weather.state).toBe('summer');
    expect(sim.entities.has(L.id)).toBe(false);
  });
});

describe('Troop balance (scripts/troop-duels.js)', () => {
  it('roles as in the model: who wins stays the same with own numbers', async () => {
    const { duel } = await import('../../scripts/troop-duels.js');
    const winners = [
      ['sword1', 'spear1', true], ['sword1', 'bow1', true], ['spear1', 'lightCav1', true],
      ['spear3', 'heavyCav1', true], ['bow3', 'heavyCav1', true], ['sword4', 'heavyCav2', false],
      ['sword4', 'sword3', true], ['cannon1', 'sword1', false],
    ];
    for (const [a, b, aWins] of winners) expect(duel(a, b, 2).winA, `${a} gegen ${b}`).toBe(aWins ? 100 : 0);
  }, 60000);
});
