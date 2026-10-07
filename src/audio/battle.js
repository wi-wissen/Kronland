// Combat intensity near the camera (purely computational, testable): combat events leave "heat points"
// that decay over time. From them follow the volume of the battle ambience and – with
// hysteresis so the music does not flutter – the switch between build and combat theme.
// The combat theme belongs to fights the player is involved in (combat): if BATTLE_MUSIC.grace
// seconds pass without such a hit, the fight is over – even if heat is still in view.

import { viewRadius } from './spatial.js';
import { BATTLE_MUSIC } from './settings.js';

export class BattleMeter {
  /** @param {Partial<typeof BATTLE_MUSIC>} [opts] */
  constructor(opts = {}) {
    const o = { ...BATTLE_MUSIC, ...opts };
    /** @type {{ x: number, z: number, w: number }[]} */
    this.spots = [];
    this.k = Math.LN2 / o.halfLife;
    this.kRelease = Math.LN2 / o.releaseHalfLife;
    this.enter = o.enter;
    this.exit = o.exit;
    /** Combat without heat in view (camera away) ends after this much quiet */
    this.hold = o.hold;
    /** Minimum duration of the combat theme in seconds */
    this.minHold = o.minHold;
    /** Seconds without combat involving the player after which the fight is over */
    this.grace = o.grace;
    /** After a fight the next one brings the combat theme back already at this intensity … */
    this.reenter = o.reenter;
    /** … for this many seconds after the combat theme ended */
    this.rearm = o.rearm;
    this.mode = 'build';
    /** End of the last combat theme */
    this.left = -Infinity;
    /** Start of the combat theme */
    this.since = -Infinity;
    /** recently high intensity in view */
    this.hot = -Infinity;
    /** last hit involving the player */
    this.lastCombat = -Infinity;
  }

  /** Combat event at a position (tiles) with weight. Nearby points are merged. */
  add(pos, w = 1) {
    for (const s of this.spots) {
      if (Math.abs(s.x - pos.x) < 4 && Math.abs(s.z - pos.z) < 4) { s.w = Math.min(60, s.w + w); return; }
    }
    if (this.spots.length < 64) this.spots.push({ x: pos.x, z: pos.z, w });
  }

  /** The player fights (own unit hits or is hit). @param {number} now seconds */
  combat(now) { this.lastCombat = now; }

  /** Intensity needed for the combat theme (lower shortly after a fight). */
  need(now) { return now - this.left < this.rearm ? this.reenter : this.enter; }

  /** Is the player currently fighting (hit within the grace period)? */
  engaged(now) { return now - this.lastCombat < this.grace; }

  /** Let heat decay; if the player's fight is over, faster (remnants only). @param {number} [now] */
  decay(dt, now) {
    if (!this.spots.length) return;
    const k = now !== undefined && !this.engaged(now) ? this.kRelease : this.k;
    const f = Math.exp(-k * dt);
    for (const s of this.spots) s.w *= f;
    this.spots = this.spots.filter((s) => s.w > 0.05);
  }

  /** Intensity 0…1 from the listener's view (only fights within ~1.5 × visible area count). */
  intensity(l) {
    const R = viewRadius(l.dist) * 1.5;
    let sum = 0;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - l.x, s.z - l.z);
      if (d < R) sum += s.w * (1 - d / R);
    }
    // ~6 hits per second nearby ≈ full intensity
    return Math.min(1, sum / 20);
  }

  /**
   * Music theme with hysteresis. Combat: high intensity in view and the player is fighting. Back to build,
   * when grace seconds passed without a fight by the player (at the earliest minHold after the start) or hold seconds
   * no heat was left in view. Shortly after a fight (rearm) the theme returns already at the lower reenter
   * intensity: the next skirmish of the same war must not stay under the freshly started peace music.
   * @param {number} now seconds
   */
  theme(intensity, now) {
    const engaged = this.engaged(now);
    if (intensity >= this.enter) this.hot = now;
    if (this.mode === 'build') {
      const need = this.need(now);
      if (intensity >= need && engaged) { this.mode = 'battle'; this.since = now; }
    } else if (now - this.since >= this.minHold && (!engaged || (intensity <= this.exit && now - this.hot >= this.hold))) {
      this.mode = 'build';
      this.left = now;
    }
    return this.mode;
  }
}
