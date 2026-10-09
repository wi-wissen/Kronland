// Rendering only: figures that come close to each other step aside a little, so that they do not walk
// through each other or stand inside each other. The simulation stays untouched (positions, speed);
// only the drawn position gets a small, softly faded offset on top of the jitter (jitter.js).
// Walking figures keep to the right of each other, standing ones are pushed apart.

/** Distance in tiles below which two figures push each other apart. */
export const SEP_RADIUS = 0.42;
/** Maximum offset in tiles. */
export const SEP_MAX = 0.26;
/** How fast the offset follows its target (per second). */
export const SEP_RATE = 5;

/**
 * @typedef {{id:number, x:number, z:number, vx:number, vz:number, w:number}} SepPoint
 * x,z drawn position without separation (tiles); vx,vz walking direction (0 when standing);
 * w 0…1 how much the figure may be shifted (0 = exact position, e.g. at work)
 */

/**
 * Update the smoothed offsets `off` (per figure ID, in tiles) for this frame. Neighbours via a coarse grid,
 * so cost O(n). Figures missing from `points` fade out and are removed.
 * @param {SepPoint[]} points
 * @param {Map<number, {dx:number, dz:number}>} off updated in place
 * @param {number} dt seconds since the last frame
 */
export function updateSeparation(points, off, dt) {
  const n = points.length, R = SEP_RADIUS;
  const tx = new Float32Array(n), tz = new Float32Array(n);
  /** @type {Map<number, number[]>} */
  const grid = new Map();
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  for (let i = 0; i < n; i++) {
    const p = points[i], k = key(Math.floor(p.x / R), Math.floor(p.z / R));
    const c = grid.get(k);
    if (c) c.push(i); else grid.set(k, [i]);
  }
  for (let i = 0; i < n; i++) {
    const a = points[i], cx = Math.floor(a.x / R), cz = Math.floor(a.z / R);
    for (let gz = cz - 1; gz <= cz + 1; gz++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      const cell = grid.get(key(gx, gz));
      if (cell) for (const j of cell) if (j > i) push(points, i, j, tx, tz);
    }
  }
  const f = Math.min(1, dt * SEP_RATE), seen = new Set();
  for (let i = 0; i < n; i++) {
    const id = points[i].id;
    seen.add(id);
    let gx = tx[i], gz = tz[i];
    const len = Math.hypot(gx, gz);
    if (len > SEP_MAX) { gx *= SEP_MAX / len; gz *= SEP_MAX / len; }
    const o = off.get(id) ?? { dx: 0, dz: 0 };
    o.dx += (gx - o.dx) * f; o.dz += (gz - o.dz) * f;
    if (Math.abs(o.dx) + Math.abs(o.dz) < 1e-3 && !gx && !gz) off.delete(id); else off.set(id, o);
  }
  for (const [id, o] of off) {
    if (seen.has(id)) continue;
    o.dx -= o.dx * f; o.dz -= o.dz * f;
    if (Math.abs(o.dx) + Math.abs(o.dz) < 1e-3) off.delete(id);
  }
}

/** Target offset for the pair (i, j), added to tx/tz. */
function push(points, i, j, tx, tz) {
  const a = points[i], b = points[j];
  const wsum = a.w + b.w;
  if (wsum <= 0) return;
  let ux = a.x - b.x, uz = a.z - b.z;
  let d = Math.hypot(ux, uz);
  if (d >= SEP_RADIUS) return;
  if (d < 1e-4) {
    // exactly on top of each other: a fixed direction per pair
    const ang = ((a.id * 31 + b.id * 17) % 64) / 64 * Math.PI * 2;
    ux = Math.cos(ang); uz = Math.sin(ang); d = 0;
  } else { ux /= d; uz /= d; }
  const s = (SEP_RADIUS - d) / SEP_RADIUS * SEP_MAX * 2;
  side(a, -ux, -uz, ux, uz, s * a.w / wsum, tx, tz, i);
  side(b, ux, uz, -ux, -uz, s * b.w / wsum, tx, tz, j);
}

/**
 * Offset of one figure away from its neighbour (direction `away`). A walking figure also steps sideways
 * (to the side where the neighbour is not; head-on to its right), so that two passing figures sidestep.
 */
function side(p, tox, toz, awx, awz, s, tx, tz, i) {
  if (s <= 0) return;
  let dx = awx, dz = awz;
  const v = Math.hypot(p.vx, p.vz);
  if (v > 1e-6) {
    const vx = p.vx / v, vz = p.vz / v;
    // right-hand side of the walking direction (x right, z down on the map)
    let rx = -vz, rz = vx;
    // neighbour clearly on the right: step to the left instead (head-on both keep right and pass each other)
    if (rx * tox + rz * toz > 0.05) { rx = -rx; rz = -rz; }
    // mostly sideways (do not slow down or speed up visibly along the path)
    const along = dx * vx + dz * vz;
    dx = (dx - along * vx) * 0.4 + rx; dz = (dz - along * vz) * 0.4 + rz;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
  }
  tx[i] += dx * s; tz[i] += dz * s;
}
