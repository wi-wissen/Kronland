// Course missions (docs/SKRIPTE.md#kursmissionen): stages are sub-objectives in sections of one map, Run restarts the
// stage. Every model solution wins – played like the engine does it (snapshot before every run, src/sim/stage.js).
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { StageSnapshot } from '../../src/sim/stage.js';
import { ADVENTURES, getScenario } from '../../src/sim/missions/registry.js';
import { courseNumber } from '../../src/sim/missions/levels/index.js';
import { refExample } from '../../src/ui/script/reference.js';
import { checkProgram } from '../../src/sim/check.js';
import { stageKey } from '../../src/sim/stage.js';
import { faceOf } from '../../src/sim/systems/ground.js';

const LANGS = ['de', 'en'];

const hero = (sim) => [...sim.entities.values()].find((e) => e.kind === 'hero' && e.owner === 0);
const tile = (sim) => { const e = hero(sim); return [Math.floor(e.px / 1000), Math.floor(e.py / 1000)]; };
const active = (sim) => sim.mission.state.objectives.filter((o) => o.status === 'active').map((o) => o.id);
const playerErrors = (sim) => sim.mission.script.state.errors.filter((e) => e.level === 'player');
const said = (sim, re) => sim.mission.state.messages.some((m) => re.test(m.text?.de ?? ''));
const program0 = (sim) => sim.mission.script.state.player.status;
/** Let the program just started finish (a few ticks for the start, then until it ended). */
function finish(state) {
  for (let i = 0; i < 5; i++) state.sim.step();
  until(state.sim, () => ['done', 'error', 'stopped'].includes(program0(state.sim)), 6000);
}
/** Everything that makes up the state of a stage start: Nelia (tile, facing), purse, items, trees and piles. */
function fingerprint(sim) {
  const e = hero(sim);
  const items = [...sim.map.items.entries()].map(([k, v]) => `${v}@${k % sim.map.width},${Math.floor(k / sim.map.width)}`).sort();
  const nodes = [...sim.entities.values()].filter((x) => x.kind === 'tree' || x.kind === 'pile').map((x) => `${x.kind}:${x.res}@${x.x},${x.y}`).sort();
  return { tile: tile(sim), face: faceOf(e), gold: sim.players[0].stock.gold, items, nodes };
}

/** Wait (at most n ticks) until a condition holds. */
function until(sim, cond, n = 3000) {
  for (let i = 0; i < n && !cond(); i++) sim.step();
  expect(cond()).toBe(true);
}

/** Collect the programs the mission loads (program.load): a display event, no state. */
function track(state, sim) {
  const step = sim.step.bind(sim);
  sim.step = (...a) => {
    const events = step(...a);
    for (const e of events) if (e.type === 'programLoad') state.loads.push(e.code);
    return events;
  };
}

/** A mission played like the engine: Run restores the stage snapshot first. */
function play(id, opts) {
  const state = { sim: createMissionSim(id, opts), stage: new StageSnapshot(), loads: [] };
  track(state, state.sim);
  expect(state.sim.mission.script.state.errors).toEqual([]);
  return state;
}

/** Like Engine.scriptRun: restart the stage (snapshot), then the run command. */
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
  // Per world: tile where the maid's program ends, end of the path, top of the slope, side of the rectangle, path, zigzag
  const W2 = {
    normal: { pe: [7, 13], xe: [25, 13], top: [30, 8], side: 2, path: 18, zig: 5, gold: 5 },
    near: { pe: [17, 12], xe: [23, 12], top: [25, 10], side: 2, path: 6, zig: 2, gold: 5 },
    far: { pe: [5, 13], xe: [25, 13], top: [31, 7], side: 3, path: 20, zig: 6, gold: 3 },
  };
  const pathSol = (n) => lines(`for i in range(${n / 2}):`, '    nelia.step()', '    nelia.put()', '    nelia.step()');
  const slopeSol = (n) => lines(`for i in range(${n}):`, '    nelia.step()', '    nelia.turn_left()', '    nelia.step()', '    nelia.turn_right()');
  const ringSol = (side) => lines('for i in range(4):', `    for j in range(${side}):`, '        nelia.step()', '        nelia.put()', '    nelia.turn_left()');
  const SOL = (w) => ({ path: pathSol(W2[w].path), slope: slopeSol(W2[w].zig), fire: ringSol(W2[w].side) });

  it.each(LANGS)('the maid loads a program; the model solution wins all four stages without a jump (%s)', (lang) => {
    const state = play('r1-2');
    until(state.sim, () => active(state.sim).includes('predict'));
    expect(state.loads).toHaveLength(1);
    const program = state.loads[0];
    expect(program).toContain('for i in range(5):');
    const tiles = [];
    const watch = () => { const sim = state.sim; const step = sim.step.bind(sim); sim.step = (...a) => { const ev = step(...a); tiles.push(tile(sim)); return ev; }; };
    watch();

    // Stage 1: running the loaded program once is enough – nothing is guessed or checked
    runAs(state, program);
    until(state.sim, () => active(state.sim).includes('path'));
    expect(tile(state.sim)).toEqual([7, 13]);
    expect(state.sim.players[0].stock.gold).toBe(9);

    // Stage 2: a coin on every tile – the purse runs out; every second tile works
    runAs(state, lines('for i in range(18):', '    nelia.step()', '    nelia.put()'));
    until(state.sim, () => said(state.sim, /gesucht sind 18 Schritte/));
    expect(JSON.stringify(playerErrors(state.sim).at(-1))).toContain('notEnoughGold');
    runAs(state, pathSol(18));
    until(state.sim, () => active(state.sim).includes('slope'));
    expect(tile(state.sim)).toEqual([25, 13]);

    // Stage 3: a straight line runs into the thicket; the zigzag loop reaches the top
    runAs(state, lines('for i in range(5):', '    nelia.step()'));
    until(state.sim, () => said(state.sim, /Hier komme ich nicht weiter/));
    runAs(state, refExample('zigzag', lang));
    until(state.sim, () => active(state.sim).includes('fire'));
    expect(tile(state.sim)).toEqual([30, 8]);
    expect(state.sim.players[0].stock.gold).toBe(8);

    // Stage 4: four equal sides around the woodpile
    runAs(state, lines('for i in range(4):', '    nelia.step()', '    nelia.put()', '    nelia.step()', '    nelia.put()', '    nelia.turn_left()'));
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(state.sim.map.items.size).toBe(5 + 9 + 8);
    // The whole journey is walked: no tick moves Nelia further than one tile (nothing is teleported)
    for (let i = 1; i < tiles.length; i++) expect(Math.abs(tiles[i][0] - tiles[i - 1][0]) + Math.abs(tiles[i][1] - tiles[i - 1][1])).toBeLessThanOrEqual(1);
  });

  it.each(Object.keys(W2))('every stage starts where the one before ended – the switcher and "Prüfen" start the same state (%s)', (w) => {
    const sol = SOL(w);
    const real = play('r1-2', { world: w });
    until(real.sim, () => active(real.sim).includes('predict'));
    expect(fingerprint(real.sim)).toEqual(fingerprint(createMissionSim('r1-2', { world: w })));
    const startAt = (stage) => {
      const sim = createMissionSim('r1-2', { world: w, stage });
      until(sim, () => active(sim).includes(stage));
      return fingerprint(sim);
    };
    const e = W2[w];
    // Ends of the stages: the maid's program, the path, the slope
    runAs(real, real.loads[0]);
    until(real.sim, () => active(real.sim).includes('path'));
    expect(tile(real.sim)).toEqual(e.pe);
    expect(fingerprint(real.sim)).toEqual(startAt('path'));
    runAs(real, sol.path);
    until(real.sim, () => active(real.sim).includes('slope'));
    expect(tile(real.sim)).toEqual(e.xe);
    expect(fingerprint(real.sim)).toEqual(startAt('slope'));
    runAs(real, sol.slope);
    until(real.sim, () => active(real.sim).includes('fire'));
    expect(tile(real.sim)).toEqual(e.top);
    expect(fingerprint(real.sim)).toEqual(startAt('fire'));
    // The world was never cut by walls
    const sim = createMissionSim('r1-2', { world: w });
    expect(sim.map.flags.some((f) => f & 8)).toBe(false);
    runAs(real, sol.fire);
    until(real.sim, () => !!real.sim.mission.state.result, 4000);
    expect(real.sim.mission.state.result).toMatchObject({ won: true });
  });

  it('Run right after a stage ended, during the closing line, restarts into the new stage with its in-place changes', () => {
    const state = play('r1-2', { stage: 'slope' });
    until(state.sim, () => active(state.sim).includes('slope'));
    expect([...state.sim.entities.values()].some((e) => e.kind === 'pile' && e.res === 'gold')).toBe(true);
    runAs(state, slopeSol(5));
    // The tick the slope is done: the next stage is already active before anything is said
    until(state.sim, () => state.sim.mission.state.objectives.find((o) => o.id === 'slope')?.status === 'done');
    for (let i = 0; i < 3; i++) state.sim.step();
    expect(active(state.sim)).toContain('fire');
    // Run during the closing dialogue, twice: every restart starts from the new stage (purse taken, coins in the purse)
    for (let n = 0; n < 2; n++) {
      runAs(state, 'nelia.step()\n');
      expect(active(state.sim)).toContain('fire');
      expect([...state.sim.entities.values()].some((e) => e.kind === 'pile' && e.res === 'gold')).toBe(false);
      expect(state.sim.players[0].stock.gold).toBe(8);
      expect(tile(state.sim)).toEqual([30, 8]);
    }
  });

  it('a game started at a stage plays on from there to the victory (in every world)', () => {
    for (const w of Object.keys(W2)) {
      const sol = SOL(w);
      for (const [stage, from] of [['path', ['path', 'slope', 'fire']], ['slope', ['slope', 'fire']], ['fire', ['fire']]]) {
        const state = play('r1-2', { world: w, stage });
        until(state.sim, () => active(state.sim).includes(stage));
        expect(state.loads, `${w}/${stage}`).toEqual([]);
        for (const st of from) {
          until(state.sim, () => active(state.sim).includes(st));
          runAs(state, sol[st]);
        }
        until(state.sim, () => !!state.sim.mission.state.result, 6000);
        expect(state.sim.mission.state.result, `${w}/${stage}`).toMatchObject({ won: true });
      }
    }
  });
});

describe('I.5 "Holz für die erste Nacht"', () => {
  // Per world: end of the coin row, the crossing at the tree, coins and roses between, steps to the brook, coins to the north
  const W5 = {
    normal: { row: [10, 15], cross: [20, 15], coins: 6, flowers: 4, brook: 9, six: 10 },
    near: { row: [13, 15], cross: [13, 15], coins: 0, flowers: 0, brook: 0, six: 6 },
    far: { row: [10, 15], cross: [22, 15], coins: 7, flowers: 5, brook: 12, six: 13 },
  };
  const ROSES = lines(
    'count = 0', 'flowers = 0',
    'while nelia.can_step():', '    nelia.step()',
    '    if nelia.here() == "coin":', '        nelia.take()', '        count = count + 1',
    '    elif nelia.here() == "flower":', '        nelia.take()', '        flowers = flowers + 1',
  );
  const SIX = lines('count = 0', 'while count < 6:', '    nelia.step()', '    nelia.take()', '    count = count + 1');

  it.each(LANGS)('counting with variables: the model solution wins all four stages without a jump (%s)', (lang) => {
    const state = play('r1-5');
    until(state.sim, () => active(state.sim).includes('predict'));
    expect(state.loads).toHaveLength(1);
    const program = state.loads[0];
    expect(program).toContain('count = count + 1');
    const tiles = [];
    const step0 = state.sim.step.bind(state.sim);
    state.sim.step = (...a) => { const ev = step0(...a); tiles.push(tile(state.sim)); return ev; };

    // Stage 1: what does Nelia say? Running the loaded program once is enough (7 coins in the row)
    runAs(state, program);
    until(state.sim, () => active(state.sim).includes('roses'));
    expect(state.sim.mission.state.messages.some((m) => m.speaker === 'nelia' && m.text === '7 Taler!')).toBe(true);
    expect(tile(state.sim)).toEqual([10, 15]);
    expect(state.sim.players[0].stock.gold).toBe(7);

    // Stage 2: a second variable for the Christmas roses
    runAs(state, program);
    until(state.sim, () => said(state.sim, /Es liegt noch etwas im Schnee/));
    runAs(state, ROSES);
    // Solved here – the stage waits for „Prüfen“ in all three worlds
    until(state.sim, () => said(state.sim, /Drück jetzt „Prüfen“/));
    expect(active(state.sim)).toEqual(['roses']);
    expect(checkAs(state, ROSES).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('brook'));
    expect(tile(state.sim)).toEqual([20, 15]);

    // Stage 3: the path turns south at the tree; count the steps to the brook and walk back just as far
    runAs(state, lines('steps = 0', 'while nelia.front() != "ice":', '    nelia.step()', '    steps = steps + 1'));
    until(state.sim, () => said(state.sim, /Vor mir steht der Baum/));
    // Turned, but never back: not at the crossing (the ice can be walked over: only front() stops at it)
    runAs(state, lines('nelia.turn_right()', 'steps = 0', 'while nelia.front() != "ice":', '    nelia.step()', '    steps = steps + 1'));
    until(state.sim, () => said(state.sim, /aber ich stehe nicht an der Kreuzung/));
    runAs(state, refExample('brook', lang));
    finish(state);
    expect(tile(state.sim)).toEqual([20, 15]);
    expect(checkAs(state, refExample('brook', lang)).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('six'));
    expect(tile(state.sim)).toEqual([20, 15]);

    // Stage 4: exactly six coins of ten, to the north
    runAs(state, lines('while nelia.front() == "coin":', '    nelia.step()', '    nelia.take()'));
    until(state.sim, () => said(state.sim, /Ich habe 10 Taler aufgehoben/));
    runAs(state, SIX);
    until(state.sim, () => said(state.sim, /Drück jetzt „Prüfen“/));
    expect(checkAs(state, SIX).passed).toBe(true);
    until(state.sim, () => !!state.sim.mission.state.result, 4000);
    expect(state.sim.mission.state.result).toMatchObject({ won: true });
    expect(playerErrors(state.sim)).toEqual([]);
    for (let i = 1; i < tiles.length; i++) expect(Math.abs(tiles[i][0] - tiles[i - 1][0]) + Math.abs(tiles[i][1] - tiles[i - 1][1])).toBeLessThanOrEqual(1);
  });

  it.each(Object.keys(W5))('every stage starts where the one before ended – the switcher and "Prüfen" start the same state (%s)', (w) => {
    const e = W5[w];
    const real = play('r1-5', { world: w });
    until(real.sim, () => active(real.sim).includes('predict'));
    expect(fingerprint(real.sim)).toEqual(fingerprint(createMissionSim('r1-5', { world: w })));
    const startAt = (stage) => {
      const sim = createMissionSim('r1-5', { world: w, stage });
      until(sim, () => active(sim).includes(stage));
      return fingerprint(sim);
    };
    runAs(real, real.loads[0]);
    until(real.sim, () => active(real.sim).includes('roses'));
    expect(tile(real.sim)).toEqual(e.row);
    expect(fingerprint(real.sim)).toEqual(startAt('roses'));
    runAs(real, ROSES);
    finish(real);
    expect(checkAs(real, ROSES).passed).toBe(true);
    until(real.sim, () => active(real.sim).includes('brook'));
    expect(tile(real.sim)).toEqual(e.cross);
    expect(fingerprint(real.sim)).toEqual(startAt('brook'));
    const brook = refExample('brook', 'de');
    runAs(real, brook);
    finish(real);
    expect(checkAs(real, brook).passed).toBe(true);
    until(real.sim, () => active(real.sim).includes('six'));
    expect(tile(real.sim)).toEqual(e.cross);
    expect(fingerprint(real.sim)).toEqual(startAt('six'));
    expect(real.sim.map.flags.some((f) => f & 8)).toBe(false);
  });

  it('Run right after a stage ended, during the closing line, restarts into the new stage', () => {
    const state = play('r1-5', { stage: 'roses' });
    until(state.sim, () => active(state.sim).includes('roses'));
    runAs(state, ROSES);
    until(state.sim, () => said(state.sim, /Drück jetzt „Prüfen“/));
    expect(checkAs(state, ROSES).passed).toBe(true);
    for (let i = 0; i < 3; i++) state.sim.step();
    expect(active(state.sim)).toContain('brook');
    for (let n = 0; n < 2; n++) {
      runAs(state, 'nelia.step()\n');
      expect(active(state.sim)).toContain('brook');
      expect(state.sim.map.items.size).toBe(10);   // only the row to the north is left
    }
  });

  it('a game started at a stage plays on from there to the victory (in every world)', () => {
    for (const w of Object.keys(W5)) {
      for (const stage of ['roses', 'brook', 'six']) {
        const state = play('r1-5', { world: w, stage });
        until(state.sim, () => active(state.sim).includes(stage));
        expect(state.loads, `${w}/${stage}`).toEqual([]);
        const code = { roses: ROSES, brook: refExample('brook', 'de'), six: SIX };
        for (const st of ['roses', 'brook', 'six'].slice(['roses', 'brook', 'six'].indexOf(stage))) {
          until(state.sim, () => active(state.sim).includes(st));
          runAs(state, code[st]);
          finish(state);
          checkAs(state, code[st]);
        }
        until(state.sim, () => !!state.sim.mission.state.result, 6000);
        expect(state.sim.mission.state.result, `${w}/${stage}`).toMatchObject({ won: true });
      }
    }
  });
});

describe('I.M "Heimweg durchs Unterholz"', () => {
  it.each(LANGS)('no program is loaded; turning right when blocked solves the edge, the right-hand rule every thicket (%s)', (lang) => {
    const state = play('r1-m');
    until(state.sim, () => active(state.sim).includes('edge'));
    expect(state.loads).toEqual([]);
    // Stage 1: walk, turn right when blocked (the way to the ruin of old)
    const simple = lines('while not nelia.is_at(place("exit")):', '    if nelia.can_step():', '        nelia.step()', '    else:', '        nelia.turn_right()');
    runAs(state, simple);
    until(state.sim, () => said(state.sim, /Drück jetzt „Prüfen“/), 4000);
    expect(active(state.sim)).toEqual(['edge']);
    expect(checkAs(state, simple).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('thicket'));
    expect(tile(state.sim)).toEqual([2, 13]);

    // Stage 2: the simple rule runs in circles (stopped by hand); the right-hand rule finds the exit
    runAs(state, simple);
    for (let i = 0; i < 600; i++) state.sim.step();
    expect(active(state.sim)).toEqual(['thicket']);
    state.sim.command({ type: 'script', player: 0, action: 'stop' });
    until(state.sim, () => said(state.sim, /Ich drehe mich im Kreis/));
    runAs(state, refExample('thicket', lang));
    until(state.sim, () => said(state.sim, /Drück jetzt „Prüfen“/), 6000);
    expect(checkAs(state, refExample('thicket', lang)).passed).toBe(true);
    until(state.sim, () => active(state.sim).includes('home'));
    expect(tile(state.sim)).toEqual([2, 24]);

    // Stage 3: the same program in undergrowth that grew differently; the stranger waits on the square
    runAs(state, refExample('thicket', lang));
    until(state.sim, () => tile(state.sim)[0] === 23 && tile(state.sim)[1] === 26, 6000);
    expect(checkAs(state, refExample('thicket', lang)).passed).toBe(true);
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
    expect(state.loads).toHaveLength(1);
    const program = state.loads[0];
    expect(program).toContain('def around_ruin():');

    // Stage 1: where does Nelia stand after three calls? Running the loaded program once is enough
    runAs(state, program);
    until(state.sim, () => active(state.sim).includes('hedge'));
    expect(tile(state.sim)).toEqual([2, 13]);

    // Stage 2: the hedge blocks the south – the unchanged program fails, the function round the left works
    runAs(state, program);
    until(state.sim, () => said(state.sim, /links und rechts tauschen/));
    const left = program.replace(/turn_right/g, 'TMP').replace(/turn_left/g, 'turn_right').replace(/TMP/g, 'turn_left');
    runAs(state, left);
    until(state.sim, () => active(state.sim).includes('coins'));
    expect(tile(state.sim)).toEqual([2, 23]);

    // Stage 3: own commands fetch the coins left and right of the path
    runAs(state, refExample('fetch', lang));
    until(state.sim, () => state.sim.players[0].stock.gold === 10, 6000);
    expect(active(state.sim)).toEqual(['coins']);
    expect(checkAs(state, refExample('fetch', lang)).passed).toBe(true);
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
