// Click confirmation for walk commands: a painted marker of arrows swirling inwards (scripts/art/, job "walkmark")
// lies on the ground at the target, turns, contracts into the spot and fades. Always the same, small; work and
// attack targets are announced by the cursor instead. A small pool of decals.

import * as THREE from 'three';

/** Duration of one marker in seconds. */
export const ORDER_MARKER_TIME = 0.8;
const POOL = 4;
/** Picture of the marker (logical path below the site root). */
export const WALKMARK_IMAGE = 'icons/walkmark.webp';

/**
 * Animation state at a given age (seconds): radius (tiles), turn (radians, clockwise from above) and opacity;
 * null when it is over. Quickly there, then it contracts and fades.
 * @param {number} age
 */
export function orderMarkerPose(age) {
  if (age < 0 || age >= ORDER_MARKER_TIME) return null;
  const t = age / ORDER_MARKER_TIME;
  return {
    r: 0.62 - 0.34 * t * t,
    turn: -2.4 * t,
    alpha: Math.min(1, t / 0.12) * (t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1),
  };
}

/** Size factor by camera distance: when zoomed out the marker stays readable. */
export function orderMarkerScale(dist) { return Math.max(0.8, Math.min(2.4, dist / 24)); }

export class OrderMarkers {
  /**
   * @param {THREE.Scene} scene
   * @param {(x:number, z:number) => number} groundY
   * @param {THREE.Texture|null} [texture] painted marker (without it a plain disc, e.g. in tests)
   */
  constructor(scene, groundY, texture = null) {
    this.groundY = groundY;
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    /** @type {{ mesh: THREE.Mesh, mat: THREE.MeshBasicMaterial, age: number, x: number, z: number, active: boolean }[]} */
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'order-marker';
      mesh.renderOrder = 21;
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, mat, age: 0, x: 0, z: 0, active: false });
    }
  }

  /** Number of running markers. */
  get active() { return this.pool.filter((m) => m.active).length; }

  /**
   * Start a marker at a walk target. A second one at the same spot in the same moment (army and serfs) is dropped.
   * @param {number} x @param {number} z world coordinates (tiles)
   */
  add(x, z) {
    if (this.pool.some((m) => m.active && m.age < 0.15 && Math.hypot(m.x - x, m.z - z) < 0.8)) return;
    const m = this.pool.find((p) => !p.active) ?? this.pool.reduce((a, b) => (b.age > a.age ? b : a));
    m.active = true; m.age = 0; m.x = x; m.z = z;
  }

  /** @param {number} dt seconds @param {number} dist camera distance */
  update(dt, dist) {
    const s = orderMarkerScale(dist);
    for (const m of this.pool) {
      if (!m.active) continue;
      m.age += dt;
      const p = orderMarkerPose(m.age);
      if (!p) { m.active = false; m.mesh.visible = false; continue; }
      m.mesh.visible = true;
      m.mesh.position.set(m.x, this.groundY(m.x, m.z) + 0.05, m.z);
      m.mesh.rotation.y = p.turn;
      m.mesh.scale.setScalar(p.r * s);
      m.mat.opacity = p.alpha;
    }
  }
}
