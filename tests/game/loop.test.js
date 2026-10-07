// Game loop (src/game/loop.js): ticks with a time budget without a death spiral, fault guard.

import { describe, it, expect } from 'vitest';
import { runSteps, frameTimes, FaultGuard, TICK_MS, MAX_STEPS, MAX_FRAME_DT, MAX_FRAME_MS } from '../../src/game/loop.js';
import { wrapAngle } from '../../src/render/angle.js';

/** Clock that advances by `cost` ms on every tick */
function fakeClock(cost) {
  let t = 0;
  return { now: () => t, step: () => { t += cost; } };
}

describe('runSteps', () => {
  it('runs the due ticks and keeps the remainder below one tick', () => {
    const c = fakeClock(1);
    let n = 0;
    const r = runSteps(3 * TICK_MS + 40, () => { n++; c.step(); }, { now: c.now });
    expect(n).toBe(3);
    expect(r).toEqual({ acc: 40, steps: 3, dropped: 0 });
  });

  it('at most MAX_STEPS ticks per frame; the backlog is discarded instead of carried along', () => {
    const c = fakeClock(1);
    const r = runSteps(20 * TICK_MS + 10, c.step, { now: c.now });
    expect(r.steps).toBe(MAX_STEPS);
    expect(r.dropped).toBe(20 - MAX_STEPS);
    expect(r.acc).toBe(10);
  });

  it('slow simulation: no further tick after the time budget is used up (at least one)', () => {
    const c = fakeClock(30);
    const r = runSteps(5 * TICK_MS, c.step, { now: c.now, budget: 45 });
    expect(r.steps).toBe(2);
    expect(r.dropped).toBe(3);
    const slow = fakeClock(500);
    expect(runSteps(2 * TICK_MS, slow.step, { now: slow.now }).steps).toBe(1);
  });

  it('no death spiral: even permanently too slow ticks do not let the backlog grow', () => {
    const c = fakeClock(150); // one tick takes longer than 100 ms of game time
    let acc = 0;
    for (let frame = 0; frame < 50; frame++) {
      acc += 300; // triple speed, one frame per 100 ms
      const r = runSteps(acc, c.step, { now: c.now });
      expect(r.steps).toBe(1);
      acc = r.acc;
      expect(acc).toBeLessThan(TICK_MS);
    }
  });
});

describe('frameTimes', () => {
  it('clamps animation time short, game time only after MAX_STEPS ticks; never negative', () => {
    expect(frameTimes(1016, 1000)).toEqual({ dt: 0.016, simMs: 16 });
    expect(frameTimes(1600, 1000)).toEqual({ dt: MAX_FRAME_DT, simMs: 600 });
    expect(frameTimes(60_000, 1000)).toEqual({ dt: MAX_FRAME_DT, simMs: MAX_FRAME_MS });
    expect(frameTimes(900, 1000)).toEqual({ dt: 0, simMs: 0 });
  });

  it('regression: slow frames (2 fps, cheap ticks) keep the game in real time instead of one tick per frame', () => {
    // Adventure on desktop under software WebGL: ~600 ms per frame. 60 s must be ~600 ticks, not 100.
    const c = fakeClock(1);
    let acc = 0, ticks = 0, now = 0, last = 0;
    for (let f = 0; f < 100; f++) {
      now += 600;
      acc += frameTimes(now, last).simMs;
      last = now;
      const r = runSteps(acc, () => { ticks++; c.step(); }, { now: c.now });
      acc = r.acc;
      expect(r.dropped).toBe(0);
    }
    expect(ticks).toBe(600);
  });
});

describe('FaultGuard', () => {
  it('counts consecutive errors per area and only gives up at the limit', () => {
    const logs = [];
    const g = new FaultGuard({ limits: { sim: 3 }, log: (area, err, n) => logs.push([area, n]) });
    expect(g.fail('sim', new Error('a'))).toBe(false);
    g.ok('sim');
    expect(g.fail('sim', new Error('b'))).toBe(false);
    expect(g.fail('sim', new Error('c'))).toBe(false);
    expect(g.fatal).toBe(null);
    expect(g.fail('sim', new Error('d'))).toBe(true);
    expect(g.fatal).toMatchObject({ area: 'sim', message: 'd' });
    expect(logs).toEqual([['sim', 1], ['sim', 2], ['sim', 3]]); // throttled: only the first three
    expect(g.total.sim).toBe(4);
  });

  it('areas without a limit never count as broken; run catches and reports', () => {
    const g = new FaultGuard({ limits: { render: 2 }, log: () => {} });
    for (let i = 0; i < 500; i++) expect(g.fail('ai', new Error('x'))).toBe(false);
    const fatal = [];
    expect(g.run('render', () => { throw new Error('frame'); }, (f) => fatal.push(f))).toBe(false);
    expect(g.run('render', () => {})).toBe(true);
    expect(g.run('render', () => { throw new Error('frame'); }, (f) => fatal.push(f))).toBe(false);
    expect(g.run('render', () => { throw new Error('frame'); }, (f) => fatal.push(f))).toBe(false);
    expect(fatal).toEqual([false, false, true]);
  });
});

describe('wrapAngle', () => {
  it('wraps angles into (−π, π] without a loop and does not hang on broken values', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(wrapAngle(7)).toBeCloseTo(7 - 2 * Math.PI);
    expect(wrapAngle(-7)).toBeCloseTo(-7 + 2 * Math.PI);
    expect(wrapAngle(Infinity)).toBe(0);
    expect(wrapAngle(NaN)).toBe(0);
    const big = wrapAngle(1e20);
    expect(Math.abs(big)).toBeLessThanOrEqual(Math.PI);
  });
});
