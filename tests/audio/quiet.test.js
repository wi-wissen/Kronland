// Quiet sound: hammer strikes in time with the animation without volleys, rare birds, wind only with a reason.
import { describe, it, expect } from 'vitest';
import { strikeIn, StrikeGate, STRIKE_GAP, STRIKE_PERIOD, STRIKE_PHASE } from '../../src/audio/workbeat.js';
import { GameAudio } from '../../src/audio/GameAudio.js';
import { ambientTargets, windTarget, birdsAllowed, birdDelay, pickBirdKind, birdGain, BIRDS } from '../../src/audio/ambient.js';
import { mulberry32 } from '../../src/audio/rng.js';

const FPS = 60;

/**
 * Plays 60 s with n building serfs around a camera point: sim tick every 100 ms (onTick),
 * figure tick like CharacterSystem (phase offset per id, clip build → hammer, 1.87 s). Returns the
 * start times of the hammer strikes played.
 */
function simulateHammer(n, { seconds = 60, ids = null, period = 1.87, anim = 'hammer' } = {}) {
  const entities = new Map();
  entities.set(1, { kind: 'building', id: 1, x: 48, y: 48, w: 3, h: 3, done: false });
  const unitIds = ids ?? Array.from({ length: n }, (_, i) => 100 + i);
  unitIds.forEach((id, i) => entities.set(id, { kind: 'unit', id, px: (49 + (i % 3)) * 1000, py: (47 + Math.floor(i / 3)) * 1000, path: [], job: { kind: 'build', target: 1 } }));
  const sim = { tick: 0, entities, map: null };
  let time = 0;
  const phase = (id) => (((id * 2654435761) >>> 0) / 4294967296) * 3;
  const chars = { beat: (id) => (entities.get(id)?.kind === 'unit' ? { clip: 'build', t: time + phase(id), period, anim } : null) };
  const engine = { sim, player: 0, paused: false, renderer: { chars } };
  const ga = new GameAudio(/** @type {any} */ (engine));
  const played = [];
  const ctx = { state: 'running', currentTime: 0 };
  ga.audio = /** @type {any} */ ({
    ctx, listener: { x: 50, z: 50, dist: 20, yaw: 0 }, rnd: mulberry32(7),
    play: (name, o) => { played.push({ name, at: ctx.currentTime + (o.delay ?? 0), gain: o.gain }); return true; },
  });
  ga.gate = new StrikeGate(mulberry32(11));
  for (let f = 0; f < seconds * FPS; f++) {
    time = f / FPS; ctx.currentTime = time;
    if (f % 6 === 0) { sim.tick++; ga.onTick(); }
    ga.workFrame();
  }
  return played.filter((p) => p.name === 'hammer').map((p) => p.at).sort((a, b) => a - b);
}

const gaps = (ts) => ts.slice(1).map((t, i) => t - ts[i]);

describe('Hammer strikes in time with the animation', () => {
  it('strikeIn: exactly one impact per cycle at the clip position', () => {
    expect(strikeIn(0, 1.6, 1.87, 0.87)).toBe(false);
    expect(strikeIn(1.6, 1.65, 1.87, 0.87)).toBe(true);
    expect(strikeIn(1.65, 3.4, 1.87, 0.87)).toBe(false);
    expect(strikeIn(3.4, 3.5, 1.87, 0.87)).toBe(true);  // 1.87 + 1.627
    expect(strikeIn(0, 10, 1.87, 0.87)).toBe(true);     // hitch: one strike
    expect(strikeIn(1, 1, 1.87, 0.87)).toBe(false);
    let n = 0;
    for (let f = 0; f < 60 * FPS; f++) if (strikeIn(f / FPS, (f + 1) / FPS, STRIKE_PERIOD.chop, STRIKE_PHASE.chop)) n++;
    expect(n).toBe(Math.floor(60 / STRIKE_PERIOD.chop + (1 - STRIKE_PHASE.chop)));
  });

  it('one serf: one strike per hammer cycle (≈ 32/min instead of 86/min before)', () => {
    const ts = simulateHammer(1);
    expect(ts.length).toBeGreaterThanOrEqual(30);
    expect(ts.length).toBeLessThanOrEqual(33);
    for (const g of gaps(ts)) { expect(g).toBeGreaterThan(1.87 - 0.1); expect(g).toBeLessThan(1.87 + 0.1); }
  });

  it('several serfs at a construction site: no volley, at most one strike per 0.42 s', () => {
    for (const n of [3, 6, 12]) {
      const ts = simulateHammer(n);
      expect(Math.min(...gaps(ts)), `n=${n}`).toBeGreaterThanOrEqual(STRIKE_GAP.hammer - 1e-9);
      expect(ts.length, `n=${n}`).toBeLessThanOrEqual(Math.ceil(60 / STRIKE_GAP.hammer));
      // never three strikes within one second
      for (let i = 2; i < ts.length; i++) expect(ts[i] - ts[i - 2], `n=${n}`).toBeGreaterThanOrEqual(0.84 - 1e-9);
    }
    // consecutive ids (previously offset by 3 ticks each: strikes 0.1–0.3 s apart)
    const ts = simulateHammer(3, { ids: [200, 201, 202] });
    expect(Math.min(...gaps(ts))).toBeGreaterThanOrEqual(STRIKE_GAP.hammer - 1e-9);
  });

  it('gate: near (louder) strikes may follow after half the gap, quiet ones may not; random delay and variation', () => {
    const g = new StrikeGate(() => 0.5);
    const a = g.admit('hammer', 0, 0.2);
    expect(a).not.toBeNull();
    expect(a.delay).toBeGreaterThan(0);
    expect(a.delay).toBeLessThanOrEqual(0.06);
    expect(g.admit('hammer', 0.1, 0.2)).toBeNull();
    expect(g.admit('hammer', 0.3, 0.2)).toBeNull();
    expect(g.admit('hammer', 0.3, 1)).not.toBeNull(); // much closer
    // other kind: not simultaneous, but slightly offset
    const c = g.admit('chop', 0.3, 1);
    expect(c.delay).toBeGreaterThanOrEqual(0.12 - 1e-9);
    const vary = new StrikeGate(mulberry32(3));
    const gains = [];
    for (let i = 0; i < 20; i++) gains.push(vary.admit('hammer', i, 1).gain);
    expect(Math.max(...gains) - Math.min(...gains)).toBeGreaterThan(0.1);
  });

  it('paused: no strikes', () => {
    const entities = new Map([[1, { kind: 'building', id: 1, x: 48, y: 48, w: 3, h: 3 }], [5, { kind: 'unit', id: 5, px: 50000, py: 50000, path: [], job: { target: 1 } }]]);
    const engine = { sim: { tick: 0, entities }, player: 0, paused: true, renderer: { chars: { beat: () => ({ clip: 'build', t: 0, period: 1.87, anim: 'hammer' }) } } };
    const ga = new GameAudio(/** @type {any} */ (engine));
    let n = 0;
    const ctx = { state: 'running', currentTime: 0 };
    ga.audio = /** @type {any} */ ({ ctx, listener: { x: 50, z: 50, dist: 20, yaw: 0 }, play: () => { n++; return true; } });
    ga.onTick();
    for (let f = 0; f < 600; f++) { ctx.currentTime = f / 60; ga.workFrame(); }
    expect(n).toBe(0);
  });
});

describe('Birds rare and isolated', () => {
  it('only in summer, near forest and not zoomed far out', () => {
    expect(birdsAllowed('summer', 0.5, 28)).toBe(true);
    expect(birdsAllowed('summer', 0, 28)).toBe(false);
    expect(birdsAllowed('summer', 0.05, 28)).toBe(false);
    expect(birdsAllowed('rain', 1, 28)).toBe(false);
    expect(birdsAllowed('winter', 1, 28)).toBe(false);
    expect(birdsAllowed('summer', 1, 60)).toBe(false);
  });

  it('at most ~2 calls per minute in dense forest, rarer with little forest (previously ≈ 13/min)', () => {
    const r = mulberry32(5);
    const perMinute = (forest) => {
      let t = 0, n = 0;
      while (t < 3600) { t += birdDelay(r, forest); n++; }
      return n / 60;
    };
    const dense = perMinute(1), sparse = perMinute(0.2);
    expect(dense).toBeLessThan(2);
    expect(dense).toBeGreaterThan(0.8);
    expect(sparse).toBeLessThan(dense * 0.7);
    for (let i = 0; i < 200; i++) expect(birdDelay(r, 1)).toBeGreaterThanOrEqual(BIRDS.gapMin);
    expect(birdDelay(() => 0, 1, true)).toBeGreaterThan(birdDelay(() => 0, 1, false));
  });

  it('never the same call kind twice in a row', () => {
    const r = mulberry32(9);
    let last = -1;
    const seen = new Set();
    for (let i = 0; i < 500; i++) { const k = pickBirdKind(r, last); expect(k).not.toBe(last); expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThan(BIRDS.kinds); seen.add(k); last = k; }
    expect(seen.size).toBe(BIRDS.kinds);
  });

  it('quieter than before (0.05 · 0.75)', () => {
    expect(birdGain(1, 10)).toBeLessThan(0.05 * 0.75 * 0.7);
    expect(birdGain(1, 44)).toBeLessThan(birdGain(1, 10));
  });
});

describe('Wind only with a reason', () => {
  it('silent in normal play, quiet when zoomed far out or in the mountains', () => {
    expect(windTarget('summer', 28, 0)).toBe(0);
    expect(windTarget('rain', 40, 0.05)).toBe(0);
    expect(windTarget('summer', 75, 0)).toBeGreaterThan(0);
    expect(windTarget('summer', 75, 0)).toBeLessThanOrEqual(0.3);
    expect(windTarget('summer', 62, 0)).toBeLessThan(windTarget('summer', 75, 0));
    expect(windTarget('summer', 28, 0.6)).toBeGreaterThan(0);
    expect(windTarget('winter', 75, 1)).toBe(0); // the winter layer is itself the wind
  });

  it('summer without forest: no constant bed any more (previously 0.75 wind), winter quieter', () => {
    const t = ambientTargets('summer', 0, 0, 1, { forest: 0, dist: 28, cliff: 0 });
    expect(t.summer).toBe(0);
    expect(t.wind).toBe(0);
    expect(ambientTargets('summer', 0, 0, 1, { forest: 1 }).summer).toBeGreaterThan(0);
    expect(ambientTargets('winter').winter).toBeLessThanOrEqual(0.5);
  });
});
