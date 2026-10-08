// Mission I.4 "Im Schneetreiben": three stages in three sections of one map, a note of the maid, a prediction checked
// with program.get, Run restarts the stage. The model solution wins – played like the engine does it (snapshot
// before every run, src/sim/stage.js).
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot } from '../../src/sim/stage.js';
import { getScenario } from '../../src/sim/missions/registry.js';
import { ADVENTURES } from '../../src/sim/missions/registry.js';

const step = (sim, n) => { for (let i = 0; i < n && !sim.mission.state.result; i++) sim.step(); };
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tile = (sim) => { const e = hero(sim); return [Math.floor(e.px / 1000), Math.floor(e.py / 1000)]; };
const active = (sim) => sim.mission.state.objectives.filter((o) => o.status === 'active').map((o) => o.id);
const playerErrors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');

/** Wait (at most n ticks) until a condition holds. */
function until(sim, cond, n = 3000) {
  for (let i = 0; i < n && !cond(); i++) sim.step();
  expect(cond()).toBe(true);
}

/** Like Engine.scriptRun: restart the stage (snapshot), then the run command. */
function runAs(state, code) {
  const next = state.stage.beforeRun(state.sim);
  if (next) state.sim = next;
  state.sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
}

const TRACK = [
  'while not nelia.is_at(place("hut")):',
  '    if nelia.front() == "track":',
  '        nelia.step()',
  '    elif nelia.left() == "track":',
  '        nelia.turn_left()',
  '    else:',
  '        nelia.turn_right()',
  '',
].join('\n');

describe('Mission I.4 "Im Schneetreiben"', () => {
  it('is a bundled adventure after adv5, with world building without errors and winter', () => {
    const ids = ADVENTURES.map((a) => a.id);
    expect(ids.indexOf('r1-4')).toBe(ids.indexOf('adv5') + 1);
    expect(getScenario('r1-4').title.de).toBe('Im Schneetreiben');
    const sim = createMissionSim('r1-4');
    expect(sim.mission.script.state.errors).toEqual([]);
    expect(sim.weather.state).toBe('winter');
    // Cliff bands between the sections, the trail of the runaways is a track
    expect(sim.map.walkable(4, 8)).toBe(false);
    expect(sim.map.walkable(4, 19)).toBe(false);
    expect(sim.map.tracks[sim.map.idx(7, 22)]).toBeGreaterThan(0);
  });

  it('the maid hands over a note; the model solution wins all three stages', () => {
    const state = { sim: createMissionSim('r1-4'), stage: new StageSnapshot() };
    until(state.sim, () => active(state.sim).includes('predict'));
    const note = state.sim.mission.script.state.note;
    expect(note).toMatchObject({ speaker: 'maid', title: { de: 'Zettel der Magd' } });
    expect(note.code).toContain('while nelia.can_step():');

    // Stage 1: a wrong guess – Nelia says how far it was; Run restores the stage, then the right guess
    runAs(state, note.code.replace('guess = 0', 'guess = 7'));
    until(state.sim, () => state.sim.mission.state.messages.some((m) => /vermutet hattest du 7/.test(m.text?.de ?? '')));
    expect(tile(state.sim)).toEqual([11, 3]);
    runAs(state, note.code.replace('guess = 0', 'guess = 9'));
    expect(tile(state.sim)).toEqual([2, 3]);
    until(state.sim, () => active(state.sim).includes('coin'));
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'predict').status).toBe('done');
    expect(tile(state.sim)).toEqual([2, 13]);

    // Stage 2: the unchanged note walks past the coin; the changed one picks it up
    runAs(state, note.code);
    until(state.sim, () => state.sim.mission.script.state.player.status === 'done');
    step(state.sim, 5);
    expect(state.sim.map.items.size).toBe(1);
    runAs(state, 'while nelia.here() != "coin":\n    nelia.step()\nnelia.take()\n');
    expect(tile(state.sim)).toEqual([2, 13]);
    until(state.sim, () => active(state.sim).includes('hut'));
    expect(tile(state.sim)).toEqual([2, 23]);

    // Stage 3: follow the track through all bends
    runAs(state, TRACK);
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(playerErrors(state.sim)).toEqual([]);
    // Winter: Nelia's own steps leave tracks in the snow
    expect(state.sim.map.tracks[state.sim.map.idx(5, 3)]).toBeGreaterThan(0);
  });
});
