// Building on slopes: the terrain under a new construction site is levelled in the simulation's
// height data (permanently, also after demolition/destruction). Rules and sources: docs/SPIELREGELN.md §6a.
//
// - Target height: rounded mean of the tiles under the footprint (integer, cm).
// - Transition border: one tile all around; edge neighbours move halfway, corner neighbours a quarter towards the target height.
// - The border leaves water, cliffs, occupied (buildings, trees, piles) and reserved tiles
//   (settlement spots, shafts) unchanged: the neighbours' foundations and their levels stay untouched.
// - Flags (water, cliff) never change; walkability and pathfinding therefore stay the same.

import { WATER, OCCUPIED, RESERVED, CLIFF } from '../map.js';

/** Tiles of the transition border that levelling does not change. */
export const KEEP = WATER | OCCUPIED | RESERVED | CLIFF;

/**
 * Target height of the plane: rounded mean of the footprint (halves round up).
 * @param {import('../map.js').TileMap} map
 * @returns {number}
 */
export function padHeight(map, x, y, w, h) {
  let sum = 0, n = 0;
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { sum += map.heights[map.idx(i, j)]; n++; }
  return Math.floor((2 * sum + n) / (2 * n));
}

/**
 * Preview for the build preview (without changing anything).
 * @param {import('../map.js').TileMap} map
 * @returns {{ target:number, slope:number, maxCut:number }} target height, height difference of the area,
 *   largest deviation of a tile from the plane (cm; 0 = already level)
 */
export function padPreview(map, x, y, w, h) {
  const target = padHeight(map, x, y, w, h);
  let maxCut = 0;
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    maxCut = Math.max(maxCut, Math.abs(map.heights[map.idx(i, j)] - target));
  }
  return { target, slope: map.slope(x, y, w, h), maxCut };
}

/**
 * Level the area. Called by the simulation when a building is placed (before the area is occupied).
 * Reports changed regions as the event `terrainChanged` (rectangle in tiles) for the rendering.
 * @param {import('../sim.js').Sim} sim
 * @returns {boolean} whether a height changed
 */
export function levelSite(sim, x, y, w, h) {
  const map = sim.map, H = map.heights, F = map.flags;
  const target = padHeight(map, x, y, w, h);
  let changed = false;
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    const k = map.idx(i, j);
    if (H[k] !== target) { H[k] = target; changed = true; }
  }
  for (let j = y - 1; j <= y + h; j++) for (let i = x - 1; i <= x + w; i++) {
    if (i >= x && i < x + w && j >= y && j < y + h) continue;
    if (!map.inBounds(i, j)) continue;
    const k = map.idx(i, j);
    if (F[k] & KEEP) continue;
    const corner = (i < x || i >= x + w) && (j < y || j >= y + h);
    const d = target - H[k];
    const step = corner ? Math.trunc(d / 4) : Math.trunc(d / 2);
    if (step) { H[k] += step; changed = true; }
  }
  if (changed) {
    map.heightVersion++;
    sim.events.push({ type: 'terrainChanged', x: x - 1, y: y - 1, w: w + 2, h: h + 2 });
  }
  return changed;
}
