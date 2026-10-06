// Throttle notice sounds from mass events. Some events do not come from the player but arrive
// in bursts on their own: new workers move in every 3 s per village centre (showcase: four centres,
// ~140 arrivals in two minutes), squads promote continuously in endless battles (swarm). The voice
// limit (voices.js, cooldown < 1 s) then lets almost every sound through – a constant "ding-ding".
// Here each event kind has a quiet period: the first sound of a burst plays, the following stay silent.
// Purely computational (time in seconds is passed in), hence testable in Node. See docs/AUDIO.md.

/** Quiet period (seconds) per event kind after a played notice sound. */
export const NOTIFY_REST = {
  workerArrived: 8,
  promoted: 5,
};

export class NotifyGate {
  /** @param {Record<string, number>} [rest] */
  constructor(rest = NOTIFY_REST) {
    this.rest = rest;
    /** @type {Map<string, number>} time of the last played sound per kind */
    this.last = new Map();
  }

  /**
   * May the notice sound for this event play? Kinds without a rule always.
   * @param {string} kind event type @param {number} now seconds
   */
  admit(kind, now) {
    const r = this.rest[kind];
    if (!r) return true;
    const t = this.last.get(kind);
    if (t !== undefined && now >= t && now - t < r) return false;
    return true;
  }

  /** Sound has been played: the quiet period begins. */
  played(kind, now) { if (this.rest[kind]) this.last.set(kind, now); }

  /**
   * admit + play + played in one: `play` returns whether the sound really ran (voice limit,
   * muted context); only then does the quiet period begin.
   * @param {string} kind @param {number} now @param {() => boolean} play
   */
  run(kind, now, play) {
    if (!this.admit(kind, now)) return false;
    const ok = !!play();
    if (ok) this.played(kind, now);
    return ok;
  }

  reset() { this.last.clear(); }
}
