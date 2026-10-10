// Mission I.4 "Im Schneetreiben": three stages in three sections of one map, a program the maid loads, a stage that ends
// once the program ran (after_run), Run restarts the stage. Three worlds (normal, near, far): coin and track only count once „Prüfen“
// solved them in every world. The model solution wins – played like the engine does it (snapshot before every run,
// src/sim/stage.js; check via src/sim/check.js and the check command).
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot } from '../../src/sim/stage.js';
import { getScenario, getMission, ADVENTURES } from '../../src/sim/missions/registry.js';
import { checkProgram } from '../../src/sim/check.js';
import { stageKey } from '../../src/sim/stage.js';

/** Collect the programs the mission loads (program.load): a display event, no state. */
function track(state, sim) {
  const step = sim.step.bind(sim);
  sim.step = (...a) => {
    const events = step(...a);
    for (const e of events) if (e.type === 'programLoad') state.loads.push(e.code);
    return events;
  };
}

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

/** Like the „Prüfen“ button: check in all worlds, the result goes in as a command. */
function checkAs(state, code) {
  const r = checkProgram(state.sim.mission.def, stageKey(state.sim), { player: code });
  state.sim.command({ type: 'script', player: 0, action: 'check', stage: r.stage, passed: r.passed });
  return r;
}

const COIN = 'while nelia.here() != "coin":\n    nelia.step()\nnelia.take()\n';
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
  it('is a bundled course mission after I.2, with world building without errors and winter', () => {
    const ids = ADVENTURES.map((a) => a.id);
    expect(ids.indexOf('r1-4')).toBe(ids.indexOf('r1-2') + 1);
    expect(getScenario('r1-4').title.de).toBe('Im Schneetreiben');
    const sim = createMissionSim('r1-4');
    expect(sim.mission.script.state.errors).toEqual([]);
    expect(sim.weather.state).toBe('winter');
    // Cliff bands between the sections, the trail of the runaways is a track
    expect(sim.map.walkable(4, 8)).toBe(false);
    expect(sim.map.walkable(4, 19)).toBe(false);
    expect(sim.map.tracks[sim.map.idx(7, 22)]).toBeGreaterThan(0);
  });

  it('the maid loads a program; the model solution wins all three stages', () => {
    const state = { sim: createMissionSim('r1-4'), stage: new StageSnapshot(), loads: [] };
    track(state, state.sim);
    until(state.sim, () => active(state.sim).includes('predict'));
    expect(state.loads).toHaveLength(1);
    const program = state.loads[0];
    expect(program).toContain('while nelia.can_step():');

    // Stage 1: an error does not end it; running the program once to its end does
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'predict').status).toBe('active');
    runAs(state, program);
    expect(tile(state.sim)).toEqual([2, 3]);
    until(state.sim, () => active(state.sim).includes('coin'));
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'predict').status).toBe('done');
    expect(tile(state.sim)).toEqual([2, 13]);

    // Stage 2: the unchanged program walks past the coin; the changed one picks it up – then „Prüfen“ in all worlds
    runAs(state, program);
    until(state.sim, () => state.sim.mission.script.state.player.status === 'done');
    step(state.sim, 5);
    expect(state.sim.map.items.size).toBe(1);
    runAs(state, COIN);
    expect(tile(state.sim)).toEqual([2, 13]);
    until(state.sim, () => state.sim.map.items.size === 0);
    step(state.sim, 5);
    // Solved here, but the goal waits for the check
    expect(active(state.sim)).toEqual(['coin']);
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'coin').here).toBe(true);
    expect(checkAs(state, COIN).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('hut'));
    expect(tile(state.sim)).toEqual([2, 23]);

    // Stage 3: follow the track through all bends – „Prüfen“ alone finishes it, in every world
    expect(checkAs(state, TRACK).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(playerErrors(state.sim)).toEqual([]);
    // Winter: Nelia's own steps leave tracks in the snow
    expect(state.sim.map.tracks[state.sim.map.idx(5, 3)]).toBeGreaterThan(0);
  });

  it('has three worlds: forest edge, coin and track differ', () => {
    expect(getMission('r1-4').worlds.map((w) => w.id)).toEqual(['normal', 'near', 'far']);
    const at = {};
    for (const w of ['normal', 'near', 'far']) {
      const sim = createMissionSim('r1-4', { world: w });
      expect(sim.mission.script.state.errors).toEqual([]);
      const firstTree = [...Array(20).keys()].find((x) => !sim.map.walkable(x, 3) && x > 2);
      const coin = [...sim.map.items.keys()].map((i) => i % sim.map.width)[0];
      const trail = [];
      for (let y = 20; y < 28; y++) for (let x = 0; x < 20; x++) if (sim.map.tracks[sim.map.idx(x, y)] > 0) trail.push(`${x},${y}`);
      at[w] = { firstTree, coin, trail: trail.join(' ') };
    }
    expect(at.normal).toMatchObject({ firstTree: 12, coin: 9 });
    // Edge cases: the forest right in front of Nelia, the coin under her; the forest far away, the coin just before the forest
    expect(at.near).toMatchObject({ firstTree: 3, coin: 2 });
    expect(at.far).toMatchObject({ firstTree: 17, coin: 14 });
    expect(new Set([at.normal.trail, at.near.trail, at.far.trail]).size).toBe(3);
  });

  it('the first stage ends once a program ran to its end, in every world; an error does not end it', () => {
    const def = getMission('r1-4');
    const solved = (code) => checkProgram(def, 'predict', { player: code }).results.filter((r) => r.status === 'solved').map((r) => r.world);
    expect(solved('steps = 0\nwhile nelia.can_step():\n    nelia.step()\n    steps = steps + 1\n')).toEqual(['normal', 'near', 'far']);
    expect(solved('print(1)\n')).toEqual(['normal', 'near', 'far']);
    expect(solved('nelia.fly()\n')).toEqual([]);
  });

  it('the model solutions pass „Prüfen“ in every world, hard-coded ones fail an edge case', () => {
    const def = getMission('r1-4');
    const by = (r) => Object.fromEntries(r.results.map((x) => [x.world, x.status]));
    expect(by(checkProgram(def, 'coin', { player: COIN }))).toEqual({ normal: 'solved', near: 'solved', far: 'solved' });
    expect(by(checkProgram(def, 'hut', { player: TRACK }))).toEqual({ normal: 'solved', near: 'solved', far: 'solved' });
    // Seven steps to the coin: right in the normal case only; take() finds nothing in the other worlds (line 3)
    const hard = checkProgram(def, 'coin', { player: 'for i in range(7):\n    nelia.step()\nnelia.take()\n' });
    expect(hard.passed).toBe(false);
    expect(hard.results.find((r) => r.world === 'normal').status).toBe('solved');
    expect(hard.results.find((r) => r.world === 'near')).toMatchObject({ status: 'error', error: { sline: 3 } });
    // The path of the normal world, written out: lost in the other worlds
    const path = 'nelia.step(5)\nnelia.turn_left()\nnelia.step(2)\nnelia.turn_right()\nnelia.step(4)\nnelia.turn_right()\nnelia.step(4)\nnelia.turn_left()\nnelia.step(5)\n';
    const lost = by(checkProgram(def, 'hut', { player: path }));
    expect(lost.normal).toBe('solved');
    expect(lost.near).not.toBe('solved');
    expect(lost.far).not.toBe('solved');
  });

  it('the switcher starts a world at the current stage', () => {
    const sim = createMissionSim('r1-4', { world: 'far', stage: 'hut' });
    until(sim, () => active(sim).includes('hut'), 200);
    expect(sim.mission.state.objectives.map((o) => o.id)).toEqual(['hut']);
    expect(tile(sim)).toEqual([2, 23]);
  });
});
