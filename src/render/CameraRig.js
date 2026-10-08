// RTS camera modelled on three.js MapControls: target point on the ground, rotation around the vertical axis,
// tilt, distance. Inputs take effect immediately and directly as in a map program – without gliding on
// or springing back. The camera pose is a pure function of target, rotation, tilt and distance
// (`pose()`): when the input stops, the image stops.
//
// - Dragging grabs the ground: the point under the mouse or finger moves along (like MapControls: rays
//   through the old and new pointer against a horizontal plane at the height of the grabbed ground).
// - Zooming to the pointer: the camera moves along the ray through the mouse or finger midpoint, the ground
//   below stays put (like OrbitControls.zoomToCursor).
// - Everything computed in closed form, without iterating in loops: rays near the horizon are limited to a
//   range, nothing shoots off to infinity or builds up oscillation.
// - The height of the target point is the spatially smoothed terrain (radius grows with distance): no
//   hopping over small bumps and no time lag that bobs afterwards.

import * as THREE from 'three';

/** Smallest and largest camera distance to the target point (tiles). */
export const MIN_DIST = 3;
export const MAX_DIST = 75;
/** Below this distance the view gradually becomes flatter (close view as in the original game). */
export const TILT_START = 18;
/** Tilt above the horizon at the smallest distance (rad, ≈ 17°). */
export const NEAR_PITCH = 0.3;
/** Limits of the set tilt (rad above the horizon). */
export const PITCH_MIN = 0.45, PITCH_MAX = 1.5;
/** Look-at point in close view this far above the ground (figures/buildings instead of feet in the screen centre). */
const LOOK_LIFT = 0.55;
/** Minimum height of the camera above the terrain: far away / very close. */
const CLEAR_FAR = 1.5, CLEAR_NEAR = 0.45;
/** Near clipping plane: far away / very close (closer = buildings right in front of the lens not cut off). */
const NEAR_FAR = 0.3, NEAR_NEAR = 0.08;

/**
 * Soft edge around a building for the camera (tiles): grows with the height so that the camera rises steadily, but at
 * most BUILDING_EDGE_MAX – with an unlimited edge the 11-tile castle tower lifted the camera already 4 tiles in front
 * of its walls and the close view in front of the castle stayed steep.
 */
export const BUILDING_EDGE_MAX = 2.5;
/** @param {number} h building height (tiles) */
export const buildingEdge = (h) => Math.min(BUILDING_EDGE_MAX, 0.8 + 0.35 * h);

/**
 * Top edge of one building at (x, z) for the camera: above the footprint base + height, outside it falls softly
 * (smoothstep) to nothing at buildingEdge(h).
 * @param {{x:number, y:number, w:number, h:number}} r footprint (tiles, y = z axis) @param {number} base ground height
 * @param {number} h building height @param {number} x @param {number} z
 * @returns {number} −∞ outside the edge
 */
export function buildingTop(r, base, h, x, z) {
  const edge = buildingEdge(h);
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dz = Math.max(r.y - z, 0, z - (r.y + r.h));
  if (dx >= edge || dz >= edge) return -Infinity;
  const s = Math.min(1, Math.hypot(dx, dz) / edge);
  return base + h * (1 - s * s * (3 - 2 * s));
}

/**
 * Share of close view 0 (from TILT_START and further) … 1 (MIN_DIST), softly rounded.
 * @param {number} dist
 */
export function nearFactor(dist) {
  const t = Math.max(0, Math.min(1, (TILT_START - dist) / (TILT_START - MIN_DIST)));
  return t * t * (3 - 2 * t);
}

/**
 * Actual tilt: the set tilt, gliding flatter when zooming in up to NEAR_PITCH.
 * The set tilt is retained, when zooming out the familiar view returns.
 * @param {number} pitch set tilt @param {number} dist distance
 */
export function viewPitch(pitch, dist) {
  const low = Math.min(pitch, NEAR_PITCH);
  return pitch + (low - pitch) * nearFactor(dist);
}

/** Smoothing radius of the target height (tiles): fine up close, coarse far away. @param {number} dist */
export const smoothRadius = (dist) => Math.max(2.5, Math.min(10, dist * 0.35));
/** Farthest distance of a grabbed point (dragging at the horizon). @param {number} dist */
export const grabRange = (dist) => Math.max(30, dist * 5);
/** Farthest distance of the point being zoomed to. @param {number} dist */
export const zoomRange = (dist) => dist * 1.5 + 10;

// Smoothing kernel of the target height: centre, inner and outer ring (weights 4/2/1)
const KERNEL = [[0, 0, 4]];
for (let i = 0; i < 8; i++) {
  const a = (i * Math.PI) / 4, b = a + Math.PI / 8;
  KERNEL.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5, 2], [Math.cos(b), Math.sin(b), 1]);
}
const KERNEL_W = KERNEL.reduce((s, k) => s + k[2], 0);
/** Sample points around the camera for ground clearance */
const RING = [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]];
/** Line of sight: sample positions k/LOS_STEPS to LOS_LAST/LOS_STEPS (the last quarter before the target stays free) */
const LOS_STEPS = 12, LOS_LAST = 9;

const _d = new THREE.Vector3(), _q = new THREE.Vector3();

export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera @param {{w:number,h:number}} bounds */
  constructor(camera, bounds) {
    this.camera = camera;
    this.bounds = bounds;
    /** Target point on the ground; y = smoothed terrain height (set by pose()) */
    this.target = new THREE.Vector3(bounds.w / 2, 0, bounds.h / 2);
    this.yaw = 0.7;
    this.pitch = 0.95;      // set tilt above the horizon (rad)
    this.dist = 28;
    this.keys = new Set();
    /** Look-at point of the camera (target point, slightly raised in close view) */
    this.aim = new THREE.Vector3();
    /** @type {(x:number,z:number)=>number} */
    this.groundAt = () => 0;
    /** Top edge of obstacles (buildings) with soft edge; −∞ = none. @type {(x:number,z:number)=>number} */
    this.obstacleAt = () => -Infinity;
  }

  /** Camera jump (minimap, notices). */
  lookAt(x, z) { this.target.x = x; this.target.z = z; this.clamp(); }

  /** Shown tilt (with close view). */
  get shownPitch() { return viewPitch(this.pitch, this.dist); }

  /**
   * Choose the look-at point so that the ground point (x,z) appears at screen height `screenY` (pixels from the top)
   * instead of in the screen centre – e.g. above a panel at the bottom edge. Measures the position via
   * projection and corrects (a few steps suffice, also at the map edge without an infinite loop).
   * @param {number} x @param {number} z @param {number} screenY @param {number} viewportH
   */
  lookAtScreen(x, z, screenY, viewportH) {
    this.lookAt(x, z);
    const p = new THREE.Vector3();
    for (let i = 0; i < 5; i++) {
      this.update(0);
      p.set(x, this.groundAt(x, z), z).project(this.camera);
      const dy = screenY - ((1 - p.y) / 2) * viewportH;
      if (Math.abs(dy) < 2) break;
      this.pan(0, dy, viewportH);
    }
  }

  /**
   * Camera position for another view (target, rotation, tilt, distance) without changing the current one: poses
   * temporarily (with terrain and house clearance) and restores afterwards.
   * @returns {{x:number, y:number, z:number}}
   */
  positionFor(x, z, yaw, pitch, dist) {
    const keep = { x: this.target.x, z: this.target.z, yaw: this.yaw, pitch: this.pitch, dist: this.dist };
    this.target.x = x; this.target.z = z; this.yaw = yaw; this.pitch = pitch; this.dist = dist;
    this.clamp();
    this.pose();
    const p = this.camera.position, out = { x: p.x, y: p.y, z: p.z };
    this.target.x = keep.x; this.target.z = keep.z; this.yaw = keep.yaw; this.pitch = keep.pitch; this.dist = keep.dist;
    this.pose();
    return out;
  }

  clamp() {
    this.target.x = Math.max(0, Math.min(this.bounds.w, this.target.x));
    this.target.z = Math.max(0, Math.min(this.bounds.h, this.target.z));
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
    this.dist = Math.max(MIN_DIST, Math.min(MAX_DIST, this.dist));
  }

  /** Move in screen pixels (keyboard, edge scrolling). */
  pan(dxPx, dyPx, viewportH) {
    const scale = (this.dist * 1.1) / viewportH;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const sp = Math.max(0.5, Math.sin(viewPitch(this.pitch, this.dist)));
    this.target.x -= (dxPx * cos + dyPx * sin / sp) * scale;
    this.target.z -= (-dxPx * sin + dyPx * cos / sp) * scale;
    this.clamp();
  }

  rotate(dYaw, dPitch) { this.yaw += dYaw; this.pitch += dPitch; this.clamp(); }

  /** Zoom to the screen centre (keys). */
  zoom(factor) { this.dist *= factor; this.clamp(); }

  /** Per frame: keyboard control, then camera pose. @param {number} dt seconds */
  update(dt) {
    const k = this.keys, speed = this.dist * 0.9 * dt;
    let fx = 0, fz = 0;
    if (k.has('w') || k.has('arrowup')) fz -= 1;
    if (k.has('s') || k.has('arrowdown')) fz += 1;
    if (k.has('a') || k.has('arrowleft')) fx -= 1;
    if (k.has('d') || k.has('arrowright')) fx += 1;
    if (fx || fz) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      this.target.x += (fx * cos + fz * sin) * speed;
      this.target.z += (-fx * sin + fz * cos) * speed;
    }
    if (k.has('q') || k.has('insert')) this.yaw += dt * 1.6;
    if (k.has('e') || k.has('delete')) this.yaw -= dt * 1.6;
    if (k.has('+') || k.has('pageup')) this.dist *= 1 - dt;
    if (k.has('-') || k.has('pagedown')) this.dist *= 1 + dt;
    if (k.has('r') || k.has('home')) this.pitch += dt * 0.8;
    if (k.has('f') || k.has('end')) this.pitch -= dt * 0.8;
    this.clamp();
    this.pose();
  }

  /** Height of the target point: terrain spatially smoothed (pure function of position, no tracking over time). */
  baseHeight(x, z) {
    const r = smoothRadius(this.dist);
    let s = 0;
    for (const [ox, oz, w] of KERNEL) s += this.groundAt(x + ox * r, z + oz * r) * w;
    return s / KERNEL_W;
  }

  /** Slightly smoothed terrain for the line of sight (edges of the terrain triangles would otherwise jerk). */
  softGround(x, z) {
    let s = this.groundAt(x, z) * 2;
    for (const [ox, oz] of RING) s += this.groundAt(x + ox * 1.25, z + oz * 1.25);
    return s / 6;
  }

  /** Set the camera pose from target, rotation, tilt and distance. */
  pose() {
    const t = this.target, shown = viewPitch(this.pitch, this.dist);
    t.y = this.baseHeight(t.x, t.z);
    // Close view: flatter view, look-at point slightly above the ground
    const near = nearFactor(this.dist);
    const a = this.aim.copy(t);
    a.y += LOOK_LIFT * near;
    const cp = Math.cos(shown);
    const c = this.camera.position.set(
      a.x + Math.sin(this.yaw) * cp * this.dist,
      a.y + Math.sin(shown) * this.dist,
      a.z + Math.cos(this.yaw) * cp * this.dist,
    );
    // Never into the terrain and never into buildings: camera and a ring around it stay above ground and roofs (the
    // near clipping plane does not cut in on slopes; buildings have a soft edge, the camera rises
    // steadily). Clear view: if a hill sticks into the line of sight between camera and target, the camera is
    // raised. Everything depends only on the position – when stopping nothing keeps moving.
    const clear = CLEAR_FAR + (CLEAR_NEAR - CLEAR_FAR) * near;
    let below = Math.max(this.groundAt(c.x, c.z), this.obstacleAt(c.x, c.z));
    for (const [ox, oz] of RING) {
      below = Math.max(below, this.groundAt(c.x + ox, c.z + oz), this.obstacleAt(c.x + ox, c.z + oz));
    }
    let minY = below + clear;
    const margin = 0.5 - 0.25 * near;
    for (let k = 1; k <= LOS_LAST; k++) {
      const f = k / LOS_STEPS;
      // distance to the slope decreases towards the target (at the target itself lies the ground)
      const h = this.softGround(c.x + (a.x - c.x) * f, c.z + (a.z - c.z) * f) + margin * (1 - f);
      // Line of sight at f: c.y + (a.y − c.y)·f ≥ h  ⇔  c.y ≥ (h − a.y·f) / (1 − f)
      minY = Math.max(minY, (h - a.y * f) / (1 - f));
    }
    if (c.y < minY) c.y = minY;
    const zNear = NEAR_FAR + (NEAR_NEAR - NEAR_FAR) * near;
    if (Math.abs(this.camera.near - zNear) > 1e-3) { this.camera.near = zNear; this.camera.updateProjectionMatrix(); }
    this.camera.lookAt(a);
    this.camera.updateMatrixWorld();
  }

  // ---------- Screen points and ground ----------

  /** Direction of the view ray through the screen point (nx, ny in −1…1, y up). */
  rayDir(nx, ny, out = new THREE.Vector3()) {
    return out.set(nx, ny, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
  }

  /**
   * Ground point under a screen point: ray over the height field, at most maxDist far.
   * @returns {THREE.Vector3|null}
   */
  pick(nx, ny, maxDist = 400) {
    const o = this.camera.position, d = this.rayDir(nx, ny, _d);
    const above = (s) => o.y + d.y * s - this.groundAt(o.x + d.x * s, o.z + d.z * s);
    if (above(0) < 0) return null;
    let prev = 0, step = 0.25;
    for (let s = step; s <= maxDist; s += step) {
      if (above(s) <= 0) {
        let lo = prev, hi = s;
        for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (above(mid) > 0) lo = mid; else hi = mid; }
        return new THREE.Vector3(o.x + d.x * hi, o.y + d.y * hi, o.z + d.z * hi);
      }
      prev = s;
      step = Math.min(1.5, step * 1.05);
    }
    return null;
  }

  /**
   * Intersection of the view ray through (nx, ny) with the horizontal plane y = h. Rays that are too flat (near the
   * horizon) and rays into the sky are tilted down far enough that the intersection is at most
   * maxDist away – dragging and zooming at the horizon thus do not shoot off to infinity.
   */
  rayPlane(nx, ny, h, maxDist, out = new THREE.Vector3()) {
    const o = this.camera.position, d = this.rayDir(nx, ny, _d);
    const dy = Math.min(h - o.y, -0.05);      // plane below the camera (if it is above: just below)
    const sy = Math.min(d.y, dy / maxDist);    // slope of the ray, at most so flat that s ≤ maxDist
    const hor = Math.hypot(d.x, d.z);
    const k = hor > 1e-9 ? Math.sqrt(Math.max(0, 1 - sy * sy)) / hor : 0;
    const s = dy / sy;
    return out.set(o.x + d.x * k * s, o.y + dy, o.z + d.z * k * s);
  }

  /**
   * Height of the plane grabbed when dragging: ground under the screen point (or target height if the
   * ray does not hit within range), at most just below the camera.
   */
  grabHeight(nx, ny) {
    this.pose();
    const p = this.pick(nx, ny, grabRange(this.dist));
    return Math.min(p ? p.y : this.target.y, this.camera.position.y - 0.5);
  }

  /**
   * A drag step as in MapControls: the ground point (on the plane y = h) under the old screen point
   * moves under the new one. Computed in closed form with the current camera; because the camera follows the
   * terrain height, a small remainder stays, which holdUnder() compensates in a limited way.
   */
  dragStep(fromX, fromY, toX, toY, h) {
    this.pose();
    const range = grabRange(this.dist);
    const hh = Math.min(h, this.camera.position.y - 0.5);
    const a = this.rayPlane(fromX, fromY, hh, range, new THREE.Vector3());
    const b = this.rayPlane(toX, toY, hh, range, _q);
    const step = Math.hypot(a.x - b.x, a.z - b.z);
    this.target.x += a.x - b.x; this.target.z += a.z - b.z;
    this.clamp();
    this.pose();
    this.holdUnder(a, toX, toY, range, step);
  }

  /**
   * Fine correction: if p (on the plane y = p.y) is no longer exactly under the screen point (nx, ny) because the
   * camera followed the terrain height, the target is pushed along – only as long as that reduces the remainder
   * and never further than `cap`. This way nothing builds up for flat rays (near the horizon).
   */
  holdUnder(p, nx, ny, range, cap) {
    let q = this.rayPlane(nx, ny, p.y, range, _q);
    let err = Math.hypot(p.x - q.x, p.z - q.z);
    const limit = Math.max(0.05, cap);
    for (let i = 0; i < 3 && err > 1e-4; i++) {
      const tx = this.target.x, tz = this.target.z;
      const k = Math.min(1, limit / err);
      this.target.x += (p.x - q.x) * k; this.target.z += (p.z - q.z) * k;
      this.clamp();
      this.pose();
      q = this.rayPlane(nx, ny, p.y, range, _q);
      const e = Math.hypot(p.x - q.x, p.z - q.z);
      if (e >= err) { this.target.x = tx; this.target.z = tz; this.pose(); break; }
      err = e;
    }
  }

  /**
   * Zooming to the screen point (nx, ny) like OrbitControls.zoomToCursor: the camera moves along the ray
   * through the pointer, so the ground point below stays under the pointer. Computed in closed form, hence
   * also near the horizon without jumps. If the pointer points into the sky, it zooms to the screen centre. In
   * close view the view additionally tilts around the screen centre.
   */
  zoomAt(factor, nx, ny) {
    this.pose();
    const d = this.rayDir(nx, ny, _d);
    if (d.y > -0.03) { this.zoom(factor); this.pose(); return; }
    // view direction (camera → look-at point) at the shown tilt
    const p = viewPitch(this.pitch, this.dist), cp = Math.cos(p);
    const fx = -Math.sin(this.yaw) * cp, fy = -Math.sin(p), fz = -Math.cos(this.yaw) * cp;
    // camera by dr along the pointer ray: new distance to the ground plane of the look-at point
    const ratio = d.y / fy;
    let dr = this.dist * (1 - factor);
    let next = this.dist - dr * ratio;
    if (next < MIN_DIST) { next = MIN_DIST; dr = (this.dist - next) / ratio; }
    if (next > MAX_DIST) { next = MAX_DIST; dr = (this.dist - next) / ratio; }
    this.target.x += d.x * dr - fx * (this.dist - next);
    this.target.z += d.z * dr - fz * (this.dist - next);
    this.dist = next;
    this.clamp();
    this.pose();
  }

  /**
   * Rotate around the ground point under (nx, ny) (two-finger rotation): target and camera rotate together
   * around the vertical axis through this point, it stays under the fingers.
   */
  rotateAt(dYaw, nx, ny) {
    this.pose();
    const range = zoomRange(this.dist);
    const p = this.pick(nx, ny, range) ?? this.rayPlane(nx, ny, this.target.y, range);
    const x = this.target.x - p.x, z = this.target.z - p.z, c = Math.cos(dYaw), s = Math.sin(dYaw);
    const tx = this.target.x, tz = this.target.z;
    this.target.x = p.x + x * c + z * s;
    this.target.z = p.z - x * s + z * c;
    this.yaw += dYaw;
    this.clamp();
    this.pose();
    this.holdUnder(p, nx, ny, range, Math.hypot(this.target.x - tx, this.target.z - tz));
  }
}
