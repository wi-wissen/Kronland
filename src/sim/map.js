// Tile map: heights (cm), water, occupation by buildings/trees/piles, reserved spots.

export const WATER = 1;      // not walkable, not buildable
export const OCCUPIED = 2;   // building, tree, resource pile: not walkable
export const RESERVED = 4;   // settlement spot or shaft: walkable, only for the matching building
export const CLIFF = 8;      // steep slope or peak: never walkable, never buildable (not even in winter)
export const BRIDGE = 16;    // finished bridge over water: walkable, not buildable (expansion)

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
    /** Counter for height changes (levelling when building); only for caches of the rendering */
    this.heightVersion = 0;
    /**
     * Items lying on tiles (sparse): tile index → 'coin' | 'flower'. At most one per tile, only on walkable ground –
     * occupy() removes them (src/sim/systems/ground.js).
     * @type {Map<number, string>}
     */
    this.items = new Map();
    /** Track strength per tile (footprints, trodden paths): grows when figures leave a tile, a sweeping broom fades it */
    this.tracks = new Uint8Array(width * height);
    /** Counter for changes of items and tracks set by scripts (rendering only, not saved) */
    this.groundVersion = 0;
    /**
     * Cache of the region numbers (lazy): [0] without ice, [1] with ice (only used in winter).
     * ver: state of `version`, dirty: rectangles changed since then [x, y, w, h, …] (local recomputation;
     * released rectangles with negative width).
     * @type {Array<{ labels: Int32Array|null, ver: number, dirty: number[] }>}
     */
    this.regionCache = [{ labels: null, ver: -1, dirty: [] }, { labels: null, ver: -1, dirty: [] }];
  }

  /**
   * Number of the connected walkable region of a tile (0 = not walkable).
   * Diagonal steps are only allowed if both neighbours are free (as in pathfinding),
   * so 4-neighbourhood suffices. The number is canonical: smallest tile index of the region + 1 –
   * independent of how and in which order it was computed (fully or only locally), and stable for
   * regions that a change does not touch. Recomputed on demand when occupation or frost
   * change; after occupy/release only the affected regions (updateRegions).
   */
  regionAt(k) {
    return this.regionLabels(this.frozen ? 1 : 0, this.frozen)[k];
  }

  /**
   * Region of a tile without ice (frozen water does not count as a way). For plans that should
   * survive the winter (AI: building spots, resources, attack targets).
   */
  landRegionAt(k) {
    return this.regionLabels(0, false)[k];
  }

  /**
   * Region numbers of a cache (0: without ice, 1: with ice), updated on demand.
   * @param {0|1} slot @param {boolean} frozen @returns {Int32Array}
   */
  regionLabels(slot, frozen) {
    const c = this.regionCache[slot];
    if (c.labels && c.ver === this.version) return c.labels;
    // Only occupy/release since the last state (each bumps version exactly once and remembers its rectangle):
    // recompute locally. Other changes (bridges, editor, script) bump version without a rectangle.
    if (c.labels && c.dirty.length && c.ver + c.dirty.length / 4 === this.version) this.updateRegions(c.labels, frozen, c.dirty);
    else c.labels = this.computeRegions(frozen, c.labels);
    c.ver = this.version;
    c.dirty.length = 0;
    return c.labels;
  }

  /** Rectangle changed (occupy/release): remember for the local region computation. @param {boolean} [freed] release */
  markDirty(x, y, w, h, freed = false) {
    for (const c of this.regionCache) {
      if (!c.labels) continue;
      // too many changes at once: recomputing fully is cheaper then (ver no longer matches → computeRegions)
      if (c.dirty.length >= 4 * 64) { c.ver = -1; c.dirty.length = 0; continue; }
      if (c.ver + c.dirty.length / 4 === this.version) c.dirty.push(x, y, freed ? -w : w, h);
    }
  }

  /** @param {boolean} frozen */
  walkableFn(frozen) {
    const flags = this.flags;
    return (k) => { const f = flags[k]; return !(f & (OCCUPIED | CLIFF)) && (!(f & WATER) || frozen || !!(f & BRIDGE)); };
  }

  /** @param {boolean} frozen @param {Int32Array|null} [reuse] @returns {Int32Array} */
  computeRegions(frozen, reuse = null) {
    const n = this.width * this.height;
    const reg = reuse && reuse.length === n ? reuse.fill(0) : new Int32Array(n);
    const ok = this.walkableFn(frozen);
    for (let s = 0; s < n; s++) if (!reg[s] && ok(s)) this.floodRegion(reg, s, ok);
    return reg;
  }

  /**
   * Recompute locally: all regions that a changed rectangle (or its border) touches are deleted
   * and flooded anew; the others stay as they are. Result equals computeRegions (canonical numbers).
   * @param {Int32Array} reg @param {boolean} frozen @param {number[]} dirty [x, y, w, h, …]
   */
  updateRegions(reg, frozen, dirty) {
    const W = this.width, H = this.height, n = W * H;
    const ok = this.walkableFn(frozen);
    // Most common case (tree felled, building demolished): the released area borders exactly one region
    if (this.joinFreed(reg, ok, dirty)) return;
    // mark affected regions (number = index + 1, hence a field of map size + 1)
    const hit = this.hitBuf?.length === n + 1 ? this.hitBuf : (this.hitBuf = new Uint8Array(n + 1));
    const hits = [];
    for (let r = 0; r < dirty.length; r += 4) {
      const x0 = Math.max(0, dirty[r] - 1), y0 = Math.max(0, dirty[r + 1] - 1);
      const x1 = Math.min(W - 1, dirty[r] + Math.abs(dirty[r + 2])), y1 = Math.min(H - 1, dirty[r + 1] + dirty[r + 3]);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const id = reg[y * W + x]; if (id && !hit[id]) { hit[id] = 1; hits.push(id); } }
    }
    // delete affected regions (one check per tile), plus the changed rectangles themselves
    const seeds = this.seedBuf?.length === n ? this.seedBuf : (this.seedBuf = new Uint8Array(n));
    let lo = n, hi = -1;
    if (hits.length) {
      for (let k = 0; k < n; k++) if (hit[reg[k]]) { reg[k] = 0; seeds[k] = 1; if (k < lo) lo = k; hi = k; }
      for (const id of hits) hit[id] = 0;
    }
    for (let r = 0; r < dirty.length; r += 4) {
      for (let y = Math.max(0, dirty[r + 1]); y < Math.min(H, dirty[r + 1] + dirty[r + 3]); y++) {
        for (let x = Math.max(0, dirty[r]); x < Math.min(W, dirty[r] + Math.abs(dirty[r + 2])); x++) {
          const k = y * W + x;
          reg[k] = 0; seeds[k] = 1;
          if (k < lo) lo = k;
          if (k > hi) hi = k;
        }
      }
    }
    // flood ascending: the first start point of a region is its smallest index (all its tiles
    // were deleted – a region that touches no deleted tile is unchanged)
    for (let s = lo; s <= hi; s++) {
      if (!seeds[s]) continue;
      seeds[s] = 0;
      if (!reg[s] && ok(s)) this.floodRegion(reg, s, ok);
    }
  }

  /**
   * Fast path only for releases: each rectangle borders exactly one region L, all freed tiles
   * attach to L within the rectangle, and none lies before L in the index (otherwise the canonical
   * number would change). Then they simply get L. Otherwise false – updateRegions recomputes the regions generally.
   * @returns {boolean}
   */
  joinFreed(reg, ok, dirty) {
    const W = this.width, H = this.height;
    for (let r = 0; r < dirty.length; r += 4) if (dirty[r + 2] >= 0) return false;
    for (let r = 0; r < dirty.length; r += 4) {
      const rx = dirty[r], ry = dirty[r + 1], rw = -dirty[r + 2], rh = dirty[r + 3];
      if (rx < 0 || ry < 0 || rx + rw > W || ry + rh > H) return false;
      const inside = (x, y) => x >= rx && x < rx + rw && y >= ry && y < ry + rh;
      // Border: exactly one region, no walkable tile without a number
      let L = 0;
      for (let y = ry - 1; y <= ry + rh; y++) for (let x = rx - 1; x <= rx + rw; x++) {
        if (inside(x, y) || x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = y * W + x, id = reg[k];
        if (!id) { if (ok(k)) return false; continue; }
        if (L && id !== L) return false;
        L = id;
      }
      if (!L) return false;
      // flood inside, starting from tiles with neighbours in L
      const queue = [];
      let walk = 0;
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        const k = y * W + x;
        if (!ok(k)) continue;
        if (k < L - 1) return false;
        walk++;
        if ((x > 0 && reg[k - 1] === L) || (x < W - 1 && reg[k + 1] === L) || (y > 0 && reg[k - W] === L) || (y < H - 1 && reg[k + W] === L)) { reg[k] = L; queue.push(k); }
      }
      let done = queue.length;
      while (queue.length) {
        const k = queue.pop(), x = k % W, y = (k / W) | 0;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (!inside(nx, ny)) continue;
          const nk = ny * W + nx;
          if (!reg[nk] && ok(nk)) { reg[nk] = L; queue.push(nk); done++; }
        }
      }
      if (done !== walk) return false; // detached part in the rectangle: compute generally (resets the area)
    }
    return true;
  }

  /** Flood a region from tile s with the number s + 1 (4-neighbourhood). */
  floodRegion(reg, s, ok) {
    const W = this.width, H = this.height, n = W * H;
    const queue = this.queueBuf?.length === n ? this.queueBuf : (this.queueBuf = new Int32Array(n));
    const id = s + 1;
    let head = 0, tail = 0;
    queue[tail++] = s; reg[s] = id;
    while (head < tail) {
      const k = queue[head++], x = k % W;
      if (x > 0 && !reg[k - 1] && ok(k - 1)) { reg[k - 1] = id; queue[tail++] = k - 1; }
      if (x < W - 1 && !reg[k + 1] && ok(k + 1)) { reg[k + 1] = id; queue[tail++] = k + 1; }
      if (k >= W && !reg[k - W] && ok(k - W)) { reg[k - W] = id; queue[tail++] = k - W; }
      if (k < n - W && !reg[k + W] && ok(k + W)) { reg[k + W] = id; queue[tail++] = k + W; }
    }
  }

  idx(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }

  walkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    const f = this.flags[this.idx(x, y)];
    if (f & (OCCUPIED | CLIFF)) return false;
    return !(f & WATER) || this.frozen || !!(f & BRIDGE);
  }

  /** Occupy or release a rectangle. */
  occupy(x, y, w, h, entityId) {
    const items = this.items.size > 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = this.idx(i, j);
      this.flags[k] |= OCCUPIED;
      this.owner[k] = entityId;
      // Items only lie on walkable ground: a tree, pile or building on the tile takes them away
      if (items && this.items.delete(k)) this.groundVersion++;
    }
    this.markDirty(x, y, w, h);
    this.version++;
  }

  release(x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = this.idx(i, j);
      this.flags[k] &= ~OCCUPIED;
      this.owner[k] = 0;
    }
    this.markDirty(x, y, w, h, true);
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
