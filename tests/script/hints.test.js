// Hints: valid code that almost never does what was meant (src/script/hints.js) – one positive and one negative case
// per hint, no false alarms on the bundled levels and the reference examples, busy loop at run time, hints(False).

import { describe, it, expect } from 'vitest';
import { compile } from '../../src/script/index.js';
import { hintVocab, API_DOC } from '../../src/sim/scripting/api.js';
import { createScenarioSim, createMissionSim } from '../../src/sim/missions/runtime.js';
import { SCENARIOS } from '../../src/sim/missions/levels/index.js';
import { EXAMPLES, WORKED, refExample } from '../../src/ui/script/reference.js';
import { has, t } from '../../src/i18n/index.js';
import { BUSY_TICKS } from '../../src/sim/scripting/host.js';

const KNOWN = ['nelia', 'wait_until', 'hero', 'orrin', 'taran', 'malvor', 'tile', 'weather', 'serfs', 'place', 'trees_near', 'stock', 'wait', 'time', 'count', 'forecast', 'items_near', 'figures_near', 'hq', 'notify', 'build', 'find_spot', 'troops'];
const hints = (src, level = 'player') => compile(src, { known: KNOWN, vocab: hintVocab(level) }).hints;
const codes = (src) => hints(src).map((h) => `${h.code.replace('script.hint.', '')}:${h.line}`);

describe('Hints at compile time', () => {
  it('left()/right() as a statement only look', () => {
    expect(hints('nelia.left()\n')).toEqual([{ code: 'script.hint.lookOnly', params: { call: 'nelia.left()', turn: 'nelia.turn_left()' }, line: 1, col: 1 }]);
    expect(codes('x = nelia.right()\nprint(nelia.left())\nif nelia.left() == "tree":\n    nelia.turn_left()\n')).toEqual([]);
  });

  it('sensor results thrown away', () => {
    expect(codes('nelia.front()\nnelia.can_step()\ntile(3, 4)\nweather()\n')).toEqual(['unusedResult:1', 'unusedResult:2', 'unusedResult:3', 'unusedResult:4']);
    // Own functions with the same name, list methods and commands are fine
    expect(codes('def tile(x, y):\n    print(x)\ntile(3, 4)\nxs = [1]\nxs.count(1)\nnelia.step()\nnelia.take()\n')).toEqual([]);
  });

  it('methods without parentheses: nothing happens, in a condition always true', () => {
    expect(codes('nelia.step\nwhile nelia.can_step:\n    pass\nif not nelia.can_step or True:\n    pass\n')).toEqual(['notCalled:1', 'alwaysTrue:2', 'alwaysTrue:4']);
    expect(hints('nelia.step\n')[0].params).toEqual({ name: 'nelia.step', call: 'nelia.step()' });
    // Passing a method as a value is fine
    expect(codes('def fetch(turn):\n    turn()\nfetch(nelia.turn_left)\nf = nelia.step\nwait_until(nelia.can_step)\n')).toEqual([]);
  });

  it('impossible answers of sensors', () => {
    const h = hints('if nelia.front() == "Tree":\n    pass\n')[0];
    expect(h).toMatchObject({ code: 'script.hint.unknownAnswer', line: 1, params: { call: 'nelia.front()', value: 'Tree', suggestion: 'tree' } });
    expect(h.params.answers).toContain('"coin"');
    expect(codes('if "baum" == nelia.left():\n    pass\nwhile weather() != "snow":\n    pass\nif nelia.facing == "nord":\n    pass\nif tile(1, 2) in ("tree", "stone"):\n    pass\n'))
      .toEqual(['unknownAnswer:1', 'unknownAnswer:3', 'unknownAnswer:5', 'unknownAnswer:7']);
    expect(codes('if nelia.front() == "tree" or nelia.here() != "coin":\n    pass\nif nelia.facing == "north" and weather() == "winter":\n    pass\nx = "Tree" == "tree"\n')).toEqual([]);
  });

  it('a comparison as a statement', () => {
    expect(hints('count = 0\ncount == count + 1\n')).toEqual([{ code: 'script.hint.compareStatement', params: { name: 'count' }, line: 2, col: 1 }]);
    expect(codes('count = 0\ncount = count + 1\nok = count == 1\nprint(count == 1)\n')).toEqual([]);
  });

  it('unknown methods on the known game objects already at compile time', () => {
    expect(hints('nelia.turnleft()\n')[0]).toMatchObject({ code: 'script.hint.unknownMethod', params: { obj: 'nelia', name: 'turnleft', suggestion: 'turn_left' } });
    expect(codes('nelia.ahead()\nprint(nelia.x, hero.name)\n')).toEqual(['unusedResult:1']);
    // A name of the program hides the game object
    expect(codes('nelia = [1]\nnelia.append(2)\nfor hero in serfs():\n    hero.chop()\n')).toEqual([]);
  });

  it('every hint has a text in both languages; without vocabulary there are no hints', () => {
    for (const c of ['lookOnly', 'unusedResult', 'notCalled', 'alwaysTrue', 'unknownAnswer', 'compareStatement', 'unknownMethod', 'busyLoop']) {
      expect(has(`script.hint.${c}`), c).toBe(true);
      expect(t(`script.hint.${c}`, { call: 'a()', turn: 'b()', name: 'n', value: 'v', suggestion: 's', answers: '"x"', obj: 'o' }, 'en')).not.toMatch(/\{/);
    }
    expect(compile('nelia.left()\n', { known: KNOWN }).hints).toEqual([]);
  });

  it('the vocabulary covers every sensor of the API', () => {
    const v = hintVocab('player');
    for (const m of ['front', 'left', 'right', 'here', 'can_step', 'is_at', 'ahead']) expect(v.queryMethods.has(m), m).toBe(true);
    for (const f of ['tile', 'weather', 'forecast', 'figures_near', 'items_near']) expect(v.queryFunctions.has(f), f).toBe(true);
    expect(v.answers.front).toContain('track');
    expect(API_DOC.filter((e) => e.answers).length).toBeGreaterThanOrEqual(5);
  });
});

describe('No false alarms', () => {
  const allHints = (sim) => [...sim.mission.script.state.player.hints ?? [], ...sim.mission.script.state.missionHints ?? []];

  it('bundled levels: mission code and player templates', () => {
    for (const s of SCENARIOS) {
      const sim = createMissionSim(s.id);
      const tpl = s.sections.find((x) => x.level === 'player')?.code;
      if (tpl !== undefined) sim.command({ type: 'script', player: 0, action: 'run', sections: { player: tpl } });
      sim.step();
      expect(allHints(sim), s.id).toEqual([]);
    }
  });

  it('reference examples and worked solutions', () => {
    const found = [];
    for (const name of [...Object.keys(EXAMPLES), ...Object.keys(WORKED)]) {
      for (const lang of ['de', 'en']) {
        const src = refExample(name, lang);
        const doc = API_DOC.find((e) => e.name === name);
        const level = doc?.level === 'mission' || WORKED[name]?.level === 'mission' ? 'mission' : 'player';
        let h;
        try { h = compile(src, { known: [...KNOWN, ...API_DOC.map((e) => e.name)], vocab: hintVocab(level) }).hints; } catch { continue; }
        // The reference entry of a sensor may show its answer being thrown away on purpose – it never does
        if (h.length) found.push(`${name} ${lang}: ${h.map((x) => x.code).join(', ')}`);
      }
    }
    expect(found).toEqual([]);
  });
});

describe('Hints in the game', () => {
  const scenario = (mission = 'pass\n') => ({
    format: 'kronland-scenario', version: 2, id: 'hints', kind: 'adventure', end: 'script',
    world: { base: 'flat', width: 20, height: 12, fog: false, starts: [{ x: 4, y: 6 }], places: {} },
    players: [{ kind: 'human', hero: 'nelia', hq: false }],
    sections: [{ id: 'mission', level: 'mission', code: mission }, { id: 'player', level: 'player', editable: true, code: '' }],
  });

  it('stored with section and line, shown in the UI state, the program keeps running', () => {
    const sim = createScenarioSim(scenario());
    sim.command({ type: 'script', player: 0, action: 'run', sections: { player: 'x = 1\nnelia.left()\nnelia.step()\n' } });
    for (let i = 0; i < 20; i++) sim.step();
    const st = sim.mission.script.state;
    expect(st.player.hints).toMatchObject([{ code: 'script.hint.lookOnly', section: 'player', sline: 2, level: 'player' }]);
    expect(sim.mission.script.uiState().player.hints).toHaveLength(1);
    expect(st.player.status).toBe('done');
    expect(st.errors).toEqual([]);
  });

  it('busy loop: computes for about 5 s without any action', () => {
    const sim = createScenarioSim(scenario());
    sim.command({ type: 'script', player: 0, action: 'run', sections: { player: 'n = 0\nwhile not nelia.is_at((9, 9)):\n    n = n + 1\n' } });
    for (let i = 0; i < BUSY_TICKS - 5; i++) sim.step();
    expect(sim.mission.script.state.player.hints).toEqual([]);
    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.mission.script.state.player.hints).toMatchObject([{ code: 'script.hint.busyLoop', section: 'player' }]);
    // A loop that waits is no busy loop
    sim.command({ type: 'script', player: 0, action: 'run', sections: { player: 'while True:\n    nelia.turn_left()\n' } });
    for (let i = 0; i < 2 * BUSY_TICKS; i++) sim.step();
    expect(sim.mission.script.state.player.hints).toEqual([]);
  });

  it('a mission can switch hints off (a stage where finding the mistake is the task)', () => {
    const sim = createScenarioSim(scenario('hints(False)\n'));
    sim.command({ type: 'script', player: 0, action: 'run', sections: { player: 'nelia.left()\nwhile True:\n    pass\n' } });
    for (let i = 0; i < 2 * BUSY_TICKS; i++) sim.step();
    expect(sim.mission.script.state.player.hints).toEqual([]);
    expect(sim.mission.script.uiState().player.hints).toEqual([]);
  });
});
