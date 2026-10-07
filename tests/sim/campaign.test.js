// Campaign with the test bot (tests/sim/missionBot.js): every mission must be winnable on two maps within the
// time limit; a passive bot (economy only) must lose missions 5 and 6.
// The full matrix (4 maps, table) is delivered by `node scripts/campaign-matrix.js`.

import { describe, it, expect } from 'vitest';
import { playMission, TIME_LIMITS } from './missionBot.js';
import { getMission } from '../../src/sim/missions/registry.js';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { WATER } from '../../src/sim/map.js';

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
