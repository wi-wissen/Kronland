import { describe, it, expect } from 'vitest';
import { Sim } from '../../src/sim/sim.js';
import { serfsOf, hqOf, nearestNode } from './helpers.js';

/** A fixed scenario: buy serfs, build, mine wood and clay. */
function scenario(seed) {
  const sim = new Sim({ seed });
  const hashes = [];
  for (const p of [0, 1]) sim.command({ type: 'buySerf', player: p, count: 4 });
  sim.step();
  for (const p of [0, 1]) {
    const hq = hqOf(sim, p);
    const serfs = serfsOf(sim, p).map((u) => u.id);
    const pos = sim.findPlacement(p, 'residence', hq.x + 2, hq.y + 2);
    sim.command({ type: 'placeBuilding', player: p, building: 'residence', x: pos.x, y: pos.y, units: serfs.slice(0, 4) });
    sim.command({ type: 'assignWork', player: p, units: serfs.slice(4, 6), target: nearestNode(sim, 'tree', 'wood', hq.x, hq.y).id });
    sim.command({ type: 'assignWork', player: p, units: serfs.slice(6), target: nearestNode(sim, 'pile', 'clay', hq.x, hq.y).id });
  }
  for (let i = 0; i < 3000; i++) {
    sim.step();
    if (i % 500 === 0) hashes.push(sim.hash());
  }
  hashes.push(sim.hash());
  return { sim, hashes };
}

describe('Determinism', () => {
  it('same seed and same commands yield exactly the same course', () => {
    const a = scenario(42), b = scenario(42);
    expect(a.hashes).toEqual(b.hashes);
  });

  it('different seed yields a different course', () => {
    expect(scenario(1).hashes.at(-1)).not.toBe(scenario(2).hashes.at(-1));
  });

  it('the scenario actually produces progress', () => {
    const { sim } = scenario(42);
    const p = sim.players[0];
    expect(p.raw.wood).toBeGreaterThan(0);
    expect(p.raw.clay).toBeGreaterThan(0);
    expect([...sim.entities.values()].some((e) => e.kind === 'building' && e.type === 'residence' && e.done)).toBe(true);
  });
});

describe('Determinism in combat', () => {
  const fight = () => {
    const sim = new Sim({ seed: 7 });
    const hq = sim.findBuilding(0, 'headquarters');
    const a = sim.spawnLeader(0, 'sword1', hq.x + 8, hq.y + 8);
    const b = sim.spawnLeader(1, 'bow1', hq.x + 14, hq.y + 8);
    const c = sim.spawnLeader(1, 'spear1', hq.x + 14, hq.y + 10);
    sim.command({ type: 'order', player: 0, units: [a.id], order: 'attackMove', x: hq.x + 16, y: hq.y + 9 });
    sim.command({ type: 'order', player: 1, units: [b.id, c.id], order: 'attackMove', x: hq.x + 6, y: hq.y + 8 });
    sim.run(1500);
    return sim.hash();
  };
  it('same battle, same result', () => {
    expect(fight()).toBe(fight());
  });
});
