// Determinism beyond the hash: the save game holds only whole numbers, the AI decides identically in
// repeated runs (same commands, same hash all along) and continues identically after loading.
// Background: docs/ARCHITEKTUR.md (lockstep), tests/sim/rules.test.js (forbidden operations).

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { createMissionSim, createScenarioSim } from '../../src/sim/missions/runtime.js';
import { nonIntegers } from './integerGuard.js';

/** AI against AI (inside the simulation), logging every command and the hash every 500 ticks. */
function match(seed, ticks, sim = new Sim({ seed, ai: ['hard', 'normal'] })) {
  const log = [];
  const command = sim.command.bind(sim);
  sim.command = (c) => { log.push(`${sim.tick} ${JSON.stringify(c)}`); return command(c); };
  for (let t = 0; t < ticks; t++) {
    sim.step();
    if (sim.tick % 500 === 0) log.push(`hash ${sim.tick} ${sim.hash()}`);
  }
  return { sim, log };
}

describe('whole numbers and repeatable decisions', () => {
  it('finds fractions, NaN and Infinity', () => {
    expect(nonIntegers({ a: 1, b: [2, 0.5], c: { d: NaN, e: Infinity, f: 2 ** 60 } })).toEqual(['$.b[1] = 0.5', '$.c.d = NaN', '$.c.e = Infinity', `$.c.f = ${2 ** 60}`]);
  });

  it('an AI match leaves only whole numbers in the save game', () => {
    const { sim } = match(4, 6000);
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    expect(data.ai.map((a) => a.player)).toEqual([0, 1]);
    expect(nonIntegers(data)).toEqual([]);
  }, 60_000);

  it('a campaign mission and a script scenario leave only whole numbers in the save game', () => {
    const c1 = createMissionSim('c1');
    for (let i = 0; i < 1500; i++) c1.step();
    expect(nonIntegers(JSON.parse(JSON.stringify(saveGame(c1))))).toEqual([]);
    const adv = createMissionSim('r1-m');
    adv.command({ type: 'script', player: 0, action: 'run', sections: { player: 'x = 2.5\nwhile nelia.can_step():\n    nelia.step()\n' } });
    for (let i = 0; i < 300; i++) adv.step();
    expect(nonIntegers(JSON.parse(JSON.stringify(saveGame(adv))))).toEqual([]);
  }, 60_000);

  it('two AI matches issue the same commands in the same ticks', () => {
    const a = match(6, 5000).log, b = match(6, 5000).log;
    expect(a.length).toBeGreaterThan(50);
    expect(b).toEqual(a);
  }, 60_000);

  it('an AI match continues with the same commands after saving and loading halfway', () => {
    const whole = match(7, 5000).log;
    const half = match(7, 2500);
    const sim = loadGame(JSON.parse(JSON.stringify(saveGame(half.sim))));
    const rest = match(7, 2500, sim).log;
    expect([...half.log, ...rest]).toEqual(whole);
  }, 60_000);

  it('a hero who joins later is known to scripts at once, before and after loading', () => {
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, end: 'script', id: 'join', kind: 'adventure',
      world: { base: 'flat', width: 20, height: 12, fog: false, starts: [{ x: 4, y: 6 }] },
      players: [{ kind: 'human', hero: 'nelia', hq: false }],
      sections: [{ id: 'm', level: 'mission', code: '@every(1)\ndef look():\n    print("orrin" if orrin else "-")\n' }],
    });
    for (let i = 0; i < 12; i++) sim.step();
    sim.spawnHero(0, 'orrin');
    for (let i = 0; i < 10; i++) sim.step();
    const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    for (let i = 0; i < 10; i++) { sim.step(); loaded.step(); }
    const out = (s) => s.mission.script.state.console.map((c) => c.text);
    expect(out(sim)[0]).toBe('-');
    expect(out(sim).at(-1)).toBe('orrin');
    expect(out(loaded)).toEqual(out(sim));
    expect(loaded.hash()).toBe(sim.hash());
  });
});
