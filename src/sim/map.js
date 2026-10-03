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
  }

  release(x, y, w, h) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      const k = this.idx(i, j);
      this.flags[k] &= ~OCCUPIED;
      this.owner[k] = 0;
    }
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
