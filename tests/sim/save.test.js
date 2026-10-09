import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

describe('Saving and loading', () => {
  it('a loaded game continues exactly the same', () => {
    const sim = new Sim({ seed: 11, ai: ['normal', 'normal'] });
    sim.run(4000);

    const json = JSON.stringify(saveGame(sim));
    const sim2 = loadGame(JSON.parse(json));
    expect(sim2.hash()).toBe(sim.hash());

    for (let i = 0; i < 3000; i++) { sim.step(); sim2.step(); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.tick).toBe(7000);
  });

  it('new systems (building research, market, weather energy, fire, ruins, experience) continue exactly after loading', () => {
    const sim = new Sim({ seed: 1, ai: ['hard', 'normal'] });
    sim.run(15000);
    // enrich state: fire, ruin, experience
    const bs = [...sim.entities.values()].filter((e) => e.kind === 'building' && e.done && e.type !== 'headquarters');
    const b = bs.find((e) => e.owner === 1 && e.type === 'residence') ?? bs.find((e) => e.owner === 1) ?? bs[0];
    b.hp = 3; // burns down before repairers arrive (serfs build and repair fast)
    const L = [...sim.entities.values()].find((e) => e.kind === 'leader');
    if (L) L.xp = 90;
    sim.players[0].weatherEnergy = 500;
    sim.run(200);
    expect([...sim.entities.values()].some((e) => e.kind === 'ruin' || e.burning)).toBe(true);
    const sim2 = loadGame(JSON.parse(JSON.stringify(saveGame(sim))));
    expect(sim2.hash()).toBe(sim.hash());
    for (let i = 0; i < 4000; i++) { sim.step(); sim2.step(); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.market.prices).toEqual(sim.market.prices);
  }, 180_000); // long run, slow on loaded machines

  it('rejects foreign formats', () => {
    expect(() => loadGame({ version: 99 })).toThrow();
  });
});
