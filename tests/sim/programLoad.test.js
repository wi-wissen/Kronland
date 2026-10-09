// The student's program in a mission (docs/SKRIPTE.md#programm-laden, #etappe-ohne-pruefung):
// - program.load(code) reaches the UI as an event; world switching, „Prüfen“ and stage restarts never load,
// - objective(after_run=True) ends a stage once the program ran and ended normally,
// - npc() figures carry the talk marker only where somebody listens.
import { describe, it, expect } from 'vitest';
import { createScenarioSim, createDefSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { StageSnapshot } from '../../src/sim/stage.js';
import { checkProgram } from '../../src/sim/check.js';

const LOADED = 'steps = 0\nwhile nelia.can_step():\n    nelia.step()\n    steps = steps + 1\n';

function scenario(mission, extra = {}) {
  return {
    format: 'kronland-scenario', version: 2, id: 'program-test', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }], places: { goal: { x: 10, y: 8, r: 0 } } },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'mission', level: 'mission', code: mission },
      { id: 'player', level: 'player', editable: true, code: '# mine\n' },
    ],
    ...extra,
  };
}

/** Steps a sim and collects the program loads it announces. */
function watch(sim) {
  const loads = [];
  const step = sim.step.bind(sim);
  sim.step = (...a) => {
    const events = step(...a);
    for (const e of events) if (e.type === 'programLoad') loads.push(e.code);
    return events;
  };
  return loads;
}
const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
const status = (sim, id) => sim.mission.state.objectives.find((o) => o.id === id)?.status;
const errors = (sim) => sim.mission.script.state.errors.map((e) => e.code);

describe('program.load', () => {
  const LEVEL = scenario([
    '@on_start',
    'def story():',
    '    say("nelia", de="Nimm das.", en="Take this.")',
    `    program.load(${JSON.stringify(LOADED)})`,
    '    objective("go", after_run=True, de="Lauf", en="Run")',
    '    wait_until(lambda: objective_status("go") == "done")',
    `    program.load("# second\\n")`,
    '    objective("again", after_run=True, de="Nochmal", en="Again")',
  ].join('\n'), { worlds: [{ id: 'a' }, { id: 'b' }] });

  it('is an event with the program text; the mission moves on with a second load', () => {
    const sim = createScenarioSim(LEVEL);
    const loads = watch(sim);
    expect(errors(sim)).toEqual([]);
    run(sim, 50);
    expect(loads).toEqual([LOADED]);
    runCode(sim, 'x = 1\n');
    run(sim, 20);
    expect(status(sim, 'go')).toBe('done');
    expect(loads).toEqual([LOADED, '# second\n']);
  });

  it('is no state: not in the save game, not in the hash, and a loaded game does not load again', () => {
    const sim = createScenarioSim(LEVEL);
    run(sim, 50);
    const data = saveGame(sim);
    // Only the mission's own source text carries the program; there is no state for it
    expect(JSON.stringify({ ...data, mission: { ...data.mission, scenario: null } })).not.toContain('steps = steps + 1');
    expect(JSON.stringify(data)).not.toContain('programLoad');
    const copy = loadGame(data);
    expect(copy.hash()).toBe(sim.hash());
    const loads = watch(copy);
    run(copy, 20);
    expect(loads).toEqual([]);
  });

  it('never loads in a world the switcher started at a stage, nor in a check game', () => {
    const def = createScenarioSim(LEVEL).mission.def;
    const sim = createDefSim(def, { world: 'b', stage: 'go' });
    const loads = watch(sim);
    run(sim, 20);
    expect(loads).toEqual([]);
    expect(errors(sim)).toEqual([]);
    const check = checkProgram(def, 'go', { player: 'x = 1\n' });
    expect(check.passed).toBe(true);
    const c = createDefSim(def, { world: 'a', stage: 'go', check: true });
    const cl = watch(c);
    run(c, 20);
    expect(cl).toEqual([]);
  });

  it('a stage restart restores the snapshot without loading again', () => {
    let sim = createScenarioSim(LEVEL);
    const loads = watch(sim);
    run(sim, 50);
    const stage = new StageSnapshot();
    expect(stage.beforeRun(sim)).toBe(null);
    runCode(sim, 'nelia.fly()\n');
    run(sim, 20);
    const next = stage.beforeRun(sim);
    expect(next).not.toBe(null);
    sim = next;
    const more = watch(sim);
    runCode(sim, 'x = 1\n');
    run(sim, 20);
    expect(loads).toEqual([LOADED]);
    expect(more.filter((c) => c === LOADED)).toEqual([]);
  });

  it('rejects wrong arguments with a script error', () => {
    for (const call of ['program.load()', 'program.load(5)', 'program.load("a", "b")']) {
      const sim = createScenarioSim(scenario(`${call}\n`));
      expect(errors(sim), call).toHaveLength(1);
    }
    const big = createScenarioSim(scenario(`program.load("x" * 30000)\n`));
    expect(JSON.stringify(big.mission.script.state.errors[0].params)).toContain('tooBig');
  });
});

describe('objective(after_run=True)', () => {
  const LEVEL = scenario([
    '@on_start',
    'def story():',
    '    objective("one", after_run=True, de="Eins", en="One")',
    '    objective("two", lambda: nelia.is_at(place("goal")), after_run=True, de="Zwei", en="Two")',
    '    objective("late", after_run=True, hidden=True, de="Spät", en="Late")',
    '    wait_until(lambda: objective_status("one") == "done")',
    '    show_objective("late")',
  ].join('\n'));

  it('is met when the program has run and ended normally; an error does not count', () => {
    const sim = createScenarioSim(LEVEL);
    run(sim, 3);
    expect(status(sim, 'one')).toBe('active');
    // Nothing happens before a run, a running program does not count either
    runCode(sim, 'nelia.step(3)\n');
    run(sim, 2);
    expect(sim.mission.script.state.player.status).toBe('running');
    expect(status(sim, 'one')).toBe('active');
    run(sim, 100);
    expect(sim.mission.script.state.player.status).toBe('done');
    expect(status(sim, 'one')).toBe('done');
    // A condition is still needed when there is one (the goal is 6 tiles away)
    expect(status(sim, 'two')).toBe('active');
    runCode(sim, 'nelia.step(3)\n');
    run(sim, 100);
    expect(status(sim, 'two')).toBe('done');
  });

  it('an error does not end the stage', () => {
    const sim = createScenarioSim(LEVEL);
    run(sim, 3);
    runCode(sim, 'nelia.fly()\n');
    run(sim, 20);
    expect(sim.mission.script.state.player.status).toBe('error');
    expect(status(sim, 'one')).toBe('active');
    runCode(sim, 'x = 1\n');
    run(sim, 20);
    expect(status(sim, 'one')).toBe('done');
  });

  it('a goal that appears later does not count runs from before', () => {
    const sim = createScenarioSim(LEVEL);
    run(sim, 3);
    runCode(sim, 'x = 1\n');
    run(sim, 20);
    expect(status(sim, 'one')).toBe('done');
    expect(status(sim, 'late')).toBe('active');
    runCode(sim, 'x = 2\n');
    run(sim, 20);
    expect(status(sim, 'late')).toBe('done');
  });

  it('works with the stage restart and the save game; the stage panel counts it', () => {
    let sim = createScenarioSim(LEVEL);
    run(sim, 3);
    const stage = new StageSnapshot();
    stage.beforeRun(sim);
    runCode(sim, 'nelia.fly()\n');
    run(sim, 20);
    sim = stage.beforeRun(sim);
    // Saved mid-stage, loaded again: the count of runs the goal started at travels with it
    const copy = loadGame(saveGame(sim));
    expect(copy.hash()).toBe(sim.hash());
    runCode(copy, 'x = 1\n');
    run(copy, 20);
    expect(status(copy, 'one')).toBe('done');
    const ui = copy.mission.uiState(copy);
    expect(ui.objectives.filter((o) => o.primary && o.status === 'done').map((o) => o.id)).toEqual(['one']);
  });

  it('solves the stage in a check game once the program ran', () => {
    const def = createScenarioSim(scenario([
      '@on_start',
      'def story():',
      '    objective("one", after_run=True, de="Eins", en="One")',
      '    wait_until(lambda: objective_status("one") == "done")',
      '    victory()',
    ].join('\n'), { worlds: [{ id: 'a' }, { id: 'b' }] })).mission.def;
    expect(checkProgram(def, 'one', { player: 'x = 1\n' }).passed).toBe(true);
    expect(checkProgram(def, 'one', { player: 'nelia.fly()\n' }).passed).toBe(false);
  });
});

describe('npc() talk marker', () => {
  const npcs = (sim) => Object.fromEntries([...sim.entities.values()].filter((e) => e.kind === 'npc').map((e) => [e.npc, e.talk]));
  const make = (code) => createScenarioSim(scenario(code));

  it('is shown only where a handler listens – registered before or after npc()', () => {
    const sim = make([
      'npc("deco", look="serf", at=(8, 8))',
      'npc("after", look="serf", at=(8, 10))',
      '@on_talk("after")',
      'def hi(hero):',
      '    print("hi")',
      '@on_talk("before")',
      'def ho(hero):',
      '    print("ho")',
      'npc("before", look="serf", at=(8, 6))',
      'npc("other", look="serf", at=(8, 4))',
    ].join('\n'));
    expect(errors(sim)).toEqual([]);
    expect(npcs(sim)).toEqual({ deco: false, after: true, before: true, other: false });
  });

  it('a handler for every figure arms them all; start_talking() and stop_talking() stay in the mission\'s hands', () => {
    const all = make('npc("a", at=(8, 8))\n@on_talk\ndef hi(hero):\n    print("hi")\n');
    expect(npcs(all)).toEqual({ a: true });
    const manual = make('a = npc("a", at=(8, 8))\na.start_talking()\n');
    expect(npcs(manual)).toEqual({ a: true });
    const off = make('a = npc("a", at=(8, 8))\n@on_talk("a")\ndef hi(hero):\n    print("hi")\na.stop_talking()\n');
    expect(npcs(off)).toEqual({ a: false });
  });

  it('a figure without a mark cannot be sent a talk order, and no player command can steer it', () => {
    const sim = make('npc("deco", look="serf", at=(8, 8))\n');
    const e = [...sim.entities.values()].find((x) => x.kind === 'npc');
    const hero = [...sim.entities.values()].find((x) => x.kind === 'hero');
    sim.applyCommand({ type: 'order', player: 0, units: [hero.id], order: 'talk', target: e.id });
    expect(sim.events.at(-1)).toMatchObject({ type: 'rejected', reason: 'err.noTalk' });
    // Not an own figure: no order moves it
    sim.applyCommand({ type: 'order', player: 0, units: [e.id], order: 'move', x: 2, y: 2 });
    expect(sim.events.at(-1)).toMatchObject({ type: 'rejected', reason: 'err.noTroops' });
  });

  it('save and load keep the marker', () => {
    const sim = make('npc("deco", at=(8, 8))\nnpc("talker", at=(8, 10))\n@on_talk("talker")\ndef hi(hero):\n    print("hi")\n');
    const copy = loadGame(saveGame(sim));
    expect(npcs(copy)).toEqual({ deco: false, talker: true });
    expect(copy.hash()).toBe(sim.hash());
  });
});
