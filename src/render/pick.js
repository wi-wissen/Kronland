// Picking figures in screen space: which drawn figure is under the pointer?
// Pure arithmetic without three.js and DOM (Vitest); the renderer projects the foot and head point of each
// figure and passes them in here.

/** Minimum pick radius in px around the figure axis (mouse) … */
export const PICK_MIN_PX = 9;
/** … and for touch (fingers are imprecise) */
export const PICK_MIN_TOUCH_PX = 16;
/** Pick radius as a fraction of the figure's screen height (about half the body width) … */
export const PICK_WIDTH = 0.32;
/** … but never more than this many px (not even when very close) */
export const PICK_MAX_PX = 64;

/**
 * Is a projected point (normalized device coordinates, z from three.js `Vector3.project`) between the
 * near and far clipping plane? Points behind the camera have z > 1, points between the camera and the near
 * clipping plane z < −1 – there the projection yields huge, meaningless screen coordinates.
 * @param {number} z
 */
export function inDepth(z) { return Number.isFinite(z) && z >= -1 && z <= 1; }

/**
 * Screen distance of the pointer from a figure, or Infinity if it is not hit.
 * A figure is only hit if it was drawn in this frame, its foot and head point are in the
 * view volume, the hit axis point is on screen and the pointer touches it within the
 * pick radius.
 * @param {{ ax:number, ay:number, az:number, bx:number, by:number, bz:number, drawn:boolean }} f
 *   foot (a) and head (b) in px relative to the canvas, z in NDC; drawn = drawn in this frame
 * @param {number} px pointer x (px, relative to the canvas) @param {number} py
 * @param {{ width:number, height:number, touch?:boolean }} view canvas size
 * @returns {number}
 */
export function figurePickDistance(f, px, py, view) {
  if (!f.drawn || !inDepth(f.az) || !inDepth(f.bz)) return Infinity;
  const dx = f.bx - f.ax, dy = f.by - f.ay, L2 = dx * dx + dy * dy;
  const len = Math.sqrt(L2);
  // A figure is never larger than the screen (otherwise the projection is wrong)
  if (!(len <= 2 * Math.max(view.width, view.height))) return Infinity;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - f.ax) * dx + (py - f.ay) * dy) / L2)) : 0;
  const qx = f.ax + dx * t, qy = f.ay + dy * t;
  // the hit point of the figure must be on screen (nothing outside the screen can be selected)
  if (qx < 0 || qy < 0 || qx > view.width || qy > view.height) return Infinity;
  const d = Math.hypot(qx - px, qy - py);
  const radius = Math.min(PICK_MAX_PX, Math.max(view.touch ? PICK_MIN_TOUCH_PX : PICK_MIN_PX, len * PICK_WIDTH));
  return d <= radius ? d : Infinity;
}

/**
 * Figure under the pointer: the one hit closest to the pointer (in groups otherwise always the frontmost, e.g. a
 * soldier in front of the hero); at equal distance the front one.
 * @template {{ ax:number, ay:number, az:number, bx:number, by:number, bz:number, drawn:boolean }} F
 * @param {Iterable<F>} figures
 * @param {number} px @param {number} py
 * @param {{ width:number, height:number, touch?:boolean }} view
 * @returns {F|null}
 */
export function pickFigure(figures, px, py, view) {
  let best = null, bestScore = Infinity;
  for (const f of figures) {
    const d = figurePickDistance(f, px, py, view);
    if (d === Infinity) continue;
    const score = d + f.az * 1e-3;
    if (score < bestScore) { bestScore = score; best = f; }
  }
  return best;
}
