// Campaign with the test bot (tests/sim/missionBot.js): every mission must be winnable on two maps within the
// time limit; a passive bot (economy only) must lose missions 5 and 6.
// The full matrix (4 maps, table) is delivered by `node scripts/campaign-matrix.js`.

import { describe, it, expect } from 'vitest';
import { playMission, TIME_LIMITS } from './missionBot.js';
import { getMission } from '../../src/sim/missions/registry.js';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { WATER } from '../../src/sim/map.js';
import { Sim } from '../../src/sim/sim.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

const CASES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].flatMap((id) => [[id, getMission(id).seed], [id, 7]]);

describe('Campaign: weather', () => {
  it('Malvor\'s winter: missions 1 to 3 do not switch to summer or rain on their own', () => {
    for (const id of ['c1', 'c2', 'c3']) {
      const cycle = getMission(id).weatherCycle;
      expect(cycle.every(([w]) => w === 'winter'), id).toBe(true);
    }
  });
});

describe('Campaign: setup and texts', () => {
  it('camps and troops never start on frozen water (except the gorge outpost in mission 3)', () => {
    for (const id of ['c1', 'c2', 'c4', 'c5', 'c6']) {
      for (const seed of [getMission(id).seed, 7]) {
        const sim = createMissionSim(id, { seed });
        const onIce = [...sim.entities.values()].filter((e) => ['leader', 'soldier', 'hero', 'npc'].includes(e.kind)
          && (sim.map.flags[sim.map.idx(Math.floor(e.px / 1000), Math.floor(e.py / 1000))] & WATER));
        expect(onIce.length, `${id}/${seed}`).toBe(0);
      }
    }
  });

  it('mission 1: the whole find conversation reaches the UI, also its first sentence (many lines in one tick)', () => {
    const sim = createMissionSim('c1');
    sim.mission.runActions(sim, sim.mission.def.objectives.find((o) => o.id === 'root').onDone);
    const texts = sim.mission.uiState(sim).messages.map((m) => m.text.de);
    const find = texts.findIndex((x) => x.startsWith('Unter der Wurzel'));
    expect(find).toBeGreaterThanOrEqual(0);
    expect(texts.length - find).toBeGreaterThan(8); // more than the old limit of 8 messages
    expect(texts[find + 1]).toMatch(/^Bei allen Märkten/);
  });

  it('the guard at the weatherworks speaks with the collector\'s voice and portrait', async () => {
    const { speakerVoice } = await import('../../src/audio/voiceLines.js');
    const { speakerPortrait } = await import('../../src/ui/icons/index.js');
    expect(speakerVoice('guard')).toBe('collector');
    expect(speakerPortrait('guard')).toBe('portraits/sp-collector.webp');
  });

  it('mission 2: the debrief follows the path taken (bought or stormed)', () => {
    const debrief = (flag) => {
      const sim = createMissionSim('c2');
      sim.mission.state.flags[flag] = true;
      sim.mission.finish(sim, true, 'objectives');
      return sim.mission.uiState(sim).result.debrief.de;
    };
    expect(debrief('shardBought')).toMatch(/Räuberhauptmann zählt/);
    expect(debrief('shardStormed')).toMatch(/gefangene Räuber/);
  });
});

describe('Campaign: step-by-step unlocks and pointers', () => {
  const hq = (sim) => sim.findBuilding(0, 'headquarters');

  it('mission 1: only the basics can be built, the rest is "not available in this mission"; only clay shafts', () => {
    const sim = createMissionSim('c1');
    const h = hq(sim);
    expect(sim.checkPlacement(0, 'storehouse', h.x, h.y)).toBe('err.notInMission');
    expect(sim.checkPlacement(0, 'barracks', h.x, h.y)).toBe('err.notInMission');
    expect(sim.findPlacement(0, 'residence', h.x, h.y, 20)).not.toBeNull();
    expect(new Set(sim.shafts.map((s) => s.res))).toEqual(new Set(['clay']));
    // Command is rejected as well
    const p = sim.findPlacement(0, 'residence', h.x, h.y, 20);
    const ev = sim.step([{ player: 0, type: 'placeBuilding', building: 'storehouse', x: p.x, y: p.y, units: [] }]);
    expect(ev.find((e) => e.type === 'rejected')?.reason).toBe('err.notInMission');
  });

  it('mission 2: the barracks unlocks with the first trade and stays unlocked after loading', () => {
    const sim = createMissionSim('c2');
    const h = hq(sim);
    expect(sim.checkPlacement(0, 'barracks', h.x, h.y)).toBe('err.notInMission');
    expect(new Set(sim.shafts.map((s) => s.res))).toEqual(new Set(['clay', 'stone']));
    const before = sim.hash();
    sim.mission.state.flags.traded = true;
    sim.step();
    expect(sim.mission.state.available.buildings).toContain('barracks');
    expect(sim.mission.state.tributes.buyShard).toBe('open');
    expect(sim.hash()).not.toBe(before);
    const loaded = loadGame(saveGame(sim));
    expect(loaded.mission.locked(0, 'buildings', 'barracks')).toBe(false);
    expect(loaded.mission.locked(0, 'buildings', 'smithy')).toBe(true);
    expect(loaded.hash()).toBe(sim.hash());
  });

  it('mission 2: no raids and no offer before the milestone (first trade)', () => {
    const sim = createMissionSim('c2');
    for (let i = 0; i < 20 * 60 * 10; i++) sim.step();
    const st = sim.mission.state;
    expect(st.fired.offer).toBeUndefined();
    expect(st.fired.raid).toBeUndefined();
    expect(st.tributes.buyShard).toBeUndefined();
  });

  it('research outside the mission list is locked (mission 4: only "Standing Army")', () => {
    const sim = createMissionSim('c4');
    const uni = sim.createBuilding(0, 'university', hq(sim).x + 8, hq(sim).y + 8, true);
    sim.players[0].stock.gold = 5000;
    expect(sim.checkResearch(0, uni, 'gears')).toBe('err.notInMission');
    expect(sim.checkResearch(0, uni, 'standingArmy')).not.toBe('err.notInMission');
  });

  it('free play and the AI are not restricted', () => {
    const sim = new Sim({ seed: 3, players: 2 });
    expect(sim.mission).toBeNull();
    const c6 = createMissionSim('c6');
    expect(c6.mission.state.available).toBeNull();
    const c1 = createMissionSim('c1');
    expect(c1.mission.locked(1, 'buildings', 'barracks')).toBe(false);
  });

  it('objective pointer: the clay pit is pointed at until it is placed', () => {
    const sim = createMissionSim('c1');
    const st = sim.mission.state;
    st.objectives.find((o) => o.id === 'workers').status = 'active';
    const hint = () => sim.mission.uiState(sim).objectives.find((o) => o.id === 'workers').hint;
    expect(hint().ui).toEqual(['build-clayMine', 'quick-all']);
    expect(hint().area).toBeTruthy();
    const s = sim.shafts.find((q) => q.res === 'clay');
    sim.createBuilding(0, 'clayMine', s.x, s.y, false);
    sim.mission.census = null;
    expect(hint().ui).toBeUndefined();
    expect(hint().area).toBeTruthy();
  });
});

describe('Campaign with bot', () => {
  it.each(CASES)('%s is winnable on map %i within the time limit', (id, seed) => {
    const { report } = playMission(id, seed);
    expect(report.warnings).toEqual([]);
    expect(report.won, `${id}/${seed}: ${report.reason} after ${report.minutes} min`).toBe(true);
    expect(report.minutes).toBeLessThanOrEqual(TIME_LIMITS[id]);
    // all main objectives fulfilled
    for (const o of getMission(id).objectives.filter((x) => x.primary)) expect(report.objectives[o.id]?.status, `${id}/${o.id}`).toBe('done');
  }, 120000);

  it('Mission 5: without deliveries and troops Morvale stays lost (the villages do not return)', () => {
    const { report } = playMission('c5', undefined, { passive: true, maxMinutes: 30 });
    expect(report.won).toBe(false);
    expect(report.objectives.regain?.status).not.toBe('done');
  }, 120000);

  it('Mission 6: without an army Malvor conquers the Ufersiedlung', () => {
    const { report } = playMission('c6', undefined, { passive: true, maxMinutes: 45 });
    expect(report.won).toBe(false);
    expect(report.reason).toBe('hq');
  }, 180000);
});
