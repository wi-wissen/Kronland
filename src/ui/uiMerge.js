// Adopt UI state without redrawing everything: the engine delivers a fresh state every 200 ms.
// If it were replaced as a whole, Vue would redraw the complete UI every time (noticeable
// stutter when moving the camera, especially on phones). Only changed parts are replaced.

/** Deep comparison for simple data (objects, arrays, numbers, strings). Anything else counts as changed. */
export function sameData(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Number.isNaN(a) && Number.isNaN(b);
  const arr = Array.isArray(a);
  if (arr !== Array.isArray(b)) return false;
  if (arr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameData(a[i], b[i])) return false;
    return true;
  }
  const pa = Object.getPrototypeOf(a), pb = Object.getPrototypeOf(b);
  if ((pa !== Object.prototype && pa !== null) || (pb !== Object.prototype && pb !== null)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!(k in b) || !sameData(a[k], b[k])) return false;
  return true;
}

/**
 * Adopt changed keys of `next` into `target` (top level).
 * @param {Record<string, any>} target reactive object (assignment triggers an update)
 * @param {Record<string, any>} raw the same object without proxy (for the fast comparison)
 * @param {Record<string, any>} next new state
 * @returns {number} number of changed keys
 */
export function mergeUi(target, raw, next) {
  let n = 0;
  for (const k of Object.keys(next)) {
    if (sameData(raw[k], next[k])) continue;
    target[k] = next[k];
    n++;
  }
  return n;
}
