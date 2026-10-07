// Click confirmation for walk commands: at the target a ring like the selection ring under the figures spreads out
// once, like a drop falling into water, and fades. Dark instead of the light selection colour, so it reads as "goal",
// not "selected". Work and attack targets are announced by the cursor instead. Drawn through GroundMarks (one draw
// call with the selection rings, tilted on slopes).

/** Duration of one marker in seconds. */
export const ORDER_MARKER_TIME = 0.45;
/** Ring colour: the dark outline brown of the icons and cursors. */
export const ORDER_MARKER_COLOR = 0x241a10;
const MAX = 4;

/**
 * Animation state at a given age (seconds): ring radius (tiles) and opacity; null when it is over.
 * Grows outwards with an easing out and fades evenly.
 * @param {number} age
 */
export function orderMarkerPose(age) {
  if (age < 0 || age >= ORDER_MARKER_TIME) return null;
  const t = age / ORDER_MARKER_TIME;
  return { r: 0.15 + 0.5 * (1 - (1 - t) ** 2), alpha: 0.9 * (1 - t) };
}

/** Size factor by camera distance: when zoomed out the ring stays readable. */
export function orderMarkerScale(dist) { return Math.max(1, Math.min(2.4, dist / 26)); }

export class OrderMarkers {
  constructor() {
    /** @type {{ age: number, x: number, z: number }[]} */
    this.list = [];
  }

  /** Number of running markers. */
  get active() { return this.list.length; }

  /**
   * Start a marker at a walk target. A second one at the same spot in the same moment (army and serfs) is dropped;
   * with many quick clicks the oldest goes.
   * @param {number} x @param {number} z world coordinates (tiles)
   */
  add(x, z) {
    if (this.list.some((m) => m.age < 0.15 && Math.hypot(m.x - x, m.z - z) < 0.8)) return;
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ age: 0, x, z });
  }

  /**
   * Advance and draw the rings.
   * @param {number} dt seconds @param {number} dist camera distance
   * @param {{ ring: Function }} marks GroundMarks (between begin and end of the frame)
   * @param {(x:number, z:number) => number} groundY
   */
  update(dt, dist, marks, groundY) {
    const s = orderMarkerScale(dist);
    this.list = this.list.filter((m) => (m.age += dt) < ORDER_MARKER_TIME);
    for (const m of this.list) {
      const p = orderMarkerPose(m.age);
      if (!p || p.alpha <= 0) continue;
      const r = p.r * s, y = groundY(m.x, m.z);
      // slope from the height field over the ring diameter, like the selection rings
      const sx = (groundY(m.x + r, m.z) - groundY(m.x - r, m.z)) / (2 * r);
      const sz = (groundY(m.x, m.z + r) - groundY(m.x, m.z - r)) / (2 * r);
      marks.ring(m.x, y + 0.05, m.z, r, ORDER_MARKER_COLOR, p.alpha, 0.07 * s, 0, sx, sz);
    }
  }
}
