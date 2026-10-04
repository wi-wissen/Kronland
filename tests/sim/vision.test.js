import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { MissionRuntime } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { VISION, buildingSight } from '../../src/sim/data/vision.js';
import { COMBAT } from '../../src/sim/data/combat.js';
import { UNITS } from '../../src/sim/data/units.js';
import {
  canSee, effectiveSight, isExplored, isVisible, knownBuildings, revealArea, updateVision, visionOf,
} from '../../src/sim/systems/vision.js';
import { combatStats } from '../../src/sim/systems/military.js';
import { UNIT } from '../../src/sim/fixed.js';
import { hqOf, serfsOf } from './helpers.js';

const sum = (a) => a.reduce((s, x) => s + x, 0);
const center = (b) => ({ x: b.x + (b.w >> 1), y: b.y + (b.h >> 1) });

/** Remove all own figures except the castle (clean vision sources for tests). */
function clearUnits(sim, owner) {
  for (const e of [...sim.entities.values()]) if (e.owner === owner && e.px !== undefined) sim.entities.delete(e.id);
}

describe('Vision ranges', () => {
  it('values per kind: serfs, workers, troops, heroes, buildings, construction sites', () => {
    const sim = new Sim({ seed: 3 });
    const serf = serfsOf(sim, 0)[0];
    expect(effectiveSight(sim, serf)).toBe(VISION.units.serf);
    const hero = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
    expect(effectiveSight(sim, hero)).toBe(VISION.units.hero);
    const hq = hqOf(sim, 0);
    expect(effectiveSight(sim, hq)).toBe(buildingSight('headquarters', 0, true) + 2);
    expect(buildingSight('tower', 2, true)).toBeGreaterThan(buildingSight('tower', 0, true));
    expect(buildingSight('residence', 0, false)).toBe(VISION.site);
    expect(buildingSight('weatherTower', 0, true)).toBeGreaterThan(buildingSight('headquarters', 0, true));
    const L = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y, 4);
    expect(effectiveSight(sim, L)).toBe(COMBAT.sight + VISION.fighterExtra.sword);
    const B = sim.spawnLeader(0, 'bow1', hq.x + 8, hq.y + 3, 4);
    expect(effectiveSight(sim, B)).toBe(COMBAT.sight + VISION.fighterExtra.bow);
  });

  it('tracking and sergeant star increase the vision of the troops', () => {
    const sim = new Sim({ seed: 3 });
    const hq = hqOf(sim, 0);
    const B = sim.spawnLeader(0, 'bow1', hq.x + 8, hq.y, 4);
    const base = effectiveSight(sim, B);
    sim.players[0].techs.add('tracking');
    expect(effectiveSight(sim, B)).toBe(base + 2);
    B.xp = 40; // 2 stars
    expect(effectiveSight(sim, B)).toBe(base + 4);
  });

  it('rain and winter shorten vision, but fighters never see less far than they attack', () => {
    const sim = new Sim({ seed: 3 });
    const hq = hqOf(sim, 0);
    const serf = serfsOf(sim, 0)[0];
    const L = sim.spawnLeader(0, 'spear1', hq.x + 8, hq.y, 4);
    const summer = effectiveSight(sim, serf);
    sim.setWeather('rain', 600);
    expect(effectiveSight(sim, serf)).toBe(summer - VISION.weather.rain);
    expect(effectiveSight(sim, L)).toBeGreaterThanOrEqual(combatStats(sim, L).sight);
    sim.setWeather('winter', 600);
    expect(effectiveSight(sim, serf)).toBe(summer - VISION.weather.winter);
    // For all troop types: vision in the worst weather ≥ attack radius
    const worst = Math.max(...Object.values(VISION.weather));
    for (const d of Object.values(UNITS)) expect(VISION.fighterExtra[d.line], d.id).toBeGreaterThanOrEqual(worst);
  });

  it('rain reduces the visible area', () => {
    const sim = new Sim({ seed: 5 });
    for (const e of [...sim.entities.values()]) if (e.owner === 0 && e.kind === 'building' && e.type !== 'headquarters') sim.removeEntity(e);
    clearUnits(sim, 0);
    updateVision(sim, true);
    const dry = sum(visionOf(sim, 0).visible);
    sim.setWeather('rain', 600);
    updateVision(sim, true);
    const wet = sum(visionOf(sim, 0).visible);
    expect(wet).toBeLessThan(dry);
    expect(wet).toBeGreaterThan(0);
  });
});

describe('Exploration', () => {
  it('start region is explored, the enemy castle is not', () => {
    const sim = new Sim({ seed: 1 });
    const mine = center(hqOf(sim, 0)), theirs = center(hqOf(sim, 1));
    expect(isVisible(sim, 0, mine.x, mine.y)).toBe(true);
    expect(isExplored(sim, 0, mine.x + VISION.startReveal - 1, mine.y)).toBe(true);
    expect(isExplored(sim, 0, theirs.x, theirs.y)).toBe(false);
    expect(canSee(sim, 0, hqOf(sim, 1))).toBe(false);
    expect(canSee(sim, 0, hqOf(sim, 0))).toBe(true);
    // at most a quarter of the map is known at the start
    expect(sum(visionOf(sim, 0).explored)).toBeLessThan(sim.map.width * sim.map.height / 4);
  });

  it('explored tiles stay explored, vision and foreign figures disappear', () => {
    const sim = new Sim({ seed: 1 });
    const hq = hqOf(sim, 0);
    const mid = { x: sim.map.width >> 1, y: sim.map.height >> 1 };
    expect(isExplored(sim, 0, mid.x, mid.y)).toBe(false);
    const L = sim.spawnLeader(0, 'sword1', mid.x, mid.y, 0);
    const foe = sim.spawnLeader(1, 'sword1', mid.x + 3, mid.y, 0);
    foe.order = { type: 'hold' }; L.order = { type: 'hold' };
    updateVision(sim, true);
    expect(isVisible(sim, 0, mid.x, mid.y)).toBe(true);
    expect(canSee(sim, 0, foe)).toBe(true);
    sim.entities.delete(L.id);
    sim.run(VISION.updateTicks);
    expect(isExplored(sim, 0, mid.x, mid.y)).toBe(true);
    expect(isVisible(sim, 0, mid.x, mid.y)).toBe(false);
    expect(canSee(sim, 0, foe)).toBe(false);
    expect(isVisible(sim, 0, center(hq).x, center(hq).y)).toBe(true);
  });

  it('allies share vision and exploration', () => {
    const sim = new Sim({ seed: 9, players: 3, teams: [0, 0, 1] });
    const ally = hqOf(sim, 1), foe = hqOf(sim, 2);
    expect(canSee(sim, 0, ally)).toBe(true);
    expect(isVisible(sim, 0, center(ally).x, center(ally).y)).toBe(true);
    expect(visionOf(sim, 0)).toBe(visionOf(sim, 1));
    expect(canSee(sim, 0, foe)).toBe(false);
    expect(canSee(sim, 2, ally)).toBe(false);
  });

  it('mission: action reveal uncovers a region (explored, visible for a limited time)', () => {
    const def = {
      id: 'test', title: { de: 'T', en: 'T' }, players: [{ kind: 'human', hero: 'bertram' }, { kind: 'ai' }], objectives: [], events: [],
      start: [{ type: 'reveal', area: 'enemyHq', r: 5, seconds: 3 }],
    };
    const sim = new Sim({ seed: 4, players: 2, heroes: ['bertram', null], mission: new MissionRuntime(def) });
    const c = center(hqOf(sim, 1));
    expect(isExplored(sim, 0, c.x, c.y)).toBe(true);
    expect(isVisible(sim, 0, c.x, c.y)).toBe(true);
    expect(canSee(sim, 0, hqOf(sim, 1))).toBe(true);
    expect(knownBuildings(sim, 0).has(hqOf(sim, 1).id)).toBe(true);
    sim.run(40);
    expect(isVisible(sim, 0, c.x, c.y)).toBe(false);
    expect(isExplored(sim, 0, c.x, c.y)).toBe(true);
    // objective variant stays: reveal with id uncovers a hidden goal
    expect(sim.mission.state.warnings).toEqual([]);
  });

  it('fog off: everything visible, no snapshots', () => {
    const sim = new Sim({ seed: 1, fog: false });
    const theirs = center(hqOf(sim, 1));
    expect(isVisible(sim, 0, theirs.x, theirs.y)).toBe(true);
    expect(canSee(sim, 0, hqOf(sim, 1))).toBe(true);
    expect(knownBuildings(sim, 0)).toBe(null);
    revealArea(sim, 0, 1, 1, 3, 10); // ineffective, but without error
  });

  it('tutorial explores generously', async () => {
    const { createMissionSim } = await import('../../src/sim/missions/runtime.js');
    const t = createMissionSim('tutorial');
    const c = createMissionSim('c1');
    expect(sum(visionOf(t, 0).explored)).toBeGreaterThan(sum(visionOf(c, 0).explored));
  });
});

describe('Last seen buildings', () => {
  it('are updated when seen, frozen in the fog and only forgotten when their disappearance is seen', () => {
    const sim = new Sim({ seed: 1 });
    const ehq = hqOf(sim, 1);
    const pos = sim.findPlacement(1, 'residence', ehq.x + 2, ehq.y + 8, 20);
    const b = sim.createBuilding(1, 'residence', pos.x, pos.y, true);
    const known = () => knownBuildings(sim, 0);
    expect(known().has(b.id)).toBe(false);
    // place a scout
    const spy = sim.spawnLeader(0, 'bow1', pos.x + 1, pos.y + 5, 0);
    spy.order = { type: 'hold' };
    updateVision(sim, true);
    expect(canSee(sim, 0, b)).toBe(true);
    expect(known().get(b.id)).toMatchObject({ type: 'residence', owner: 1, level: 0, x: pos.x, y: pos.y });
    // scout away: building stays known, changes in the fog stay hidden
    sim.entities.delete(spy.id);
    updateVision(sim, true);
    expect(canSee(sim, 0, b)).toBe(false);
    b.level = 1;
    updateVision(sim, true);
    expect(known().get(b.id).level).toBe(0);
    // look again: state is updated
    const spy2 = sim.spawnLeader(0, 'bow1', pos.x + 1, pos.y + 5, 0);
    spy2.order = { type: 'hold' };
    updateVision(sim, true);
    expect(known().get(b.id).level).toBe(1);
    sim.entities.delete(spy2.id);
    updateVision(sim, true);
    // demolished in the fog: stays as the last seen state
    sim.removeEntity(b);
    updateVision(sim, true);
    expect(known().has(b.id)).toBe(true);
    // see that it is missing: forgotten
    const spy3 = sim.spawnLeader(0, 'bow1', pos.x + 1, pos.y + 5, 0);
    spy3.order = { type: 'hold' };
    updateVision(sim, true);
    expect(known().has(b.id)).toBe(false);
  });
});

describe('Determinism and save game', () => {
  const run = (seed, ticks) => {
    const sim = new Sim({ seed });
    const ais = [new AiPlayer(sim, 0, 'normal'), new AiPlayer(sim, 1, 'hard')];
    for (let i = 0; i < ticks; i++) { for (const ai of ais) ai.update(); sim.step(); }
    return { sim, ais };
  };

  it('same course yields the same vision', () => {
    const a = run(21, 3000).sim, b = run(21, 3000).sim;
    expect(a.hash()).toBe(b.hash());
    for (const p of [0, 1]) {
      expect(Buffer.from(visionOf(a, p).explored).equals(Buffer.from(visionOf(b, p).explored))).toBe(true);
      expect(Buffer.from(visionOf(a, p).visible).equals(Buffer.from(visionOf(b, p).visible))).toBe(true);
    }
  });

  it('save game stores exploration, vision and last seen buildings; afterwards everything continues the same', () => {
    const { sim, ais } = run(12, 2500);
    // save between two recalculations
    while (sim.tick % VISION.updateTicks === 0) { for (const ai of ais) ai.update(); sim.step(); }
    const ehq = hqOf(sim, 1);
    revealArea(sim, 0, center(ehq).x, center(ehq).y, 4, 200);
    const data = JSON.parse(JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) })));
    expect(data.vision.enabled).toBe(true);
    // compact: bit fields instead of bytes per tile
    expect(data.vision.teams[0].explored.length).toBeLessThan(sim.map.width * sim.map.height / 4);
    const sim2 = loadGame(data);
    const ais2 = data.extra.ais.map((st) => AiPlayer.fromState(sim2, st));
    expect(sim2.hash()).toBe(sim.hash());
    for (const p of [0, 1]) {
      expect([...visionOf(sim2, p).explored]).toEqual([...visionOf(sim, p).explored]);
      expect([...visionOf(sim2, p).visible]).toEqual([...visionOf(sim, p).visible]);
      expect([...visionOf(sim2, p).ghosts.values()]).toEqual([...visionOf(sim, p).ghosts.values()]);
    }
    for (let i = 0; i < 2000; i++) {
      for (const ai of ais) ai.update(); sim.step();
      for (const ai of ais2) ai.update(); sim2.step();
    }
    expect(sim2.hash()).toBe(sim.hash());
  });

  it('old save games without vision load with fog off', () => {
    const sim = new Sim({ seed: 2 });
    const data = saveGame(sim);
    delete data.vision;
    const sim2 = loadGame(data);
    expect(sim2.vision.enabled).toBe(false);
    expect(canSee(sim2, 0, hqOf(sim2, 1))).toBe(true);
  });
});

describe('AI without cheating', () => {
  it('initially knows the enemy castle only as a start position and enemies only in sight', () => {
    const sim = new Sim({ seed: 1 });
    const ai = new AiPlayer(sim, 1, 'normal');
    ai.scan();
    const known = ai.knownHq(0);
    expect(known.id).toBe(null);
    expect(Math.abs(known.x + 2 - sim.starts[0].x)).toBeLessThanOrEqual(1);
    // enemy in the fog near the castle (21 tiles, castle sees 20): normal does not see it, hard (guards) does
    for (const e of [...sim.entities.values()]) if (e.owner === 1 && e.kind === 'building' && e.type !== 'headquarters') sim.removeEntity(e);
    clearUnits(sim, 1);
    updateVision(sim, true);
    let spot = null;
    for (let a = 0; a < 64 && !spot; a++) {
      const x = Math.round(ai.home.x + Math.cos(a / 10) * 21), y = Math.round(ai.home.y + Math.sin(a / 10) * 21);
      if (sim.map.walkable(x, y) && ai.reachableAt(x + 0.5, y + 0.5) && Math.hypot(x + 0.5 - ai.home.x, y + 0.5 - ai.home.y) < 21.6) spot = { x, y };
    }
    expect(spot).not.toBe(null);
    const L = sim.spawnLeader(0, 'sword1', spot.x, spot.y, 0);
    L.order = { type: 'hold' };
    updateVision(sim, true);
    expect(canSee(sim, 1, L)).toBe(false);
    ai.scan();
    expect(ai.enemyNearHome.includes(L)).toBe(false);
    const hard = new AiPlayer(sim, 1, 'hard');
    hard.scan();
    expect(hard.enemyNearHome.includes(L)).toBe(true);
    // as soon as the castle has been seen, the AI knows it
    revealArea(sim, 1, center(hqOf(sim, 0)).x, center(hqOf(sim, 0)).y, 4, 50);
    expect(ai.knownHq(0).id).toBe(hqOf(sim, 0).id);
  });

  it('without fog the AI reads the real castle', () => {
    const sim = new Sim({ seed: 1, fog: false });
    const ai = new AiPlayer(sim, 1, 'normal');
    expect(ai.knownHq(0).id).toBe(hqOf(sim, 0).id);
  });

  it('attacks despite fog and finds the castle (attack-move to the start position)', () => {
    const sim = new Sim({ seed: 2 });
    const ai = new AiPlayer(sim, 1, 'normal');
    ai.scan();
    const target = ai.enemyHome();
    expect(target).not.toBe(null);
    expect(target.id).toBe(null);
    const hq = hqOf(sim, 0);
    expect(Math.hypot(target.x - (hq.x + 2), target.y - (hq.y + 2))).toBeLessThan(8);
    void UNIT;
  });
});
