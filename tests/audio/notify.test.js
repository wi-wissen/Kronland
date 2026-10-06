// Notice sounds from mass events (src/audio/notify.js): no constant "ding-ding" on the showcase.
import { describe, it, expect } from 'vitest';
import { NotifyGate, NOTIFY_REST } from '../../src/audio/notify.js';
import { GameAudio } from '../../src/audio/GameAudio.js';
import { createMissionSim } from '../../src/sim/missions/runtime.js';
import { SHOWCASE_ID } from '../../src/sim/missions/showcase.js';

describe('NotifyGate', () => {
  it('the first sound of a burst plays, then rest for NOTIFY_REST seconds', () => {
    const g = new NotifyGate();
    const r = NOTIFY_REST.workerArrived;
    let n = 0;
    for (let t = 0; t < 60; t += 0.5) if (g.run('workerArrived', t, () => true)) n++;
    expect(n).toBe(Math.ceil(60 / r));
    expect(g.admit('workerArrived', 60)).toBe(false);
    expect(g.admit('workerArrived', 60 + r)).toBe(true);
  });

  it('rest time only starts if the sound actually played; kinds without a rule are always free', () => {
    const g = new NotifyGate();
    expect(g.run('promoted', 0, () => false)).toBe(false);
    expect(g.run('promoted', 0.1, () => true)).toBe(true);
    expect(g.run('promoted', 0.2, () => true)).toBe(false);
    for (let i = 0; i < 5; i++) expect(g.run('buildingDone', i * 0.01, () => true)).toBe(true);
    // new AudioContext (time jumps back): not silent forever
    expect(g.admit('promoted', 0)).toBe(true);
  });
});

describe('Showcase: new workers arriving', () => {
  it('over 2 game minutes at most one arrival sound per rest period (instead of one per worker)', () => {
    const sim = createMissionSim(SHOWCASE_ID);
    const engine = { sim, player: 0, paused: false, renderer: null };
    const ga = new GameAudio(/** @type {any} */ (engine));
    const ctx = { state: 'running', currentTime: 0 };
    const played = {};
    ga.audio = /** @type {any} */ ({
      ctx, listener: { x: 0, z: 0, dist: 28, yaw: 0 }, ambient: { setWeather() {} }, music: { jingle() {} },
      play: (name) => { played[name] = (played[name] ?? 0) + 1; return true; },
    });
    let arrived = 0;
    const seconds = 120;
    for (let i = 0; i < seconds * 10; i++) {
      const evs = sim.step([]);
      arrived += evs.filter((e) => e.type === 'workerArrived' && e.player === 0).length;
      ctx.currentTime = (i + 1) / 10;
      ga.onEvents(evs, new Map());
    }
    // Cause: four own village centres each send a worker every 3 s
    expect(arrived).toBeGreaterThan(100);
    expect(played.workerArrived).toBeGreaterThanOrEqual(1);
    expect(played.workerArrived).toBeLessThanOrEqual(Math.ceil(seconds / NOTIFY_REST.workerArrived));
  }, 60_000);
});
