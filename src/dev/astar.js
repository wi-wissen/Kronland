// Making A* pathfinding visible (developer mode, teaching).
//
// The simulation stays untouched: a figure's path comes from its state (`e.path`). To
// show the search, the same function `findPath` is called once more – from the current
// location to the goal tile – with an observer that records every step. `findPath` only reads the
// map; without an observer (normal case) the instrumentation costs one null check.
//
// Recording: compact event list (type, tile, g, h, parent). Playback: `SearchPlayback` builds
// the state up to any step (forwards step by step, backwards anew).

import { findPath } from '../sim/pathfinding.js';
import { UNIT } from '../sim/fixed.js';

export const EV_OPEN = 1, EV_CLOSE = 2, EV_GOAL = 3;

/** State of a tile during playback. */
export const TILE_NONE = 0, TILE_OPEN = 1, TILE_CLOSED = 2, TILE_PATH = 3;

/**
 * @typedef {Object} SearchRecord
 * @property {number} W map width
 * @property {number} start start tile
 * @property {number[]} goals goal tiles
 * @property {number[]|null} path result of findPath (without start)
 * @property {'found'|'unreachable'|'exhausted'|'here'} result
 * @property {number} steps number of events
 * @property {Uint8Array} type @property {Int32Array} tile @property {Int32Array} g @property {Int32Array} h @property {Int32Array} parent
 * @property {number} expanded examined tiles (closed list)
 */

/**
 * Run A* with an observer and record all steps.
 * @param {import('../sim/map.js').TileMap} map
 * @param {number} sx @param {number} sy start tile
 * @param {number[]} goals goal tiles (indices)
 * @param {number} [maxNodes] as in the simulation
 * @returns {SearchRecord}
 */
export function recordSearch(map, sx, sy, goals, maxNodes = 20000) {
  let cap = 1024, n = 0;
  let type = new Uint8Array(cap), tile = new Int32Array(cap), g = new Int32Array(cap), h = new Int32Array(cap), parent = new Int32Array(cap);
  let result = 'exhausted', expanded = 0;
  const grow = () => {
    cap *= 2;
    const t2 = new Uint8Array(cap); t2.set(type); type = t2;
    for (const [k, a] of Object.entries({ tile, g, h, parent })) {
      const b = new Int32Array(cap); b.set(a);
      if (k === 'tile') tile = b; else if (k === 'g') g = b; else if (k === 'h') h = b; else parent = b;
    }
  };
  /** @type {import('../sim/pathfinding.js').PathObserver} */
  const observer = (kind, i, gv, hv, p) => {
    if (kind === 'unreachable') { result = 'unreachable'; return; }
    if (kind === 'exhausted') { result = 'exhausted'; return; }
    if (n >= cap) grow();
    type[n] = kind === 'open' ? EV_OPEN : kind === 'close' ? EV_CLOSE : EV_GOAL;
    tile[n] = i; g[n] = gv; h[n] = hv; parent[n] = p;
    n++;
    if (kind === 'close') expanded++;
    if (kind === 'goal') result = 'found';
  };
  const path = findPath(map, sx, sy, goals, maxNodes, observer);
  const W = map.width;
  if (path && path.length === 0) result = 'here';
  return {
    W, start: sy * W + sx, goals: [...goals], path, result, steps: n, expanded,
    type: type.subarray(0, n), tile: tile.subarray(0, n), g: g.subarray(0, n), h: h.subarray(0, n), parent: parent.subarray(0, n),
  };
}

/**
 * Debug search for a figure: from the current location to the last tile of its path (or to `goal`).
 * Only reads the state; null if there is nothing to search.
 * @param {import('../sim/sim.js').Sim} sim
 * @param {any} e figure with px/py and path
 * @param {number|null} [goal] own goal tile (teaching: tap the goal)
 */
export function searchForFigure(sim, e, goal = null) {
  if (!e || e.px === undefined) return null;
  const map = sim.map;
  const target = goal ?? (e.path?.length ? e.path[e.path.length - 1] : null);
  if (target === null || target === undefined) return null;
  const sx = Math.floor(e.px / UNIT), sy = Math.floor(e.py / UNIT);
  return recordSearch(map, sx, sy, [target]);
}

/**
 * Playback of a recording: state per tile, g/h/parent up to the chosen step.
 * Forwards it is computed incrementally, backwards from the start.
 */
export class SearchPlayback {
  /** @param {SearchRecord} rec @param {number} size tile count of the map */
  constructor(rec, size) {
    this.rec = rec;
    this.state = new Uint8Array(size);
    this.g = new Int32Array(size).fill(-1);
    this.h = new Int32Array(size).fill(-1);
    this.parent = new Int32Array(size).fill(-1);
    /** Number of applied events (0 … rec.steps) */
    this.step = 0;
    this.open = 0;
    this.closed = 0;
    /** Tile examined last (current node) */
    this.current = -1;
    /** Path at the end (tiles incl. start) */
    this.pathTiles = null;
    /** Change counter (rendering rebuilds only on change) */
    this.version = 0;
  }

  get done() { return this.step >= this.rec.steps; }

  reset() {
    this.state.fill(0); this.g.fill(-1); this.h.fill(-1); this.parent.fill(-1);
    this.step = 0; this.open = 0; this.closed = 0; this.current = -1; this.pathTiles = null;
  }

  /** Jump to step `target` (0 = before the search, rec.steps = end). */
  seek(target) {
    const r = this.rec;
    target = Math.max(0, Math.min(r.steps, Math.floor(target)));
    if (target === this.step) return;
    if (target < this.step) this.reset();
    const st = this.state;
    for (let k = this.step; k < target; k++) {
      const i = r.tile[k];
      const t = r.type[k];
      if (t === EV_OPEN) {
        if (st[i] !== TILE_OPEN) { st[i] = TILE_OPEN; this.open++; }
        this.g[i] = r.g[k]; this.h[i] = r.h[k]; this.parent[i] = r.parent[k];
      } else if (t === EV_CLOSE) {
        if (st[i] === TILE_OPEN) this.open--;
        if (st[i] !== TILE_CLOSED) { st[i] = TILE_CLOSED; this.closed++; }
        this.current = i;
      } else if (t === EV_GOAL) {
        if (st[i] === TILE_OPEN) this.open--;
        this.current = i;
        // trace the path back via the parents
        const tiles = [];
        for (let n = i, guard = 0; n >= 0 && guard < st.length; n = this.parent[n], guard++) {
          tiles.push(n);
          if (n === r.start) break;
        }
        this.pathTiles = tiles.reverse();
        for (const p of tiles) st[p] = TILE_PATH;
      }
    }
    this.step = target;
    this.version++;
  }

  /**
   * Values of a tile for display on hover. null if the search does not (yet) know it.
   * @param {number} i
   */
  info(i) {
    if (i < 0 || i >= this.state.length || this.g[i] < 0) return null;
    const s = this.state[i];
    return { g: this.g[i], h: this.h[i], f: this.g[i] + this.h[i], parent: this.parent[i], state: s === TILE_OPEN ? 'open' : s === TILE_PATH ? 'path' : 'closed' };
  }
}
