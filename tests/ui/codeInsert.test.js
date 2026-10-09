// World editor: inserting code from the map and building blocks (src/ui/editor/codeInsert.js, blocks.js).

import { describe, it, expect } from 'vitest';
import { planInsert, applyPlan, uniqueName, targetSnippet, menuSnippet, blankLineIndent } from '../../src/ui/editor/codeInsert.js';
import { BLOCKS, buildBlock, talkBlock } from '../../src/ui/editor/blocks.js';
import { compile } from '../../src/script/index.js';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';

/** Insert at the caret marked with | in `src`; returns the code with | at the new caret (or [sel] for a selection). */
function ins(src, snippet) {
  const at = src.indexOf('|');
  const code = src.replace('|', '');
  const plan = planInsert(code, at, at, snippet);
  const out = applyPlan(code, plan);
  const [a, b] = plan.select;
  return a === b ? out.slice(0, a) + '|' + out.slice(a) : out.slice(0, a) + '[' + out.slice(a, b) + ']' + out.slice(b);
}
const expr = (code) => ({ kind: 'expr', code });
const stmt = (code, wrap) => ({ kind: 'stmt', code, ...(wrap ? { wrap } : {}) });
const top = (code) => ({ kind: 'top', code });

describe('Insert code at the caret', () => {
  it('expressions go exactly to the caret or replace the selection', () => {
    expect(ins('camera.fly_to(|)\n', expr('place("camp")'))).toBe('camera.fly_to(place("camp")|)\n');
    const code = 'x = 1\n';
    const plan = planInsert(code, 4, 5, expr('(3, 4)'));
    expect(applyPlan(code, plan)).toBe('x = (3, 4)\n');
  });

  it('statements take the indentation of the line, one deeper after a colon', () => {
    expect(ins('def f():\n    a = 1|\n', stmt('b = 2'))).toBe('def f():\n    a = 1\n    b = 2|\n');
    expect(ins('def f():|\n    a = 1\n', stmt('b = 2'))).toBe('def f():\n    b = 2|\n    a = 1\n');
    expect(ins('x = 1|\n', stmt('for i in range(2):\n    y = i'))).toBe('x = 1\nfor i in range(2):\n    y = i|\n');
  });

  it('a blank line is replaced; its indentation comes from the line above', () => {
    expect(ins('def f():\n    a = 1\n|\n', stmt('b = 2'))).toBe('def f():\n    a = 1\n    b = 2|\n');
    expect(ins('if x:\n|', stmt('y = 1'))).toBe('if x:\n    y = 1|');
    expect(ins('def f():\n        |\n', stmt('b = 2'))).toBe('def f():\n        b = 2|\n');
    expect(blankLineIndent('def f():\n    a = 1\n# c\n\n', 23)).toBe('    ');
  });

  it('the caret in the indentation puts the statement above the line', () => {
    expect(ins('def f():\n  |  a = 1\n', stmt('b = 2'))).toBe('def f():\n    b = 2|\n    a = 1\n');
  });

  it('top-level blocks inside a function go behind it, with blank lines between the blocks', () => {
    const src = '@on_start\ndef intro():\n    say("nelia", de="Los")|\n\n# next\n@every(5)\ndef tick():\n    pass\n';
    expect(ins(src, top('@on_talk("a")\ndef t(hero):\n    pass'))).toBe(
      '@on_start\ndef intro():\n    say("nelia", de="Los")\n\n@on_talk("a")\ndef t(hero):\n    pass|\n\n# next\n@every(5)\ndef tick():\n    pass\n');
    expect(ins('def f():\n    a = 1|\n', top('x = 2'))).toBe('def f():\n    a = 1\n\nx = 2|\n');
  });

  it('top-level blocks at the top level stand apart by one blank line', () => {
    expect(ins('a = 1|\nb = 2\n', top('def g():\n    pass'))).toBe('a = 1\n\ndef g():\n    pass|\n\nb = 2\n');
    expect(ins('a = 1\n|\nb = 2\n', top('def g():\n    pass'))).toBe('a = 1\n\ndef g():\n    pass|\n\nb = 2\n');
    expect(ins('|', top('def g():\n    pass'))).toBe('def g():\n    pass|');
  });

  it('never between a decorator and its def, never inside a call spread over lines', () => {
    expect(ins('@every(|120)\ndef f():\n    pass\n', top('x = 1'))).toBe('@every(120)\ndef f():\n    pass\n\nx = 1|\n');
    expect(ins('@every(|120)\ndef f():\n    pass\n', stmt('y = 2'))).toBe('@every(120)\ndef f():\n    y = 2|\n    pass\n');
    expect(ins('def f():\n    objective("a", lambda: True,|\n              de="A")\n', stmt('b = 2'))).toBe(
      'def f():\n    objective("a", lambda: True,\n              de="A")\n    b = 2|\n');
    expect(ins('x = f(1,\n  |  2)\n', stmt('b = 2'))).toBe('x = f(1,\n    2)\nb = 2|\n');
    expect(ins('@on_start\n|def f():\n    pass\n', stmt('b = 2'))).toBe('@on_start\ndef f():\n    b = 2|\n    pass\n');
  });

  it('brackets in strings and comments do not count', async () => {
    const { depthAt } = await import('../../src/ui/editor/codeInsert.js');
    const code = 'say("(", de=\'[\')  # {\nx = """(\n"""\n';
    expect(depthAt(code, code.length)).toBe(0);
    expect(depthAt('f(a,\n', 5)).toBe(1);
  });

  it('statements with a header: in a function the lines only, at the top level wrapped', () => {
    const s = stmt('say("a")\nsay("b")', '@on_start\ndef d1():');
    expect(ins('def f():\n    x = 1|\n', s)).toBe('def f():\n    x = 1\n    say("a")\n    say("b")|\n');
    expect(ins('x = 1|\n', s)).toBe('x = 1\n\n@on_start\ndef d1():\n    say("a")\n    say("b")|\n');
  });

  it('placeholders «…» are selected after inserting', () => {
    expect(ins('|', stmt('make_place("«place1»", 3, 4, 2)'))).toBe('make_place("[place1]", 3, 4, 2)');
  });
});

describe('Code for map targets and the tile menu', () => {
  const codes = ['place1 = 1\nnpc("figure1", at=(1, 1))'];
  it('places, castle, heroes, figures and other things', () => {
    expect(targetSnippet({ kind: 'place', name: 'camp', x: 3, y: 4 }).code).toBe('place("camp")');
    expect(targetSnippet({ kind: 'hq', x: 3, y: 4 }).code).toBe('hq()');
    expect(targetSnippet({ kind: 'hero', hero: 'nelia', x: 3, y: 4 }).code).toBe('nelia');
    expect(targetSnippet({ kind: 'npc', npc: 'alchemist', x: 3, y: 4 }).code).toBe('"alchemist"');
    for (const kind of ['tree', 'pile', 'building', 'start', 'spot', 'shaft', 'coin', 'track']) expect(targetSnippet({ kind, x: 3, y: 4 }).code).toBe('(3, 4)');
    expect(targetSnippet({ kind: 'free', x: 3, y: 4 })).toBeNull();
  });

  it('menu: place with a fresh name, talk figure at the tile, coordinates', () => {
    const ctx = { codes, talk: (at) => talkBlock({ ...at, lang: 'de', codes, hero: 'nelia', hq: false, width: 32, height: 32 }) };
    expect(menuSnippet('coords', { x: 5, y: 6 }, ctx)).toEqual({ kind: 'expr', code: '(5, 6)' });
    expect(menuSnippet('place', { x: 5, y: 6 }, ctx)).toEqual({ kind: 'stmt', code: 'make_place("«place2»", 5, 6, 2)' });
    const npc = menuSnippet('npc', { x: 5, y: 6 }, ctx);
    expect(npc.kind).toBe('top');
    expect(npc.code).toContain('figure2 = npc("figure2", look="serf", at=(5, 6)');
    expect(npc.code).toContain('@on_talk("figure2")');
  });

  it('unique names skip names in any section', () => {
    expect(uniqueName('goal', ['goal1 = 2', 'x = "goal2"'])).toBe('goal3');
    expect(uniqueName('goal', ['goals1 = 2'])).toBe('goal1');
  });
});

describe('Building blocks', () => {
  const scenario = (code, hq) => ({
    format: 'kronland-scenario', version: 2, id: 'blocks', kind: 'mission', end: 'script',
    world: { base: 'flat', size: 32, fog: false, places: {} },
    players: [{ kind: 'human', hero: 'nelia', hq }, { kind: 'bandits' }],
    sections: [
      { id: 'mission', level: 'mission', code },
      { id: 'player', level: 'player', editable: true, code: '' },
    ],
  });
  const base = '@on_start\ndef intro():\n    say("nelia", de="Los geht\'s!", en="Here we go!")\n';

  for (const lang of ['de', 'en']) {
    for (const hq of [true, false]) {
      it(`all blocks compile and run together (${lang}, ${hq ? 'with' : 'without'} castle)`, () => {
        // Compile against the mission API (names, modules) of a real host
        const host = createScenarioSim(scenario('', hq)).mission.script;
        host.makeVm('mission', '', 1);
        const api = host.apis.mission;
        let code = base;
        let caret = code.indexOf('Here we go!")') + 'Here we go!")'.length;
        for (const b of BLOCKS) {
          const sn = buildBlock(b.id, { x: 12, y: 10, lang, codes: [code], hero: 'nelia', hq, width: 32, height: 32 });
          expect(sn, b.id).toBeTruthy();
          const plan = planInsert(code, caret, caret, sn);
          code = applyPlan(code, plan);
          caret = plan.select[1];
          expect(() => compile(code, { known: api.known, modules: api.modules }), `${b.id}:\n${code}`).not.toThrow();
        }
        const sim = createScenarioSim(scenario(code, hq));
        for (let i = 0; i < 1500; i++) sim.step();
        const st = sim.mission.script.state;
        expect(st.errors.map((e) => `${e.code} ${JSON.stringify(e.params)} line ${e.sline}`), code).toEqual([]);
        // The talk figure stands, the coins lie, the first wave came
        expect([...sim.entities.values()].some((e) => e.kind === 'npc' && e.npc === 'figure1')).toBe(true);
        expect(sim.map.items.size).toBe(5);
        expect([...sim.entities.values()].some((e) => e.kind === 'leader' && e.owner === sim.mission.state.bandits)).toBe(true);
        expect(sim.mission.state.objectives.find((o) => o.id === 'goal1')).toMatchObject({ status: 'active' });
      });
    }
  }

  it('the comments follow the UI language, the texts are in both languages', () => {
    for (const b of BLOCKS) {
      const de = b.build({ x: 3, y: 3, lang: 'de', codes: [], hero: 'nelia', hq: true, width: 32, height: 32 }).code;
      const en = b.build({ x: 3, y: 3, lang: 'en', codes: [], hero: 'nelia', hq: true, width: 32, height: 32 }).code;
      for (const line of de.split('\n')) if (/\bde="/.test(line)) expect(line, b.id).toMatch(/\ben="/);
      expect(de.replace(/#.*/g, '')).toBe(en.replace(/#.*/g, ''));
    }
  });
});
