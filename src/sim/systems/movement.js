// Shared movement for serfs, workers and later soldiers.

import { findPath } from '../pathfinding.js';
import { idiv, isqrt, tileCenter, toTile } from '../fixed.js';

/**
 * One tick of movement along `e.path`. Returns true when the path is finished.
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

/** Is the unit directly at a rectangle (or inside it)? */
export function isAdjacent(e, r) {
  const tx = toTile(e.px), ty = toTile(e.py);
  return tx >= r.x - 1 && tx <= r.x + r.w && ty >= r.y - 1 && ty <= r.y + r.h;
}
