import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/sim/mapgen.js';
import { WATER } from '../../src/sim/map.js';

describe('Map generator', () => {
  it('is deterministic', () => {
    const a = generateMap(7), b = generateMap(7);
    expect(Array.from(a.map.heights)).toEqual(Array.from(b.map.heights));
    expect(a.features).toEqual(b.features);
  });

  it('produces different maps per seed', () => {
    const a = generateMap(1), b = generateMap(2);
    expect(Array.from(a.map.heights)).not.toEqual(Array.from(b.map.heights));
  });

  for (const seed of [1, 2, 3, 42, 99]) {
    it(`Seed ${seed}: every player has start region, shafts, piles and settlement spots`, () => {
      const g = generateMap(seed);
      expect(g.starts.length).toBe(2);
      for (let p = 0; p < 2; p++) {
        const s = g.starts[p];
        for (let y = s.y - 6; y <= s.y + 6; y++) for (let x = s.x - 6; x <= s.x + 6; x++) {
          expect(g.map.flags[g.map.idx(x, y)] & WATER).toBe(0);
        }
        const own = g.features.filter((f) => f.player === p);
        expect(own.filter((f) => f.kind === 'shaft').length).toBeGreaterThanOrEqual(5);
        expect(own.filter((f) => f.kind === 'pile').length).toBeGreaterThanOrEqual(5);
        expect(own.filter((f) => f.kind === 'spot').length).toBeGreaterThanOrEqual(2);
      }
      let water = 0;
      for (const f of g.map.flags) if (f & WATER) water++;
      const pct = (water / g.map.flags.length) * 100;
      expect(pct).toBeGreaterThan(4);
      expect(pct).toBeLessThan(16);
    });
  }
});
