// Rendering-only sidestep of figures close to each other (separation.js).

import { describe, it, expect } from 'vitest';
import { updateSeparation, SEP_MAX } from '../../src/render/separation.js';

const settle = (pts, off = new Map()) => { for (let i = 0; i < 60; i++) updateSeparation(pts, off, 1 / 30); return off; };

describe('updateSeparation', () => {
  it('pushes two standing figures on one spot apart', () => {
    const off = settle([{ id: 1, x: 5, z: 5, vx: 0, vz: 0, w: 1 }, { id: 2, x: 5.05, z: 5, vx: 0, vz: 0, w: 1 }]);
    const a = off.get(1), b = off.get(2);
    expect(b.dx - a.dx).toBeGreaterThan(0.2);
    expect(Math.hypot(a.dx, a.dz)).toBeLessThanOrEqual(SEP_MAX + 1e-6);
  });

  it('head-on walkers step to opposite sides (keep right)', () => {
    const off = settle([{ id: 1, x: 5, z: 5, vx: 1, vz: 0, w: 1 }, { id: 2, x: 5.2, z: 5, vx: -1, vz: 0, w: 1 }]);
    const a = off.get(1), b = off.get(2);
    expect(Math.abs(a.dz)).toBeGreaterThan(0.05);
    expect(Math.sign(a.dz)).toBe(-Math.sign(b.dz));
    // mostly sideways, hardly along the path
    expect(Math.abs(a.dz)).toBeGreaterThan(Math.abs(a.dx));
  });

  it('a fixed figure (w = 0) stays exact, the other takes the whole sidestep', () => {
    const off = settle([{ id: 1, x: 5, z: 5, vx: 0, vz: 0, w: 0 }, { id: 2, x: 5.1, z: 5, vx: 0, vz: 0, w: 1 }]);
    expect(off.get(1)?.dx ?? 0).toBe(0);
    expect(off.get(2).dx).toBeGreaterThan(0.15);
  });

  it('leaves distant figures alone and fades out removed ones', () => {
    const off = settle([{ id: 1, x: 5, z: 5, vx: 0, vz: 0, w: 1 }, { id: 2, x: 6, z: 5, vx: 0, vz: 0, w: 1 }]);
    expect(off.size).toBe(0);
    const o2 = settle([{ id: 1, x: 5, z: 5, vx: 0, vz: 0, w: 1 }, { id: 2, x: 5, z: 5, vx: 0, vz: 0, w: 1 }]);
    expect(o2.size).toBe(2);
    settle([], o2);
    expect(o2.size).toBe(0);
  });
});
