import { describe, it, expect } from 'vitest';
import { fireSpots } from '../../src/render/Renderer.js';

describe('Fire spots', () => {
  it('sit fixed per building on roof and walls within the footprint', () => {
    const a = fireSpots(42, 3, 3, 2.5), b = fireSpots(42, 3, 3, 2.5);
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    expect(a[0].roof).toBe(true);
    for (const s of a) {
      expect(Math.abs(s.x)).toBeLessThanOrEqual(1.5);
      expect(Math.abs(s.z)).toBeLessThanOrEqual(1.5);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(2.5);
    }
    expect(fireSpots(43, 3, 3, 2.5)).not.toEqual(a);
  });
});
