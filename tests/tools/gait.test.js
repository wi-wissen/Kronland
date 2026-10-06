// Horse gaits (scripts/asset-gen/gait.mjs): hoof paths, footfall order, IK, closed loops.
import { describe, it, expect } from 'vitest';
import { GAITS, LEGS, hoofPath, legPreference, solveChain, chainFK, bodyPose, gaitSpeed, solveLinear } from '../../scripts/asset-gen/gait.mjs';

const phases = (n) => Array.from({ length: n }, (_, i) => i / n);

describe('Hoof path', () => {
  for (const [name, g] of Object.entries(GAITS)) {
    it(`${name}: stance hoof slides back exactly at ground speed`, () => {
      for (const leg of LEGS) {
        const dp = 0.001;
        for (const p of phases(40)) {
          const a = hoofPath(g, leg, p), b = hoofPath(g, leg, p + dp);
          if (!a.stance || !b.stance) continue;
          expect(a.dy).toBe(0);
          // distance per cycle fraction = stride length → speed = stride / period
          expect(((a.dz - b.dz) / (dp * g.period))).toBeCloseTo(gaitSpeed(g), 3);
        }
      }
    });
    it(`${name}: path is closed (end of swing phase = start of stance phase)`, () => {
      for (const leg of LEGS) {
        const t = g.touch[leg];
        const before = hoofPath(g, leg, t - 1e-6), at = hoofPath(g, leg, t);
        expect(before.dz).toBeCloseTo(at.dz, 4);
        expect(before.dy).toBeCloseTo(0, 3);
        expect(at.stance).toBe(true);
      }
    });
  }
  it('walk: always at least two hooves on the ground (four-beat)', () => {
    for (const p of phases(96)) expect(LEGS.filter((l) => hoofPath(GAITS.walk, l, p).stance).length).toBeGreaterThanOrEqual(2);
    // four separate touchdown times
    expect(new Set(Object.values(GAITS.walk.touch)).size).toBe(4);
  });
  it('gallop: suspension phase (no hoof on the ground) and three-beat', () => {
    const air = phases(96).filter((p) => LEGS.every((l) => !hoofPath(GAITS.gallop, l, p).stance));
    expect(air.length).toBeGreaterThan(5);
    const t = GAITS.gallop.touch;
    expect(Math.abs(t.RH - t.LF)).toBeLessThan(0.06); // diagonal lands almost simultaneously
  });
  it('gallop is faster than walk', () => {
    expect(gaitSpeed(GAITS.gallop)).toBeGreaterThan(gaitSpeed(GAITS.walk) * 2.5);
  });
  it('swing phase lifts the hoof, stance phase does not', () => {
    const g = GAITS.walk;
    const mid = hoofPath(g, 'LF', g.touch.LF + g.duty + (1 - g.duty) / 2);
    expect(mid.stance).toBe(false);
    expect(mid.dy).toBeGreaterThan(g.lift * 0.8);
  });
});

describe('Joint flexion', () => {
  it('front carpus bends backwards, hock forwards', () => {
    const swing = { stance: false, s: 0.45 };
    expect(legPreference('front', swing, 1)[1]).toBeLessThan(-0.5);
    expect(legPreference('hind', swing, 1)[1]).toBeGreaterThan(0.5);
  });
  it('extended in the middle of the stance phase', () => {
    expect(legPreference('front', { stance: true, s: 0.5 }, 1)).toEqual([0, 0, -0, -0]);
  });
});

describe('IK in the side plane', () => {
  const segs = [[0, -0.3], [-0.05, -0.15], [0, -0.18], [0.02, -0.1]];
  it('hits a reachable target exactly', () => {
    const target = chainFK([0, 0], 0, segs, [0.3, 0.1, -0.4, -0.1])[4];
    const r = solveChain([0, 0], 0, segs, target, [0, 0, 0, 0], [0.002, 0.05, 0.08, 0.08]);
    expect(r.err).toBeLessThan(1e-3);
  });
  it('takes the rotation of the trunk into account', () => {
    const target = chainFK([0, 0], 0, segs, [0, 0, 0, 0])[4];
    const r = solveChain([0, 0], 0.1, segs, target, [0, 0, 0, 0], [0.002, 0.05, 0.08, 0.08]);
    expect(r.err).toBeLessThan(1e-3);
    expect(r.a[0]).toBeCloseTo(-0.1, 1); // shoulder compensates the trunk
  });
  it('solves linear equations', () => {
    expect(solveLinear([[2, 1], [1, 3]], [3, 5]).map((x) => +x.toFixed(6))).toEqual([0.8, 1.4]);
  });
});

describe('Body motion', () => {
  for (const clip of ['idle', 'walk', 'gallop']) {
    it(`${clip}: loop does not jump`, () => {
      const a = bodyPose(clip, 0), b = bodyPose(clip, 1 - 1e-9);
      for (const k of ['dy', 'pitch', 'spine', 'head', 'yaw']) expect(b[k]).toBeCloseTo(a[k], 5);
      a.tailSide.forEach((v, i) => expect(b.tailSide[i]).toBeCloseTo(v, 5));
      a.neck.forEach((v, i) => expect(b.neck[i]).toBeCloseTo(v, 5));
    });
  }
  it('gallop: trunk sways clearly, head nods', () => {
    const ps = phases(24).map((p) => bodyPose('gallop', p));
    const range = (f) => Math.max(...ps.map(f)) - Math.min(...ps.map(f));
    expect(range((x) => x.pitch)).toBeGreaterThan(0.1);
    expect(range((x) => x.neck[0])).toBeGreaterThan(0.15);
  });
});
