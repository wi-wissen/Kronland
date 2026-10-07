// Click confirmation for walk commands: at the target a ring like the selection ring under the figures snaps
// together and flickers twice, then fades. Dark instead of the light selection colour, so it reads as "goal", not
// "selected". Work and attack targets are announced by the cursor instead. Drawn through GroundMarks (one draw call
// with the selection rings, tilted on slopes).

/** Duration of one marker in seconds. */
export const ORDER_MARKER_TIME = 0.9;
/** Ring colour: the dark outline brown of the icons and cursors. */
export const ORDER_MARKER_COLOR = 0x241a10;
const MAX = 4;
const SNAP = 0.22;

/**
 * Animation state at a given age (seconds): ring radius (tiles) and opacity; null when it is over.
 * Snaps together from a wider ring, then flickers twice (dimmer, brighter) and fades out.
 * @param {number} age
 */
export function orderMarkerPose(age) {
  if (age < 0 || age >= ORDER_MARKER_TIME) return null;
  const t = age / ORDER_MARKER_TIME;
  const s = Math.min(1, age / SNAP);
  const r = 0.4 + 0.32 * (1 - s) * (1 - s);
  let alpha = 0.9 * Math.min(1, age / 0.06);
  if (age > SNAP) alpha *= Math.floor((age - SNAP) / 0.11) % 2 ? 0.3 : 1;
  if (t > 0.75) alpha *= 1 - (t - 0.75) / 0.25;
  return { r, alpha };
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
      marks.ring(m.x, y + 0.05, m.z, r, ORDER_MARKER_COLOR, p.alpha, 0.07 * s, 0.35, sx, sz);
    }
  }
}
