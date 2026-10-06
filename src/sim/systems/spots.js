// Fixed spots for resting figures.
//
// Two kinds:
// - Tile spot (`e.spot`, tile index, -1 = none): builders and repairers stand on their own tile
//   directly at the footprint (`map.ring`), centre of the tile – so they hit the wall.
// - Ring slot (`e.slot`, slot number, -1 = none): resters at the campfire, waiters in front of a building
//   and serfs at a tree or resource pile stand on an exact point of a circle around their target
//   (rings and radii: SPOTS in src/sim/data/spots.js). Slot number = ring × 72 + spot in the ring; the target
//   is `job.target` for serfs, `target` for workers. Spots on blocked tiles or in a
//   different region are dropped; if all are taken, the target counts as full.
//
// The spot is stored on the figure itself (saved and hashed with it); which spots are taken is derived
// from all figures on demand (one pass, points in a tile grid). Taken means: another
// resting figure stands closer than `SPOTS.minGap` – this holds across targets and spot kinds (two
// neighbouring trees, builders next to waiters). A spot only counts as long as the figure has the matching activity
// (serfs: `job`, workers: outside), so spots become free on withdrawal, death or abort.

import { toTile, tileCenter, idiv, isqrt, UNIT } from '../fixed.js';
import { DIR72, RING_SIZES } from '../dirs.js';
import { SPOTS } from '../data/spots.js';

const RING_STRIDE = 72;

/** Which circle table a target uses. */
export function slotUse(t) {
  if (t.kind === 'tree') return 'tree';
  if (t.kind === 'pile') return 'pile';
  if (t.kind === 'camp') return 'camp';
  return 'building';
}

/** Centre of a target in milli-tiles. */
export function centerOf(t) {
  const w = t.w ?? 1, h = t.h ?? 1;
  return { x: t.x * UNIT + idiv(w * UNIT, 2), y: t.y * UNIT + idiv(h * UNIT, 2) };
}

/** Largest divisor of 72 at which neighbouring spots on the circle are at least `spacing` apart. */
function ringSize(radius, spacing) {
  const circ = idiv(radius * 6283, 1000);
  for (const n of RING_SIZES) if (idiv(circ, n) >= spacing) return n;
  return 1;
}

/**
 * Rings around a target: [{ radius, n, shift }] (shift = offset in DIR72 steps).
 * @returns {{radius:number, n:number, shift:number}[]}
 */
export function ringsOf(t) {
  const use = slotUse(t);
  if (use !== 'building') return SPOTS[use].rings.map((r, i) => ({ radius: r.radius, n: r.slots, shift: i & 1 ? (RING_STRIDE / r.slots) >> 1 : 0 }));
  const B = SPOTS.building;
  const hd = idiv(isqrt((t.w * UNIT) ** 2 + (t.h * UNIT) ** 2), 2);
  const out = [];
  for (let i = 0; i < B.rings; i++) {
    const radius = hd + B.margin + i * B.gap, n = ringSize(radius, B.spacing);
    out.push({ radius, n, shift: i & 1 ? (RING_STRIDE / n) >> 1 : 0 });
  }
  return out;
}

/** Point of a ring slot (without a walkability check) or null for an invalid number. */
export function slotPoint(t, slot, rings = ringsOf(t)) {
  if (slot < 0) return null;
  const r = rings[(slot / RING_STRIDE) | 0], k = slot % RING_STRIDE;
  if (!r || k >= r.n) return null;
  const c = centerOf(t), v = DIR72[(k * (RING_STRIDE / r.n) + r.shift) % RING_STRIDE];
  return { x: c.x + idiv(v.x * r.radius, 1000), y: c.y + idiv(v.y * r.radius, 1000) };
}

/**
 * All usable ring slots of a target: point on a walkable tile (and in region `region`, if
 * given), ring by ring from inside out.
 * @returns {{slot:number, x:number, y:number, k:number}[]}
 */
export function slotPoints(map, t, region = 0) {
  const rings = ringsOf(t), out = [];
  for (let r = 0; r < rings.length; r++) {
    for (let i = 0; i < rings[r].n; i++) {
      const slot = r * RING_STRIDE + i, p = slotPoint(t, slot, rings);
      const tx = toTile(p.x), ty = toTile(p.y);
      if (!map.walkable(tx, ty)) continue;
      const k = map.idx(tx, ty);
      if (region && map.regionAt(k) !== region) continue;
      out.push({ slot, x: p.x, y: p.y, k });
    }
  }
  return out;
}

/** Target of a figure's ring slot (serf: mining target, worker: walk target). */
function slotTarget(sim, e) {
  if (e.kind === 'unit') return e.job?.kind === 'gather' && !e.militia ? sim.entities.get(e.job.target) : null;
  if (e.kind === 'worker') return e.inside ? null : sim.entities.get(e.target);
  return null;
}

/** Tile that a figure currently holds as a tile spot, otherwise -1. */
export function heldSpot(e) {
  if (e.spot === undefined || e.spot < 0) return -1;
  if (e.kind === 'unit') return e.job && !e.militia ? e.spot : -1;
  return -1;
}

/** Point where a figure currently rests (tile or ring slot), otherwise null. */
export function heldPoint(sim, e) {
  if (e.slot !== undefined && e.slot >= 0) {
    const t = slotTarget(sim, e);
    if (t) return slotPoint(t, e.slot);
  }
  const k = heldSpot(e);
  if (k < 0) return null;
  const w = sim.map.width;
  return { x: tileCenter(k % w), y: tileCenter((k / w) | 0) };
}

/** Taken spots as points in a tile grid; query "does anyone stand closer than minGap?". */
export class Occupancy {
  constructor(width) { this.width = width; this.cells = new Map(); }
  add(x, y) {
    const k = toTile(y) * this.width + toTile(x);
    const c = this.cells.get(k);
    if (c) c.push(x, y); else this.cells.set(k, [x, y]);
  }
  /** Does a taken point lie closer than `gap` to (x,y)? (gap at most one tile) */
  near(x, y, gap = SPOTS.minGap) {
    const tx = toTile(x), ty = toTile(y), g2 = gap * gap;
    for (let j = ty - 1; j <= ty + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
      const c = this.cells.get(j * this.width + i);
      if (!c) continue;
      for (let n = 0; n < c.length; n += 2) if ((c[n] - x) ** 2 + (c[n + 1] - y) ** 2 < g2) return true;
    }
    return false;
  }
}

/**
 * All taken spots (except those of figure `exceptId`).
 * @returns {Occupancy}
 */
export function takenSpots(sim, exceptId = 0) {
  const out = new Occupancy(sim.map.width);
  for (const e of sim.entities.values()) {
    if (e.id === exceptId || (e.kind !== 'unit' && e.kind !== 'worker')) continue;
    const p = heldPoint(sim, e);
    if (p) out.add(p.x, p.y);
  }
  return out;
}

/** Region in which a figure stands (0 = unknown, e.g. on a blocked tile). */
export function regionOf(map, e) {
  const tx = toTile(e.px), ty = toTile(e.py);
  return map.walkable(tx, ty) ? map.regionAt(map.idx(tx, ty)) : 0;
}

/** Free tile spots from `tiles` (not taken, in region `region`, if given). */
export function freeSpots(map, tiles, taken, region = 0) {
  return tiles.filter((k) => !taken.near(tileCenter(k % map.width), tileCenter((k / map.width) | 0)) && (!region || map.regionAt(k) === region));
}

/**
 * Choose a tile spot for figure `e` from the tiles `tiles`: the previous one if it belongs, otherwise the
 * nearest free one in its own region (tie: smaller tile index – deterministic).
 * @param {number[]} tiles walkable tiles around the target (e.g. `map.ring(...)`)
 * @param {Occupancy} [taken] taken spots (without those of the figure itself)
 * @returns {number} tile index or -1 if everything is taken
 */
export function pickSpot(sim, e, tiles, taken = takenSpots(sim, e.id)) {
  const m = sim.map, w = m.width;
  if (e.spot >= 0 && tiles.includes(e.spot) && !taken.near(tileCenter(e.spot % w), tileCenter((e.spot / w) | 0))) return e.spot;
  const free = freeSpots(m, tiles, taken, regionOf(m, e));
  let best = -1, bd = Infinity;
  for (const k of free) {
    const dx = tileCenter(k % w) - e.px, dy = tileCenter((k / w) | 0) - e.py;
    const d = dx * dx + dy * dy;
    if (d < bd || (d === bd && k < best)) { bd = d; best = k; }
  }
  return best;
}

/** Free ring slots around `t` (in region `region`, if given). */
export function freeSlots(map, t, taken, region = 0) {
  return slotPoints(map, t, region).filter((p) => !taken.near(p.x, p.y));
}

/**
 * Choose a ring slot for figure `e` around the target `t`: `keep` (the previous one) if it is still usable and free;
 * otherwise in the innermost ring with a free spot the one nearest to `e` – i.e. the one in the direction
 * `e` comes from, or the nearest free one next to it (tie: smaller slot number – deterministic).
 * @param {Occupancy} [taken] taken spots (without those of the figure itself)
 * @returns {number} slot number or -1 if everything is taken
 */
export function pickSlot(sim, e, t, keep = -1, taken = takenSpots(sim, e.id)) {
  const pts = freeSlots(sim.map, t, taken, regionOf(sim.map, e));
  if (keep >= 0 && pts.some((p) => p.slot === keep)) return keep;
  let best = -1, bd = Infinity, ring = -1;
  for (const p of pts) {
    const r = (p.slot / RING_STRIDE) | 0;
    if (ring >= 0 && r !== ring) break; // only the innermost ring with a free spot
    ring = r;
    const d = (p.x - e.px) ** 2 + (p.y - e.py) ** 2;
    if (d < bd) { bd = d; best = p.slot; }
  }
  return best;
}

/** Tile of a ring slot if its point is (still) walkable, otherwise -1. */
export function slotTile(map, p) {
  const tx = toTile(p.x), ty = toTile(p.y);
  return map.walkable(tx, ty) ? map.idx(tx, ty) : -1;
}

/**
 * Last stretch to the exact spot: straight ahead within the slot's tile (the figure already stands in it,
 * the path ends at the tile centre). Returns true as soon as the figure stands exactly on the point.
 */
export function stepToPoint(e, p, speed) {
  const dx = p.x - e.px, dy = p.y - e.py;
  if (!dx && !dy) return true;
  const d = isqrt(dx * dx + dy * dy);
  if (d <= speed) { e.px = p.x; e.py = p.y; return true; }
  e.px += idiv(dx * speed, d); e.py += idiv(dy * speed, d);
  return false;
}
