// Edge scrolling decision (pure, testable: tests/game/edgeScroll.test.js).
// The mouse pushes the camera when it rests in a thin strip at the edge of the game area. A strip only counts
// when the pointer got there "on purpose" from inside the map:
//   - not while a button is held or while a drag started outside the game area is running (e.g. the code
//     panel divider, which sits right at the game area's edge),
//   - not when the pointer comes into the strip straight from a UI element outside the game area (code
//     panel, divider) or is released there after such a drag – it has to visit the map once first (re-arm).

/** Width of the edge strip (px) in which the mouse pushes the camera */
export const EDGE_PX = 6;

/**
 * @typedef {object} PointerSample
 * @property {number} x clientX
 * @property {number} y clientY
 * @property {number} buttons pressed buttons
 * @property {boolean} inGame pointer over the game area (canvas or HUD on top of it), not over panels beside it
 * @property {boolean} [uiDrag] a press started outside the game area is still held
 */

/**
 * Direction of the edge strip at (x, y) inside the rectangle r (game canvas), clipped to the window.
 * @param {number} x @param {number} y
 * @param {{left:number, top:number, right:number, bottom:number}} r
 * @param {number} W window width @param {number} H window height
 * @returns {[number, number]} camera push direction, [0, 0] = not in a strip (or outside r)
 */
export function edgeDir(x, y, r, W, H, px = EDGE_PX) {
  if (!(x >= r.left && x < r.right && y >= r.top && y < r.bottom)) return [0, 0];
  let dx = 0, dy = 0;
  if (x <= r.left + px) dx = 1; else if (x >= Math.min(W, r.right) - 1 - px) dx = -1;
  if (y <= r.top + px) dy = 1; else if (y >= Math.min(H, r.bottom) - 1 - px) dy = -1;
  return [dx, dy];
}

/**
 * Whether edge scrolling is armed after the pointer moved from prev to cur.
 * @param {boolean} armed state before
 * @param {PointerSample|null} prev previous sample (null: pointer came from outside the window)
 * @param {PointerSample|null} cur new sample (null: pointer left the window)
 * @param {{left:number, top:number, right:number, bottom:number}} r game canvas rectangle
 * @param {number} W @param {number} H
 */
export function nextArmed(armed, prev, cur, r, W, H) {
  if (!cur) return armed;
  if (cur.uiDrag) return false;
  if (!cur.inGame) return armed;
  // entered the game area from a panel beside it (or released there after a UI drag): wait for the map
  const entered = !!prev && (!prev.inGame || !!prev.uiDrag);
  const [dx, dy] = edgeDir(cur.x, cur.y, r, W, H);
  if (!dx && !dy) return true;
  return armed && !entered;
}

/**
 * Edge scroll direction for the current pointer state.
 * @param {PointerSample|null} m last pointer sample
 * @param {boolean} armed see nextArmed
 * @param {{left:number, top:number, right:number, bottom:number}} r @param {number} W @param {number} H
 * @returns {[number, number]}
 */
export function edgeScrollDir(m, armed, r, W, H) {
  if (!m || !armed || m.buttons || m.uiDrag || !m.inGame) return [0, 0];
  return edgeDir(m.x, m.y, r, W, H);
}
