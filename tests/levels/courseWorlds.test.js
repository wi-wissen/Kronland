// Worlds of the course missions (docs/SKRIPTE.md#welten, #kursmissionen): every mission has a normal case and edge
// cases. Model solutions pass „Prüfen“ (src/sim/check.js) in every world of all_worlds stages, hard-coded programs
// fail a named edge world; the first stages end once the program ran, the counting loops of I.2 count per world.
import { describe, it, expect } from 'vitest';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { getMission } from '../../src/sim/missions/registry.js';
import { checkProgram } from '../../src/sim/check.js';
import { refExample } from '../../src/ui/script/reference.js';

const lines = (...l) => `${l.join('\n')}\n`;
const by = (r) => Object.fromEntries(r.results.map((x) => [x.world, x.status]));
const check = (id, stage, code) => checkProgram(getMission(id), stage, { player: code });
/** Worlds in which a program solves a stage. */
const solvedIn = (id, stage, code) => check(id, stage, code).results.filter((r) => r.status === 'solved').map((r) => r.world);
/** Does the goal of a stage only count after „Prüfen“ in every world (all_worlds=True)? */
function isAllWorlds(id, stage) {
  const sim = createMissionSim(id, { stage });
  for (let i = 0; i < 400 && !sim.mission.state.objectives.some((o) => o.id === stage); i++) sim.step();
  return !!sim.mission.objectiveDef(stage)?.allWorlds;
}

describe('Course missions have worlds', () => {
  it.each([['r1-2', 3], ['r1-4', 3], ['r1-5', 3], ['r1-m', 3], ['r2-1', 3], ['r3-m', 0]])('%s has %i worlds, all built without errors', (id, n) => {
    const worlds = getMission(id).worlds ?? [];
    expect(worlds.length).toBe(n);
    for (const w of worlds) {
      expect(w.title.de && w.title.en, `${id}/${w.id}`).toBeTruthy();
      const sim = createMissionSim(id, { world: w.id });
      for (let i = 0; i < 50; i++) sim.step();
      expect(sim.mission.script.state.errors, `${id}/${w.id}`).toEqual([]);
    }
    if (n) expect(worlds[0].id).toBe('normal');
  });
});

describe('I.2 "Taler für die Mägde": one counting loop per world', () => {
  const LOADED = lines('for i in range(5):', '    nelia.put()', '    nelia.step()');
  const PATH = (n) => lines(`for i in range(${n}):`, '    nelia.step()', '    nelia.put()', '    nelia.step()');
  const SLOPE = (n) => lines(`for i in range(${n}):`, '    nelia.step()', '    nelia.turn_left()', '    nelia.step()', '    nelia.turn_right()');
  const RING2 = lines('for i in range(4):', '    nelia.step()', '    nelia.put()', '    nelia.step()', '    nelia.put()', '    nelia.turn_left()');
  const RING3 = lines('for i in range(4):', '    for j in range(3):', '        nelia.step()', '        nelia.put()', '    nelia.turn_left()');

  it('the first stage ends once the loaded program ran – also where it breaks off at the tree (near) or the empty purse (far)', () => {
    expect(isAllWorlds('r1-2', 'predict')).toBe(false);
    expect(solvedIn('r1-2', 'predict', LOADED)).toEqual(['normal', 'near', 'far']);
    // A program that fails before it laid the coins of its world does not end the stage
    expect(solvedIn('r1-2', 'predict', 'nelia.fly()\n')).toEqual([]);
  });

  it('each world has its own number: path, slope and woodpile solved per world', () => {
    expect(solvedIn('r1-2', 'path', PATH(9))).toEqual(['normal']);
    expect(solvedIn('r1-2', 'path', PATH(3))).toEqual(['near']);
    expect(solvedIn('r1-2', 'path', PATH(10))).toEqual(['far']);
    expect(solvedIn('r1-2', 'slope', refExample('zigzag', 'de'))).toEqual(['normal']);
    expect(solvedIn('r1-2', 'slope', SLOPE(2))).toEqual(['near']);
    expect(solvedIn('r1-2', 'slope', SLOPE(6))).toEqual(['far']);
    expect(solvedIn('r1-2', 'fire', RING2)).toEqual(['normal', 'near']);
    expect(solvedIn('r1-2', 'fire', RING3)).toEqual(['far']);
  });

  it('the normal-case loop runs into the trees of the short path (near) and the slope breaks off early', () => {
    const r = check('r1-2', 'path', PATH(9));
    expect(by(r)).toMatchObject({ normal: 'solved', near: 'error', far: 'failed' });
    expect(r.results.find((x) => x.world === 'near').error).toMatchObject({ sline: 3 });   // the purse of 3 coins is empty
    expect(by(check('r1-2', 'slope', refExample('zigzag', 'de')))).toMatchObject({ near: 'error', far: 'failed' });
    // The long path ends at trees too: one round too many is blocked
    expect(by(check('r1-2', 'path', PATH(11)))).toMatchObject({ far: 'error' });
  });
});

describe('I.5 "Holz für die erste Nacht": roses, brook and six count in every world', () => {
  const LOADED = lines('count = 0', 'while nelia.front() == "coin":', '    nelia.step()', '    nelia.take()', '    count = count + 1');
  const ROSES = lines(
    'count = 0', 'flowers = 0',
    'while nelia.can_step():', '    nelia.step()',
    '    if nelia.here() == "coin":', '        nelia.take()', '        count = count + 1',
    '    elif nelia.here() == "flower":', '        nelia.take()', '        flowers = flowers + 1',
  );
  const SIX = lines('count = 0', 'while count < 6:', '    nelia.step()', '    nelia.take()', '    count = count + 1');

  it('the first stage ends once the loaded program ran, in every world', () => {
    expect(isAllWorlds('r1-5', 'predict')).toBe(false);
    expect(solvedIn('r1-5', 'predict', LOADED)).toEqual(['normal', 'near', 'far']);
    expect(solvedIn('r1-5', 'predict', 'nelia.fly()\n')).toEqual([]);
  });

  it('the model solutions pass „Prüfen“ in every world', () => {
    const all = { normal: 'solved', near: 'solved', far: 'solved' };
    for (const g of ['roses', 'brook', 'six']) expect(isAllWorlds('r1-5', g), g).toBe(true);
    expect(by(check('r1-5', 'roses', ROSES))).toEqual(all);
    expect(by(check('r1-5', 'brook', refExample('brook', 'de')))).toEqual(all);
    expect(by(check('r1-5', 'brook', refExample('brook', 'en')))).toEqual(all);
    expect(by(check('r1-5', 'six', SIX))).toEqual(all);
  });

  it('hard-coded programs fail an edge world', () => {
    // Ten steps along the row of the normal case: the tree stands right in front of Nelia (near), items stay (far)
    const ten = check('r1-5', 'roses', ROSES.replace('while nelia.can_step():', 'for i in range(10):'));
    expect(by(ten)).toEqual({ normal: 'solved', near: 'error', far: 'failed' });
    expect(ten.results.find((r) => r.world === 'near').error).toMatchObject({ sline: 4 });
    // The counts of the normal case written in: wrong where the row is empty or longer
    expect(by(check('r1-5', 'roses', `${ROSES}count = 6\nflowers = 4\n`))).toEqual({ normal: 'solved', near: 'failed', far: 'failed' });
    // Nine steps there and back: back at the crossing, but the ice lies right next to it (0 steps, near) and
    // the brook is further away (far)
    const nine = lines('nelia.turn_right()', 'steps = 9', 'for i in range(steps):', '    nelia.step()', 'nelia.turn_left()', 'nelia.turn_left()', 'for i in range(steps):', '    nelia.step()');
    expect(by(check('r1-5', 'brook', nine))).toEqual({ normal: 'solved', near: 'failed', far: 'failed' });
    // Taking the whole row to the north: exactly six coins only where there are six (near)
    expect(by(check('r1-5', 'six', LOADED))).toEqual({ normal: 'failed', near: 'solved', far: 'failed' });
  });
});
