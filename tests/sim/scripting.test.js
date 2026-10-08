// Python scripts in the simulation: scenarios, player programs, events, goals, debugger,
// saving mid-run and determinism.

import { describe, it, expect } from 'vitest';
import { createMissionSim, createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { validateScenario, emptyScenario } from '../../src/sim/scripting/scenario.js';
import { SCENARIOS } from '../../src/sim/missions/levels/index.js';
import { WATER } from '../../src/sim/map.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code, extra = {}) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code }, ...extra });
const heroOf = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tileOf = (e) => [Math.floor(e.px / 1000), Math.floor(e.py / 1000)];
const consoleText = (sim) => sim.mission.script.state.console.map((c) => c.text).join('\n');

/** Small test scenario on a flat meadow. */
function scenario(sections, extra = {}) {
  return {
    format: 'kronland-scenario', version: 1, id: 'test', kind: 'adventure',
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }], places: { goal: { x: 10, y: 8, r: 0 } } },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    texts: { hi: { de: 'Hallo!', en: 'Hello!' } },
    sections,
    ...extra,
  };
}
const playerSection = (code = 'hero.step()\n') => ({ id: 'player', level: 'player', editable: true, visibility: 'open', code });

describe('Scenarios', () => {
  it('shipped scenarios are a valid JSON format', () => {
    for (const s of SCENARIOS) {
      expect(validateScenario(s), s.id).toEqual([]);
      expect(JSON.parse(JSON.stringify(s)), s.id).toEqual(s);
    }
    expect(validateScenario(emptyScenario())).toEqual([]);
    expect(validateScenario({ format: 'x' }).length).toBeGreaterThan(0);
  });

  it('learning adventure 1: a loop brings Nelia to the treasure, two steps are not enough', () => {
    const sim = createMissionSim('adv1');
    expect(sim.mission.script.state.errors).toEqual([]);
    expect(heroOf(sim)).toBeTruthy();
    expect(sim.findBuilding(0, 'headquarters')).toBeNull();
    runCode(sim, 'hero.step()\nhero.step()\n');
    run(sim, 200);
    expect(sim.mission.state.result).toBeNull();
    expect(tileOf(heroOf(sim))).toEqual([6, 6]);
    runCode(sim, 'for i in range(8):\n    hero.step()\n');
    run(sim, 400);
    expect(sim.mission.state.result).toMatchObject({ won: true, reason: 'script' });
    expect(sim.mission.state.messages.map((m) => m.speaker)).toEqual(['nelia', 'nelia']);
  });

  it('player programs do not know the mission API', () => {
    const sim = createScenarioSim(scenario([playerSection()]));
    runCode(sim, 'spawn(1, "sword1", hero)');
    sim.step();
    const err = sim.mission.script.state.errors[0];
    expect(err).toMatchObject({ code: 'err.script.nameUnknown', level: 'player', section: 'player', sline: 1 });
  });

  it('errors are assigned to the section and its line', () => {
    const sim = createScenarioSim(scenario([
      { id: 'a', level: 'mission', code: 'x = 1\ny = 2\n' },
      { id: 'b', level: 'mission', code: 'z = 3\nprint(10 / 0)\n' },
    ]));
    const e = sim.mission.script.state.errors[0];
    expect(e).toMatchObject({ kind: 'ZeroDivisionError', line: 4, section: 'b', sline: 2 });
  });

  it('print() only writes to the console (no notice event) and marks where the current run starts', () => {
    const sim = createScenarioSim(scenario([playerSection()]));
    runCode(sim, 'print(wod)\n');
    sim.step();
    expect(sim.mission.script.state.player.status).toBe('error');
    const before = sim.mission.script.state.seq;
    runCode(sim, 'print("a", end="")\nprint("b")\nprint("x\\ny")\n');
    const events = [];
    for (let i = 0; i < 5; i++) events.push(...sim.step());
    expect(events.filter((e) => e.type === 'scriptNotify' || e.type === 'scriptPrint')).toEqual([]);
    const st = sim.mission.script.uiState();
    expect(st.player.since).toBe(before);
    // Everything after `since` belongs to this run: the old NameError is not part of it
    expect(st.console.filter((c) => c.seq > st.player.since).map((c) => c.text)).toEqual(['ab', 'x', 'y']);
  });

  it('notify() emits a display event, folds a loop within one tick and leaves the console alone', () => {
    const sim = createScenarioSim(scenario([playerSection()]));
    runCode(sim, 'notify("Hallo")\nwait(0.1)\nfor i in range(500):\n    notify(i)\nwait(0.1)\nnotify(hero)\nnotify(None)\n');
    const events = [];
    for (let i = 0; i < 6; i++) events.push(...sim.step());
    const notes = events.filter((e) => e.type === 'scriptNotify');
    expect(notes.map((e) => [e.text, e.n])).toEqual([['Hallo', 1], ['499', 500], ['None', 2]]);
    expect(notes.every((e) => e.level === 'player' && e.player === 0)).toBe(true);
    expect(consoleText(sim)).toBe('');
    expect(sim.mission.script.state.player.status).toBe('done');
    // Error: missing text
    runCode(sim, 'notify()\n');
    sim.step();
    expect(sim.mission.script.state.errors.at(-1)).toMatchObject({ code: 'err.script.argMissing' });
  });

  it('notify() is also available to mission scripts and does not change the saved state', () => {
    const sim = createScenarioSim(scenario([{ id: 'm', level: 'mission', code: '@on_start\ndef s():\n    notify("Start")\n' }, playerSection()]));
    const events = [];
    for (let i = 0; i < 3; i++) events.push(...sim.step());
    expect(events.filter((e) => e.type === 'scriptNotify')).toMatchObject([{ text: 'Start', level: 'mission', n: 1 }]);
    const copy = loadGame(saveGame(sim));
    expect(copy.hash()).toBe(sim.hash());
  });

  it('hero: turning, facing direction, obstacles, take() and chop()', () => {
    const sim = createScenarioSim(scenario([
      { id: 'w', level: 'mission', code: 'add_tree(6, 8)\nadd_pile("stone", 4, 7, 50)\n' },
      playerSection(),
    ]));
    runCode(sim, [
      'print(hero.facing, hero.ahead(), hero.can_step())',
      'hero.step()',
      'print(hero.ahead())',
      'hero.chop()',
      'print(stock("wood") > 0, hero.ahead())',
      'hero.turn_left()',
      'hero.step(0)',
      'print(hero.facing)',
      'hero.turn_to("west")',
      'hero.step()',
      'hero.turn_right()',
      'print(hero.ahead())',
      's0 = stock("stone")',
      'print(hero.take(), stock("stone") - s0)',
      'hero.step()',
      'hero.step()',
    ].join('\n'));
    run(sim, 200);
    expect(consoleText(sim)).toBe(['east free True', 'tree', 'True free', 'north', 'pile', 'stone 50'].join('\n'));
    // after two steps north he stands at (4, 6)
    expect(tileOf(heroOf(sim))).toEqual([4, 6]);
  });

  it('hero without a castle looks east and keeps the facing direction when stepping', () => {
    const sim = createScenarioSim(scenario([playerSection('hero.turn_right()\nhero.step()\nhero.step()\n')]));
    const h = heroOf(sim);
    expect(h.face).toBe(1);
    runCode(sim, 'hero.turn_right()\nhero.step()\nhero.step()\n');
    run(sim, 120);
    expect(h.face).toBe(2);
    expect(tileOf(h)).toEqual([4, 10]);
  });

  it('walking into a tree is an error with a reason', () => {
    const sim = createScenarioSim(scenario([{ id: 'w', level: 'mission', code: 'add_tree(6, 8)\n' }, playerSection()]));
    runCode(sim, 'hero.step()\nhero.step()\n');
    run(sim, 100);
    const st = sim.mission.script.state;
    expect(st.player.status).toBe('error');
    expect(st.errors[0]).toMatchObject({ kind: 'GameError', sline: 2, params: { reason: 'script.game.blocked', reasonParams: { what: 'tree' } } });
    expect(tileOf(heroOf(sim))).toEqual([5, 8]);
  });
});

describe('Mission scripts', () => {
  it('on_start, say (blocks by text length), every, wait_until, goals with condition', () => {
    const sim = createScenarioSim(scenario([{
      id: 'm', level: 'mission', code: [
        'log = []',
        '@on_start',
        'def start():',
        '    objective("walk", "Geh zum Ziel", lambda: hero.is_at(place("goal")))',
        '    say("nelia", "hi")',
        '    log.append(("said", int(time())))',
        '    ok = wait_until(lambda: hero.is_at(place("goal")), timeout=60)',
        '    log.append(("reached", ok))',
        '    victory()',
        'ticks = 0',
        '@every(2)',
        'def tick():',
        '    global ticks',
        '    ticks += 1',
      ].join('\n'),
    }, playerSection()]));
    run(sim, 2);
    const m = sim.mission.state;
    expect(m.messages[0]).toMatchObject({ speaker: 'nelia', text: { de: 'Hallo!', en: 'Hello!' } });
    expect(m.objectives).toEqual([expect.objectContaining({ id: 'walk', status: 'active' })]);
    runCode(sim, 'hero.move_to(place("goal"))');
    run(sim, 300);
    expect(m.result).toMatchObject({ won: true });
    const vm = sim.mission.script.vms.mission;
    expect(vm.repr(vm.globals.get('log'))).toMatch(/^\[\('said', 3\), \('reached', True\)\]$/);
    expect(vm.globals.get('ticks')).toBeGreaterThanOrEqual(1);
    expect(m.objectives[0].status).toBe('done');
  });

  it('skipping dialogue ends the wait immediately', () => {
    const sim = createScenarioSim(scenario([{ id: 'm', level: 'mission', code: 'say("nelia", "x" * 200)\nprint("weiter", int(time()))\n' }, playerSection()]));
    run(sim, 5);
    expect(consoleText(sim)).toBe('');
    sim.command({ type: 'script', player: 0, action: 'skipDialog' });
    run(sim, 2);
    expect(consoleText(sim)).toMatch(/^weiter 0$/);
  });

  it('events from the simulation: on_building_placed with filter', () => {
    const sc = scenario([{
      id: 'm', level: 'mission', code: [
        'seen = []',
        '@on_building_placed("residence")',
        'def placed(b):',
        '    seen.append((b.type, b.done))',
        '@on_building_placed',
        'def any_building(b):',
        '    seen.append("any")',
      ].join('\n'),
    }]);
    sc.players[0].hq = true;
    sc.world.size = 40; sc.world.width = 40; sc.world.height = 40; sc.world.starts = [{ x: 10, y: 10 }];
    const sim = createScenarioSim(sc);
    const p = sim.findPlacement(0, 'residence', 18, 18);
    sim.command({ type: 'placeBuilding', player: 0, building: 'residence', x: p.x, y: p.y });
    run(sim, 3);
    const vm = sim.mission.script.vms.mission;
    expect(vm.repr(vm.globals.get('seen'))).toBe("[('residence', False), 'any']");
  });

  it('world building: shape terrain, water, places; rendering gets one event per tick', () => {
    const sim = createScenarioSim(scenario([{
      id: 'w', level: 'mission', code: [
        'for x in range(8, 12):',
        '    for y in range(2, 5):',
        '        world.set_water(x, y)',
        'world.set_height(1, 1, 999)',
        'make_place("lake", 10, 3, 2)',
        'print(world.width, world.height, world.is_water(9, 3), world.height_at(1, 1), place("lake").x)',
        '@every(1)',
        'def later():',
        '    world.set_height(2, 2, 500)',
      ].join('\n'),
    }]));
    const m = sim.map;
    expect(m.flags[m.idx(9, 3)] & WATER).toBeTruthy();
    expect(consoleText(sim)).toBe('24 16 True 999 10');
    const evs = [];
    for (let i = 0; i < 12; i++) evs.push(...sim.step().filter((e) => e.type === 'terrainChanged'));
    expect(evs.length).toBeGreaterThan(0);
    expect(m.heights[m.idx(2, 2)]).toBe(500);
  });
});

describe('Debugger via commands', () => {
  it('single step stops at every statement, the UI sees line and variables', () => {
    const sim = createScenarioSim(scenario([playerSection()]));
    runCode(sim, 'a = 1\nb = a + 1\nprint(a, b)\n', { debug: { mode: 'step' } });
    run(sim, 1);
    let ui = sim.mission.uiState(sim).script.player;
    expect(ui.status).toBe('paused');
    expect(ui.line).toEqual({ section: 'player', line: 1 });
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'into' });
    run(sim, 1);
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'into' });
    run(sim, 1);
    ui = sim.mission.uiState(sim).script.player;
    expect(ui.line.line).toBe(3);
    expect(ui.vars.globals).toEqual([{ name: 'a', type: 'int', value: '1' }, { name: 'b', type: 'int', value: '2' }]);
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'continue' });
    run(sim, 1);
    expect(sim.mission.uiState(sim).script.player.status).toBe('done');
    expect(consoleText(sim)).toBe('1 2');
  });

  it('breakpoints per section', () => {
    const sim = createScenarioSim(scenario([playerSection()]));
    runCode(sim, 'x = 0\nfor i in range(3):\n    x += i\nprint(x)\n', { debug: { mode: 'run', bps: { player: [4] } } });
    run(sim, 1);
    const ui = sim.mission.uiState(sim).script.player;
    expect(ui).toMatchObject({ status: 'paused', line: { line: 4 } });
    expect(ui.vars.globals.find((g) => g.name === 'x').value).toBe('3');
  });

  it('stop halts program and hero', () => {
    const sim = createScenarioSim(scenario([playerSection()]));
    runCode(sim, 'while True:\n    hero.turn_left()\n');
    run(sim, 10);
    sim.command({ type: 'script', player: 0, action: 'stop' });
    run(sim, 1);
    expect(sim.mission.script.state.player.status).toBe('stopped');
    expect(sim.mission.script.vms.player).toBeNull();
  });
});

describe('Saving and determinism', () => {
  const code = 'import random\nfor i in range(6):\n    hero.step()\n    print(i, random.randint(1, 9))\n';
  const mission = 'n = 0\n@every(1)\ndef count():\n    global n\n    n += 1\n@on_start\ndef s():\n    say("nelia", "hi")\n';

  it('same commands, same hash', () => {
    const a = createScenarioSim(scenario([{ id: 'm', level: 'mission', code: mission }, playerSection()]));
    const b = createScenarioSim(scenario([{ id: 'm', level: 'mission', code: mission }, playerSection()]));
    for (const s of [a, b]) { runCode(s, code); run(s, 60); }
    expect(a.hash()).toBe(b.hash());
    expect(consoleText(a)).toBe(consoleText(b));
  });

  it('loading mid-program continues the same way (hash and output)', () => {
    const mk = () => createScenarioSim(scenario([{ id: 'm', level: 'mission', code: mission }, playerSection()]));
    const ref = mk();
    runCode(ref, code);
    run(ref, 80);
    const sim = mk();
    runCode(sim, code);
    run(sim, 17);
    // save game as text (like localStorage) and back
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.hash()).toBe(sim.hash());
    run(loaded, 63);
    expect(loaded.tick).toBe(ref.tick);
    expect(consoleText(loaded)).toBe(consoleText(ref));
    expect(loaded.hash()).toBe(ref.hash());
  });

  it('own scenarios are part of the save game', () => {
    const sim = createScenarioSim(scenario([{ id: 'm', level: 'mission', code: 'x = 41\n' }]));
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    expect(data.mission.scenario.id).toBe('test');
    const loaded = loadGame(data);
    expect(loaded.mission.script.vms.mission.globals.get('x')).toBe(41);
  });
});

describe('Learning adventures are solvable with a model solution', () => {
  const SOLUTIONS = {
    adv1: 'for i in range(10):\n    hero.step()\n',
    adv2: 'while not hero.is_at(place("goal")):\n    if hero.can_step():\n        hero.step()\n    else:\n        hero.turn_right()\n',
    adv3: 'hero.step()\nwhile hero.ahead() == "tree":\n    hero.chop()\n    hero.step()\n',
    adv4: [
      'def check_side(turn, back):',
      '    turn()',
      '    if hero.ahead() == "pile":',
      '        hero.take()',
      '    back()',
      'while hero.can_step():',
      '    hero.step()',
      '    check_side(hero.turn_left, hero.turn_right)',
      '    check_side(hero.turn_right, hero.turn_left)',
    ].join('\n'),
    adv5: [
      'def build_one(kind):',
      '    spot = find_spot(kind, hq())',
      '    site = build(kind, spot[0], spot[1])',
      '    for s in serfs(idle=True)[:3]:',
      '        s.work_on(site)',
      'build_one("residence")',
      'build_one("residence")',
      'build_one("farm")',
    ].join('\n'),
  };
  for (const [id, code] of Object.entries(SOLUTIONS)) {
    it(id, () => {
      const sim = createMissionSim(id);
      expect(sim.mission.script.state.errors).toEqual([]);
      sim.step();
      // the template in the adventure compiles without errors
      const tpl = sim.mission.def.scenario.sections.find((s) => s.level === 'player').code;
      runCode(sim, tpl);
      sim.step();
      expect(sim.mission.script.state.errors.filter((e) => e.kind === 'SyntaxError' || e.kind === 'NameError')).toEqual([]);
      sim.command({ type: 'script', player: 0, action: 'stop' });
      runCode(sim, code);
      run(sim, 4000);
      expect(sim.mission.script.state.errors.filter((e) => e.level === 'player' && e.seq > 2)).toEqual([]);
      expect(sim.mission.state.result).toMatchObject({ won: true });
    });
  }

  it('script mission m1: camp, dialogues, first wave', () => {
    const sim = createMissionSim('m1');
    expect(sim.mission.script.state.errors).toEqual([]);
    expect([...sim.entities.values()].some((e) => e.type === 'banditCamp')).toBe(true);
    run(sim, 1600);
    const speakers = sim.mission.state.messages.map((m) => m.speaker);
    expect(speakers.slice(0, 3)).toEqual(['kunz', 'nelia', 'kunz']);
    expect(sim.mission.state.objectives.map((o) => o.id)).toEqual(['barracks', 'army', 'camp']);
  });

  it('scenarios only end via victory()/defeat(): fulfilled goals and a lost castle alone end nothing', () => {
    const sim = createScenarioSim(scenario([
      { id: 'm', level: 'mission', editable: false, visibility: 'hidden', code: 'objective("a", "hi", lambda: True)\nobjective("b", "hi", lambda: True)\n' },
      playerSection(),
    ]));
    run(sim, 30);
    expect(sim.mission.state.objectives.every((o) => o.status === 'done')).toBe(true);
    expect(sim.mission.state.result).toBeFalsy();

    const m1 = createMissionSim('m1');
    const hq = [...m1.entities.values()].find((e) => e.type === 'headquarters' && e.owner === 0);
    hq.hp = 0;
    m1.players[0].defeated = true;
    m1.events.push({ type: 'buildingDestroyed', buildingType: 'headquarters', owner: 0 });
    run(m1, 5);
    expect(m1.mission.state.result).toMatchObject({ won: false, reason: 'hq' });
  });
});

describe('Several heroes and diplomacy in the script', () => {
  it('every hero has a variable with their name; hero is the first, hero_of(p, name) searches specifically', () => {
    const sc = scenario([
      { id: 'm', level: 'mission', code: '@on_start\ndef s():\n    print(hero.name, nelia.name, orrin.name, taran)\n    print(hero_of(HUMAN, "orrin").name)\n    orrin.teleport((6, 8))\n' },
      playerSection(),
    ]);
    sc.players = [{ kind: 'human', heroes: ['nelia', 'orrin'], hq: false }];
    const sim = createScenarioSim(sc);
    run(sim, 5);
    expect(sim.mission.script.state.errors).toEqual([]);
    expect(consoleText(sim)).toContain('nelia nelia orrin None');
    expect(consoleText(sim)).toContain('orrin');
    const o = [...sim.entities.values()].find((e) => e.kind === 'hero' && e.hero === 'orrin');
    expect(tileOf(o)).toEqual([6, 8]);
  });

  it('set_diplomacy and diplomacy', () => {
    const sc = scenario([
      { id: 'm', level: 'mission', code: '@on_start\ndef s():\n    print(diplomacy(0, 1))\n    set_diplomacy(0, 1, "neutral")\n    print(diplomacy(0, 1))\n' },
      playerSection(),
    ]);
    sc.players = [{ kind: 'human', hero: 'nelia', hq: false }, { kind: 'ai', hero: 'malvor', hq: false }];
    sc.world.starts.push({ x: 18, y: 8 });
    const sim = createScenarioSim(sc);
    run(sim, 5);
    expect(sim.mission.script.state.errors).toEqual([]);
    expect(consoleText(sim)).toContain('hostile\nneutral');
    expect(sim.relation(0, 1)).toBe('neutral');
  });
});
