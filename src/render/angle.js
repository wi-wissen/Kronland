// Angle helpers for rendering.

const TAU = 2 * Math.PI;

/**
 * Bring an angle into (−π, π] – without a loop: an infinite or huge value (e.g. from a broken
 * view direction) used to hang `while (d > π) d -= 2π` forever, and with it the whole frame.
 * Non-finite values yield 0.
 * @param {number} a
 */
export function wrapAngle(a) {
  if (!Number.isFinite(a)) return 0;
  let d = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (d === -Math.PI) d = Math.PI;
  return d;
}
