import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { AiPlayer } from '../../src/ai/AiPlayer.js';

function match(seed, diffs, ticks, stopOnWin = true) {
  const sim = new Sim({ seed });
  const ais = diffs.map((d, i) => d && new AiPlayer(sim, i, d));
  const rejects = [];
  for (let t = 0; t < ticks; t++) {
    for (const ai of ais) ai?.update();
    for (const e of sim.step()) if (e.type === 'rejected') rejects.push(e);
    if (stopOnWin && sim.winner !== null) break;
  }
  return { sim, ais, rejects };
}

const count = (sim, p, kind, type) => [...sim.entities.values()].filter((e) => e.owner === p && e.kind === kind && (!type || e.type === type)).length;

describe('AI opponent', () => {
  it('builds up an economy in 10 minutes', () => {
    const { sim } = match(2, ['normal', null], 6000);
    expect(count(sim, 0, 'building')).toBeGreaterThanOrEqual(10);
    expect(count(sim, 0, 'worker')).toBeGreaterThanOrEqual(10);
    expect(sim.players[0].techs.size).toBeGreaterThanOrEqual(1);
    expect(count(sim, 0, 'unit')).toBeGreaterThan(10);
  });

  it('builds an army by minute 30 and attacks', () => {
    const { sim, ais } = match(2, ['normal', null], 18000, false);
    expect(count(sim, 0, 'leader')).toBeGreaterThanOrEqual(2);
    expect(['attack', 'gather']).toContain(ais[0].armyState);
  });

  it('the hard AI defeats the easy one', () => {
    const { sim } = match(1, ['hard', 'easy'], 36000);
    expect(sim.winner).toBe(0);
  });

  it('defends its own castle against attackers', () => {
    const sim = new Sim({ seed: 2 });
    const ai = new AiPlayer(sim, 0, 'normal');
    const hq = sim.findBuilding(0, 'headquarters');
    const L = sim.spawnLeader(1, 'sword1', hq.x + 7, hq.y + 2);
    L.order = { type: 'hold' };
    for (let t = 0; t < 60; t++) { ai.update(); sim.step(); }
    expect([...sim.entities.values()].some((e) => e.owner === 0 && e.kind === 'unit' && e.militia)).toBe(true);
    expect(ai.armyState).toBe('defend');
  });

  it('is deterministic', () => {
    const a = match(5, ['normal', 'normal'], 4000, false).sim.hash();
    const b = match(5, ['normal', 'normal'], 4000, false).sim.hash();
    expect(a).toBe(b);
  });

  it('only gives valid commands for itself', () => {
    const { rejects } = match(3, ['normal', 'normal'], 12000, false);
    const foreign = rejects.filter((r) => /eigene|ausgewählt|Unbekannt/.test(r.reason));
    expect(foreign).toEqual([]);
    expect(rejects.length).toBeLessThan(40);
  });
});
