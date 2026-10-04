// Voice limiting: at most n simultaneous voices per sound kind, minimum gap (cooldown)
// between two triggers, plus a global cap with priority for important sounds.
// Purely computational (time is passed in) and therefore testable in Node.

/** @typedef {{ max?: number, cooldown?: number, priority?: number }} VoiceRule  cooldown in seconds */

export class VoiceLimiter {
  /** @param {{ globalMax?: number }} [opts] */
  constructor(opts = {}) {
    this.globalMax = opts.globalMax ?? 24;
    /** @type {Map<string, { ends: number[], last: number }>} */
    this.types = new Map();
    /** @type {{ end: number, priority: number, type: string }[]} */
    this.all = [];
  }

  /** Remove expired voices. */
  prune(now) {
    if (this.all.length) this.all = this.all.filter((v) => v.end > now);
    for (const t of this.types.values()) if (t.ends.length) t.ends = t.ends.filter((e) => e > now);
  }

  active(type, now) {
    this.prune(now);
    return type ? (this.types.get(type)?.ends.length ?? 0) : this.all.length;
  }

  /**
   * May a new voice start? If so, it is registered immediately.
   * @param {string} type
   * @param {number} now seconds
   * @param {number} duration seconds
   * @param {VoiceRule} [rule]
   */
  acquire(type, now, duration, rule = {}) {
    const max = rule.max ?? 4, cooldown = rule.cooldown ?? 0, priority = rule.priority ?? 1;
    this.prune(now);
    let t = this.types.get(type);
    if (!t) { t = { ends: [], last: -Infinity }; this.types.set(type, t); }
    if (now - t.last < cooldown) return false;
    if (t.ends.length >= max) return false;
    if (this.all.length >= this.globalMax) {
      // Only displace if something less important is playing (the voice is then only removed from the count)
      let low = -1;
      for (let i = 0; i < this.all.length; i++) if (this.all[i].priority < priority && (low < 0 || this.all[i].priority < this.all[low].priority)) low = i;
      if (low < 0) return false;
      const [gone] = this.all.splice(low, 1);
      const gt = this.types.get(gone.type);
      if (gt) { const k = gt.ends.indexOf(gone.end); if (k >= 0) gt.ends.splice(k, 1); }
    }
    const end = now + Math.max(0.01, duration);
    t.ends.push(end);
    t.last = now;
    this.all.push({ end, priority, type });
    return true;
  }

  reset() { this.types.clear(); this.all = []; }
}
