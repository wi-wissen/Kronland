// Selection box (left drag): screen rectangle and which own figures it catches. Pure functions without DOM;
// the selection is UI state, the simulation stays untouched.

/**
 * Normalised screen rectangle between the drag start (sx, sy) and the pointer (x, y).
 * @returns {{left:number,top:number,right:number,bottom:number,width:number,height:number}}
 */
export function dragRect(sx, sy, x, y) {
  const left = Math.min(sx, x), top = Math.min(sy, y), right = Math.max(sx, x), bottom = Math.max(sy, y);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/** Can the box catch this entity? Own serfs (also militia), captains and heroes. */
export function boxSelectable(e, player) {
  return (e.kind === 'unit' || e.kind === 'leader' || e.kind === 'hero') && e.owner === player;
}

/**
 * Own figures whose screen point lies in the rectangle (edges included). `project` is called only for
 * figures the box can catch, so foreign figures, soldiers and buildings cost nothing.
 * @param {Iterable<any>} entities all entities
 * @param {number} player own player
 * @param {(e:any) => {x:number,y:number,behind?:boolean}} project figure → screen point
 * @param {{left:number,top:number,right:number,bottom:number}} rect
 * @returns {number[]} IDs
 */
export function unitsInBox(entities, player, project, rect) {
  const out = [];
  for (const e of entities) {
    if (!boxSelectable(e, player)) continue;
    const s = project(e);
    if (!s.behind && s.x >= rect.left && s.x <= rect.right && s.y >= rect.top && s.y <= rect.bottom) out.push(e.id);
  }
  return out;
}
