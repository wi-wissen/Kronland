// Double-click/double-tap on an own figure: select all visible own figures of the same kind.
// Deliberate deviation from the model (common real-time strategy controls). Pure computation functions without DOM;
// the selection is UI state, the simulation stays untouched.

/** Second click or second tap within this time (ms) counts as a double click */
export const DOUBLE_CLICK_MS = 400;
/** … and at most this far (px) from the first (fingers never hit exactly the same spot) */
export const DOUBLE_CLICK_PX = 24;

/**
 * Is `cur` the second part of a double click after `prev`?
 * @param {{x:number,y:number,at:number}|null|undefined} prev last click
 * @param {{x:number,y:number,at:number}} cur
 */
export function isDoubleClick(prev, cur) {
  return !!prev && cur.at - prev.at >= 0 && cur.at - prev.at < DOUBLE_CLICK_MS
    && Math.hypot(cur.x - prev.x, cur.y - prev.y) <= DOUBLE_CLICK_PX;
}

/**
 * Kind of a selectable figure for "same kind":
 * serfs, militia (armed serfs) and captains per unit type (with squad) are separate kinds;
 * all heroes count as one kind (every hero is unique, so the double click selects the hero group).
 * @param {any} e Entity
 * @returns {string|null} null if no selectable figure
 */
export function sameTypeKey(e) {
  if (!e) return null;
  if (e.kind === 'unit') return e.militia ? 'militia' : 'serf';
  if (e.kind === 'leader') return 'leader:' + e.def;
  if (e.kind === 'hero') return 'hero';
  return null;
}

/**
 * Own figures of the same kind as `ref` whose screen point lies in the rectangle.
 * @param {Iterable<any>} entities all entities
 * @param {number} player own player
 * @param {any} ref clicked figure
 * @param {(e:any) => {x:number,y:number,behind?:boolean}} project figure → screen point
 * @param {{left:number,top:number,right:number,bottom:number}} rect visible map area
 * @returns {number[]} IDs (always with `ref` if it is an own figure)
 */
export function visibleSameType(entities, player, ref, project, rect) {
  const key = ref?.owner === player ? sameTypeKey(ref) : null;
  if (!key) return [];
  const out = [];
  for (const e of entities) {
    if (e.owner !== player || sameTypeKey(e) !== key) continue;
    if (e.id === ref.id) { out.push(e.id); continue; }
    const s = project(e);
    if (!s.behind && s.x >= rect.left && s.x <= rect.right && s.y >= rect.top && s.y <= rect.bottom) out.push(e.id);
  }
  return out;
}
