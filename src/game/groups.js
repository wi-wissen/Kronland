// Control groups (like Ctrl+number in Settlers 5): remember a selection under a number 1–9 and recall it.
// Pure UI state of the player – no sim state, no commands, not in the state hash.

/** Number of groups (keys 1–9) */
export const GROUP_COUNT = 9;
/** Same group twice within this time (ms): camera jumps there */
export const DOUBLE_MS = 450;

export class ControlGroups {
  constructor() {
    /** @type {Map<number, number[]>} number → entity IDs */
    this.map = new Map();
    this.last = { n: 0, at: -Infinity };
  }

  /** Remember the selection under number n (an empty selection deletes the group). */
  assign(n, ids) {
    if (n < 1 || n > GROUP_COUNT) return;
    const list = [...new Set(ids)];
    if (list.length) this.map.set(n, list); else this.map.delete(n);
  }

  /** Members still alive (isAlive checks the ID); empty groups disappear. */
  members(n, isAlive) {
    const list = (this.map.get(n) ?? []).filter(isAlive);
    if (list.length) this.map.set(n, list); else this.map.delete(n);
    return list;
  }

  /** Group that contains exactly this selection, otherwise 0. */
  find(ids) {
    const want = [...new Set(ids)].sort((a, b) => a - b).join(',');
    if (!want) return 0;
    for (const [n, list] of this.map) if ([...list].sort((a, b) => a - b).join(',') === want) return n;
    return 0;
  }

  /** Smallest free number, otherwise 0 (all taken). */
  nextFree() {
    for (let n = 1; n <= GROUP_COUNT; n++) if (!this.map.has(n)) return n;
    return 0;
  }

  /** Remember a recall; true if it is a double recall of the same group (move the camera there). */
  recall(n, now) {
    const twice = this.last.n === n && now - this.last.at < DOUBLE_MS;
    this.last = { n, at: now };
    return twice;
  }

  /** Occupied numbers ascending */
  numbers() { return [...this.map.keys()].sort((a, b) => a - b); }
}
