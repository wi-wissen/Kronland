// RTS camera: target point on the ground, rotation about the vertical axis, tilt, distance.
// Driven by input (mouse, keyboard, touch).

import * as THREE from 'three';

export class CameraRig {
  /** @param {THREE.PerspectiveCamera} camera @param {{w:number,h:number}} bounds */
  constructor(camera, bounds) {
    this.camera = camera;
    this.bounds = bounds;
    this.target = new THREE.Vector3(bounds.w / 2, 0, bounds.h / 2);
    this.yaw = 0.7;
    this.pitch = 0.95;      // angle above the horizon (rad)
    this.dist = 28;
    this.keys = new Set();
    /** @type {(x:number,z:number)=>number} */
    this.groundAt = () => 0;
  }

  lookAt(x, z) { this.target.set(x, 0, z); this.clamp(); }

  clamp() {
    this.target.x = Math.max(0, Math.min(this.bounds.w, this.target.x));
    this.target.z = Math.max(0, Math.min(this.bounds.h, this.target.z));
    this.pitch = Math.max(0.45, Math.min(1.5, this.pitch));
    this.dist = Math.max(8, Math.min(75, this.dist));
  }

  /** Verschieben in Bildschirm-Pixeln (Ziehen). */
  pan(dxPx, dyPx, viewportH) {
    const scale = (this.dist * 1.1) / viewportH;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    this.target.x -= (dxPx * cos + dyPx * sin / Math.max(0.5, Math.sin(this.pitch))) * scale;
    this.target.z -= (-dxPx * sin + dyPx * cos / Math.max(0.5, Math.sin(this.pitch))) * scale;
    this.clamp();
  }

  rotate(dYaw, dPitch) { this.yaw += dYaw; this.pitch += dPitch; this.clamp(); }

  zoom(factor) { this.dist *= factor; this.clamp(); }

  /** Per frame: keyboard control and camera position. */
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
    this.clamp();

    // Ease the target height along the terrain (no jumping over mountains); dt = 0 sets it immediately
    const ground = this.groundAt(this.target.x, this.target.z);
    this.target.y = dt > 0 && this.settled ? this.target.y + (ground - this.target.y) * Math.min(1, dt * 6) : ground;
    this.settled = true;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    // Never below the terrain (high mountains between camera and target)
    const under = this.groundAt(this.camera.position.x, this.camera.position.z) + 1.5;
    if (this.camera.position.y < under) this.camera.position.y = under;
    this.camera.lookAt(this.target);
  }
}
