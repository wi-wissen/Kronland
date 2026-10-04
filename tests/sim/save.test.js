import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';
import { saveGame, loadGame } from '../../src/sim/serialize.js';

describe('Saving and loading', () => {
  it('a loaded game continues exactly the same', () => {
    const sim = new Sim({ seed: 11 });
    const ais = [0, 1].map((p) => new AiPlayer(sim, p, 'normal'));
    const tick = (s, a) => { for (const ai of a) ai.update(); s.step(); };
    for (let i = 0; i < 4000; i++) tick(sim, ais);

    const json = JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) }));
    const data = JSON.parse(json);
    const sim2 = loadGame(data);
    const ais2 = data.extra.ais.map((st) => AiPlayer.fromState(sim2, st));
    expect(sim2.hash()).toBe(sim.hash());

    for (let i = 0; i < 3000; i++) { tick(sim, ais); tick(sim2, ais2); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.tick).toBe(7000);
  });

  it('new systems (building research, market, weather energy, fire, ruins, experience) continue exactly after loading', () => {
    const sim = new Sim({ seed: 1 });
    const ais = [new AiPlayer(sim, 0, 'hard'), new AiPlayer(sim, 1, 'normal')];
    const tick = (s, a) => { for (const ai of a) ai.update(); s.step(); };
    for (let i = 0; i < 15000; i++) tick(sim, ais);
    // enrich state: fire, ruin, experience
    const bs = [...sim.entities.values()].filter((e) => e.kind === 'building' && e.done && e.type !== 'headquarters');
    const b = bs.find((e) => e.owner === 1 && e.type === 'residence') ?? bs.find((e) => e.owner === 1) ?? bs[0];
    b.hp = 10;
    const L = [...sim.entities.values()].find((e) => e.kind === 'leader');
    if (L) L.xp = 90;
    sim.players[0].weatherEnergy = 500;
    for (let i = 0; i < 200; i++) tick(sim, ais);
    expect([...sim.entities.values()].some((e) => e.kind === 'ruin' || e.burning)).toBe(true);
    const json = JSON.stringify(saveGame(sim, { ais: ais.map((a) => a.getState()) }));
    const data = JSON.parse(json);
    const sim2 = loadGame(data);
    const ais2 = data.extra.ais.map((st) => AiPlayer.fromState(sim2, st));
    expect(sim2.hash()).toBe(sim.hash());
    for (let i = 0; i < 4000; i++) { tick(sim, ais); tick(sim2, ais2); }
    expect(sim2.hash()).toBe(sim.hash());
    expect(sim2.market.prices).toEqual(sim.market.prices);
  });

  it('rejects foreign formats', () => {
    expect(() => loadGame({ version: 99 })).toThrow();
  });
});
