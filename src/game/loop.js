// Game loop: process ticks per frame without falling into a death spiral, and catch errors
// so that a single exception (simulation, AI, rendering, audio) does not halt the frame forever.
// Pure logic without browser dependencies (tests/game/loop.test.js).

/** Length of a simulation tick (ms) */
export const TICK_MS = 100;
/** At most this many ticks per frame (catching up after short hitches) */
export const MAX_STEPS = 8;
/** Time budget per frame for ticks (ms): after it no further tick in this frame */
export const STEP_BUDGET_MS = 45;
/** Longest frame for animations (s): bigger gaps would make figures and camera jump */
export const MAX_FRAME_DT = 0.1;
/** Longest frame for game time (ms): as many ticks as one frame may run at most */
export const MAX_FRAME_MS = MAX_STEPS * TICK_MS;

/**
 * Elapsed time of a frame, clamped separately for animations and for game time. Game time must not use the
 * short animation clamp: below 10 frames per second every frame would then advance at most one tick and the game
 * would run at frame-rate speed (at 2 fps only a fifth as fast) although the ticks themselves are cheap. Up to
 * MAX_FRAME_MS it keeps real time; larger gaps (tab in the background, debugger) are cut off.
 * Never negative: the rAF timestamp can lie before the start time (long warm-up).
 * @param {number} now @param {number} last timestamps (ms)
 * @returns {{ dt: number, simMs: number }} dt: animation time (s), simMs: game time (ms, before the speed factor)
 */
export function frameTimes(now, last) {
  const ms = Math.max(0, now - last);
  return { dt: Math.min(MAX_FRAME_DT, ms / 1000), simMs: Math.min(MAX_FRAME_MS, ms) };
}

/**
 * Run the due ticks of a frame. At most MAX_STEPS ticks and, once the time budget has elapsed, none
 * more (at least one, otherwise the game would stand still). What has accumulated beyond that is discarded: if the
 * simulation is slower than the clock, the game runs slower instead of slowing itself down with ever more catch-up ticks per
 * frame. The remainder below one tick is kept for the in-between frames.
 * @param {number} acc accumulated game time (ms)
 * @param {() => void} step runs one tick
 * @param {{ now?: () => number, budget?: number, maxSteps?: number }} [opts]
 * @returns {{ acc: number, steps: number, dropped: number }} dropped: discarded ticks
 */
export function runSteps(acc, step, { now = () => performance.now(), budget = STEP_BUDGET_MS, maxSteps = MAX_STEPS } = {}) {
  const t0 = now();
  let steps = 0;
  while (acc >= TICK_MS && steps < maxSteps) {
    step();
    acc -= TICK_MS;
    steps++;
    if (now() - t0 >= budget) break;
  }
  let dropped = 0;
  if (acc >= TICK_MS) { dropped = Math.floor(acc / TICK_MS); acc -= dropped * TICK_MS; }
  return { acc, steps, dropped };
}

/** After this many errors in a row the loop gives up (stop the game, error dialogue). */
export const FAULT_LIMITS = { sim: 3, render: 30, ai: Infinity, audio: Infinity, ui: 30, dev: Infinity };

/**
 * Fault guard per area: counts errors in a row, logs throttled (the first few, then every
 * hundredth) and reports when an area counts as permanently broken.
 */
export class FaultGuard {
  /** @param {{ limits?: Record<string, number>, log?: (area: string, err: unknown, n: number) => void }} [opts] */
  constructor({ limits = FAULT_LIMITS, log = (area, err, n) => console.error(`[Kronland] Error in ${area} (${n}×):`, err) } = {}) {
    this.limits = limits;
    this.log = log;
    /** Errors in a row per area */
    this.streak = {};
    /** Errors in total per area */
    this.total = {};
    /** First error that led to giving up: { area, message, stack } */
    this.fatal = null;
  }

  /** Area ran without errors. */
  ok(area) { if (this.streak[area]) this.streak[area] = 0; }

  /**
   * Report an error. @returns {boolean} true if the area now counts as broken (limit reached)
   * @param {string} area @param {unknown} err
   */
  fail(area, err) {
    const n = (this.total[area] = (this.total[area] ?? 0) + 1);
    const s = (this.streak[area] = (this.streak[area] ?? 0) + 1);
    if (n <= 3 || n % 100 === 0) { try { this.log(area, err, n); } catch { /* logging must never interfere */ } }
    if (s >= (this.limits[area] ?? Infinity)) {
      this.fatal ??= { area, message: String(/** @type {any} */ (err)?.message ?? err).slice(0, 300), stack: String(/** @type {any} */ (err)?.stack ?? '').slice(0, 2000) };
      return true;
    }
    return false;
  }

  /**
   * Run a function protected. @returns {boolean} true on success
   * @param {string} area @param {() => void} fn @param {(fatal: boolean) => void} [onFail]
   */
  run(area, fn, onFail) {
    try { fn(); this.ok(area); return true; } catch (err) {
      const fatal = this.fail(area, err);
      onFail?.(fatal);
      return false;
    }
  }
}
