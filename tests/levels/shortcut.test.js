// Mission II.1 "Orrins Abkürzung": one road, three stages as consecutive legs of one journey (three detours round the
// first walls of the ruin, three round the rest while a thorn hedge grows in place, then the road with Orrin's coins).
// The loaded program stays and grows; the three worlds are three complete maps (the ruin is the same, the road beyond
// it differs). Played like the engine does it (snapshot before every run, src/sim/stage.js).
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot, stageKey } from '../../src/sim/stage.js';
import { getMission, getScenario } from '../../src/sim/missions/registry.js';
import { checkProgram } from '../../src/sim/check.js';
import { tileKind } from '../../src/sim/systems/ground.js';
import { refExample } from '../../src/ui/script/reference.js';

const WORLDS = ['normal', 'near', 'far'];
const lines = (...l) => `${l.join('\n')}\n`;
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tile = (sim) => { const e = hero(sim); return [Math.floor(e.px / 1000), Math.floor(e.py / 1000)]; };
const active = (sim) => sim.mission.state.objectives.filter((o) => o.status === 'active').map((o) => o.id);
const playerErrors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const said = (sim, re) => sim.mission.state.messages.some((m) => re.test(m.text?.de ?? ''));
const by = (r) => Object.fromEntries(r.results.map((x) => [x.world, x.status]));
const check = (stage, code) => checkProgram(getMission('r2-1'), stage, { player: code });
const trees = (sim) => { let n = 0; for (let y = 0; y < sim.map.height; y++) for (let x = 0; x < sim.map.width; x++) if (tileKind(sim, x, y) === 'tree') n++; return n; };
/** Everything a stage start consists of: the hero (tile, facing), items, trees, gold, the active goals. */
const situation = (sim) => ({ tile: tile(sim), face: hero(sim).face, items: [...sim.map.items.entries()].sort((a, b) => a[0] - b[0]), trees: trees(sim), gold: sim.players[0].stock.gold, active: active(sim) });

/** Wait (at most n ticks) until a condition holds. */
function until(sim, cond, n = 3000) {
  for (let i = 0; i < n && !cond(); i++) sim.step();
  expect(cond()).toBe(true);
}
function track(state, sim) {
  const step = sim.step.bind(sim);
  sim.step = (...a) => {
    const events = step(...a);
    for (const e of events) if (e.type === 'programLoad') state.loads.push(e.code);
    return events;
  };
}
function play(world) {
  const state = { sim: createMissionSim('r2-1', { world }), stage: new StageSnapshot(), loads: [] };
  track(state, state.sim);
  expect(state.sim.mission.script.state.errors).toEqual([]);
  return state;
}
function runAs(state, code) {
  const next = state.stage.beforeRun(state.sim);
  if (next) { state.sim = next; track(state, next); }
  state.sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
}
function checkAs(state, code) {
  const r = checkProgram(state.sim.mission.def, stageKey(state.sim), { player: code });
  state.sim.command({ type: 'script', player: 0, action: 'check', stage: r.stage, passed: r.passed });
  return r;
}
function startAt(world, stage) {
  const sim = createMissionSim('r2-1', { world, stage });
  until(sim, () => active(sim).includes(stage), 400);
  return sim;
}

const LOADED = `\ndef around_ruin():\n    nelia.turn_right()\n    nelia.step()\n    nelia.turn_left()\n    nelia.step(2)\n    nelia.turn_left()\n    nelia.step()\n    nelia.turn_right()\n\naround_ruin()\naround_ruin()\naround_ruin()\n`;
const LEFT = LOADED.replace(/turn_right/g, 'TMP').replace(/turn_left/g, 'turn_right').replace(/TMP/g, 'turn_left');
const FETCH = (lang) => refExample('fetch', lang);

describe('Mission II.1 "Orrins Abkürzung": one road with a ruin', () => {
  it('has three worlds, each a complete map without cliff walls; the ruin is the same, the road beyond differs', () => {
    expect(getScenario('r2-1').worlds.map((w) => w.id)).toEqual(WORLDS);
    const roads = new Set();
    for (const w of WORLDS) {
      const sim = createMissionSim('r2-1', { world: w });
      expect(sim.mission.script.state.errors, w).toEqual([]);
      let cliffs = 0;
      for (let y = 0; y < sim.map.height; y++) for (let x = 0; x < sim.map.width; x++) if (tileKind(sim, x, y) === 'cliff') cliffs++;
      expect(cliffs, w).toBe(0);
      // Six wall remains on the road, free north of them, no hedge yet in the south
      for (const x of [3, 5, 7, 9, 11, 13]) expect(tileKind(sim, x, 5), `${w} ${x}`).toBe('pile');
      for (let x = 2; x <= 14; x++) { expect(sim.map.walkable(x, 4), `${w} north ${x}`).toBe(true); expect(sim.map.walkable(x, 6), `${w} south ${x}`).toBe(true); }
      expect(tile(sim)).toEqual([2, 5]);
      roads.add([...sim.map.items.keys()].sort((a, b) => a - b).join());
    }
    expect(roads.size).toBe(3);
  });

  it('edge worlds: the forest comes early (near) or late (far), coins beside the first step (near) or mostly right (far)', () => {
    const forest = (w) => { const s = createMissionSim('r2-1', { world: w }); let x = 15; while (s.map.walkable(x, 5)) x++; return x; };
    expect([forest('normal'), forest('near'), forest('far')]).toEqual([32, 21, 34]);
    const row = (w, y) => { const s = createMissionSim('r2-1', { world: w }); return [...s.map.items.keys()].filter((k) => Math.floor(k / s.map.width) === y).length; };
    expect(row('near', 4) + row('near', 6)).toBe(4);
    expect(row('far', 4)).toBe(1);
    expect(row('far', 6)).toBe(6);
  });

  it.each(['de', 'en'])('the loaded program stays and grows: the model solution wins all three stages, each starting where the last ended (%s)', (lang) => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    expect(state.loads).toHaveLength(1);
    const program = state.loads[0];
    expect(program).toContain('def around_ruin():');
    expect(trees(state.sim)).toBe(trees(createMissionSim('r2-1')));

    // Stage 1: where does Nelia stand after three calls? Running the loaded program once is enough
    runAs(state, program);
    until(state.sim, () => active(state.sim).includes('hedge'));
    expect(tile(state.sim)).toEqual([8, 5]);
    // The world changed in place: a thorn hedge south of the second half of the ruin; nobody was moved, nothing loaded
    expect(state.loads).toHaveLength(1);
    for (let x = 8; x <= 14; x++) expect(tileKind(state.sim, x, 6), `hedge ${x}`).toBe('tree');
    for (let i = 0; i < 5; i++) state.sim.step();
    const end1 = situation(state.sim);
    expect(situation(startAt('normal', 'hedge'))).toEqual(end1);

    // Stage 2: the unchanged function fails at the hedge – swapped left and right it goes round the north
    runAs(state, program);
    until(state.sim, () => said(state.sim, /links und rechts tauschen/));
    expect(tile(state.sim)).toEqual([8, 5]);
    runAs(state, LEFT);
    until(state.sim, () => active(state.sim).includes('coins'));
    expect(tile(state.sim)).toEqual([14, 5]);
    for (let i = 0; i < 5; i++) state.sim.step();
    expect(situation(startAt('normal', 'coins'))).toEqual(situation(state.sim));

    // Stage 3: own commands fetch the coins left and right of the path
    runAs(state, FETCH(lang));
    until(state.sim, () => state.sim.players[0].stock.gold === 10, 6000);
    expect(active(state.sim)).toEqual(['coins']);
    expect(checkAs(state, FETCH(lang)).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 6000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(state.sim.players[0].stock.gold).toBe(10);
    expect(playerErrors(state.sim)).toEqual([]);
  });

  it('Run pressed right after a stage ended (during the closing line) snapshots the world with the new stage\'s changes', () => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    runAs(state, state.loads[0]);
    // The moment the new goal exists – the closing line is still being spoken – the hedge stands already
    until(state.sim, () => active(state.sim).includes('hedge'));
    for (let x = 8; x <= 14; x++) expect(tileKind(state.sim, x, 6)).toBe('tree');
    runAs(state, state.loads[0]);
    for (let i = 0; i < 40; i++) state.sim.step();
    runAs(state, state.loads[0]);
    expect(tile(state.sim)).toEqual([8, 5]);
    for (let x = 8; x <= 14; x++) expect(tileKind(state.sim, x, 6), `restart ${x}`).toBe('tree');
    expect(active(state.sim)).toEqual(['hedge']);
  });

  it('the coins goal exists before the camera flight and the dialogue; Run right after the hedge stage restarts there', () => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    runAs(state, state.loads[0]);
    until(state.sim, () => active(state.sim).includes('hedge'));
    runAs(state, LEFT);
    until(state.sim, () => active(state.sim).includes('coins'));
    runAs(state, FETCH('de'));
    for (let i = 0; i < 30; i++) state.sim.step();
    runAs(state, FETCH('de'));
    expect(tile(state.sim)).toEqual([14, 5]);
    expect(active(state.sim)).toEqual(['coins']);
  });

  it('a check that passes without a run: Orrin fetches the remaining coins himself', () => {
    const state = play('normal');
    until(state.sim, () => active(state.sim).includes('predict'));
    runAs(state, state.loads[0]);
    until(state.sim, () => active(state.sim).includes('hedge'));
    runAs(state, LEFT);
    until(state.sim, () => active(state.sim).includes('coins'));
    expect(checkAs(state, FETCH('de')).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 6000);
    expect(state.sim.map.items.size).toBe(0);
    expect(state.sim.players[0].stock.gold).toBe(10);
  });

  it.each(WORLDS)('every world starts at every stage with Nelia where the stage before ends (%s)', (w) => {
    expect(tile(startAt(w, 'predict'))).toEqual([2, 5]);
    const hedge = startAt(w, 'hedge');
    expect(tile(hedge)).toEqual([8, 5]);
    expect(hedge.mission.state.objectives.map((o) => o.id)).toEqual(['hedge']);
    expect(tileKind(hedge, 10, 6)).toBe('tree');
    const coins = startAt(w, 'coins');
    expect(tile(coins)).toEqual([14, 5]);
    expect(coins.mission.state.objectives.map((o) => o.id)).toEqual(['coins']);
    expect(tileKind(coins, 10, 6)).toBe('tree');
    expect(coins.map.items.size).toBeGreaterThan(0);
  });
});

describe('Mission II.1 "Prüfen"', () => {
  it('the first stage ends once the loaded program ran, in every world', () => {
    const def = getMission('r2-1');
    const solved = (code) => checkProgram(def, 'predict', { player: code }).results.filter((r) => r.status === 'solved').map((r) => r.world);
    expect(solved(LOADED)).toEqual(WORLDS);
    expect(solved('nelia.fly()\n')).toEqual([]);
  });

  it('the hedge is the same in every world; the swapped function solves it, the unchanged one does not', () => {
    expect(by(check('hedge', LEFT))).toEqual({ normal: 'solved', near: 'solved', far: 'solved' });
    expect(by(check('hedge', LOADED))).toEqual({ normal: 'error', near: 'error', far: 'error' });
    // Walking straight on instead of round the walls: the first wall blocks the road
    expect(by(check('hedge', 'nelia.step(6)\n'))).toEqual({ normal: 'error', near: 'error', far: 'error' });
  });

  it('the coins count only after „Prüfen“; the model solution passes every world', () => {
    const sim = startAt('normal', 'coins');
    expect(sim.mission.objectiveDef('coins').allWorlds).toBe(true);
    expect(!!startAt('normal', 'hedge').mission.objectiveDef('hedge').allWorlds).toBe(false);
    for (const lang of ['de', 'en']) expect(by(check('coins', FETCH(lang)))).toEqual({ normal: 'solved', near: 'solved', far: 'solved' });
  });

  it('hard-coded and sloppy programs fail an edge world', () => {
    const F = FETCH('de');
    const defs = F.slice(0, F.indexOf('while'));
    // The walk of the normal world, written out: runs into the forest edge of the short road (near), reaches for a
    // coin that lies elsewhere (far: take() finds nothing)
    const walk = `${defs}${lines('nelia.step(2)', 'fetch_left()', 'nelia.step()', 'fetch_right()', 'nelia.step(2)', 'fetch_left()', 'nelia.step()', 'fetch_left()',
      'nelia.step()', 'fetch_right()', 'nelia.step(3)', 'fetch_left()', 'fetch_right()', 'nelia.step(2)', 'fetch_right()', 'nelia.step(2)', 'fetch_left()',
      'nelia.step(2)', 'fetch_right()', 'nelia.step()')}`;
    expect(by(check('coins', walk))).toEqual({ normal: 'solved', near: 'error', far: 'error' });
    // Looking before the step misses the coins beside the last tile before the forest (near, far)
    const early = F.replace('while nelia.can_step():\n    nelia.step()\n', 'while nelia.can_step():\n')
      .replace(/(\n    if nelia\.right\(\) == "coin":\n        fetch_right\(\)\n)$/, '$1    nelia.step()\n');
    expect(early).toMatch(/fetch_right\(\)\n    nelia\.step\(\)\n$/);
    expect(by(check('coins', early))).toEqual({ normal: 'solved', near: 'failed', far: 'failed' });
  });
});
