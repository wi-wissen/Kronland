import { describe, it, expect } from 'vitest';
import { newSim, quickBuild, workersOfPlayer, runUntil, serfsOf } from './helpers.js';
import { WORKER } from '../../src/sim/data/professions.js';
import { BUILDINGS } from '../../src/sim/data/buildings.js';
import { BALANCE } from '../../src/sim/data/balance.js';

describe('Workers move in', () => {
  it('a stonemason comes from the village centre as soon as the workshop is built', () => {
    const sim = newSim();
    const b = quickBuild(sim, 'stonemason');
    runUntil(sim, () => b.workers.length === 3, 400);
    const ws = workersOfPlayer(sim);
    expect(ws.length).toBe(3);
    expect(ws.every((w) => w.prof === 'mason' && w.workplace === b.id)).toBe(true);
  });

  it('without free workplaces nobody comes', () => {
    const sim = newSim();
    sim.run(300);
    expect(workersOfPlayer(sim).length).toBe(0);
  });

  it('the population limit also applies to workers', () => {
    const sim = newSim();
    sim.players[0].stock.gold = 100000;
    sim.step([{ type: 'buySerf', player: 0, count: 74 }]);
    expect(sim.popUsed(0)).toBe(75);
    quickBuild(sim, 'farm');
    sim.run(200);
    expect(workersOfPlayer(sim).length).toBe(0);
  });

  it('workers get a bed and dining place up to capacity', () => {
    const sim = newSim();
    const home = quickBuild(sim, 'residence');
    const farm = quickBuild(sim, 'farm');
    quickBuild(sim, 'stonemason'); quickBuild(sim, 'stonemason'); quickBuild(sim, 'stonemason');
    sim.run(600);
    expect(home.residents.length).toBe(BUILDINGS.residence.levels[0].beds);
    expect(farm.eaters.length).toBe(BUILDINGS.farm.levels[0].seats);
  });
});

describe('Production', () => {
  it('miners extract raw material at the mine', () => {
    const sim = newSim();
    const mine = quickBuild(sim, 'stoneMine');
    expect(mine.type).toBe('stoneMine');
    sim.run(1200);
    expect(sim.players[0].raw.stone).toBeGreaterThan(50);
  });

  it('refiners fetch raw material and make more refined goods from it', () => {
    const sim = newSim();
    const p = sim.players[0];
    p.raw.stone = 40;
    const stock0 = p.stock.stone;
    quickBuild(sim, 'stonemason');
    sim.run(1500);
    const used = 40 - p.raw.stone;
    expect(used).toBeGreaterThan(5);
    expect(p.stock.stone - stock0).toBeGreaterThan(used); // refining multiplies
  });

  it('refiners wait without raw material', () => {
    const sim = newSim();
    const p = sim.players[0];
    const stock0 = p.stock.clay;
    quickBuild(sim, 'brickworks');
    sim.run(800);
    expect(p.stock.clay).toBe(stock0);
  });

  it('with house and farm clearly more is produced than at the campfire', () => {
    const run = (withHousing) => {
      const sim = newSim();
      if (withHousing) { quickBuild(sim, 'residence'); quickBuild(sim, 'farm'); }
      quickBuild(sim, 'bank');
      const gold0 = sim.players[0].stock.gold;
      sim.run(6000);
      return sim.players[0].stock.gold - gold0;
    };
    const housed = run(true), camping = run(false);
    expect(camping).toBeGreaterThan(0);
    expect(housed).toBeGreaterThan(camping * 2);
  });

  it('overtime increases output but costs motivation', () => {
    const run = (on) => {
      const sim = newSim();
      quickBuild(sim, 'residence'); quickBuild(sim, 'farm');
      const bank = quickBuild(sim, 'bank');
      sim.step([{ type: 'setOvertime', player: 0, building: bank.id, on }]);
      const gold0 = sim.players[0].stock.gold;
      sim.run(2000);
      const mot = workersOfPlayer(sim).reduce((s, w) => s + w.motivation, 0) / workersOfPlayer(sim).length;
      return { gold: sim.players[0].stock.gold - gold0, mot };
    };
    const normal = run(false), over = run(true);
    expect(over.gold).toBeGreaterThan(normal.gold);
    expect(over.mot).toBeLessThan(normal.mot);
  });
});

describe('Taxes and motivation', () => {
  const setup = () => {
    const sim = newSim();
    sim.players[0].techs.add('education');
    quickBuild(sim, 'farm'); quickBuild(sim, 'farm');
    sim.run(300);
    return sim;
  };

  it('normal tax: 5 thalers per worker, motivation stays', () => {
    const sim = setup();
    const n = workersOfPlayer(sim).length;
    expect(n).toBe(2);
    let ev = [];
    runUntil(sim, (s) => (ev = s.events.filter((e) => e.type === 'payday' && e.player === 0)).length > 0, 1300);
    expect(ev[0].income).toBe(n * BALANCE.tax.perWorker);
    expect(workersOfPlayer(sim).every((w) => w.motivation === 100)).toBe(true);
  });

  it('very high tax brings double and lowers motivation', () => {
    const sim = setup();
    sim.step([{ type: 'setTax', player: 0, level: 4 }]);
    let ev = [];
    runUntil(sim, (s) => (ev = s.events.filter((e) => e.type === 'payday' && e.player === 0)).length > 0, 1300);
    expect(ev[0].income).toBe(2 * 2 * BALANCE.tax.perWorker);
    expect(workersOfPlayer(sim).every((w) => w.motivation === 100 + BALANCE.tax.motivation[4])).toBe(true);
  });

  it('no tax raises motivation, capped by the maximum', () => {
    const sim = setup();
    sim.step([{ type: 'setTax', player: 0, level: 0 }]);
    sim.run(1200 * 10);
    expect(workersOfPlayer(sim).every((w) => w.motivation === WORKER.baseMaxMotivation)).toBe(true);
  });

  it('with too low motivation workers leave', () => {
    const sim = setup();
    for (const w of workersOfPlayer(sim)) w.motivation = 30;
    sim.step([{ type: 'setTax', player: 0, level: 4 }]);
    let left = 0;
    for (let i = 0; i < 1300; i++) left += sim.step().filter((e) => e.type === 'workerLeft').length;
    expect(left).toBeGreaterThan(0);
  });

  it('under 30 % average no new settlers arrive', () => {
    const sim = setup();
    for (const w of workersOfPlayer(sim)) w.motivation = 28;
    quickBuild(sim, 'farm');
    sim.run(200);
    expect(workersOfPlayer(sim).length).toBe(2);
  });

  it('decorative buildings raise maximum and current motivation', () => {
    const sim = setup();
    quickBuild(sim, 'clock');
    const before = workersOfPlayer(sim)[0].motivation;
    sim.onBuildingDone([...sim.entities.values()].find((e) => e.type === 'clock'));
    expect(workersOfPlayer(sim)[0].motivation).toBe(before + BUILDINGS.clock.motivationEffect);
  });

  it('blessing costs faith and raises the motivation of the group', () => {
    const sim = setup();
    sim.players[0].techs.add('education');
    const chapel = quickBuild(sim, 'chapel');
    sim.players[0].faith = WORKER.blessingFaith;
    for (const w of workersOfPlayer(sim)) w.motivation = 80;
    sim.step([{ type: 'bless', player: 0, building: chapel.id, blessing: 'bell' }]);
    const farmers = workersOfPlayer(sim).filter((w) => w.prof === 'farmer');
    expect(farmers.every((w) => w.motivation === 80 + WORKER.blessingMotivation)).toBe(true);
    expect(sim.players[0].faith).toBe(0);
    const ev = sim.step([{ type: 'bless', player: 0, building: chapel.id, blessing: 'bell' }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.notEnoughFaith');
  });
});

describe('Research and upgrade', () => {
  it('education is researched by scholars and unlocks taxes', () => {
    const sim = newSim();
    quickBuild(sim, 'residence'); quickBuild(sim, 'farm');
    const uni = quickBuild(sim, 'university');
    sim.step([{ type: 'research', player: 0, building: uni.id, tech: 'education' }]);
    expect(uni.research?.tech).toBe('education');
    const t = runUntil(sim, (s) => s.players[0].techs.has('education'), 3000);
    expect(t).toBeGreaterThan(200);
    sim.step([{ type: 'setTax', player: 0, level: 3 }]);
    expect(sim.players[0].taxLevel).toBe(3);
  });

  it('level 2 needs predecessor and fortress', () => {
    const sim = newSim();
    const uni = quickBuild(sim, 'university');
    const reason = (tech) => sim.step([{ type: 'research', player: 0, building: uni.id, tech }]).find((e) => e.type === 'rejected')?.reason;
    expect(reason('trade')).toBe('err.techFirst');
    sim.players[0].techs.add('education');
    expect(reason('trade')).toBe('err.fortressFirst');
  });

  it('house upgrade needs construction and serfs', () => {
    const sim = newSim();
    const home = quickBuild(sim, 'residence');
    let ev = sim.step([{ type: 'upgradeBuilding', player: 0, building: home.id }]);
    expect(ev.find((e) => e.type === 'rejected')).toMatchObject({ reason: 'err.techFirst', params: { tech: 'construction' } });
    sim.players[0].techs.add('construction');
    const units = serfsOf(sim).map((u) => u.id);
    sim.step([{ type: 'upgradeBuilding', player: 0, building: home.id, units }]);
    expect(home.level).toBe(1);
    expect(home.done).toBe(false);
    runUntil(sim, () => home.done, 3000);
    expect(home.done).toBe(true);
    expect(BUILDINGS.residence.levels[home.level].beds).toBe(9);
  });

  it('demolition refunds half and sends the workers away', () => {
    const sim = newSim();
    const b = quickBuild(sim, 'stonemason');
    runUntil(sim, () => b.workers.length === 3, 400);
    const wood0 = sim.players[0].stock.wood;
    sim.step([{ type: 'demolish', player: 0, building: b.id }]);
    expect(sim.entities.has(b.id)).toBe(false);
    expect(workersOfPlayer(sim).length).toBe(0);
    expect(sim.players[0].stock.wood).toBe(wood0 + BUILDINGS.stonemason.levels[0].cost.wood / 2);
  });
});
