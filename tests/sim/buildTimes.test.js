import { describe, it, expect } from 'vitest';
import { newSim, quickBuild, runUntil, serfsOf } from './helpers.js';
import { BUILDINGS, buildersOf, isUpgrading } from '../../src/sim/data/buildings.js';
import { siteRoom } from '../../src/sim/systems/serfs.js';

// Original values (config/entities/PB_*.xml, github.com/mcb5637/s5HEmodification):
// [build time with one serf, upgrade times …], BuilderSlot count
const ORIGINAL = {
  headquarters: [[0, 90, 120], 8], villageCenter: [[110, 40, 40], 6], residence: [[80, 40, 50], 4], farm: [[80, 40, 50], 4],
  university: [[90, 50], 6], clayMine: [[80, 40, 50], 4], stoneMine: [[80, 40, 50], 4], ironMine: [[80, 40, 50], 4],
  sulfurMine: [[110, 40, 50], 4], brickworks: [[110, 40], 4], sawmill: [[110, 40], 6], stonemason: [[80, 40], 4],
  smithy: [[110, 40], 4], alchemist: [[80, 40], 4], bank: [[130, 40], 8], chapel: [[140, 60, 90], 8], storehouse: [[80, 40], 4],
  barracks: [[90, 40], 6], archery: [[90, 40], 6], stable: [[120, 40], 8], foundry: [[110, 40], 6], tower: [[80, 15, 15], 4],
  weatherTower: [[40], 4], weatherPlant: [[40], 4], bridge: [[80], 4], windwheel: [[20], 1], statue: [[30], 1],
};

describe('Build times and builder spots (original)', () => {
  it('times and builder spots match the original XMLs', () => {
    for (const [type, [times, builders]] of Object.entries(ORIGINAL)) {
      expect(BUILDINGS[type].levels.map((l) => l.buildTime), type).toEqual(times);
      expect(buildersOf(type), type).toBe(builders);
    }
  });

  it('every building has 1, 4, 6 or 8 builder spots', () => {
    for (const [type, d] of Object.entries(BUILDINGS)) expect([1, 4, 6, 8], type).toContain(d.builders);
  });

  it('construction work = build time in ticks with one serf', () => {
    const sim = newSim();
    const b = sim.createBuilding(0, 'villageCenter', 5, 5, false);
    expect(b.work).toBe(BUILDINGS.villageCenter.levels[0].buildTime * 10);
  });

  it('siteRoom respects the builder spots of the type', () => {
    const sim = newSim();
    const [u] = serfsOf(sim);
    const hq = sim.findBuilding(0, 'headquarters');
    sim.players[0].techs.add('education');
    const pos = sim.findPlacement(0, 'chapel', hq.x + 2, hq.y + 2, 30);
    const chapel = sim.createBuilding(0, 'chapel', pos.x, pos.y, false);
    expect(siteRoom(sim, chapel, u)).toBe(8);
  });
});

describe('Upgrade without serfs', () => {
  const upgraded = () => {
    const sim = newSim();
    const home = quickBuild(sim, 'residence');
    sim.players[0].techs.add('construction');
    sim.step([{ type: 'upgradeBuilding', player: 0, building: home.id, units: serfsOf(sim).map((u) => u.id) }]);
    return { sim, home };
  };

  it('serfs passed with the command are not dispatched', () => {
    const { sim, home } = upgraded();
    expect(isUpgrading(home)).toBe(true);
    expect(home.builders).toEqual([]);
    expect(serfsOf(sim).every((u) => !u.job)).toBe(true);
  });

  it('assigning serfs to an upgrade is rejected', () => {
    const { sim, home } = upgraded();
    const ev = sim.step([{ type: 'assignWork', player: 0, units: serfsOf(sim).map((u) => u.id), target: home.id }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.upgradeNoSerfs');
    expect(home.builders).toEqual([]);
    const [u] = serfsOf(sim);
    expect(siteRoom(sim, home, u)).toBe(0);
  });

  it('progress and hit points rise every tick, done event with the new level', () => {
    const { sim, home } = upgraded();
    const p0 = home.progress;
    sim.run(10);
    expect(home.progress).toBe(p0 + 10);
    let done = null;
    runUntil(sim, (s) => { done = s.events.find((e) => e.type === 'buildingDone' && e.building === home.id) ?? done; return home.done; }, 1000);
    expect(done).toMatchObject({ level: 1, buildingType: 'residence' });
    expect(home.hp).toBe(BUILDINGS.residence.levels[1].hp);
  });

  it('serfs repairing the building are released when the upgrade starts', () => {
    const sim = newSim();
    const home = quickBuild(sim, 'residence');
    sim.players[0].techs.add('construction');
    home.hp = 100;
    const units = serfsOf(sim).slice(0, 2).map((u) => u.id);
    sim.step([{ type: 'assignWork', player: 0, units, target: home.id }]);
    expect(home.builders.length).toBe(2);
    sim.step([{ type: 'upgradeBuilding', player: 0, building: home.id }]);
    expect(home.builders).toEqual([]);
    expect(units.every((id) => !sim.entities.get(id).job)).toBe(true);
  });

  it('tower upgrades take 15 s', () => {
    const sim = newSim();
    const tw = quickBuild(sim, 'tower');
    sim.players[0].techs.add('gears');
    sim.players[0].stock.iron += 1000; sim.players[0].stock.stone += 1000;
    sim.step([{ type: 'upgradeBuilding', player: 0, building: tw.id }]);
    expect(tw.level).toBe(1);
    expect(runUntil(sim, () => tw.done, 500) + 1).toBe(150);
  });
});
