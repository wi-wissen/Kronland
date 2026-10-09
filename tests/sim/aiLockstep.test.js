// Computer opponents inside the simulation (src/ai/runner.js): their memory is sim state (saved, hashed),
// they run inside Sim.step, so lockstep clients and loaded games decide identically. docs/ARCHITEKTUR.md (Multiplayer).

import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';
import { createMissionSim, createScenarioSim } from '../../src/sim/missions/runtime.js';
import { addAi, aiOf, AI_ERROR_LIMIT } from '../../src/ai/runner.js';
import { createAiState } from '../../src/ai/AiPlayer.js';

const roundTrip = (sim) => loadGame(JSON.parse(JSON.stringify(saveGame(sim))));

describe('AI inside the simulation', () => {
  it('AI vs AI: straight run and save → load at half time have the same hash in every tick after loading', () => {
    const N = 3000;
    const straight = new Sim({ seed: 8, ai: ['hard', 'normal'] });
    straight.run(N / 2);
    const loaded = roundTrip(straight);
    expect(loaded.ai).toEqual(straight.ai);
    expect(loaded.hash()).toBe(straight.hash());
    let diff = -1;
    for (let t = 0; t < N / 2 && diff < 0; t++) {
      straight.step(); loaded.step();
      if (loaded.hash() !== straight.hash()) diff = straight.tick;
    }
    expect(diff).toBe(-1);
    // the AI did something in the second half (not a trivially idle comparison)
    expect([...straight.entities.values()].filter((e) => e.owner === 1 && e.kind === 'building').length).toBeGreaterThan(3);
  }, 120_000);

  it('two independent simulations with the same seed and command log stay identical (human + AI)', () => {
    // client A: a scripted human player 0 decides from its own state; its commands go into the log
    const a = new Sim({ seed: 13, ai: [null, 'hard'] });
    const log = new Map();
    const human = (sim) => {
      const t = sim.tick;
      if (t === 5) return [{ type: 'buySerf', player: 0, count: 2 }];
      if (t === 40) return [{ type: 'setTax', player: 0, level: 3 }];
      if (t === 80) {
        const hq = sim.findBuilding(0, 'headquarters');
        const pos = sim.findPlacement(0, 'residence', hq.x + 2, hq.y + 6);
        const serfs = [...sim.entities.values()].filter((e) => e.kind === 'unit' && e.owner === 0).slice(0, 3).map((e) => e.id);
        return [{ type: 'placeBuilding', player: 0, building: 'residence', x: pos.x, y: pos.y, units: serfs }];
      }
      return [];
    };
    const hashesA = [];
    for (let i = 0; i < 1500; i++) {
      const cmds = human(a);
      if (cmds.length) log.set(a.tick, cmds);
      a.step(structuredClone(cmds));
      hashesA.push(a.hash());
    }
    // client B: same seed, only the command log (the AI decisions it computes itself)
    const b = new Sim({ seed: 13, ai: [null, 'hard'] });
    const hashesB = [];
    for (let i = 0; i < 1500; i++) { b.step(structuredClone(log.get(b.tick) ?? [])); hashesB.push(b.hash()); }
    expect(log.size).toBe(3);
    expect(hashesB).toEqual(hashesA);
    expect(b.ai).toEqual(a.ai);
  }, 60_000);

  it('AI memory is plain JSON: round trip keeps it and the hash', () => {
    const sim = new Sim({ seed: 3, ai: ['easy', 'hard'] });
    sim.run(700);
    const st = sim.ai;
    expect(st.map((s) => s.player)).toEqual([0, 1]);
    expect(JSON.parse(JSON.stringify(st))).toEqual(st);
    for (const s of st) expect(Object.keys(s).sort()).toEqual(Object.keys(createAiState(sim, 0)).sort());
    const loaded = roundTrip(sim);
    expect(loaded.ai).toEqual(sim.ai);
    expect(loaded.hash()).toBe(sim.hash());
    // AI memory is part of the hash
    loaded.ai[1].armyState = loaded.ai[1].armyState === 'attack' ? 'gather' : 'attack';
    expect(loaded.hash()).not.toBe(sim.hash());
  });

  it('older save games with the AI outside the simulation (extra.ais) load into sim.ai', () => {
    const sim = new Sim({ seed: 4, ai: [null, 'hard'] });
    sim.run(300);
    const data = JSON.parse(JSON.stringify(saveGame(sim)));
    const old = data.ai[0];
    delete data.ai;
    data.extra = { ais: [{ player: 1, difficulty: 'hard', rng: old.rng, armyState: old.armyState, attackStrength: 0, attackNowSeen: 0, forceAttack: false, badTargets: [] }] };
    const loaded = loadGame(data);
    expect(loaded.ai).toEqual(sim.ai);
    for (let i = 0; i < 600; i++) { sim.step(); loaded.step(); }
    expect(loaded.hash()).toBe(sim.hash());
  });

  it('AI commands go through the normal validation (no rule can be bypassed)', () => {
    const sim = new Sim({ seed: 2 });
    const ai = addAi(sim, 1, 'normal');
    const foreignHq = sim.findBuilding(0, 'headquarters');
    ai.run = () => [{ type: 'demolish', player: 1, building: foreignHq.id }, { type: 'buySerf', player: 1, count: 1 }];
    const ev = sim.step();
    expect(ev.some((e) => e.type === 'rejected' && e.player === 1 && e.command === 'demolish')).toBe(true);
    expect(sim.entities.has(foreignHq.id)).toBe(true);
  });

  it('an error in the AI drops that decision, is reported and switches the AI off deterministically', () => {
    const make = () => {
      const sim = new Sim({ seed: 5, ai: ['normal', 'normal'] });
      sim.run(100);
      const ai = aiOf(sim, 1);
      const run = ai.run.bind(ai);
      ai.run = () => { if (sim.tick >= 120) throw new Error('boom'); return run(); };
      return sim;
    };
    const a = make(), b = make();
    const events = [];
    for (let i = 0; i < 100; i++) {
      for (const e of a.step()) if (e.type === 'aiError' || e.type === 'aiDisabled') events.push(e);
      b.step();
      expect(b.hash()).toBe(a.hash());
    }
    expect(events.filter((e) => e.type === 'aiError')).toHaveLength(AI_ERROR_LIMIT);
    expect(events[0]).toMatchObject({ type: 'aiError', player: 1, message: 'boom' });
    expect(events.at(-1)).toEqual({ type: 'aiDisabled', player: 1 });
    expect(a.ai[1]).toMatchObject({ disabled: true, errors: AI_ERROR_LIMIT });
    expect(a.ai[0].disabled).toBe(false);
    // stays off after loading
    expect(roundTrip(a).ai[1].disabled).toBe(true);
  });

  it('a single error does not switch the AI off', () => {
    const sim = new Sim({ seed: 5, ai: [null, 'normal'] });
    const ai = aiOf(sim, 1);
    const run = ai.run.bind(ai);
    let once = true;
    ai.run = () => { const c = run(); if (c && once) { once = false; throw new Error('once'); } return c; };
    const errors = [];
    for (let i = 0; i < 400; i++) for (const e of sim.step()) if (e.type === 'aiError') errors.push(e);
    expect(errors).toHaveLength(1);
    expect(sim.ai[0]).toMatchObject({ disabled: false, errors: 0 });
  });

  it('mission AI comes with the simulation', () => {
    const sim = createMissionSim('c6');
    const ais = sim.mission.def.players.map((p, i) => (p.kind === 'ai' ? i : null)).filter((i) => i !== null);
    expect(ais.length).toBeGreaterThan(0);
    expect(sim.ai.map((s) => s.player)).toEqual(ais);
    expect(createMissionSim('c6', { ai: false }).ai).toEqual([]);
  });

  it('script settings of the AI (start delay, ai()) live in the simulation and survive saving while it waits', () => {
    const sim = createScenarioSim({
      format: 'kronland-scenario', version: 2, id: 'test', kind: 'mission', end: 'script',
      world: { base: 'generate', seed: 42, size: 64, fog: true },
      players: [{ kind: 'human', hero: 'nelia' }, { kind: 'ai', difficulty: 'normal', startDelay: 30, forbid: ['residence'] }],
      sections: [{ id: 'mission', level: 'mission', code: '@on_start\ndef mad():\n    wait(60)\n    ai(ENEMY, difficulty="hard", aggression="aggressive")\n' }],
    });
    const buildings = (s) => [...s.entities.values()].filter((e) => e.kind === 'building' && e.owner === 1).length;
    sim.run(150);
    const loaded = roundTrip(sim);
    expect(loaded.mission.state.ai).toEqual(sim.mission.state.ai);
    for (let i = 0; i < 1500; i++) { sim.step(); loaded.step(); }
    expect(loaded.hash()).toBe(sim.hash());
    expect(buildings(loaded)).toBeGreaterThan(2);
    expect(loaded.ai[0]).toMatchObject({ player: 1, difficulty: 'hard' });
    expect(loaded.ai).toEqual(sim.ai);
  }, 60_000);

  it('eliminated players: their AI issues no more commands', () => {
    const sim = new Sim({ seed: 3, players: 3, ai: [null, 'hard', null] });
    sim.destroyBuilding(sim.findBuilding(1, 'headquarters'), null);
    let n = 0;
    const orig = sim.command.bind(sim);
    sim.command = (c) => { if (c.player === 1) n++; orig(c); };
    sim.run(300);
    expect(n).toBe(0);
  });
});
