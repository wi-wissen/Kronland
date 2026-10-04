// Combat intensity near the camera (purely computational, testable): combat events leave "heat points"
// that decay over time. From them follow the volume of the battle ambience and – with
// hysteresis so the music does not flutter – the switch between build and combat theme.

import { audibleRadius } from './spatial.js';

export class BattleMeter {
  constructor({ halfLife = 4, enter = 0.45, exit = 0.12, hold = 12 } = {}) {
    /** @type {{ x: number, z: number, w: number }[]} */
    this.spots = [];
    this.k = Math.LN2 / halfLife;
    this.enter = enter;
    this.exit = exit;
    /** Minimum duration of the combat theme in seconds */
    this.hold = hold;
    this.mode = 'build';
    this.since = -Infinity;
  }

  /** Combat event at a position (tiles) with weight. Nearby points are merged. */
  add(pos, w = 1) {
    for (const s of this.spots) {
      if (Math.abs(s.x - pos.x) < 4 && Math.abs(s.z - pos.z) < 4) { s.w = Math.min(60, s.w + w); return; }
    }
    if (this.spots.length < 64) this.spots.push({ x: pos.x, z: pos.z, w });
  }

  decay(dt) {
    if (!this.spots.length) return;
    const f = Math.exp(-this.k * dt);
    for (const s of this.spots) s.w *= f;
    this.spots = this.spots.filter((s) => s.w > 0.05);
  }

  /** Intensity 0…1 from the listener's view (only fights within ~1.5 × visible area count). */
  intensity(l) {
    const R = audibleRadius(l.dist) * 1.5;
    let sum = 0;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - l.x, s.z - l.z);
      if (d < R) sum += s.w * (1 - d / R);
    }
    // ~6 hits per second nearby ≈ full intensity
    return Math.min(1, sum / 20);
  }

  /** Music theme with hysteresis. @param {number} now seconds */
  theme(intensity, now) {
    if (this.mode === 'build' && intensity >= this.enter) { this.mode = 'battle'; this.since = now; }
    else if (this.mode === 'battle' && intensity <= this.exit && now - this.since >= this.hold) this.mode = 'build';
    else if (this.mode === 'battle' && intensity >= this.enter) this.since = now;
    return this.mode;
  }
}
