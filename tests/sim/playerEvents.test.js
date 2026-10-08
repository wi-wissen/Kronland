// Events in the player program: @every, @on_enter, @on_building_done … next to the main program, status
// "waits for events", the debugger halts all tasks together, two tasks steering the same figure → "busy".
import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

const run = (sim, ticks) => { for (let i = 0; i < ticks && !sim.mission.state.result; i++) sim.step(); };
const runCode = (sim, code, extra = {}) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code }, ...extra });
const ui = (sim) => sim.mission.uiState(sim).script.player;
const out = (sim) => sim.mission.script.state.console.filter((c) => c.level === 'player' && !c.err).map((c) => c.text);
const errors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const pvar = (sim, name) => sim.mission.script.playerVariable(name);

function scenario(mission = '') {
  return createScenarioSim({
    format: 'kronland-scenario', version: 2, id: 'events', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 24, height: 16, fog: false, starts: [{ x: 4, y: 8 }], places: { gate: { x: 8, y: 8, r: 1 } } },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [
      { id: 'm', level: 'mission', code: mission || 'pass\n' },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
  });
}

describe('Events in the player program', () => {
  it('@every runs next to the main program; afterwards the program waits for events', () => {
    const sim = scenario();
    runCode(sim, 'n = 0\n@every(1)\ndef tick():\n    global n\n    n += 1\n    print("tick", n)\nprint("start")\n');
    run(sim, 2);
    expect(ui(sim)).toMatchObject({ status: 'running', listening: true });
    run(sim, 30);
    expect(out(sim)).toEqual(['start', 'tick 1', 'tick 2', 'tick 3']);
    expect(pvar(sim, 'n')).toBe(3);
    sim.command({ type: 'script', player: 0, action: 'stop' });
    run(sim, 12);
    expect(ui(sim).status).toBe('stopped');
    expect(out(sim).length).toBe(4);
  });

  it('without handlers the program is done; a new run forgets the old handlers', () => {
    const sim = scenario();
    runCode(sim, '@every(1)\ndef tick():\n    print("old")\n');
    run(sim, 12);
    runCode(sim, 'print("new")\n');
    run(sim, 25);
    expect(ui(sim)).toMatchObject({ status: 'done', listening: false });
    expect(out(sim).filter((t) => t === 'old').length).toBe(1);
  });

  it('@on_enter fires when Nelia walks into a place', () => {
    const sim = scenario();
    runCode(sim, '@on_enter(place("gate"), who="hero")\ndef arrived(who):\n    print("at the gate:", who.name)\nnelia.step(5)\n');
    run(sim, 200);
    expect(out(sim)).toEqual(['at the gate: nelia']);
    expect(errors(sim)).toEqual([]);
  });

  it('@on_enter respects the fog: an unseen figure enters unnoticed', () => {
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, id: 'fog', kind: 'adventure', end: 'script',
      world: { base: 'flat', width: 48, height: 16, fog: true, starts: [{ x: 4, y: 8 }], places: { far: { x: 40, y: 8, r: 5 } } },
      players: [{ kind: 'human', hero: 'nelia', hq: false }, { kind: 'bandits' }],
      sections: [
        { id: 'm', level: 'mission', code: '@on_enter(place("far"), player=BANDITS)\ndef seen(who):\n    print("mission sees it")\n@on_start\ndef go():\n    wait(1)\n    spawn(BANDITS, "sword1", (40, 8))\n' },
        { id: 'player', level: 'player', editable: true, code: '' },
      ],
    });
    runCode(sim, '@on_enter(place("far"), player=BANDITS)\ndef seen(who):\n    print("player sees it")\n');
    run(sim, 60);
    const lines = sim.mission.script.state.console.map((c) => c.text);
    expect(lines).toContain('mission sees it');
    expect(lines).not.toContain('player sees it');
  });

  it('@on_destroyed only reports own buildings, @on_weather what everybody sees', () => {
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, id: 'own', kind: 'adventure', end: 'script',
      world: { base: 'flat', width: 32, height: 20, fog: false, starts: [{ x: 4, y: 8 }] },
      players: [{ kind: 'human', hero: 'nelia', hq: false }, { kind: 'bandits' }],
      sections: [
        { id: 'm', level: 'mission', code: 'mine = place_building(HUMAN, "residence", (14, 4))\ntheirs = place_building(BANDITS, "residence", (14, 14))\n@on_start\ndef go():\n    wait(1)\n    remove(theirs)\n    remove(mine)\n    set_weather("winter")\n' },
        { id: 'player', level: 'player', editable: true, code: '' },
      ],
    });
    runCode(sim, '@on_destroyed(owner=BANDITS)\ndef lost(kind, owner):\n    print("lost", kind, owner)\n@on_weather("winter")\ndef cold(state):\n    print("cold")\n');
    run(sim, 30);
    expect(out(sim)).toEqual(['lost residence 0', 'cold']);
  });

  it('two tasks steering the same figure: "… is busy"', () => {
    const sim = scenario();
    runCode(sim, '@every(1)\ndef turn():\n    nelia.turn_left()\nnelia.step(6)\n');
    run(sim, 40);
    const e = errors(sim)[0];
    expect(e).toMatchObject({ kind: 'GameError', params: { reason: 'script.game.busy', reasonParams: { name: 'nelia' } } });
    // The error ends the whole program
    expect(ui(sim).status).toBe('error');
  });

  it('a breakpoint in an event function halts all tasks of the player program together', () => {
    const sim = scenario();
    const code = 'steps = 0\n@every(1)\ndef look():\n    print("look", steps)\nwhile True:\n    nelia.turn_left()\n    steps += 1\n';
    runCode(sim, code, { debug: { mode: 'run', bps: { player: [4] } } });
    run(sim, 12);
    let p = ui(sim);
    expect(p.status).toBe('paused');
    expect(p.line).toEqual({ section: 'player', line: 4 });
    expect(p.vars.frames.map((f) => f.name)).toEqual(['look']);
    const steps = pvar(sim, 'steps');
    const face = hero(sim).face;
    run(sim, 30);
    // Main loop held too: no more turning while the handler is paused
    expect(pvar(sim, 'steps')).toBe(steps);
    expect(hero(sim).face).toBe(face);
    // A step goes on in the handler only
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'over' });
    run(sim, 1);
    expect(pvar(sim, 'steps')).toBe(steps);
    expect(out(sim).at(-1)).toBe(`look ${steps}`);
    // Continue releases everything
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'continue', bps: { player: [] } });
    run(sim, 30);
    p = ui(sim);
    expect(p.status).toBe('running');
    expect(pvar(sim, 'steps')).toBeGreaterThan(steps);
  });

  it('pause halts every task, continue releases them all', () => {
    const sim = scenario();
    runCode(sim, 'n = 0\n@every(1)\ndef tick():\n    global n\n    n += 1\nwhile True:\n    nelia.turn_left()\n');
    run(sim, 25);
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'pause' });
    run(sim, 20);
    const n = pvar(sim, 'n');
    expect(ui(sim).status).toBe('paused');
    run(sim, 30);
    expect(pvar(sim, 'n')).toBe(n);
    sim.command({ type: 'script', player: 0, action: 'debug', cmd: 'continue' });
    run(sim, 30);
    expect(ui(sim).status).toBe('running');
    expect(pvar(sim, 'n')).toBeGreaterThan(n);
  });

  it('player programs cannot use mission-only events', () => {
    const sim = scenario();
    runCode(sim, '@on_event("talk")\ndef t(h):\n    pass\n');
    run(sim, 2);
    expect(errors(sim)[0]).toMatchObject({ params: { reason: 'script.game.eventUnknown' } });
    const s2 = scenario();
    runCode(s2, '@on_start\ndef s():\n    pass\n');
    run(s2, 2);
    expect(errors(s2)[0].kind).toBe('NameError');
  });

  it('saving with listening handlers continues the same way', () => {
    const code = 'n = 0\n@every(2)\ndef tick():\n    global n\n    n += 1\n    nelia.turn_right()\n';
    const ref = scenario();
    runCode(ref, code);
    run(ref, 100);
    const sim = scenario();
    runCode(sim, code);
    run(sim, 37);
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(loaded.hash()).toBe(sim.hash());
    run(loaded, 63);
    expect(loaded.hash()).toBe(ref.hash());
    expect(pvar(loaded, 'n')).toBe(pvar(ref, 'n'));
  });
});
