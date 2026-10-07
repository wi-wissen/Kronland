// Click confirmation for walk commands: dark arrows on the ground flow from all sides into the target spot
// and fade. Always the same, small and plain; work and attack targets are announced by the cursor instead.
// Procedural (no asset), a small pool.

import * as THREE from 'three';

/** Duration of one marker in seconds. */
export const ORDER_MARKER_TIME = 0.7;
const ARROWS = 4;
/** Two waves of arrows one after the other: they flow into each other. */
const WAVES = 2;
const WAVE_DELAY = 0.16;
const POOL = 4;
const COLOR = 0x17110b;

/**
 * Animation state of one wave of arrows at a given marker age (seconds): distance from the centre,
 * size and opacity; null when the wave is not (yet or any more) visible.
 * @param {number} age @param {number} wave 0 or 1
 */
export function orderMarkerWave(age, wave) {
  const t = (age - wave * WAVE_DELAY) / (ORDER_MARKER_TIME - (WAVES - 1) * WAVE_DELAY);
  if (t <= 0 || t >= 1) return null;
  return { r: 0.62 - 0.46 * t * (2 - t), size: 1 - 0.35 * t, alpha: 0.85 * Math.sin(Math.PI * t) };
}

/** Size factor by camera distance: when zoomed out the marker stays readable. */
export function orderMarkerScale(dist) { return Math.max(0.8, Math.min(2.4, dist / 24)); }

/** Flat dart lying on the ground, tip towards −x (the centre, seen from its place at +x). */
function dartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.17, 0); s.lineTo(0.13, 0.2); s.lineTo(0.05, 0); s.lineTo(0.13, -0.2); s.closePath();
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}

export class OrderMarkers {
  /** @param {THREE.Scene} scene @param {(x:number, z:number) => number} groundY */
  constructor(scene, groundY) {
    this.groundY = groundY;
    const geo = dartGeometry();
    /** @type {{ group: THREE.Group, waves: { mesh: THREE.Mesh[], mat: THREE.MeshBasicMaterial }[], age: number, x: number, z: number, active: boolean }[]} */
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const group = new THREE.Group();
      group.name = 'order-marker';
      group.visible = false;
      const waves = [];
      for (let w = 0; w < WAVES; w++) {
        const mat = new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
        const mesh = [];
        for (let j = 0; j < ARROWS; j++) {
          const m = new THREE.Mesh(geo, mat);
          m.renderOrder = 21;
          // arrows from four sides, the second wave turned by 45°
          m.rotation.y = (j / ARROWS + w / (ARROWS * WAVES)) * Math.PI * 2;
          mesh.push(m);
          group.add(m);
        }
        waves.push({ mesh, mat });
      }
      scene.add(group);
      this.pool.push({ group, waves, age: 0, x: 0, z: 0, active: false });
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
      if (m.age >= ORDER_MARKER_TIME) { m.active = false; m.group.visible = false; continue; }
      m.group.visible = true;
      m.group.position.set(m.x, this.groundY(m.x, m.z) + 0.05, m.z);
      m.group.scale.setScalar(s);
      m.waves.forEach((w, i) => {
        const p = orderMarkerWave(m.age, i);
        for (const a of w.mesh) {
          a.visible = !!p;
          if (!p) continue;
          a.position.set(Math.cos(a.rotation.y) * p.r, 0, -Math.sin(a.rotation.y) * p.r);
          a.scale.setScalar(p.size);
        }
        w.mat.opacity = p?.alpha ?? 0;
      });
    }
  }
}
