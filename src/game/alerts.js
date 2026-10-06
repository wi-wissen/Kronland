// Attack notices for the minimap: places where something of the player's own is currently attacked (pure rendering).

/** A place pulses this long after the last hit (ms) */
export const ALERT_MS = 8000;
/** Hits closer than this many tiles to an existing place belong to it */
export const ALERT_RADIUS = 12;

/**
 * Record hits at pos: refresh a nearby place, otherwise create a new one; expired ones drop out.
 * @param {{ x: number, y: number, last: number }[]} list @param {{ x: number, y: number }} pos @param {number} now
 * @returns {{ x: number, y: number, last: number }[]}
 */
export function noteAlert(list, pos, now) {
  const out = activeAlerts(list, now);
  const near = out.find((a) => Math.hypot(a.x - pos.x, a.y - pos.y) < ALERT_RADIUS);
  if (near) near.last = now;
  else out.push({ x: pos.x, y: pos.y, last: now });
  return out;
}

/** Places that are still pulsing. */
export const activeAlerts = (list, now) => (list ?? []).filter((a) => now - a.last < ALERT_MS);
