import { describe, it, expect } from 'vitest';
import { Rng } from '../../src/sim/rng.js';
import { isqrt, dist } from '../../src/sim/fixed.js';
import { TileMap, WATER } from '../../src/sim/map.js';
import { findPath } from '../../src/sim/pathfinding.js';

describe('Random generator', () => {
  it('yields the same sequence for the same seed', () => {
    const a = new Rng(123), b = new Rng(123);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('yields a different sequence for a different seed', () => {
    const a = new Rng(1), b = new Rng(2);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });
  it('stays in range and can be saved', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.range(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
    const state = r.getState();
    const x = r.next();
    r.setState(state);
    expect(r.next()).toBe(x);
  });
});

describe('Integer maths', () => {
  it('isqrt rounds down correctly', () => {
    for (const n of [0, 1, 2, 3, 4, 15, 16, 17, 99, 100, 1e6, 2 ** 40 + 7]) {
      const r = isqrt(n);
      expect(r * r).toBeLessThanOrEqual(n);
      expect((r + 1) * (r + 1)).toBeGreaterThan(n);
    }
  });
  it('dist is an integer', () => {
    expect(dist(0, 0, 3000, 4000)).toBe(5000);
  });
});

describe('Pathfinding', () => {
  const mapWithWall = () => {
    const m = new TileMap(10, 10);
    for (let y = 0; y < 9; y++) m.flags[m.idx(5, y)] |= WATER; // wall with a gap at the bottom
    return m;
  };

  it('finds a path around an obstacle', () => {
    const m = mapWithWall();
    const p = findPath(m, 1, 1, [m.idx(8, 1)]);
    expect(p).not.toBeNull();
    expect(p[p.length - 1]).toBe(m.idx(8, 1));
    for (const t of p) expect(m.walkable(t % 10, (t / 10) | 0)).toBe(true);
    expect(p.some((t) => ((t / 10) | 0) === 9)).toBe(true); // must go through the gap
  });

  it('returns null when the goal is enclosed', () => {
    const m = mapWithWall();
    m.flags[m.idx(5, 9)] |= WATER;
    expect(findPath(m, 1, 1, [m.idx(8, 1)])).toBeNull();
  });

  it('does not cut corners', () => {
    const m = new TileMap(5, 5);
    m.flags[m.idx(2, 1)] |= WATER;
    m.flags[m.idx(1, 2)] |= WATER;
    const p = findPath(m, 1, 1, [m.idx(2, 2)]);
    expect(p === null || p.length > 1).toBe(true);
  });

  it('returns an empty path when already at the goal', () => {
    const m = new TileMap(5, 5);
    expect(findPath(m, 2, 2, [m.idx(2, 2)])).toEqual([]);
  });
});
