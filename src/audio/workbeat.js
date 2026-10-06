// Work sounds in time with the animation (purely computational, testable in Node):
// - One strike per work cycle of the figure, exactly where hammer, axe or pickaxe hit in the clip.
// - A shared gate (StrikeGate) distributes the strikes of many workers: per sound kind at most one strike
//   per minimum gap (hammer ≈ 0.42 s), slight random delay and volume spread – no volleys.
// See docs/AUDIO.md#arbeitsgeräusche.

/**
 * Position of the impact in the cycle (0…1) per animation name. Measured at the height of the right hand in the
 * serf clips (lowest point after the downswing): hammer 1.62 s of 1.87 s,
 * chop 1.17 s of 2.53 s, mine 0.93 s of 2.53 s. `work` = procedural figure (tool at the bottom at k = 0.5).
 */
export const STRIKE_PHASE = { hammer: 0.87, chop: 0.46, mine: 0.37, work: 0.5 };

/** Cycle length (s) per work clip if no figure data is available (e.g. without rendering). */
export const STRIKE_PERIOD = { build: 1.87, chop: 2.53, mine: 2.53 };

/** Work clip of the figure → sound. */
export const CLIP_SOUND = { build: 'hammer', chop: 'chop', mine: 'pickaxe' };

/** Minimum gap (s) between two strikes of the same sound kind, across all workers within hearing range. */
export const STRIKE_GAP = { hammer: 0.42, chop: 0.45, pickaxe: 0.45, anvil: 0.6, saw: 0.9, chisel: 0.4, bubble: 1.2 };

/** Minimum gap (s) between two work sounds of different kinds (otherwise shifted back slightly). */
export const STRIKE_ANY_GAP = 0.12;

/** Largest random delay of a strike (s). */
export const STRIKE_JITTER = 0.06;

/**
 * Does an impact fall in the time window (t0, t1]? Times in seconds since clip start.
 * If the window is longer than one cycle (hitch), it counts as one strike.
 * @param {number} t0 @param {number} t1 @param {number} period @param {number} phase 0…1
 */
export function strikeIn(t0, t1, period, phase) {
  if (!(period > 0) || !(t1 > t0)) return false;
  const off = phase * period;
  const last = Math.floor((t1 - off) / period) * period + off;
  return last > t0 && last <= t1;
}

/** Position of the impact for an animation name (fallback: middle of the cycle). */
export const strikePhase = (anim) => STRIKE_PHASE[anim] ?? 0.5;

/**
 * Distributes work strikes: minimum gap per sound kind, different kinds slightly offset, random delay,
 * volume spread. A clearly louder (nearer) strike may come after half the gap.
 */
export class StrikeGate {
  /** @param {() => number} rnd randomness 0…1 */
  constructor(rnd) {
    this.rnd = rnd;
    /** @type {Map<string, { at: number, gain: number }>} */
    this.last = new Map();
    this.lastAny = -Infinity;
  }

  /**
   * May the strike sound? If so, it is registered.
   * @param {string} snd sound kind @param {number} now seconds @param {number} gain expected volume (with distance)
   * @returns {{ delay: number, gain: number } | null} delay from now and volume factor
   */
  admit(snd, now, gain = 1) {
    const gap = STRIKE_GAP[snd] ?? 0.4;
    let at = now + this.rnd() * STRIKE_JITTER;
    if (at - this.lastAny < STRIKE_ANY_GAP) at = this.lastAny + STRIKE_ANY_GAP;
    const prev = this.last.get(snd);
    if (prev) {
      const dt = at - prev.at;
      if (dt < gap && !(gain >= prev.gain * 2.5 && dt >= gap / 2)) return null;
    }
    const g = gain * (0.82 + this.rnd() * 0.26);
    this.last.set(snd, { at, gain: g });
    this.lastAny = Math.max(this.lastAny, at);
    return { delay: at - now, gain: g / Math.max(1e-6, gain) };
  }

  reset() { this.last.clear(); this.lastAny = -Infinity; }
}
