// Fuzz/endurance test: random but plausible command sequences (with seed) from several players,
// plus occasional nonsensical commands. Checks invariants after each section, determinism
// and that saving/loading mid-run continues exactly the same.

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { allMissions } from '../../src/sim/missions/registry.js';
import { fuzzRun, checkInvariants } from './fuzzHelpers.js';

const CASES = [
  { seed: 1, size: 96, players: 2, ticks: 6000 },
  { seed: 7, size: 96, players: 3, ticks: 6000 },
  { seed: 23, size: 128, players: 4, ticks: 5000 },
  { seed: 99, size: 160, players: 2, ticks: 4000 },
];

describe('Fuzz: random command sequences', () => {
  for (const c of CASES) {
    it(`Seed ${c.seed}, size ${c.size}, ${c.players} players: no exceptions, invariants hold`, () => {
      const { problems, sim } = fuzzRun(c);
      expect(problems).toEqual([]);
      expect(sim.tick).toBe(c.ticks);
    }, 120_000);
  }

  for (const m of allMissions()) {
    it(`Mission ${m.id}: random commands, saving/loading, invariants`, () => {
      const c = { seed: 3, mission: m.id, ticks: 3000, rich: false };
      const a = fuzzRun(c);
      expect(a.problems).toEqual([]);
      const first = fuzzRun({ ...c, ticks: 1500, replay: a.log });
      const loaded = loadGame(JSON.parse(JSON.stringify(saveGame(first.sim))));
      const rest = fuzzRun({ ...c, sim: loaded, from: 1500, replay: a.log });
      expect(rest.problems).toEqual([]);
      expect(JSON.parse(JSON.stringify(saveGame(loaded)))).toEqual(JSON.parse(JSON.stringify(saveGame(a.sim))));
    }, 120_000);
  }

  it('same commands ⇒ same course; saving/loading mid-run continues identically', () => {
    const c = { seed: 5, size: 96, players: 3, ticks: 5000 };
    const a = fuzzRun(c);
    expect(a.problems).toEqual([]);
    // repetition with recorded commands ⇒ identical hashes
    const b = fuzzRun({ ...c, replay: a.log });
    expect(b.hashes).toEqual(a.hashes);
    // run to the middle, save, load (via JSON), continue with the same commands
    const half = 2500;
    const first = fuzzRun({ ...c, ticks: half, replay: a.log });
    const json = JSON.stringify(saveGame(first.sim));
    const loaded = loadGame(JSON.parse(json));
    expect(loaded.hash()).toBe(first.sim.hash());
    const rest = fuzzRun({ ...c, sim: loaded, from: half, replay: a.log });
    expect(rest.problems).toEqual([]);
    expect(loaded.hash()).toBe(a.sim.hash());
    // Not only the hash: the complete state matches (also weather, mission, market)
    expect(JSON.parse(JSON.stringify(saveGame(loaded)))).toEqual(JSON.parse(JSON.stringify(saveGame(a.sim))));
    // The loaded state shares no mutable objects with the original
    const again = loadGame(JSON.parse(json));
    const twice = loadGame(saveGame(again));
    twice.players[0].stock.gold += 1;
    twice.players[0].unitTier.sword = 4;
    expect(again.players[0].stock.gold).not.toBe(twice.players[0].stock.gold);
    expect(again.players[0].unitTier.sword).not.toBe(4);
  }, 180_000);
});

describe('Endurance run: AI vs AI', () => {
  it('4 AI opponents, size 160, 60 min play time: invariants and runtime', () => {
    const sim = new Sim({ seed: 31, size: 160, players: 4 });
    const ais = [0, 1, 2, 3].map((p) => new AiPlayer(sim, p, ['hard', 'normal', 'hard', 'easy'][p]));
    const t0 = performance.now();
    let slowest = 0;
    const problems = [];
    const TICKS = 60 * 600;
    for (let t = 0; t < TICKS; t++) {
      const s = performance.now();
      for (const ai of ais) if (!sim.players[ai.player].defeated) ai.update();
      sim.step();
      slowest = Math.max(slowest, performance.now() - s);
      if ((t + 1) % 3000 === 0) {
        const bad = checkInvariants(sim);
        if (bad.length) { problems.push(`tick ${t}: ${bad.slice(0, 8).join('; ')}`); break; }
      }
      if (sim.winner !== null) break;
    }
    const secs = (performance.now() - t0) / 1000;
    // document runtime (for the QA report)
    console.log(`AI endurance run: ${sim.tick} ticks in ${secs.toFixed(1)} s, slowest tick ${slowest.toFixed(1)} ms, entities ${sim.entities.size}, winner ${sim.winner}`);
    expect(problems).toEqual([]);
    // Real time would be 3600 s. Measured (QA): ~35 s; before the region pre-check of the pathfinding ~10 min with
    // ticks over 1 s. Generous limit so that slow machines do not fail.
    expect(secs).toBeLessThan(300);
  }, 900_000);
});
