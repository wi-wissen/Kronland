// Tile grid over the terrain (learning adventure: count steps; world editor: hit tiles).
// Rendering only: reads just the terrain height. Each tile edge follows the ground in two pieces,
// every fifth line is bolder so one can count quickly.

import * as THREE from 'three';

const LIFT = 0.04;

/**
 * Line positions for the grid (without three.js, tested with Vitest).
 * @param {number} w width in tiles @param {number} h height in tiles
 * @param {(x: number, z: number) => number} y height at a point
 * @param {number} [major] which line is bold (every n-th)
 * @returns {{ minor: Float32Array, major: Float32Array }} two points (x, y, z) per segment
 */
export function gridLines(w, h, y, major = 5) {
  const minor = [], strong = [];
  const seg = (out, x0, z0, x1, z1) => out.push(x0, y(x0, z0), z0, x1, y(x1, z1), z1);
  // Vertical lines (x fixed), two pieces per tile
  for (let x = 0; x <= w; x++) {
    const out = x % major === 0 ? strong : minor;
    for (let z = 0; z < h; z++) { seg(out, x, z, x, z + 0.5); seg(out, x, z + 0.5, x, z + 1); }
  }
  for (let z = 0; z <= h; z++) {
    const out = z % major === 0 ? strong : minor;
    for (let x = 0; x < w; x++) { seg(out, x, z, x + 0.5, z); seg(out, x + 0.5, z, x + 1, z); }
  }
  return { minor: new Float32Array(minor), major: new Float32Array(strong) };
}

/**
 * Camera distance at which a small map (learning adventure) fits entirely on screen.
 * @param {number} w @param {number} h tiles
 */
export function overviewDist(w, h) {
  return Math.max(16, Math.min(60, Math.max(w * 0.95, h * 1.6)));
}

export class TileGrid {
  /** @param {any} terrain src/render/terrain.js @param {number} w @param {number} h */
  constructor(terrain, w, h) {
    this.terrain = terrain;
    this.w = w;
    this.h = h;
    this.group = new THREE.Group();
    this.group.name = 'tile-grid';
    this.group.renderOrder = 2;
    const mat = (opacity) => new THREE.LineBasicMaterial({ color: 0xfff6dc, transparent: true, opacity, depthWrite: false });
    this.minor = new THREE.LineSegments(new THREE.BufferGeometry(), mat(0.28));
    this.major = new THREE.LineSegments(new THREE.BufferGeometry(), mat(0.6));
    this.group.add(this.minor, this.major);
    this.rebuild();
  }

  /** Height of a grid point: above the ground, on the water surface over water. */
  heightAt(x, z) {
    const t = this.terrain;
    return Math.max(t.heightAt(x, z), t.waterY ?? -Infinity) + LIFT;
  }

  /** After terrain changes, fit to the ground again (small maps: completely anew, that is fast enough). */
  rebuild() {
    const { minor, major } = gridLines(this.w, this.h, (x, z) => this.heightAt(x, z));
    for (const [obj, arr] of [[this.minor, minor], [this.major, major]]) {
      obj.geometry.dispose();
      obj.geometry = new THREE.BufferGeometry();
      obj.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    }
  }

  dispose() {
    for (const obj of [this.minor, this.major]) { obj.geometry.dispose(); obj.material.dispose(); }
    this.group.removeFromParent();
  }
}
