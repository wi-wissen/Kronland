// Course missions (docs/SKRIPTE.md#kursmissionen): stages are sub-objectives in sections of one map, Run restarts the
// stage. Every model solution wins – played like the engine does it (snapshot before every run, src/sim/stage.js).
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot } from '../../src/sim/stage.js';
import { ADVENTURES, getScenario } from '../../src/sim/missions/registry.js';
import { courseNumber } from '../../src/sim/missions/levels/index.js';
import { refExample } from '../../src/ui/script/reference.js';

const LANGS = ['de', 'en'];

const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tile = (sim) => { const e = hero(sim); return [Math.floor(e.px / 1000), Math.floor(e.py / 1000)]; };
const active = (sim) => sim.mission.state.objectives.filter((o) => o.status === 'active').map((o) => o.id);
const playerErrors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const said = (sim, re) => sim.mission.state.messages.some((m) => re.test(m.text?.de ?? ''));
const coinsIn = (sim, top) => [...sim.map.items.entries()].filter(([k, v]) => v === 'coin' && Math.floor(k / sim.map.width) >= top && Math.floor(k / sim.map.width) < top + 8).length;

/** Wait (at most n ticks) until a condition holds. */
function until(sim, cond, n = 3000) {
  for (let i = 0; i < n && !cond(); i++) sim.step();
  expect(cond()).toBe(true);
}

/** A mission played like the engine: Run restores the stage snapshot first. */
function play(id) {
  const state = { sim: createMissionSim(id), stage: new StageSnapshot() };
  expect(state.sim.mission.script.state.errors).toEqual([]);
  return state;
}

/** Like Engine.scriptRun: restart the stage (snapshot), then the run command. */
function runAs(state, code) {
  const next = state.stage.beforeRun(state.sim);
  if (next) state.sim = next;
  state.sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });
}

const lines = (...l) => `${l.join('\n')}\n`;

describe('Course missions in the adventure menu', () => {
  it('are listed in row order, chained, with course numbers', () => {
    expect(ADVENTURES.map((a) => a.id)).toEqual(['r1-2', 'r1-4', 'r1-5', 'r1-m', 'r2-1', 'r3-m']);
    expect(ADVENTURES.map((a) => a.next)).toEqual(['r1-4', 'r1-5', 'r1-m', 'r2-1', 'r3-m', null]);
    expect(courseNumber('r1-2')).toEqual({ row: 1, roman: 'I', n: '2', label: 'I.2' });
    expect(courseNumber('r1-m')).toMatchObject({ label: 'I.M', n: 'M' });
    expect(courseNumber('r3-m').label).toBe('III.M');
    expect(courseNumber('m1')).toBeNull();
    for (const a of ADVENTURES) {
      const s = getScenario(a.id);
      expect(s.title.de && s.title.en, a.id).toBeTruthy();
      expect(s.folder.startsWith(`${a.id}-`), a.id).toBe(true);
    }
  });
});

describe('I.2 "Taler für die Mägde"', () => {
  it.each(LANGS)('the maid hands over a note; the model solution wins all four stages (%s)', (lang) => {
    const state = play('r1-2');
    until(state.sim, () => active(state.sim).includes('predict'));
    const note = state.sim.mission.script.state.note;
    expect(note).toMatchObject({ speaker: 'maid', title: { de: 'Zettel der Magd' } });
    expect(note.code).toContain('for i in range(5):');

    // Stage 1: a wrong guess – Nelia says how many lie there; then the right one
    runAs(state, note.code.replace('guess = 0', 'guess = 4'));
    until(state.sim, () => said(state.sim, /vermutet hattest du 4/));
    expect(coinsIn(state.sim, 0)).toBe(5);
    runAs(state, note.code.replace('guess = 0', 'guess = 5'));
    expect(coinsIn(state.sim, 0)).toBe(0);
    until(state.sim, () => active(state.sim).includes('path'));
    expect(tile(state.sim)).toEqual([2, 13]);
    expect(state.sim.players[0].stock.gold).toBe(9);

    // Stage 2: a coin on every tile – the purse runs out; every second tile works
    runAs(state, lines('for i in range(18):', '    nelia.step()', '    nelia.put()'));
    until(state.sim, () => said(state.sim, /gesucht sind 18 Schritte/));
    expect(JSON.stringify(playerErrors(state.sim).at(-1))).toContain('notEnoughGold');
    runAs(state, lines('for i in range(9):', '    nelia.step()', '    nelia.put()', '    nelia.step()'));
    until(state.sim, () => active(state.sim).includes('slope'));
    expect(tile(state.sim)).toEqual([2, 26]);

    // Stage 3: a straight line runs into the thicket; the zigzag loop reaches the top
    runAs(state, lines('for i in range(5):', '    nelia.step()'));
    until(state.sim, () => said(state.sim, /Hier komme ich nicht weiter/));
    runAs(state, refExample('zigzag', lang));
    until(state.sim, () => active(state.sim).includes('fire'));
    expect(tile(state.sim)).toEqual([4, 34]);
    expect(state.sim.players[0].stock.gold).toBe(8);

    // Stage 4: four equal sides around the woodpile
    runAs(state, lines('for i in range(4):', '    nelia.step()', '    nelia.put()', '    nelia.step()', '    nelia.put()', '    nelia.turn_left()'));
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(coinsIn(state.sim, 30)).toBe(8);
  });
});

describe('I.5 "Holz für die erste Nacht"', () => {
  it.each(LANGS)('counting with variables: the model solution wins all four stages (%s)', (lang) => {
    const state = play('r1-5');
    until(state.sim, () => active(state.sim).includes('predict'));
    const note = state.sim.mission.script.state.note;
    expect(note).toMatchObject({ speaker: 'woodcutter' });
    expect(note.code).toContain('count = count + 1');

    // Stage 1: what does Nelia say? A wrong guess, then the right one (7 coins in the row)
    runAs(state, note.code.replace('guess = 0', 'guess = 5'));
    until(state.sim, () => said(state.sim, /vermutet hattest du 5/));
    expect(state.sim.mission.state.messages.some((m) => m.speaker === 'nelia' && m.text === '7 Taler!')).toBe(true);
    runAs(state, note.code.replace('guess = 0', 'guess = 7'));
    until(state.sim, () => active(state.sim).includes('roses'));
    expect(tile(state.sim)).toEqual([2, 13]);
    expect(state.sim.players[0].stock.gold).toBe(7);

    // Stage 2: a second variable for the Christmas roses
    runAs(state, note.code);
    until(state.sim, () => said(state.sim, /Es liegt noch etwas im Schnee/));
    runAs(state, lines(
      'count = 0', 'flowers = 0',
      'while nelia.can_step():', '    nelia.step()',
      '    if nelia.here() == "coin":', '        nelia.take()', '        count = count + 1',
      '    elif nelia.here() == "flower":', '        nelia.take()', '        flowers = flowers + 1',
    ));
    until(state.sim, () => active(state.sim).includes('brook'));
    expect(tile(state.sim)).toEqual([2, 23]);

    // Stage 3: count the steps to the brook and walk back just as far
    runAs(state, lines('steps = 0', 'while nelia.can_step():', '    nelia.step()', '    steps = steps + 1'));
    until(state.sim, () => said(state.sim, /aber ich stehe nicht am Start/));
    runAs(state, refExample('brook', lang));
    until(state.sim, () => active(state.sim).includes('six'));
    expect(tile(state.sim)).toEqual([2, 33]);

    // Stage 4: exactly six coins of ten
    runAs(state, lines('while nelia.front() == "coin":', '    nelia.step()', '    nelia.take()'));
    until(state.sim, () => said(state.sim, /Ich habe 10 Taler aufgehoben/));
    runAs(state, lines('count = 0', 'while count < 6:', '    nelia.step()', '    nelia.take()', '    count = count + 1'));
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(coinsIn(state.sim, 30)).toBe(4);
    expect(playerErrors(state.sim)).toEqual([]);
  });
});

describe('I.M "Heimweg durchs Unterholz"', () => {
  it.each(LANGS)('no note; turning right when blocked solves the edge, the right-hand rule every thicket (%s)', (lang) => {
    const state = play('r1-m');
    until(state.sim, () => active(state.sim).includes('edge'));
    expect(state.sim.mission.script.state.note).toBeFalsy();
    // Stage 1: walk, turn right when blocked (the way to the ruin of old)
    const simple = lines('while not nelia.is_at(place("exit")):', '    if nelia.can_step():', '        nelia.step()', '    else:', '        nelia.turn_right()');
    runAs(state, simple);
    until(state.sim, () => active(state.sim).includes('thicket'), 4000);
    expect(tile(state.sim)).toEqual([2, 13]);

    // Stage 2: the simple rule runs in circles (stopped by hand); the right-hand rule finds the exit
    runAs(state, simple);
    for (let i = 0; i < 600; i++) state.sim.step();
    expect(active(state.sim)).toEqual(['thicket']);
    state.sim.command({ type: 'script', player: 0, action: 'stop' });
    until(state.sim, () => said(state.sim, /Ich drehe mich im Kreis/));
    runAs(state, refExample('thicket', lang));
    until(state.sim, () => active(state.sim).includes('home'), 6000);
    expect(tile(state.sim)).toEqual([2, 24]);

    // Stage 3: the same program in undergrowth that grew differently; the stranger waits on the square
    runAs(state, refExample('thicket', lang));
    until(state.sim, () => !!state.sim.mission.state.result, 6000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(tile(state.sim)).toEqual([23, 26]);
    expect(state.sim.mission.state.messages.some((m) => m.speaker === 'stranger')).toBe(true);
    expect(playerErrors(state.sim)).toEqual([]);
    expect(state.sim.map.tracks[state.sim.map.idx(6, 2)]).toBe(0);
  });
});

describe('II.1 "Orrins Abkürzung"', () => {
  it.each(LANGS)('functions without parameters: the model solution wins all three stages (%s)', (lang) => {
    const state = play('r2-1');
    until(state.sim, () => active(state.sim).includes('predict'));
    const note = state.sim.mission.script.state.note;
    expect(note).toMatchObject({ speaker: 'orrin', title: { de: 'Orrins Abkürzung' } });
    expect(note.code).toContain('def around_ruin():');

    // Stage 1: where does Nelia stand after three calls?
    runAs(state, note.code.replace('guess = 0', 'guess = 3'));
    until(state.sim, () => said(state.sim, /vermutet hattest du 3/));
    expect(tile(state.sim)).toEqual([8, 3]);
    runAs(state, note.code.replace('guess = 0', 'guess = 6'));
    until(state.sim, () => active(state.sim).includes('hedge'));
    expect(tile(state.sim)).toEqual([2, 13]);

    // Stage 2: the hedge blocks the south – the unchanged note fails, the function round the left works
    runAs(state, note.code);
    until(state.sim, () => said(state.sim, /links und rechts tauschen/));
    const left = note.code.replace(/turn_right/g, 'TMP').replace(/turn_left/g, 'turn_right').replace(/TMP/g, 'turn_left');
    runAs(state, left);
    until(state.sim, () => active(state.sim).includes('coins'));
    expect(tile(state.sim)).toEqual([2, 23]);

    // Stage 3: own commands fetch the coins left and right of the path
    runAs(state, refExample('fetch', lang));
    until(state.sim, () => !!state.sim.mission.state.result, 6000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(state.sim.players[0].stock.gold).toBe(10);
    expect(playerErrors(state.sim)).toEqual([]);
  });
});

describe('III.M "Lindgrund steht wieder"', () => {
  it.each(LANGS)('a whole village by program: gather wood and clay, then build from a plan (%s)', (lang) => {
    const state = play('r3-m');
    const sim = state.sim;
    // The village centre has decayed: only its site is left; the stock is not enough for the plan
    expect([...sim.entities.values()].some((e) => e.type === 'villageCenter')).toBe(false);
    expect(sim.spots.length).toBeGreaterThan(0);
    expect(sim.players[0].stock).toMatchObject({ wood: 300, clay: 300 });
    until(sim, () => active(sim).length === 3);
    // Run restarts nothing in a building mission
    runAs(state, 'print(len(serfs()))\n');
    expect(state.sim).toBe(sim);
    runAs(state, refExample('village', lang));
    until(sim, () => !!sim.mission.state.result, 20000);
    expect(sim.mission.state.result).toMatchObject({ won: true });
    expect(sim.mission.state.messages.some((m) => m.speaker === 'herald')).toBe(true);
    expect(playerErrors(sim)).toEqual([]);
  });
});
