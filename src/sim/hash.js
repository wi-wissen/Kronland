// FNV-1a hash over integers. Used to detect deviations (determinism, later desync).

export class Hasher {
  constructor() { this.h = 0x811c9dc5; }
  /** @param {number} n integer */
  int(n) {
    let v = n | 0;
    for (let k = 0; k < 4; k++) {
      this.h ^= v & 0xff;
      this.h = Math.imul(this.h, 0x01000193);
      v >>>= 8;
    }
    return this;
  }
  /** @param {string} s */
  str(s) {
    for (let k = 0; k < s.length; k++) {
      this.h ^= s.charCodeAt(k);
      this.h = Math.imul(this.h, 0x01000193);
    }
    return this;
  }
  get value() { return this.h >>> 0; }
}
