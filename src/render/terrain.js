// Terrain mesh from the simulation's height map. 1 tile = 1 world unit.

import * as THREE from 'three';
import { WATER } from '../sim/map.js';
import { valueNoise } from '../sim/mapgen.js';

/** Centimetres per world unit in height. */
export const HEIGHT_SCALE = 250;

export class Terrain {
  /** @param {import('../sim/map.js').TileMap} map @param {number} waterLevel */
  constructor(map, waterLevel) {
    this.map = map;
    const W = map.width, H = map.height;
    this.W = W; this.H = H;
    // corner heights = mean of the adjacent tiles
    this.corners = new Float32Array((W + 1) * (H + 1));
    for (let j = 0; j <= H; j++) for (let i = 0; i <= W; i++) {
      let sum = 0, n = 0;
      for (let y = j - 1; y <= j; y++) for (let x = i - 1; x <= i; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        sum += map.heights[map.idx(x, y)]; n++;
      }
      this.corners[j * (W + 1) + i] = sum / n / HEIGHT_SCALE;
    }
    this.waterY = waterLevel / HEIGHT_SCALE - 0.08;
    this.mesh = this.buildMesh();
    this.water = this.buildWater();
  }

  cornerY(i, j) {
    i = Math.max(0, Math.min(this.W, i)); j = Math.max(0, Math.min(this.H, j));
    return this.corners[j * (this.W + 1) + i];
  }

  /** Height at any world position (bilinear). */
  heightAt(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    const fx = x - i, fz = z - j;
    const a = this.cornerY(i, j), b = this.cornerY(i + 1, j), c = this.cornerY(i, j + 1), d = this.cornerY(i + 1, j + 1);
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }

  /** Mean height of an area (for buildings). */
  rectHeight(x, y, w, h) {
    let max = -Infinity;
    for (let j = y; j <= y + h; j++) for (let i = x; i <= x + w; i++) max = Math.max(max, this.cornerY(i, j));
    let sum = 0, n = 0;
    for (let j = y; j <= y + h; j++) for (let i = x; i <= x + w; i++) { sum += this.cornerY(i, j); n++; }
    return Math.min(max, sum / n + 0.15);
  }

  buildMesh() {
    const { W, H, map } = this;
    const pos = new Float32Array(W * H * 6 * 3);
    const col = new Float32Array(W * H * 6 * 3);
    const c = new THREE.Color();
    const grassA = new THREE.Color(0x6a9442), grassB = new THREE.Color(0x86a952), dry = new THREE.Color(0x9aa35a);
    let k = 0;
    const nearWater = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (map.inBounds(x + dx, y + dy) && map.flags[map.idx(x + dx, y + dy)] & WATER) return true;
      }
      return false;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h00 = this.cornerY(x, y), h10 = this.cornerY(x + 1, y), h01 = this.cornerY(x, y + 1), h11 = this.cornerY(x + 1, y + 1);
      const slope = Math.max(h00, h10, h01, h11) - Math.min(h00, h10, h01, h11);
      const hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (map.flags[map.idx(x, y)] & WATER) c.setHex(0xb8a876);
      else if (nearWater(x, y)) c.setHex(0xd6c38c);
      else if (slope > 1.1) c.setHex(hash & 1 ? 0x8b857a : 0x958f83);
      else if (slope > 0.7) c.setHex(0x86955a);
      else {
        const n = valueNoise(x, y, 9, 77) / 1023, n2 = valueNoise(x, y, 23, 78) / 1023;
        c.copy(grassA).lerp(grassB, n).lerp(dry, Math.max(0, n2 - 0.6));
        c.offsetHSL(0, 0, ((hash % 7) - 3) * 0.004);
      }
      const quad = [[x, y, h00], [x, y + 1, h01], [x + 1, y, h10], [x + 1, y, h10], [x, y + 1, h01], [x + 1, y + 1, h11]];
      for (const [vx, vz, vy] of quad) {
        pos[k] = vx; pos[k + 1] = vy; pos[k + 2] = vz;
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
        k += 3;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    m.receiveShadow = true;
    m.name = 'terrain';
    return m;
  }

  buildWater() {
    const g = new THREE.PlaneGeometry(this.W + 40, this.H + 40);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4f8fb8, transparent: true, opacity: 0.82, roughness: 0.3, metalness: 0.05 }));
    m.position.set(this.W / 2, this.waterY, this.H / 2);
    return m;
  }
}
