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

  it('rejects foreign formats', () => {
    expect(() => loadGame({ version: 99 })).toThrow();
  });
});
