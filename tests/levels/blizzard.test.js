// Mission I.4 "Im Schneetreiben": one snow field, three stages as consecutive legs of one journey (east to the forest
// edge, south along it to the coin, along the track to the hut). The maid loads a program, a stage that ends once
// the program ran (after_run), Run restarts the stage. Three worlds = three maps of the whole journey (normal, near,
// far): coin and track only count once „Prüfen“ solved them in every world. The model solution wins – played like the
// engine does it (snapshot before every run, src/sim/stage.js; check via src/sim/check.js and the check command).
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot, stageKey } from '../../src/sim/stage.js';
import { getScenario, getMission, ADVENTURES } from '../../src/sim/missions/registry.js';
import { checkProgram } from '../../src/sim/check.js';
import { tileKind } from '../../src/sim/systems/ground.js';

/** Collect the programs the mission loads (program.load): a display event, no state. */
function track(state, sim) {
  const step = sim.step.bind(sim);
  sim.step = (...a) => {
    const events = step(...a);
    for (const e of events) if (e.type === 'programLoad') state.loads.push(e.code);
    return events;
  };
}

const WORLDS = ['normal', 'near', 'far'];
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tile = (sim) => { const e = hero(sim); return [Math.floor(e.px / 1000), Math.floor(e.py / 1000)]; };
const place = (sim, id) => { const p = sim.mission.script.state.places[id]; return [p.x, p.y]; };
const active = (sim) => sim.mission.state.objectives.filter((o) => o.status === 'active').map((o) => o.id);
const playerErrors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const by = (r) => Object.fromEntries(r.results.map((x) => [x.world, x.status]));
/** Everything a stage start consists of: the hero (tile, facing), items, trees, the coin in the purse, the active goals. */
function situation(sim) {
  let trees = 0;
  for (let y = 0; y < sim.map.height; y++) for (let x = 0; x < sim.map.width; x++) if (tileKind(sim, x, y) === 'tree') trees++;
  return { tile: tile(sim), face: hero(sim).face, items: [...sim.map.items.entries()].sort((a, b) => a[0] - b[0]), trees, gold: sim.players[0].stock.gold, active: active(sim) };
}

/** Wait (at most n ticks) until a condition holds. */
function until(sim, cond, n = 3000) {
  for (let i = 0; i < n && !cond(); i++) sim.step();
  expect(cond()).toBe(true);
}

/** A mission played like the engine: Run restores the stage snapshot first. */
function play(world) {
  const state = { sim: createMissionSim('r1-4', { world }), stage: new StageSnapshot(), loads: [] };
  track(state, state.sim);
  return state;
}
function runAs(state, code) {
  const next = state.stage.beforeRun(state.sim);
  if (next) { state.sim = next; track(state, next); }
  state.sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
}
/** Like the „Prüfen“ button: check in all worlds, the result goes in as a command. */
function checkAs(state, code) {
  const r = checkProgram(state.sim.mission.def, stageKey(state.sim), { player: code });
  state.sim.command({ type: 'script', player: 0, action: 'check', stage: r.stage, passed: r.passed });
  return r;
}
/** A fresh game that starts at a stage, as the world switcher and „Prüfen“ start it. */
function startAt(world, stage) {
  const sim = createMissionSim('r1-4', { world, stage });
  until(sim, () => active(sim).includes(stage), 400);
  return sim;
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
  });

  it('is one open snow field per world: no cliff walls, the forest edge, the coin and the track of the runaways', () => {
    for (const w of WORLDS) {
      const sim = createMissionSim('r1-4', { world: w });
      let cliffs = 0, tracks = 0;
      for (let y = 0; y < sim.map.height; y++) for (let x = 0; x < sim.map.width; x++) {
        if (tileKind(sim, x, y) === 'cliff') cliffs++;
        if (sim.map.tracks[sim.map.idx(x, y)] > 0) tracks++;
      }
      expect(cliffs, w).toBe(0);
      expect(tracks, w).toBeGreaterThan(5);
      // Every part of the journey can be walked: start, corner at the forest edge, coin, hut
      const [cx, cy] = place(sim, 'coin');
      expect(sim.map.items.get(sim.map.idx(cx, cy)), w).toBe('coin');
      for (const p of ['start', 'coin', 'hut']) { const [x, y] = place(sim, p); expect(sim.map.walkable(x, y), `${w}/${p}`).toBe(true); }
    }
  });

  it('the maid loads a program; the model solution wins all three stages, each one starting where the last ended', () => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    expect(state.loads).toHaveLength(1);
    const program = state.loads[0];
    expect(program).toContain('while nelia.can_step():');
    expect(tile(state.sim)).toEqual([2, 3]);

    // Stage 1: an error does not end it; running the program once to its end does (the forest edge: 9 steps east)
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'predict').status).toBe('active');
    runAs(state, program);
    expect(tile(state.sim)).toEqual([2, 3]);
    until(state.sim, () => active(state.sim).includes('coin'));
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'predict').status).toBe('done');
    // Stage 2 begins at the forest edge, Nelia looks south along it – the same program, nothing loaded, no jump
    expect(tile(state.sim)).toEqual([11, 3]);
    expect(state.loads).toHaveLength(1);
    const end1 = situation(state.sim);
    expect(situation(startAt('normal', 'coin'))).toEqual(end1);

    // The unchanged program walks past the coin; the changed one picks it up – then „Prüfen“ in all worlds
    runAs(state, program);
    for (let i = 0; i < 3; i++) state.sim.step();
    until(state.sim, () => state.sim.mission.script.state.player.status === 'done');
    expect(tile(state.sim)).toEqual([11, 23]);
    expect(state.sim.map.items.size).toBe(1);
    runAs(state, COIN);
    expect(tile(state.sim)).toEqual([11, 3]);
    until(state.sim, () => state.sim.map.items.size === 0);
    expect(tile(state.sim)).toEqual([11, 8]);
    for (let i = 0; i < 5; i++) state.sim.step();
    // Solved here, but the goal waits for the check
    expect(active(state.sim)).toEqual(['coin']);
    expect(state.sim.mission.state.objectives.find((o) => o.id === 'coin').here).toBe(true);
    expect(checkAs(state, COIN).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('hut'));
    // Stage 3 begins on the coin tile (now empty), looking south, where the track starts
    expect(tile(state.sim)).toEqual([11, 8]);
    expect(hero(state.sim).face).toBe(2);
    const end2 = situation(state.sim);
    expect(situation(startAt('normal', 'hut'))).toEqual(end2);

    // Stage 3: follow the track through all bends – „Prüfen“ alone finishes it, in every world
    expect(checkAs(state, TRACK).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(playerErrors(state.sim)).toEqual([]);
    // Nobody was moved: Nelia walked to the hut herself after the check, the way she was
    expect(tile(state.sim)).toEqual(place(state.sim, 'hut'));
    // Winter: Nelia's own steps leave tracks in the snow
    expect(state.sim.map.tracks[state.sim.map.idx(5, 3)]).toBeGreaterThan(0);
  });

  it('Run pressed right after a stage ended restarts at the new stage start (goal exists before the closing line)', () => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    runAs(state, state.loads[0]);
    until(state.sim, () => active(state.sim).includes('coin'));
    runAs(state, state.loads[0]);
    for (let i = 0; i < 40; i++) state.sim.step();
    runAs(state, COIN);
    expect(tile(state.sim)).toEqual([11, 3]);
    expect(active(state.sim)).toEqual(['coin']);
  });

  it('a check that solves the coin stage without a run: the hut goal is active before Nelia walks to the coin; Run during the walk is safe', () => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    runAs(state, state.loads[0]);
    until(state.sim, () => active(state.sim).includes('coin'));
    expect(checkAs(state, COIN).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('hut'), 400);
    // The walk to the coin has just begun: she is not on the coin tile yet, Run takes the snapshot of the hut stage
    expect(tile(state.sim)).not.toEqual([11, 8]);
    runAs(state, TRACK);
    expect(active(state.sim)).toEqual(['hut']);
    until(state.sim, () => state.sim.mission.script.state.player.status === 'done', 4000);
    expect(playerErrors(state.sim)).toEqual([]);
  });

  it('has three worlds: forest edge, coin and track differ', () => {
    expect(getMission('r1-4').worlds.map((w) => w.id)).toEqual(WORLDS);
    const at = {};
    for (const w of WORLDS) {
      const sim = createMissionSim('r1-4', { world: w });
      expect(sim.mission.script.state.errors).toEqual([]);
      const firstTree = [...Array(sim.map.width).keys()].find((x) => !sim.map.walkable(x, 3) && x > 2);
      const coin = place(sim, 'coin');
      const trail = [];
      for (let y = 0; y < sim.map.height; y++) for (let x = 0; x < sim.map.width; x++) if (sim.map.tracks[sim.map.idx(x, y)] > 0) trail.push(`${x},${y}`);
      at[w] = { firstTree, coin, trail: trail.join(' ') };
    }
    expect(at.normal).toMatchObject({ firstTree: 12, coin: [11, 8] });
    // Edge cases: the forest right in front of Nelia, the coin under her; the forest far away, the coin just before the map edge
    expect(at.near).toMatchObject({ firstTree: 3, coin: [2, 3] });
    expect(at.far).toMatchObject({ firstTree: 17, coin: [16, 19] });
    expect(new Set([at.normal.trail, at.near.trail, at.far.trail]).size).toBe(3);
  });

  it.each(WORLDS)('every world starts at every stage with Nelia where the stage before ends (%s)', (w) => {
    const sim0 = startAt(w, 'predict');
    expect(tile(sim0)).toEqual([2, 3]);
    const sim1 = startAt(w, 'coin');
    expect(tile(sim1)).toEqual([place(sim1, 'coin')[0], 3]);
    expect(hero(sim1).face).toBe(2);
    expect(sim1.mission.state.objectives.map((o) => o.id)).toEqual(['coin']);
    const sim2 = startAt(w, 'hut');
    expect(tile(sim2)).toEqual(place(sim2, 'coin'));
    expect(hero(sim2).face).toBe(2);
    expect(sim2.mission.state.objectives.map((o) => o.id)).toEqual(['hut']);
    // Nothing is loaded into the program when a stage is started by the switcher
    const loads = [];
    track({ loads }, sim1);
    for (let i = 0; i < 50; i++) sim1.step();
    expect(loads).toEqual([]);
  });

  it('the first stage ends once a program ran to its end, in every world; an error does not end it', () => {
    const def = getMission('r1-4');
    const solved = (code) => checkProgram(def, 'predict', { player: code }).results.filter((r) => r.status === 'solved').map((r) => r.world);
    expect(solved('steps = 0\nwhile nelia.can_step():\n    nelia.step()\n    steps = steps + 1\n')).toEqual(WORLDS);
    expect(solved('print(1)\n')).toEqual(WORLDS);
    expect(solved('nelia.fly()\n')).toEqual([]);
  });

  it('the model solutions pass „Prüfen“ in every world, hard-coded ones fail an edge case', () => {
    const def = getMission('r1-4');
    expect(by(checkProgram(def, 'coin', { player: COIN }))).toEqual({ normal: 'solved', near: 'solved', far: 'solved' });
    expect(by(checkProgram(def, 'hut', { player: TRACK }))).toEqual({ normal: 'solved', near: 'solved', far: 'solved' });
    // Five steps to the coin: right in the normal case only; take() finds nothing in the other worlds (line 3)
    const hard = checkProgram(def, 'coin', { player: 'for i in range(5):\n    nelia.step()\nnelia.take()\n' });
    expect(hard.passed).toBe(false);
    expect(hard.results.find((r) => r.world === 'normal').status).toBe('solved');
    expect(hard.results.find((r) => r.world === 'near')).toMatchObject({ status: 'error', error: { sline: 3 } });
    expect(hard.results.find((r) => r.world === 'far')).toMatchObject({ status: 'error', error: { sline: 3 } });
    // Walking on without looking at the ground passes the coin: the unchanged first-stage program never picks it up
    const past = by(checkProgram(def, 'coin', { player: 'while nelia.can_step():\n    nelia.step()\n' }));
    expect(past.near).not.toBe('solved');
    // The path of the normal world, written out: lost in the other worlds
    const path = 'nelia.turn_right()\nnelia.step(4)\nnelia.turn_left()\nnelia.step(4)\nnelia.turn_right()\nnelia.step(3)\nnelia.turn_left()\nnelia.step(4)\nnelia.turn_left()\nnelia.step(8)\n';
    const lost = by(checkProgram(def, 'hut', { player: path }));
    expect(lost.normal).toBe('solved');
    expect(lost.near).not.toBe('solved');
    expect(lost.far).not.toBe('solved');
  });

  it('the switcher starts a world at the current stage', () => {
    const sim = createMissionSim('r1-4', { world: 'far', stage: 'hut' });
    until(sim, () => active(sim).includes('hut'), 200);
    expect(sim.mission.state.objectives.map((o) => o.id)).toEqual(['hut']);
    expect(tile(sim)).toEqual([16, 19]);
  });
});
