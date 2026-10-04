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
 * @returns {number[]|null} tile indices without start, or null if no path
 */
export function findPath(map, sx, sy, goals, maxNodes = 20000) {
  if (!goals.length) return null;
  const W = map.width;
  const start = sy * W + sx;
  const goalSet = new Set(goals);
  if (goalSet.has(start)) return [];
  pathStats.searches++;
  if (!reachable(map, sx, sy, goals)) { pathStats.unreachable++; pathStats.onFail?.(sx, sy, goals); return null; }
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
  let expanded = 0;

  while (open.size) {
    const cur = open.pop();
    if (closed.has(cur.i)) continue;
    if (goalSet.has(cur.i)) {
      const path = [];
      for (let n = cur.i; n !== start; n = parent.get(n)) path.push(n);
      return path.reverse();
    }
    closed.add(cur.i);
    if (++expanded > maxNodes) { pathStats.exhausted++; return null; }
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
    }
  }
  pathStats.exhausted++;
  return null;
}
