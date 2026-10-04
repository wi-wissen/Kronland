// Two-finger gestures: which gesture is meant? Pure computation functions (no DOM), modelled on MapLibre.

/** Movement (px) after which it is settled whether zooming/rotating or tilting is happening */
export const MODE_PX = 10;
/** Rotating only begins once the fingers have turned this far (px) on their circle (MapLibre: 25) */
export const ROTATE_PX = 25;

/** Angle to −π…π */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Kind of two-finger gesture from the movement of both fingers since the gesture began.
 * Tilt only if both fingers slide vertically in the same direction and their distance stays almost the same;
 * otherwise zoom/pan/rotate. As long as hardly anything has moved: still open (null).
 * @param {{x:number,y:number}} va path of finger A @param {{x:number,y:number}} vb path of finger B
 * @param {number} spread change of the finger distance (px)
 * @returns {'tilt'|'zoom'|null}
 */
export function pinchMode(va, vb, spread) {
  const moved = Math.max(Math.hypot(va.x, va.y), Math.hypot(vb.x, vb.y));
  if (moved < MODE_PX) return null;
  const vertical = (v) => Math.abs(v.y) > Math.abs(v.x);
  return vertical(va) && vertical(vb) && va.y * vb.y > 0 && Math.abs(spread) < moved * 0.5 ? 'tilt' : 'zoom';
}

/**
 * Have the fingers turned far enough for rotating to begin? (path on the finger circle ≥ ROTATE_PX)
 * @param {number} twist rotation so far (rad) @param {number} diameter smallest finger distance (px)
 */
export const twistUnlocked = (twist, diameter) => (Math.abs(twist) * diameter) / 2 >= ROTATE_PX;
