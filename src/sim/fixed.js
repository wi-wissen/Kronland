// Integer maths for the simulation.
// Positions are stored in milli-tiles: 1 tile = 1000 units.

export const UNIT = 1000;
export const HALF = 500;
export const TICKS_PER_SECOND = 10;

/** Convert seconds to ticks. @param {number} s */
export const secondsToTicks = (s) => Math.round(s * TICKS_PER_SECOND);

/**
 * Integer square root (rounded down). Math.sqrt is exact per IEEE 754,
 * the correction additionally secures the result for large values.
 * @param {number} n non-negative integer
 */
export function isqrt(n) {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

/** Distance between two points, integer. */
export function dist(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return isqrt(dx * dx + dy * dy);
}

/** Integer division truncating towards 0. */
export const idiv = (a, b) => Math.trunc(a / b);

/** Tile centre in milli-tiles. */
export const tileCenter = (t) => t * UNIT + HALF;

/** Milli-tiles to tile coordinate. */
export const toTile = (m) => Math.floor(m / UNIT);
