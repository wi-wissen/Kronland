// Deterministic random generator (sfc32). Replaces Math.random in the entire simulation.

export class Rng {
  /** @param {number} seed */
  constructor(seed) {
    this.a = 0x9e3779b9;
    this.b = 0x243f6a88;
    this.c = 0xb7e15162;
    this.d = seed >>> 0;
    for (let i = 0; i < 15; i++) this.next();
  }

  /** @returns {number} integer 0 … 2^32-1 */
  next() {
    let { a, b, c, d } = this;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t >>> 0;
  }

  /** @param {number} n @returns {number} integer 0 … n-1 */
  int(n) {
    return this.next() % n;
  }

  /** @param {number} min @param {number} max @returns {number} integer min … max (inclusive) */
  range(min, max) {
    return min + this.int(max - min + 1);
  }

  /** @returns {number[]} state to save */
  getState() {
    return [this.a, this.b, this.c, this.d];
  }

  /** @param {number[]} s */
  setState(s) {
    [this.a, this.b, this.c, this.d] = s;
  }
}
