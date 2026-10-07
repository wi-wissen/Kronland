// Click confirmation for walk and attack commands: three arrows spiral down onto the target spot,
// then a ring spreads on the ground and fades. Purely visual, procedural (no asset), a small pool.

import * as THREE from 'three';
import { UNIT } from '../sim/fixed.js';

/** Duration of one marker in seconds. */
export const ORDER_MARKER_TIME = 0.9;
/** Arrows land at this share of the duration, then the ring spreads. */
const LAND = 0.45;
const ARROWS = 3;
const POOL = 6;

/** Colour per command kind. */
export const ORDER_COLORS = {
  move: 0x7cf03c,
  attackMove: 0xffaa3c,
  attack: 0xff4a36,
  work: 0xffd45a,
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);

/**
 * Animation state of a marker at a given age (seconds); null when it is over.
 * Arrows: height above ground, distance from the centre, turn and opacity. Ring: radius factor and opacity.
 * @param {number} age
 */
export function orderMarkerPose(age) {
  if (age < 0 || age >= ORDER_MARKER_TIME) return null;
  const k = age / ORDER_MARKER_TIME;
  const a = clamp01(k / LAND), b = clamp01((k - LAND) / (1 - LAND));
  return {
    arrowY: 1.5 * (1 - easeIn(a)) + 0.12,
    arrowR: 0.75 - 0.45 * easeIn(a),
    spin: 2.6 * a,
    arrowAlpha: Math.min(1, a * 4) * (1 - b),
    ringR: 0.3 + 0.75 * easeOut(b),
    ringAlpha: b > 0 ? 1 - b * b : 0,
  };
}

/**
 * World point (tiles) of a command target: a figure (milli-tiles), an entity on tiles (building, tree, pile:
 * its centre) or a plain point.
 * @param {any} at
 * @returns {{x:number, y:number}|null}
 */
export function orderPoint(at) {
  if (!at) return null;
  if (at.px !== undefined) return { x: at.px / UNIT, y: at.py / UNIT };
  if (at.kind) return { x: at.x + (at.w ?? 1) / 2, y: at.y + (at.h ?? 1) / 2 };
  return { x: at.x, y: at.y };
}

/** Size factor by camera distance: when zoomed out the marker stays readable. */
export function orderMarkerScale(dist) { return Math.max(1, Math.min(3, dist / 18)); }

/** Arrow head: flat-shaded by baked vertex colours, so it looks the same under every light and weather. */
function arrowGeometry() {
  const g = new THREE.ConeGeometry(0.24, 0.75, 4).rotateX(Math.PI).rotateZ(-0.55).toNonIndexed();
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(n.count * 3);
  const light = new THREE.Vector3(0.4, 0.8, 0.45).normalize(), v = new THREE.Vector3();
  for (let i = 0; i < n.count; i += 3) {
    // one brightness per triangle
    v.set(n.getX(i) + n.getX(i + 1) + n.getX(i + 2), n.getY(i) + n.getY(i + 1) + n.getY(i + 2), n.getZ(i) + n.getZ(i + 1) + n.getZ(i + 2)).normalize();
    const b = 0.55 + 0.45 * Math.max(0, v.dot(light));
    for (let j = i; j < i + 3; j++) col.set([b, b, b], j * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class OrderMarkers {
  /** @param {THREE.Scene} scene @param {(x:number, z:number) => number} groundY */
  constructor(scene, groundY) {
    this.groundY = groundY;
    // tip down, tilted towards the centre (the arrow stands at +x of its holder)
    const arrowGeo = arrowGeometry();
    const ringGeo = new THREE.RingGeometry(0.74, 1, 40).rotateX(-Math.PI / 2);
    const shadowGeo = new THREE.RingGeometry(0.66, 1.08, 40).rotateX(-Math.PI / 2);
    const dotGeo = new THREE.CircleGeometry(0.2, 20).rotateX(-Math.PI / 2);
    /** @type {{ group: THREE.Group, holders: THREE.Group[], ring: THREE.Mesh, shadow: THREE.Mesh, dot: THREE.Mesh, arrowMat: THREE.MeshBasicMaterial, ringMat: THREE.MeshBasicMaterial, shadowMat: THREE.MeshBasicMaterial, age: number, x: number, z: number, active: boolean }[]} */
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const group = new THREE.Group();
      group.name = 'order-marker';
      group.visible = false;
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      // dark rim under the ring: contrast on bright grass and snow
      const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1a140c, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
      const holders = [];
      for (let j = 0; j < ARROWS; j++) {
        const h = new THREE.Group();
        const m = new THREE.Mesh(arrowGeo, arrowMat);
        m.renderOrder = 22;
        h.add(m);
        holders.push(h);
        group.add(h);
      }
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const dot = new THREE.Mesh(dotGeo, ringMat);
      shadow.renderOrder = 20;
      ring.renderOrder = dot.renderOrder = 21;
      group.add(shadow, ring, dot);
      scene.add(group);
      this.pool.push({ group, holders, ring, shadow, dot, arrowMat, ringMat, shadowMat, age: 0, x: 0, z: 0, active: false });
    }
  }

  /** Number of running markers. */
  get active() { return this.pool.filter((m) => m.active).length; }

  /**
   * Start a marker. A second command at the same spot in the same moment (army and serfs together) shows only one.
   * @param {keyof typeof ORDER_COLORS} kind @param {number} x @param {number} z world coordinates (tiles)
   */
  add(kind, x, z) {
    if (this.pool.some((m) => m.active && m.age < 0.15 && Math.hypot(m.x - x, m.z - z) < 0.8)) return;
    const m = this.pool.find((p) => !p.active) ?? this.pool.reduce((a, b) => (b.age > a.age ? b : a));
    const c = ORDER_COLORS[kind] ?? ORDER_COLORS.move;
    m.arrowMat.color.setHex(c);
    m.ringMat.color.setHex(c);
    m.active = true; m.age = 0; m.x = x; m.z = z;
  }

  /** @param {number} dt seconds @param {number} dist camera distance */
  update(dt, dist) {
    const s = orderMarkerScale(dist);
    for (const m of this.pool) {
      if (!m.active) continue;
      m.age += dt;
      const p = orderMarkerPose(m.age);
      if (!p) { m.active = false; m.group.visible = false; continue; }
      m.group.visible = true;
      m.group.position.set(m.x, this.groundY(m.x, m.z) + 0.05, m.z);
      m.group.scale.setScalar(s);
      m.holders.forEach((h, j) => {
        h.rotation.y = p.spin + (j * Math.PI * 2) / ARROWS;
        h.children[0].position.set(p.arrowR, p.arrowY, 0);
      });
      m.arrowMat.opacity = p.arrowAlpha;
      m.ring.visible = m.shadow.visible = m.dot.visible = p.ringAlpha > 0;
      m.ring.scale.setScalar(p.ringR);
      m.shadow.scale.setScalar(p.ringR);
      m.ringMat.opacity = p.ringAlpha;
      m.shadowMat.opacity = p.ringAlpha * 0.4;
    }
  }
}
