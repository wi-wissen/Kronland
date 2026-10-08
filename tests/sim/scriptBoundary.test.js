// Boundary Python → simulation: every number from a script reaches the game state as a whole number.
// NaN, infinity and absurd sizes become a readable script error (api.js toInt/toTicks).

import { describe, it, expect } from 'vitest';
import { createScenarioSim } from '../../src/sim/missions/runtime.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { nonIntegers } from './integerGuard.js';

const scenario = (mission, extra = {}) => createScenarioSim({
  format: 'kronland-scenario', version: 1, id: 'boundary', kind: 'adventure',
  world: { base: 'flat', width: 20, height: 12, fog: false, starts: [{ x: 4, y: 6 }] },
  players: [{ kind: 'human', hero: 'nelia', hq: false }],
  sections: [{ id: 'm', level: 'mission', code: mission }, { id: 'player', level: 'player', editable: true, code: '' }],
  ...extra,
});
const errors = (sim) => sim.mission.script.state.errors;
const runPlayer = (sim, code) => sim.command({ type: 'script', player: 0, action: 'run', sections: { player: code } });

describe('numbers from scripts', () => {
  it('wait(inf) and wait(nan) are script errors, not a broken save game', () => {
    for (const v of ['float("inf")', 'float("nan")', '10 ** 9']) {
      const sim = scenario('');
      runPlayer(sim, `wait(${v})\nprint("after")`);
      for (let i = 0; i < 3; i++) sim.step();
      expect(errors(sim)[0], v).toMatchObject({ code: 'err.script.value', params: { what: 'gameSeconds' } });
      expect(nonIntegers(JSON.parse(JSON.stringify(saveGame(sim))))).toEqual([]);
    }
  });

  it('coordinates must be finite whole-number sized', () => {
    const sim = scenario('p = toward((1, 1), (5, 5), float("inf"))\n');
    expect(errors(sim)[0]).toMatchObject({ code: 'err.script.value', params: { what: 'gameNumber', name: 'distance', value: 'inf' } });
    const sim2 = scenario('make_place("a", 2.9, -3.7, 1)\nprint(place("a").x, place("a").y)\n');
    expect(errors(sim2)).toEqual([]);
    expect(sim2.mission.script.state.console.map((c) => c.text)).toEqual(['2 -3']);
  });

  it('@every(0.5) runs every 5 ticks; @every with a non-number is an error', () => {
    const sim = scenario('n = 0\n@every(0.5)\ndef tick():\n    global n\n    n += 1\n');
    for (let i = 0; i < 40; i++) sim.step();
    const vm = sim.mission.script.vms.mission;
    expect(vm.globals.get('n')).toBeGreaterThanOrEqual(7);
    expect(vm.globals.get('n')).toBeLessThanOrEqual(8);
    expect(errors(scenario('@every(float("inf"))\ndef t():\n    pass\n'))[0]).toMatchObject({ params: { what: 'gameSeconds' } });
  });

  it('ai(start_in=2.55) starts on a whole tick', () => {
    const sim = scenario('ai(HUMAN, start_in=2.55)\n');
    expect(errors(sim)).toEqual([]);
    expect(Number.isSafeInteger(sim.mission.state.ai[0].startTick)).toBe(true);
    const copy = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(copy.hash()).toBe(sim.hash());
  });
});
