// Mission I.M "Heimweg durchs Unterholz": one forest per world (three worlds = the same task on three maps), two
// consecutive stages in each forest: a winding path to the clearing, then the forking thicket up to the exit. The
// program grows from stage to stage, nothing is loaded or teleported between them; the final stage counts only once
// „Prüfen“ solved it in all forests. Played like the engine does it (snapshot before every run, src/sim/stage.js).
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
const place = (sim, id) => { const p = sim.mission.script.state.places[id]; return [p.x, p.y]; };
const active = (sim) => sim.mission.state.objectives.filter((o) => o.status === 'active').map((o) => o.id);
const playerErrors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const said = (sim, re) => sim.mission.state.messages.some((m) => re.test(m.text?.de ?? ''));
const by = (r) => Object.fromEntries(r.results.map((x) => [x.world, x.status]));
const check = (stage, code) => checkProgram(getMission('r1-m'), stage, { player: code });

/** Wait (at most n ticks) until a condition holds. */
function until(sim, cond, n = 3000) {
  for (let i = 0; i < n && !cond(); i++) sim.step();
  expect(cond()).toBe(true);
}

/** A mission played like the engine: Run restores the stage snapshot first. */
function play(world) {
  const state = { sim: createMissionSim('r1-m', { world }), stage: new StageSnapshot() };
  expect(state.sim.mission.script.state.errors).toEqual([]);
  return state;
}
function runAs(state, code) {
  const next = state.stage.beforeRun(state.sim);
  if (next) state.sim = next;
  state.sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
}
function checkAs(state, code) {
  const r = checkProgram(state.sim.mission.def, stageKey(state.sim), { player: code });
  state.sim.command({ type: 'script', player: 0, action: 'check', stage: r.stage, passed: r.passed });
  return r;
}

// Stage 1: walk while the way ahead is free, otherwise turn right (the winding path has right turns only)
const PATH = lines('while not nelia.is_at(place("clearing")):', '    if nelia.can_step():', '        nelia.step()', '    else:', '        nelia.turn_right()');
// Stage 2: the same, aimed at the exit – wrong in a forking thicket, it runs in circles
const SIMPLE_EXIT = PATH.replace('"clearing"', '"exit"');
const RIGHT_HAND = (lang) => refExample('thicket', lang);

describe('I.M "Heimweg durchs Unterholz": one forest per world', () => {
  it('has three worlds, each a complete forest map without cliff walls and without sections', () => {
    expect(getScenario('r1-m').worlds.map((w) => w.id)).toEqual(WORLDS);
    const plans = new Set();
    for (const w of WORLDS) {
      const sim = createMissionSim('r1-m', { world: w });
      expect(sim.mission.script.state.errors, w).toEqual([]);
      let cliffs = 0, trees = 0;
      for (let y = 0; y < sim.map.height; y++) for (let x = 0; x < sim.map.width; x++) {
        const k = tileKind(sim, x, y);
        if (k === 'cliff') cliffs++;
        if (k === 'tree') trees++;
      }
      expect(cliffs, w).toBe(0);
      expect(trees, w).toBeGreaterThan(100);
      plans.add(trees);
      for (const p of ['start', 'clearing', 'exit', 'square']) expect(place(sim, p), `${w}/${p}`).toBeTruthy();
      // The stranger waits next to the exit from the start (no talk marker: nobody listens)
      expect(sim.mission.script.state.places.square).toBeTruthy();
      expect(tile(sim)).toEqual(place(sim, 'start'));
    }
    expect(plans.size).toBe(3);
  });

  it('near: a tree stands right in front of Nelia, clearing and exit are close; far: long corridors', () => {
    const dist = (w, a, b) => { const s = createMissionSim('r1-m', { world: w }); const p = place(s, a), q = place(s, b); return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]); };
    const near = createMissionSim('r1-m', { world: 'near' });
    const [sx, sy] = place(near, 'start');
    expect(near.map.walkable(sx + 1, sy)).toBe(false);
    expect(dist('near', 'start', 'exit')).toBeLessThan(dist('normal', 'start', 'exit'));
    expect(dist('far', 'clearing', 'exit')).toBeGreaterThan(dist('near', 'clearing', 'exit'));
  });

  it('no program is loaded at the start; the program stays and grows', () => {
    const sim = createMissionSim('r1-m');
    const loads = [];
    const step = sim.step.bind(sim);
    sim.step = (...a) => { const ev = step(...a); for (const e of ev) if (e.type === 'programLoad') loads.push(e.code); return ev; };
    until(sim, () => active(sim).includes('path'));
    for (let i = 0; i < 100; i++) sim.step();
    expect(loads).toEqual([]);
  });
});

describe.each(WORLDS)('I.M in the %s forest: the stages are consecutive legs of one journey', (world) => {
  it.each(['de', 'en'])('winding path, then right hand: the model solutions win (%s)', (lang) => {
    const state = play(world);
    until(state.sim, () => active(state.sim).includes('path'));
    expect(tile(state.sim)).toEqual(place(state.sim, 'start'));

    // Stage 1 (ends in the played world): walk, turn right when blocked – it reaches the clearing, the program is then stopped
    runAs(state, PATH);
    until(state.sim, () => active(state.sim).includes('thicket'), 4000);
    const end = { tile: tile(state.sim), face: hero(state.sim).face };
    expect(end.tile).toEqual(place(state.sim, 'clearing'));
    // Hand-over: nothing was teleported, a fresh start of stage 2 equals the end of stage 1
    const fresh = createMissionSim('r1-m', { world, stage: 'thicket' });
    until(fresh, () => active(fresh).includes('thicket'));
    expect({ tile: tile(fresh), face: hero(fresh).face }).toEqual(end);
    expect(fresh.map.items.size).toBe(state.sim.map.items.size);
    expect([...fresh.entities.values()].filter((e) => e.kind === 'npc').length).toBe([...state.sim.entities.values()].filter((e) => e.kind === 'npc').length);

    // Stage 2: the simple rule runs in circles (stopped by hand), the right-hand rule finds the exit – then „Prüfen“ in all worlds
    runAs(state, SIMPLE_EXIT);
    for (let i = 0; i < 600; i++) state.sim.step();
    expect(active(state.sim)).toEqual(['thicket']);
    state.sim.command({ type: 'script', player: 0, action: 'stop' });
    until(state.sim, () => said(state.sim, /Ich drehe mich im Kreis/));
    runAs(state, RIGHT_HAND(lang));
    until(state.sim, () => said(state.sim, /Drück jetzt „Prüfen“/), 6000);
    expect(active(state.sim)).toEqual(['thicket']);
    expect(tile(state.sim)).toEqual(place(state.sim, 'exit'));
    expect(checkAs(state, RIGHT_HAND(lang)).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 6000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(state.sim.mission.state.messages.some((m) => m.speaker === 'stranger')).toBe(true);
    expect(playerErrors(state.sim)).toEqual([]);
  });

  it('a check that passes without a run walks Nelia to the exit; starting at either stage works', () => {
    const state = play(world);
    runAs(state, PATH);
    until(state.sim, () => active(state.sim).includes('thicket'), 4000);
    expect(checkAs(state, RIGHT_HAND('de')).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 6000);
    expect(tile(state.sim)).toEqual(place(state.sim, 'exit'));
    const first = createMissionSim('r1-m', { world });
    until(first, () => active(first).includes('path'));
    expect(tile(first)).toEqual(place(first, 'start'));
    expect(first.mission.state.objectives.map((o) => o.id)).toEqual(['path']);
  });
});

describe('I.M "Prüfen"', () => {
  it('the final stage counts only after „Prüfen“; the model solution passes every forest, the first stage in the played one', () => {
    const sim = createMissionSim('r1-m', { stage: 'thicket' });
    until(sim, () => active(sim).includes('thicket'));
    expect(sim.mission.objectiveDef('thicket').allWorlds).toBe(true);
    const sim1 = createMissionSim('r1-m');
    until(sim1, () => active(sim1).includes('path'));
    expect(!!sim1.mission.objectiveDef('path').allWorlds).toBe(false);
    const all = { normal: 'solved', near: 'solved', far: 'solved' };
    expect(by(check('path', PATH))).toEqual(all);
    for (const lang of ['de', 'en']) expect(by(check('thicket', RIGHT_HAND(lang)))).toEqual(all);
  });

  it('hard-coded and sloppy programs fail', () => {
    // The way of the normal forest, written out: the tree right in front of Nelia (near) blocks the first step
    const path = lines('nelia.step(3)', 'nelia.turn_right()', 'nelia.step(2)', 'nelia.turn_right()', 'nelia.step(5)', 'nelia.turn_right()', 'nelia.step(5)', 'nelia.turn_right()', 'nelia.step(9)');
    const r = check('path', path);
    expect(r.passed).toBe(false);
    expect(by(r).normal).toBe('solved');
    expect(by(r).near).toBe('error');
    expect(r.results.find((x) => x.world === 'near').error).toMatchObject({ sline: 1 });
    // Turning right when blocked runs in circles in every forking thicket
    expect(by(check('thicket', SIMPLE_EXIT))).toEqual({ normal: 'timeout', near: 'timeout', far: 'timeout' });
    // Right hand without looking before the step: stuck at the first dead end in some forest
    const lazy = lines('while not nelia.is_at(place("exit")):', '    if nelia.can_step():', '        nelia.step()', '    else:', '        nelia.turn_left()');
    expect(check('thicket', lazy).passed).toBe(false);
  });
});
