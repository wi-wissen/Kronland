// A* pathfinding on the tile grid, 8 directions, integer costs, deterministic.

const STRAIGHT = 10, DIAG = 14;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

/** Binary min-heap over node indices with deterministic tie-breaking (f, then h, then index). */
class Heap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  less(a, b) {
    if (a.f !== b.f) return a.f < b.f;
    if (a.h !== b.h) return a.h < b.h;
    return a.i < b.i;
  }
  push(n) {
    const it = this.items; it.push(n);
    let k = it.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!this.less(it[k], it[p])) break;
      [it[k], it[p]] = [it[p], it[k]]; k = p;
    }
  }
  pop() {
    const it = this.items, top = it[0], last = it.pop();
    if (it.length) {
      it[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < it.length && this.less(it[l], it[m])) m = l;
        if (r < it.length && this.less(it[r], it[m])) m = r;
        if (m === k) break;
        [it[k], it[m]] = [it[m], it[k]]; k = m;
      }
    }
    return top;
  }
}

/**
 * Can (sx,sy) reach any of the goal tiles at all? Compares the region numbers; for
 * unreachable goals (island, other river bank) this saves the full A* search over the whole map.
 * The result is identical to the search itself (determinism): A* only enters walkable tiles.
 */
function reachable(map, sx, sy, goals) {
  if (!map.regionAt) return true;
  const W = map.width;
  const from = new Set();
  if (map.walkable(sx, sy)) from.add(map.regionAt(sy * W + sx));
  else {
    // Start on an occupied tile: exit via the free neighbours (diagonals only via these)
    if (map.walkable(sx - 1, sy)) from.add(map.regionAt(sy * W + sx - 1));
    if (map.walkable(sx + 1, sy)) from.add(map.regionAt(sy * W + sx + 1));
    if (map.walkable(sx, sy - 1)) from.add(map.regionAt((sy - 1) * W + sx));
    if (map.walkable(sx, sy + 1)) from.add(map.regionAt((sy + 1) * W + sx));
  }
  if (!from.size) return false;
  for (const g of goals) {
    if (map.walkable(g % W, (g / W) | 0) && from.has(map.regionAt(g))) return true;
  }
  return false;
}

/**
 * Observer of an A* search (developer mode). Events:
 *   'open'  tile enters the open list (or gets a shorter path): g, h, predecessor
 *   'close' tile is examined (taken from the open list, neighbours are checked)
 *   'goal'  goal reached (search ends with a path)
 *   'unreachable' goal lies in another region (no search needed), 'exhausted' no path/aborted
 * @callback PathObserver
 * @param {'open'|'close'|'goal'|'unreachable'|'exhausted'} type
 * @param {number} i tile index
 * @param {number} g cost so far (straight 10, diagonal 14 per step)
 * @param {number} h estimated remaining cost (octile distance)
 * @param {number} parent predecessor tile or −1
 */

/** Counters for measurements and tests (no effect on the simulation). */
export const pathStats = { searches: 0, unreachable: 0, exhausted: 0, onFail: null };

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return STRAIGHT * (dx + dy) + (DIAG - 2 * STRAIGHT) * Math.min(dx, dy);
}

/**
 * Searches a path from (sx,sy) to one of the goal tiles.
 * @param {import('./map.js').TileMap} map
 * @param {number} sx @param {number} sy
 * @param {number[]} goals tile indices; all must be walkable
 * @param {number} [maxNodes]
 * @param {PathObserver|null} [observer] only for rendering/teaching (developer mode): receives every
 *   search step. Without an observer (normal case in the simulation) this costs just a null check;
 *   with an observer the search does not count in `pathStats`. The result is identical in both cases.
 * @returns {number[]|null} tile indices without start, or null if no path
 */
export function findPath(map, sx, sy, goals, maxNodes = 20000, observer = null) {
  if (!goals.length) return null;
  const W = map.width;
  const start = sy * W + sx;
  const goalSet = new Set(goals);
  if (goalSet.has(start)) return [];
  if (!observer) pathStats.searches++;
  if (!reachable(map, sx, sy, goals)) {
    if (observer) observer('unreachable', start, 0, 0, -1);
    else { pathStats.unreachable++; pathStats.onFail?.(sx, sy, goals); }
    return null;
  }
  const gx = goals.map((g) => g % W), gy = goals.map((g) => (g / W) | 0);
  const h = (x, y) => {
    let best = Infinity;
    for (let k = 0; k < gx.length; k++) { const v = octile(x, y, gx[k], gy[k]); if (v < best) best = v; }
    return best;
  };

  const g = new Map([[start, 0]]);
  const parent = new Map();
  const closed = new Set();
  const open = new Heap();
  const h0 = h(sx, sy);
  open.push({ i: start, f: h0, h: h0 });
  if (observer) observer('open', start, 0, h0, -1);
  let expanded = 0;

  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur.i)) continue;
    if (goalSet.has(cur.i)) {
      const path = [];
      for (let n = cur.i; n !== start; n = parent.get(n)) path.push(n);
      if (observer) observer('goal', cur.i, g.get(cur.i), cur.h, parent.get(cur.i) ?? -1);
      return path.reverse();
    }
    closed.add(cur.i);
    if (observer) observer('close', cur.i, g.get(cur.i), cur.h, parent.get(cur.i) ?? -1);
    if (++expanded > maxNodes) { if (observer) observer('exhausted', cur.i, 0, 0, -1); else pathStats.exhausted++; return null; }
    const cx = cur.i % W, cy = (cur.i / W) | 0;
    const cg = g.get(cur.i);
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (!map.walkable(nx, ny)) continue;
      // Diagonal only if both neighbours are free (no corner cutting).
      if (d >= 4 && (!map.walkable(cx + DX[d], cy) || !map.walkable(cx, cy + DY[d]))) continue;
      const ni = ny * W + nx;
      if (closed.has(ni)) continue;
      const ng = cg + (d < 4 ? STRAIGHT : DIAG);
      const old = g.get(ni);
      if (old !== undefined && old <= ng) continue;
      g.set(ni, ng);
      parent.set(ni, cur.i);
      const nh = h(nx, ny);
      open.push({ i: ni, f: ng + nh, h: nh });
      if (observer) observer('open', ni, ng, nh, cur.i);
    }
  }
  if (observer) observer('exhausted', start, 0, 0, -1);
  else pathStats.exhausted++;
  return null;
}
