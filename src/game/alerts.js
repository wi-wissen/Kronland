// Attack notices for the minimap: places where something of the player's own is currently attacked (pure rendering).

/** A place pulses this long after the last hit (ms) */
export const ALERT_MS = 8000;
/** Hits closer than this many tiles to an existing place belong to it */
export const ALERT_RADIUS = 12;

let seq = 0;

/**
 * @typedef {{ id: number, x: number, y: number, first: number, last: number, info: any, muted?: boolean }} Alert
 * `info`: what is hit there (notices.attackInfo, with rank); the place keeps the highest-ranking target.
 */

/**
 * Record hits at pos: refresh a nearby place, otherwise create a new one; expired ones drop out.
 * The same list feeds the persistent notice "Angriff …" (notices.attackNotices): it stays until no hit has come for ALERT_MS.
 * @param {Alert[]} list @param {{ x: number, y: number }} pos @param {number} now @param {any} [info]
 * @returns {Alert[]}
 */
export function noteAlert(list, pos, now, info = null) {
  const out = activeAlerts(list, now);
  const near = out.find((a) => Math.hypot(a.x - pos.x, a.y - pos.y) < ALERT_RADIUS);
  if (near) {
    near.last = now;
    if (info && (!near.info || info.rank >= near.info.rank)) near.info = info;
  } else out.push({ id: ++seq, x: pos.x, y: pos.y, first: now, last: now, info });
  return out;
}

/** Places that are still pulsing. */
export const activeAlerts = (list, now) => (list ?? []).filter((a) => now - a.last < ALERT_MS);
