// Tile grid (learning adventure, world editor): lines follow the ground, every fifth is bold.

import { describe, it, expect } from 'vitest';
import { gridLines, overviewDist } from '../../src/render/grid.js';

describe('Tile grid', () => {
  it('one line per tile edge, two segments per tile, height from the ground', () => {
    const { minor, major } = gridLines(10, 4, (x, z) => x + z * 100);
    // 11 vertical lines × 4 tiles × 2 segments + 5 horizontal × 10 × 2, 6 numbers per segment
    expect((minor.length + major.length) / 6).toBe(11 * 4 * 2 + 5 * 10 * 2);
    // Bold: x = 0, 5, 10 (vertical) and z = 0 (horizontal)
    expect(major.length / 6).toBe(3 * 4 * 2 + 1 * 10 * 2);
    // First point is at (0, 0) with ground height 0, one point at x = 5 with height 5
    expect([...major.slice(0, 3)]).toEqual([0, 0, 0]);
    expect(major.some((v, i) => i % 3 === 0 && v === 5 && major[i + 1] === 5 + major[i + 2] * 100)).toBe(true);
  });

  it('overview spacing grows with the map but stays within limits', () => {
    expect(overviewDist(10, 8)).toBe(16);
    expect(overviewDist(24, 13)).toBeGreaterThan(overviewDist(20, 10));
    expect(overviewDist(500, 500)).toBe(60);
  });
});
