// Shared movement for serfs, workers, soldiers and heroes.
//
// Rule: a figure never enters a non-walkable tile. Each sub-step changes at most into
// a neighbouring tile; diagonally only if both adjacent tiles are free (as in pathfinding),
// otherwise the figure would walk across water or building corners. Whoever still stands on a blocked
// tile (new building, ruin, mission setup) is freed by `unstickAll`.

import { findPath } from '../pathfinding.js';
import { idiv, isqrt, tileCenter, toTile } from '../fixed.js';

/** Figures that walk (and can thus get stuck). */
const MOBILE = new Set(['unit', 'worker', 'leader', 'soldier', 'hero']);

/**
 * May a figure go from (ax,ay) to (bx,by) (milli-tiles, sub-step at most one tile)?
 * Within its own tile always (even out of a blocked tile only the change
 * into a free neighbouring tile is allowed).
 * @param {import('../map.js').TileMap} map
 */
export function canStep(map, ax, ay, bx, by) {
  const atx = toTile(ax), aty = toTile(ay), btx = toTile(bx), bty = toTile(by);
  if (atx === btx && aty === bty) return true;
  const dx = btx - atx, dy = bty - aty;
  if (dx < -1 || dx > 1 || dy < -1 || dy > 1) return false;
  if (!map.walkable(btx, bty)) return false;
  if (dx && dy) return map.walkable(atx + dx, aty) && map.walkable(atx, aty + dy);
  return true;
}

/**
 * One tick of movement along `e.path`. Returns true when the path is finished.
 * If the next waypoint is no longer an allowed neighbouring tile (blocked, corner built over, figure was
 * displaced), the path is discarded; the caller searches again next tick.
 * @param {import('../sim.js').Sim} sim
 * @param {{px:number, py:number, path:number[]}} e
 * @param {number} speed milli-tiles per tick
 */
export function moveAlong(sim, e, speed) {
  const m = sim.map;
  let step = speed;
  while (step > 0 && e.path.length) {
    const next = e.path[0];
    const nx = next % m.width, ny = (next / m.width) | 0;
    if (!m.walkable(nx, ny)) { e.path = []; return false; }
    const cx = toTile(e.px), cy = toTile(e.py), sx = nx - cx, sy = ny - cy;
    if (sx || sy) {
      // Only into a neighbouring tile, diagonally only without corner cutting
      if (sx < -1 || sx > 1 || sy < -1 || sy > 1
        || (sx && sy && (!m.walkable(cx + sx, cy) || !m.walkable(cx, cy + sy)))) { e.path = []; return false; }
    }
    const tx = tileCenter(nx), ty = tileCenter(ny);
    const dx = tx - e.px, dy = ty - e.py;
    const d = isqrt(dx * dx + dy * dy);
    if (d <= step) {
      e.px = tx; e.py = ty; step -= d; e.path.shift();
    } else {
      e.px += idiv(dx * step, d); e.py += idiv(dy * step, d); step = 0;
    }
  }
  return e.path.length === 0;
}

/** Path from the current position to one of the target tiles. */
export function pathTo(sim, e, goals) {
  return findPath(sim.map, toTile(e.px), toTile(e.py), goals);
}

/** Walkable target tiles for a point: its tile, otherwise the free neighbours. */
export function goalsAt(map, px, py) {
  const tx = toTile(px), ty = toTile(py);
  if (map.walkable(tx, ty)) return [map.idx(tx, ty)];
  const out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (map.walkable(tx + dx, ty + dy)) out.push(map.idx(tx + dx, ty + dy));
  }
  return out;
}

/**
 * Nearest walkable tile around (tx,ty) (ring search up to maxR, on a tie by distance to the point
 * (px,py) and tile index – deterministic). With `region` only tiles of this region.
 * @returns {number} tile index or -1
 */
export function nearestWalkable(map, tx, ty, px, py, maxR = 12, region = 0) {
  let best = -1, bd = Infinity;
  for (let r = 0; r <= maxR; r++) {
    // Tiles of this ring are at least (r − ½) tiles from the point
    if (best >= 0 && (r * 1000 - 500) ** 2 > bd) break;
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || !map.walkable(x, y)) continue;
      const k = map.idx(x, y);
      if (region && map.regionAt(k) !== region) continue;
      const d = (tileCenter(x) - px) ** 2 + (tileCenter(y) - py) ** 2;
      if (d < bd || (d === bd && k < best)) { bd = d; best = k; }
    }
  }
  return best;
}

/**
 * Put figures on blocked tiles (under a new building or a ruin, placed there by the mission script)
 * onto the nearest walkable tile. Per tick; costs only one lookup per figure.
 * @param {import('../sim.js').Sim} sim
 */
export function unstickAll(sim) {
  const m = sim.map;
  for (const e of sim.entities.values()) {
    if (e.px === undefined || !MOBILE.has(e.kind)) continue;
    const tx = toTile(e.px), ty = toTile(e.py);
    if (m.walkable(tx, ty)) continue;
    const t = nearestWalkable(m, tx, ty, e.px, e.py, 16);
    if (t < 0) continue;
    e.px = tileCenter(t % m.width); e.py = tileCenter((t / m.width) | 0);
    e.path = [];
  }
}

/** Is the unit directly at a rectangle (or inside it)? */
export function isAdjacent(e, r) {
  const tx = toTile(e.px), ty = toTile(e.py);
  return tx >= r.x - 1 && tx <= r.x + r.w && ty >= r.y - 1 && ty <= r.y + r.h;
}

/**
 * Tiles already taken by other figures: where a figure stands without a path, and where a serf
 * is currently walking to (`goal`). Figures in `exclude` (the group being sent) do not count,
 * nor workers inside their building. Without `soldiers` only squad leaders count for a squad (their
 * soldiers stand in rows behind them and would push the squads far apart).
 * @param {import('../sim.js').Sim} sim
 * @param {Set<number>} exclude entity IDs
 * @returns {Set<number>} tile indices
 */
export function takenTiles(sim, exclude, soldiers = true) {
  const m = sim.map, out = new Set();
  for (const e of sim.entities.values()) {
    if (e.px === undefined || !MOBILE.has(e.kind) || exclude.has(e.id) || e.inside || e.down) continue;
    if (e.kind === 'soldier' && (!soldiers || exclude.has(e.leader))) continue;
    if (e.goal !== undefined) out.add(e.goal);
    else if (!e.path?.length) out.add(m.idx(toTile(e.px), toTile(e.py)));
  }
  return out;
}

/**
 * Walk targets for a group so that they do not stand on top of each other: grid points at spacing `spacing`
 * (tiles) around (tx,ty), from inside out, only walkable and in the same region as the centre.
 * Tiles in `taken` (other figures stand there) are skipped, so a figure sent onto an occupied tile
 * stops on the neighbouring tile instead. Assignment greedy by shortest path (pair with the smallest
 * distance first), so that the paths hardly cross. Deterministic: ties by order.
 * @param {import('../map.js').TileMap} map
 * @param {{px:number, py:number}[]} units
 * @param {Set<number>} [taken] tile indices to avoid
 * @returns {number[]} tile index per unit (same order as `units`)
 */
export function formationTiles(map, tx, ty, units, spacing = 1, taken = null) {
  const n = units.length;
  let ck = map.walkable(tx, ty) ? map.idx(tx, ty) : nearestWalkable(map, tx, ty, tileCenter(tx), tileCenter(ty), 12);
  if (ck < 0) return units.map(() => -1);
  if (n === 1 && !taken?.has(ck)) return [ck];
  const cx = ck % map.width, cy = (ck / map.width) | 0, region = map.regionAt(ck);
  /** @type {number[]} */
  const slots = [];
  for (let r = 0; slots.length < n && r <= 40; r++) {
    const ring = [];
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
      const x = cx + i * spacing, y = cy + j * spacing;
      if (!map.walkable(x, y) || map.regionAt(map.idx(x, y)) !== region || taken?.has(map.idx(x, y))) continue;
      ring.push({ k: map.idx(x, y), d: i * i + j * j });
    }
    // In the ring the round spots first (circle instead of square)
    ring.sort((a, b) => a.d - b.d || a.k - b.k);
    for (const s of ring) if (slots.length < n) slots.push(s.k);
  }
  while (slots.length < n) slots.push(ck);
  const pairs = [];
  for (let u = 0; u < n; u++) for (let s = 0; s < n; s++) {
    const k = slots[s];
    const d = (tileCenter(k % map.width) - units[u].px) ** 2 + (tileCenter((k / map.width) | 0) - units[u].py) ** 2;
    pairs.push({ u, s, d });
  }
  pairs.sort((a, b) => a.d - b.d || a.u - b.u || a.s - b.s);
  const out = new Array(n).fill(-1), used = new Uint8Array(n);
  let left = n;
  for (const p of pairs) {
    if (out[p.u] >= 0 || used[p.s]) continue;
    out[p.u] = slots[p.s]; used[p.s] = 1;
    if (!--left) break;
  }
  return out;
}
