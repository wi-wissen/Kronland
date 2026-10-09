// Worlds of a mission (docs/SKRIPTE.md#welten): format and checker, world.id/world.stage in the world code,
// determinism and save game per world, „Prüfen“ (src/sim/check.js) and goals with all_worlds=True.
import { describe, it, expect } from 'vitest';
import { createScenarioSim, createDefSim } from '../../src/sim/missions/runtime.js';
import { validateScenario, validateWorlds, worldsOf, scenarioToDef, SCENARIO_LIMITS } from '../../src/sim/scripting/scenario.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { stageKey } from '../../src/sim/stage.js';
import { checkProgram, WorldCheck } from '../../src/sim/check.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tileX = (sim) => Math.floor(hero(sim).px / 1000);

// A coin lies 3, 1 or 6 tiles east of Nelia; the goal "coin" only counts in every world (all_worlds=True)
const WORLD = [
  'DIST = {"normal": 3, "near": 1, "far": 6}[world.id]',
  'add_item("coin", 4 + DIST, 8)',
  'add_tree(4 + DIST + 2, 8)',
].join('\n');
const MISSION = [
  'STAGES = ["warm", "coin"]',
  'first = STAGES.index(world.stage) if world.stage in STAGES else 0',
  'print("world", world.id, world.stage)',
  '@on_start',
  'def story():',
  '    if first == 0:',
  '        objective("warm", lambda: program.runs > 0 and program.status == "done", de="Lauf los", en="Go")',
  '        wait_until(lambda: objective_status("warm") == "done")',
  '    objective("coin", lambda: len(items("coin")) == 0, all_worlds=True, de="Taler", en="Coin")',
  '    wait_until(lambda: objective_status("coin") == "done")',
  '    victory()',
].join('\n');

function scenario(extra = {}) {
  return {
    format: 'kronland-scenario', version: 2, id: 'worlds-test', kind: 'adventure', end: 'script',
    worlds: [
      { id: 'normal', title: { de: 'Normalfall', en: 'Normal case' } },
      { id: 'near', title: { de: 'Ganz nah', en: 'Close' } },
      { id: 'far', title: 'Far', seed: 7 },
    ],
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }] },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'world', level: 'mission', code: WORLD },
      { id: 'mission', level: 'mission', code: MISSION },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
    ...extra,
  };
}

const GOOD = 'while nelia.here() != "coin":\n    nelia.step()\nnelia.take()\n';
const HARD = 'nelia.step(3)\nnelia.take()\n';
const LOOP = 'while True:\n    x = 1\n';

describe('Worlds: format', () => {
  it('validates the worlds list: ids, titles, seeds, at most six', () => {
    expect(validateScenario(scenario())).toEqual([]);
    expect(validateWorlds(undefined)).toEqual([]);
    expect(validateWorlds([])).toEqual(['worlds must be a non-empty list']);
    expect(validateWorlds([{ id: 'a' }, { id: 'a' }]).join()).toMatch(/duplicate id/);
    expect(validateWorlds([{ id: '1x' }]).join()).toMatch(/worlds\[0\]\.id/);
    expect(validateWorlds([{ id: 'a', title: 5 }]).join()).toMatch(/title/);
    expect(validateWorlds([{ id: 'a', seed: -1 }]).join()).toMatch(/seed/);
    const many = Array.from({ length: SCENARIO_LIMITS.worlds + 1 }, (_, i) => ({ id: `w${i}` }));
    expect(validateWorlds(many).join()).toMatch(/at most 6 worlds/);
    expect(validateScenario(scenario({ worlds: 'normal' })).join()).toMatch(/worlds must be/);
    // Invalid worlds never reach a game; one world = no worlds field
    expect(worldsOf({ worlds: [{ id: 'a' }, { id: 'a' }] })).toEqual([]);
    expect(scenarioToDef(scenario()).worlds.map((w) => w.id)).toEqual(['normal', 'near', 'far']);
  });

  it('a level without worlds runs as before: world.id is None, no check needed', () => {
    const s = scenario();
    delete s.worlds;
    s.sections[0].code = 'add_item("coin", 7, 8)\nprint(world.id)';
    const sim = createScenarioSim(s);
    expect(sim.mission.state.world).toBe(null);
    expect(sim.mission.script.state.console.map((c) => c.text)).toContain('None');
    expect(sim.mission.uiState(sim).worlds).toEqual([]);
  });
});

describe('Worlds: start options', () => {
  it('builds the chosen world (first world by default, unknown ids fall back), with its own seed', () => {
    const a = createScenarioSim(scenario());
    expect(a.mission.state.world).toBe('normal');
    expect([...a.map.items.keys()].length).toBe(1);
    expect(a.map.items.has(a.map.idx(7, 8))).toBe(true);
    const b = createScenarioSim(scenario(), { world: 'near' });
    expect(b.map.items.has(b.map.idx(5, 8))).toBe(true);
    expect(createScenarioSim(scenario(), { world: 'nope' }).mission.state.world).toBe('normal');
    expect(createScenarioSim(scenario(), { world: 'far' }).seed).toBe(7);
    expect(b.mission.uiState(b)).toMatchObject({ world: 'near', worlds: [{ id: 'normal' }, { id: 'near' }, { id: 'far' }] });
  });

  it('world.stage starts the mission at a stage (switcher, check)', () => {
    const sim = createScenarioSim(scenario(), { world: 'far', stage: 'coin' });
    run(sim, 3);
    expect(stageKey(sim)).toBe('coin');
    expect(sim.mission.state.objectives.map((o) => o.id)).toEqual(['coin']);
    expect(sim.mission.script.state.console.map((c) => c.text)).toContain('world far coin');
  });

  it('is deterministic per world and part of the hash', () => {
    const play = (world) => {
      const sim = createScenarioSim(scenario(), { world });
      run(sim, 2);
      sim.command({ type: 'script', player: 0, action: 'run', sections: { player: GOOD } });
      run(sim, 80);
      return sim.hash();
    };
    expect(play('near')).toBe(play('near'));
    expect(play('near')).not.toBe(play('normal'));
    // Same map, only another world id or start stage: still another hash
    const h = (o) => createScenarioSim(scenario({ sections: [{ id: 'player', level: 'player', editable: true, code: '' }] }), o).hash();
    expect(h({ world: 'normal' })).not.toBe(h({ world: 'near' }));
    expect(h({ world: 'near', stage: 'coin' })).not.toBe(h({ world: 'near' }));
  });

  it('save and load keep the world, the start stage and passed checks', () => {
    const sim = createScenarioSim(scenario(), { world: 'near', stage: 'coin' });
    run(sim, 5);
    sim.command({ type: 'script', player: 0, action: 'check', stage: 'coin', passed: true });
    sim.step();
    const back = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(back.mission.state).toMatchObject({ world: 'near', startStage: 'coin', checked: { coin: true } });
    expect(back.hash()).toBe(sim.hash());
    run(back, 3);
    run(sim, 3);
    expect(back.hash()).toBe(sim.hash());
  });
});

describe('Worlds: „Prüfen“', () => {
  const def = { ...scenarioToDef(scenario()), custom: true };

  it('a general program solves every world', () => {
    const r = checkProgram(def, 'coin', { player: GOOD });
    expect(r.passed).toBe(true);
    expect(r.results.map((x) => [x.world, x.status])).toEqual([['normal', 'solved'], ['near', 'solved'], ['far', 'solved']]);
  });

  it('a hard-coded program fails the edge cases: which world, which line', () => {
    const r = checkProgram(def, 'coin', { player: HARD });
    expect(r.passed).toBe(false);
    const by = Object.fromEntries(r.results.map((x) => [x.world, x]));
    expect(by.normal.status).toBe('solved');
    // near: three steps run into the tree behind the coin (line 1); far: take() finds no coin yet (line 2)
    expect(by.near).toMatchObject({ status: 'error', error: { section: 'player', sline: 1 } });
    expect(by.far).toMatchObject({ status: 'error', error: { section: 'player', sline: 2 } });
  });

  it('syntax errors, endless loops and unreachable stages are reported per world', () => {
    const syntax = checkProgram(def, 'coin', { player: 'nelia.step(\n' });
    expect(syntax.results.every((x) => x.status === 'error' && x.error.section === 'player')).toBe(true);
    const loop = new WorldCheck(def, 'normal', 'coin', { player: LOOP }, { runTicks: 60 }).advance(Infinity);
    expect(loop.status).toBe('timeout');
    expect(checkProgram(def, 'nothing', { player: GOOD }, { setupTicks: 30 }).results[0].status).toBe('nostage');
  });

  it('an all_worlds goal waits for a passed check; the check command only counts for the current stage', () => {
    const sim = createScenarioSim(scenario(), { stage: 'coin' });
    run(sim, 3);
    sim.command({ type: 'script', player: 0, action: 'run', sections: { player: GOOD } });
    run(sim, 100);
    const coin = () => sim.mission.state.objectives.find((o) => o.id === 'coin');
    // Solved here – but not yet in every world
    expect(sim.map.items.size).toBe(0);
    expect(coin()).toMatchObject({ status: 'active', here: true });
    expect(sim.mission.uiState(sim).objectives[0]).toMatchObject({ allWorlds: true, here: true });
    // A failed check changes nothing, a check of another stage is rejected
    sim.command({ type: 'script', player: 0, action: 'check', stage: 'coin', passed: false });
    sim.command({ type: 'script', player: 0, action: 'check', stage: 'warm', passed: true });
    run(sim, 3);
    expect(coin().status).toBe('active');
    sim.command({ type: 'script', player: 0, action: 'check', stage: 'coin', passed: true });
    run(sim, 3);
    expect(coin().status).toBe('done');
    expect(sim.mission.state.result).toMatchObject({ won: true });
  });

  it('a passed check completes the stage even without a run in the current world', () => {
    const sim = createScenarioSim(scenario(), { world: 'far', stage: 'coin' });
    run(sim, 3);
    const r = checkProgram(sim.mission.def, stageKey(sim), { player: GOOD });
    sim.command({ type: 'script', player: 0, action: 'check', stage: r.stage, passed: r.passed });
    run(sim, 3);
    expect(sim.mission.state.result).toMatchObject({ won: true });
    expect(tileX(sim)).toBe(4);
  });

  it('check games do not need the check: all_worlds goals count on their condition there', () => {
    const sim = createDefSim(def, { world: 'near', stage: 'coin', check: true });
    run(sim, 3);
    sim.command({ type: 'script', player: 0, action: 'run', sections: { player: GOOD } });
    run(sim, 60);
    expect(sim.mission.state.objectives[0].status).toBe('done');
  });
});
