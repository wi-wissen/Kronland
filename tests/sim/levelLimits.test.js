// Limits for levels from other people (docs/SKRIPTE.md#grenzen): a script must not freeze the browser,
// blow up memory or the save game, reach into JS internals or load files from other websites.

import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { validateScenario } from '../../src/sim/scripting/scenario.js';

const base = (mission, extra = {}) => ({
  format: 'kronland-scenario', version: 2, end: 'script', id: 'limits', kind: 'adventure',
  world: { base: 'flat', width: 20, height: 12, fog: false, starts: [{ x: 4, y: 6 }] },
  players: [{ kind: 'human', hero: 'nelia', hq: false }],
  sections: [{ id: 'm', level: 'mission', code: mission }],
  ...extra,
});
const sim = (mission, extra) => createScenarioSim(base(mission, extra));
const errors = (s) => s.mission.script.state.errors;
const what = (s) => errors(s).map((e) => e.params?.what ?? e.code);

describe('levels from other people', () => {
  it('names from Object.prototype are plain texts, unsafe names are refused', () => {
    const s = sim('message("constructor")\nmessage("__proto__")\n');
    expect(errors(s)).toEqual([]);
    expect(s.mission.state.messages.map((m) => m.text)).toEqual(['constructor', '__proto__']);
    expect(() => structuredClone(saveGame(s))).not.toThrow();
    expect(loadGame(JSON.parse(JSON.stringify(saveGame(s)))).hash()).toBe(s.hash());
    expect(what(sim('make_place("__proto__", 1, 1)\n'))).toEqual(['badName']);
    expect(what(sim('objective("__proto__", lambda: False, text="x")\n'))).toEqual(['badName']);
    expect(what(sim('print(place("constructor"))\n'))).toEqual(['err.script.game']);
  });

  it('voice recordings may only come from the level itself', () => {
    expect(what(sim('say("nelia", "Hallo", voice="https://example.org/a.mp3")\n'))).toEqual(['assetPath']);
    expect(what(sim('say("nelia", "Hallo", voice="../../a.mp3")\n'))).toEqual(['assetPath']);
    expect(errors(sim('say("nelia", "Hallo", voice="audio/voice/a.mp3")\n'))).toEqual([]);
    // Scenario format 1 (text table texts/voice) no longer loads; a text is never a key into a table
    expect(validateScenario(base('', { version: 1 })).join()).toMatch(/version 1 is not supported/);
    const s = createScenarioSim(base('', { texts: { hi: 'Hallo' }, voice: { hi: 'https://example.org/a.mp3' } }));
    s.mission.script.say('nelia', 'hi', null, null);
    expect(s.mission.state.messages.at(-1)).toMatchObject({ text: 'hi', voice: null });
  });

  it('memory: big ranges and doubling lists or texts end in an OverflowError', () => {
    for (const code of ['x = list(range(10 ** 7))', 'x = [1]\nfor i in range(30):\n    x = x + x', 's = "ab"\nfor i in range(30):\n    s = s + s', 'x = [1]\nfor i in range(30):\n    x.extend(x)']) {
      expect(errors(sim(code))[0]?.kind, code).toBe('OverflowError');
    }
  });

  it('world building per call is limited', () => {
    expect(what(sim('plant_trees((5, 5), 10, radius=3000)\n'))).toEqual(['tooBig']);
    expect(what(sim('spawn(HUMAN, "sword1", (5, 5), count=1000)\n'))).toEqual(['tooBig']);
    expect(what(sim('for i in range(600):\n    make_place("p" + str(i), 1, 1)\n'))).toEqual(['tooMany']);
  });

  it('endless goal conditions share one budget per tick and are switched off', () => {
    const s = sim('def spin():\n    while True:\n        pass\n\nobjective("a", lambda: spin(), text="a")\nobjective("b", lambda: spin(), text="b")\nobjective("c", lambda: spin(), text="c")\n');
    const t0 = performance.now();
    s.step();
    const ms = performance.now() - t0;
    expect(errors(s).map((e) => e.code)).toEqual(['err.script.tooLong', 'err.script.tooLong', 'err.script.tooLong']);
    expect(ms).toBeLessThan(1000);
    for (let i = 0; i < 5; i++) s.step();
    expect(errors(s)).toHaveLength(3);
  });

  it('a world building that never ends is an error, not a silent loop in the game', () => {
    expect(errors(sim('x = 0\nwhile True:\n    x += 1\n'))[0]).toMatchObject({ code: 'err.script.setupTooLong' });
  }, 30_000);

  it('very long output lines are cut', () => {
    const s = sim('print("x" * 100000)\nfor i in range(100):\n    print("y" * 1000, end="")\n');
    expect(Math.max(...s.mission.script.state.console.map((c) => c.text.length))).toBeLessThanOrEqual(2000);
  });

  it('scenario files are checked for size, names and texts', () => {
    expect(validateScenario(base('', { world: { base: 'flat', width: 5000, height: 12 } })).join()).toMatch(/world\.width/);
    expect(validateScenario(base('', { players: Array.from({ length: 12 }, (_, i) => ({ kind: i ? 'ai' : 'human' })) })).join()).toMatch(/players/);
    expect(validateScenario(JSON.parse('{"format":"kronland-scenario","version":2,"id":"x","players":[{"kind":"human"}],"victoryTexts":{"__proto__":"x"}}')).join()).toMatch(/victoryTexts\.__proto__/);
    expect(validateScenario(base('', { title: 42 })).join()).toMatch(/title/);
  });
});
