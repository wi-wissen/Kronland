// Spatial mix (pure maths, no Web Audio): volume by distance to the camera target
// and zoom level, stereo pan by screen side. Units: tiles.
//
// You hear what happens around the screen centre – not everything that is visible: the hearing range grows with
// zoom only slowly (at medium zoom about a third of the screen width), figures at the screen edge stay silent.
// Zoomed far out, everything gets quieter. See docs/AUDIO.md#räumlicher-klang.

/** @typedef {{ x: number, z: number, dist: number, yaw: number }} Listener */

/** Hearing range in tiles for individual sounds (work, combat, events). */
export function audibleRadius(dist) { return 6 + dist * 0.3; }

/** Approximate half of the visible area in tiles (battle music, battle noise, nearby water). */
export function viewRadius(dist) { return 10 + dist * 0.8; }

/** Overall attenuation by zoom: full up to distance 15, far out only a good third. */
export function zoomGain(dist) { return Math.max(0.35, Math.min(1, 1 - (dist - 15) / 92)); }

/**
 * Volume 0…1 for a source at distance d (tiles) with camera distance dist.
 * Full in the inner quarter of the hearing range, then soft (quadratic) down to 0 at the edge.
 */
export function distanceGain(d, dist) {
  const R = audibleRadius(dist);
  if (d >= R) return 0;
  const inner = R / 4;
  const t = d <= inner ? 0 : (d - inner) / (R - inner);
  return (1 - t) * (1 - t) * zoomGain(dist);
}

/**
 * Pan −1 (left) … 1 (right): projection onto the camera's screen-right axis.
 * The right axis is (cos yaw, −sin yaw) – matching CameraRig.
 */
export function screenPan(dx, dz, dist, yaw) {
  const right = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const half = Math.max(4, dist * 0.75);
  return Math.max(-1, Math.min(1, right / half)) * 0.85;
}

/**
 * Volume and pan of a source relative to the listener; null if inaudible.
 * @param {number} x @param {number} z world position (tiles)
 * @param {Listener} l
 * @returns {{ gain: number, pan: number, d: number } | null}
 */
export function spatialize(x, z, l) {
  const dx = x - l.x, dz = z - l.z;
  const d = Math.hypot(dx, dz);
  const gain = distanceGain(d, l.dist);
  if (gain < 0.01) return null;
  return { gain, pan: screenPan(dx, dz, l.dist, l.yaw), d };
}
