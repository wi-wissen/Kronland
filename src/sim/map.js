// Tile map: heights (cm), water, occupation by buildings/trees/piles, reserved spots.

export const WATER = 1;      // not walkable, not buildable
export const OCCUPIED = 2;   // building, tree, resource pile: not walkable
export const RESERVED = 4;   // settlement spot or shaft: walkable, only for the matching building
export const CLIFF = 8;      // steep slope or peak: never walkable, never buildable (not even in winter)

export class TileMap {
  /** @param {number} width @param {number} height */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.heights = new Int32Array(width * height);
    this.flags = new Uint8Array(width * height);
    /** Entity ID per tile (0 = none) for buildings, trees, piles */
    this.owner = new Int32Array(width * height);
    /** Winter: water is frozen and walkable */
    this.frozen = false;
    /** Counter for changes of the occupation (invalidates the region numbers) */
    this.version = 0;
    /** @type {Int32Array|null} connected walkable regions (0 = not walkable), lazy */
    this.regions = null;
    this.regionKey = '';
    /** @type {Int32Array|null} regions without ice (stored separately only in winter) */
    this.landRegions = null;
    this.landKey = '';
  }

  /**
   * Number of the connected walkable region of a tile (0 = not walkable).
   * Diagonal steps are only allowed if both neighbours are free (as in pathfinding),
   * so 4-neighbourhood is enough. Recomputed on demand when occupancy or frost changes.
   */
  regionAt(k) {
    const key = this.version + (this.frozen ? 'f' : '');
    if (this.regionKey !== key || !this.regions) {
      this.regions = this.computeRegions(this.frozen, this.regions);
      this.regionKey = key;
    }
    return this.regions[k];
  }

  /**
   * Region of a tile without ice (frozen water does not count as a way). For plans that should
   * survive the winter (AI: building spots, resources, attack targets).
   */
  landRegionAt(k) {
    if (!this.frozen) return this.regionAt(k);
    const key = String(this.version);
    if (this.landKey !== key || !this.landRegions) {
      this.landRegions = this.computeRegions(false, this.landRegions);
      this.landKey = key;
    }
    return this.landRegions[k];
  }

  /** @param {boolean} frozen @param {Int32Array|null} [reuse] @returns {Int32Array} */
  computeRegions(frozen, reuse = null) {
    const W = this.width, H = this.height, n = W * H;
    const reg = reuse && reuse.length === n ? reuse.fill(0) : new Int32Array(n);
    const queue = new Int32Array(n);
    const flags = this.flags;
    const ok = (k) => { const f = flags[k]; return !(f & (OCCUPIED | CLIFF)) && (!(f & WATER) || frozen); };
    let id = 0;
    for (let s = 0; s < n; s++) {
      if (reg[s] || !ok(s)) continue;
      id++;
      let head = 0, tail = 0;
      queue[tail++] = s; reg[s] = id;
      while (head < tail) {
        const k = queue[head++], x = k % W, y = (k / W) | 0;
        if (x > 0 && !reg[k - 1] && ok(k - 1)) { reg[k - 1] = id; queue[tail++] = k - 1; }
        if (x < W - 1 && !reg[k + 1] && ok(k + 1)) { reg[k + 1] = id; queue[tail++] = k + 1; }
        if (y > 0 && !reg[k - W] && ok(k - W)) { reg[k - W] = id; queue[tail++] = k - W; }
        if (y < H - 1 && !reg[k + W] && ok(k + W)) { reg[k + W] = id; queue[tail++] = k + W; }
      }
    }
    return reg;
  }

  idx(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  walkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const f = this.flags[this.idx(x, y)];
    if (f & (OCCUPIED | CLIFF)) return false;
    return !(f & WATER) || this.frozen;
  }

  /** Occupy or release a rectangle. */
  occupy(x, y, w, h, entityId) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = this.idx(i, j);
      this.flags[k] |= OCCUPIED;
      this.owner[k] = entityId;
    }
    this.version++;
  }

  release(x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = this.idx(i, j);
      this.flags[k] &= ~OCCUPIED;
      this.owner[k] = 0;
    }
    this.version++;
  }

  reserve(x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.flags[this.idx(i, j)] |= RESERVED;
  }

  /** Checks whether a rectangle is free of certain flags and lies within the map area. */
  rectFree(x, y, w, h, mask = WATER | OCCUPIED | RESERVED | CLIFF) {
    if (x < 1 || y < 1 || x + w > this.width - 1 || y + h > this.height - 1) return false;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (this.flags[this.idx(i, j)] & mask) return false;
    }
    return true;
  }

  /** Height difference within a rectangle. */
  slope(x, y, w, h) {
    let min = Infinity, max = -Infinity;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const v = this.heights[this.idx(i, j)];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return max - min;
  }

  /** Walkable tiles directly around a rectangle (workplaces for serfs). */
  ring(x, y, w, h) {
    const out = [];
    for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
      const inside = i >= x && i < x + w && j >= y && j < y + h;
      if (!inside && this.walkable(i, j)) out.push(this.idx(i, j));
    }
    return out;
  }
}
