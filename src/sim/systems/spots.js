// Fixed spots for resting figures: whoever builds, repairs, fells wood, mines a pile, waits in front of a
// building or rests at the campfire occupies a tile of their own around their target (`e.spot`,
// tile index, -1 = none). Two figures never stand on the same tile; if everything around is
// taken, the target counts as full.
//
// The spot is stored on the figure itself (saved and hashed with it); which spots are taken
// is derived from all figures on demand. A spot only counts as long as the figure has the
// matching activity (serfs: `job`), so spots become free on withdrawal, death or abort.

import { toTile, tileCenter } from '../fixed.js';

/** Tile that a figure currently holds as its spot, otherwise -1. */
export function heldSpot(e) {
  if (e.spot === undefined || e.spot < 0) return -1;
  if (e.kind === 'unit') return e.job && !e.militia ? e.spot : -1;
  if (e.kind === 'worker') return e.inside ? -1 : e.spot;
  return -1;
}

/**
 * All taken spots (except those of figure `exceptId`).
 * @returns {Set<number>}
 */
export function takenSpots(sim, exceptId = 0) {
  const out = new Set();
  for (const e of sim.entities.values()) {
    if (e.id === exceptId) continue;
    const k = heldSpot(e);
    if (k >= 0) out.add(k);
  }
  return out;
}

/** Region in which a figure stands (0 = unknown, e.g. on a blocked tile). */
export function regionOf(map, e) {
  const tx = toTile(e.px), ty = toTile(e.py);
  return map.walkable(tx, ty) ? map.regionAt(map.idx(tx, ty)) : 0;
}

/** Free spots from `tiles` (walkable, not taken, in region `region` if given). */
export function freeSpots(map, tiles, taken, region = 0) {
  return tiles.filter((k) => !taken.has(k) && (!region || map.regionAt(k) === region));
}

/**
 * Choose a spot for figure `e` from the tiles `tiles`: the previous one if it belongs, otherwise the
 * nearest free one in its own region (tie: smaller tile index – deterministic).
 * @param {number[]} tiles walkable tiles around the target (e.g. `map.ring(...)`)
 * @param {Set<number>} [taken] taken spots (without the figure's own)
 * @returns {number} tile index or -1 if everything is taken
 */
export function pickSpot(sim, e, tiles, taken = takenSpots(sim, e.id)) {
  const m = sim.map;
  if (e.spot >= 0 && tiles.includes(e.spot) && !taken.has(e.spot)) return e.spot;
  const free = freeSpots(m, tiles, taken, regionOf(m, e));
  let best = -1, bd = Infinity;
  for (const k of free) {
    const dx = tileCenter(k % m.width) - e.px, dy = tileCenter((k / m.width) | 0) - e.py;
    const d = dx * dx + dy * dy;
    if (d < bd || (d === bd && k < best)) { bd = d; best = k; }
  }
  return best;
}
