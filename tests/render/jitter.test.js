// Rendering offset (src/render/jitter.js): fixed per figure, bounded, only where the exact position does not matter.
import { describe, it, expect } from 'vitest';
import { jitterOffset, jitterTarget, JITTER_TILES } from '../../src/render/jitter.js';

describe('jitterOffset', () => {
  it('is bounded, deterministic and never zero', () => {
    for (let id = 1; id < 5000; id++) {
      const o = jitterOffset(id), r = Math.hypot(o.dx, o.dz);
      expect(r).toBeLessThanOrEqual(JITTER_TILES + 1e-9);
      expect(r).toBeGreaterThanOrEqual(JITTER_TILES * 0.35 - 1e-9);
      expect(jitterOffset(id)).toEqual(o);
    }
  });

  it('spreads neighbouring IDs in all directions (figures at the same point stand apart)', () => {
    const quad = [0, 0, 0, 0];
    let close = 0;
    for (let id = 100; id < 400; id++) {
      const o = jitterOffset(id);
      quad[(o.dx >= 0 ? 0 : 1) + (o.dz >= 0 ? 0 : 2)]++;
      const p = jitterOffset(id + 1);
      if (Math.hypot(o.dx - p.dx, o.dz - p.dz) < 0.02) close++;
    }
    for (const q of quad) expect(q).toBeGreaterThan(50);
    expect(close).toBeLessThan(15);
  });
});

describe('jitterTarget', () => {
  it('squads always offset, heroes, NPCs and small stuff never', () => {
    expect(jitterTarget({ kind: 'soldier' }, false)).toBe(1);
    expect(jitterTarget({ kind: 'leader' }, true)).toBe(1);
    for (const kind of ['hero', 'npc', 'trap', 'turret']) expect(jitterTarget({ kind }, true)).toBe(0);
  });

  it('serfs not while working, but on the way and as militia', () => {
    expect(jitterTarget({ kind: 'unit', job: { kind: 'build' }, path: [] }, false)).toBe(0);
    expect(jitterTarget({ kind: 'unit', job: { kind: 'build' }, path: [5] }, true)).toBe(1);
    expect(jitterTarget({ kind: 'unit', job: null, path: [] }, false)).toBe(1);
    expect(jitterTarget({ kind: 'unit', militia: true, job: null, path: [] }, false)).toBe(1);
  });

  it('workers only on the way or waiting outside', () => {
    expect(jitterTarget({ kind: 'worker', state: 'walk' }, true)).toBe(1);
    expect(jitterTarget({ kind: 'worker', state: 'waiting' }, false)).toBe(1);
    // on its own ring slot in front of the building: exact point, no offset
    expect(jitterTarget({ kind: 'worker', state: 'waiting', slot: 3 }, false)).toBe(0);
    expect(jitterTarget({ kind: 'worker', state: 'waiting', slot: -1 }, false)).toBe(1);
    for (const state of ['working', 'eating', 'sleeping', 'camping']) expect(jitterTarget({ kind: 'worker', state }, false)).toBe(0);
    expect(jitterTarget({ kind: 'worker', state: 'walk', inside: true }, false)).toBe(0);
  });
});
