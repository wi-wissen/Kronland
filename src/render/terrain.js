// Terrain mesh from the simulation's height map. 1 tile = 1 world unit.
// One draw call: smooth mesh (optionally subdivided more finely), texture blending in the shader from
// grass, meadow, earth, sand, rock (triplanar) and snow via weights per corner.
// Around buildings the ground is trodden (small data texture). The levelling under buildings
// is computed by the simulation (sim/systems/terrain.js); updateArea() takes changed heights into the mesh.

import * as THREE from 'three';
import { WATER, CLIFF } from '../sim/map.js';
import { terrainTextures, TEX_REPEAT, ROCK_REPEAT } from './textures.js';
import { getQuality } from './quality.js';

/** Centimetres per world unit in height. */
export const HEIGHT_SCALE = 360;

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Small rendering noise (not used in the simulation). */
function vnoise(x, y, seed) {
  const h = (i, j) => {
    let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}
const fbm2 = (x, y, seed) => vnoise(x, y, seed) * 0.6 + vnoise(x * 2.1, y * 2.1, seed + 1) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 2) * 0.1;

export class Terrain {
  /**
   * @param {import('../sim/map.js').TileMap} map
   * @param {number} waterLevel
   * @param {import('./quality.js').QualitySettings} [quality]
   */
  constructor(map, waterLevel, quality = getQuality()) {
    this.map = map;
    this.q = quality;
    const W = map.width, H = map.height;
    this.W = W; this.H = H;
    this.R = quality.terrainDetail;          // mesh points per tile
    this.M = quality.margin;                 // border terrain in tiles
    this.waterY = waterLevel / HEIGHT_SCALE - 0.12;
    this.waterLevelY = waterLevel / HEIGHT_SCALE;

    /** Building surfaces whose edge corners lie exactly on the plane (id → rectangle) */
    this.pads = new Map();
    // corner heights = mean of the adjacent tiles
    this.corners = new Float32Array((W + 1) * (H + 1));
    this.computeCorners(0, 0, W, H);
    this.buildGrid();
    this.uniforms = {
      uSnow: { value: 0 }, uWet: { value: 0 }, uTrample: { value: null },
      uMapSize: { value: new THREE.Vector2(W, H) }, uWaterY: { value: this.waterY },
    };
    this.buildTrample();
    this.mesh = this.buildMesh();
  }

  /** Corner heights in the corner region [i0..i1]×[j0..j1] from the simulation's tile heights (building surfaces exactly flat). */
  computeCorners(i0, j0, i1, j1) {
    const { W, H, map } = this;
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(W, i1); j1 = Math.min(H, j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let sum = 0, n = 0;
      for (let y = j - 1; y <= j; y++) for (let x = i - 1; x <= i; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        sum += map.heights[map.idx(x, y)]; n++;
      }
      this.corners[j * (W + 1) + i] = sum / n / HEIGHT_SCALE;
    }
    // corners on the edge of a building surface lie on its plane (mean if two surfaces touch)
    let acc = null;
    for (const r of this.pads.values()) {
      if (r.x > i1 || r.x + r.w < i0 || r.y > j1 || r.y + r.h < j0) continue;
      const v = map.heights[map.idx(r.x, r.y)] / HEIGHT_SCALE;
      for (let j = Math.max(j0, r.y); j <= Math.min(j1, r.y + r.h); j++) for (let i = Math.max(i0, r.x); i <= Math.min(i1, r.x + r.w); i++) {
        const k = j * (W + 1) + i;
        acc ??= new Map();
        const a = acc.get(k);
        if (a) { a[0] += v; a[1]++; } else acc.set(k, [v, 1]);
      }
    }
    if (acc) for (const [k, [sum, n]] of acc) this.corners[k] = sum / n;
  }

  // ---------- Height grid ----------

  /** Fine height grid including border terrain; intermediate points via Catmull-Rom (smooth hills). */
  buildGrid() {
    const { W, H, R, M } = this;
    const GW = (W + 2 * M) * R + 1, GH = (H + 2 * M) * R + 1;
    this.GW = GW; this.GH = GH;
    const g = new Float32Array(GW * GH);
    const cw = W + 1;
    // corner height at any (also outer) corner: outside it is continued
    const edgeLand = (i, j) => this.corners[Math.max(0, Math.min(H, j)) * cw + Math.max(0, Math.min(W, i))];
    const outer = (i, j) => {
      const ci = Math.max(0, Math.min(W, i)), cj = Math.max(0, Math.min(H, j));
      const base = edgeLand(ci, cj);
      const d = Math.max(Math.abs(i - ci), Math.abs(j - cj));
      if (d === 0) return base;
      const n = fbm2(i * 0.11, j * 0.11, 9);
      if (base < this.waterLevelY + 0.2) return Math.min(base, this.waterLevelY - 0.3) - d * 0.06; // sea continues
      // land: gently rising hills as a map frame
      // land: gently rising, wooded hills as a map frame (below the snow line)
      const v = base + Math.min(1, d / 10) * (1.2 + n * 3.5) * smooth(0, 14, d) + (n - 0.5) * 0.4 * Math.min(1, d / 3);
      return Math.min(v, Math.max(base, this.waterLevelY + 6.5));
    };
    this.outer = outer;
    // compute the extended corner grid once (edge + 2 for the Catmull-Rom neighbours)
    const E = M + 2, EW = W + 2 * E + 1;
    this.E = E; this.EW = EW;
    this.ext = new Float32Array(EW * (H + 2 * E + 1));
    for (let j = -E; j <= H + E; j++) for (let i = -E; i <= W + E; i++) this.ext[(j + E) * EW + i + E] = outer(i, j);
    this.grid = g;
    this.fillGrid(0, 0, GW - 1, GH - 1);
  }

  /** Fine mesh points in the area [gx0..gx1]×[gy0..gy1] from the extended corner grid (Catmull-Rom). */
  fillGrid(gx0, gy0, gx1, gy1) {
    const { W, H, R, M, E, EW, GW, ext, grid: g } = this;
    const C = (i, j) => ext[(Math.max(-E, Math.min(H + E, j)) + E) * EW + Math.max(-E, Math.min(W + E, i)) + E];
    const cr = (p0, p1, p2, p3, t) => {
      const t2 = t * t, t3 = t2 * t;
      return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    };
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const fx = gx / R - M, fz = gy / R - M;
      const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
      let v;
      if (tx === 0 && tz === 0) v = C(i, j);
      else {
        const rows = [];
        for (let k = -1; k <= 2; k++) rows.push(cr(C(i - 1, j + k), C(i, j + k), C(i + 1, j + k), C(i + 2, j + k), tx));
        v = cr(rows[0], rows[1], rows[2], rows[3], tz);
        // limit overshoot so that shores do not bulge beyond the neighbours
        // points on a cell edge depend only on its two corners
        const i1 = tx === 0 ? i : i + 1, j1 = tz === 0 ? j : j + 1;
        const lo = Math.min(C(i, j), C(i1, j), C(i, j1), C(i1, j1));
        const hi = Math.max(C(i, j), C(i1, j), C(i, j1), C(i1, j1));
        // flat cells and edges (e.g. building surfaces) stay exactly flat
        v = lo === hi ? lo : Math.max(lo - 0.15, Math.min(hi + 0.15, v));
      }
      g[gy * GW + gx] = v;
    }
  }

  gridY(gx, gy) {
    gx = Math.max(0, Math.min(this.GW - 1, gx)); gy = Math.max(0, Math.min(this.GH - 1, gy));
    return this.grid[gy * this.GW + gx];
  }

  cornerY(i, j) {
    return this.gridY((i + this.M) * this.R, (j + this.M) * this.R);
  }

  /** Height at any world position (bilinear on the fine grid, matches the mesh). */
  heightAt(x, z) {
    const fx = (x + this.M) * this.R, fz = (z + this.M) * this.R;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const a = this.gridY(i, j), b = this.gridY(i + 1, j), c = this.gridY(i, j + 1), d = this.gridY(i + 1, j + 1);
    // same triangle split as in the mesh
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  /** Build height of a surface (for buildings). */
  rectHeight(x, y, w, h) {
    let max = -Infinity, sum = 0, n = 0;
    for (let j = y; j <= y + h; j++) for (let i = x; i <= x + w; i++) {
      const v = this.cornerY(i, j);
      max = Math.max(max, v); sum += v; n++;
    }
    return Math.min(max, sum / n + 0.15);
  }

  // ---------- Mesh ----------

  buildMesh() {
    const { GW, GH, R, M } = this;
    const count = GW * GH;
    const pos = new Float32Array(count * 3);
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const k = gy * GW + gx;
      pos[k * 3] = gx / R - M; pos[k * 3 + 1] = this.grid[k]; pos[k * 3 + 2] = gy / R - M;
    }
    const idx = new Uint32Array((GW - 1) * (GH - 1) * 6);
    let t = 0;
    for (let gy = 0; gy < GH - 1; gy++) for (let gx = 0; gx < GW - 1; gx++) {
      const a = gy * GW + gx, b = a + 1, c = a + GW, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b;
      idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    this.splatA = new Float32Array(count * 4);
    this.splatB = new Float32Array(count * 4);
    g.setAttribute('splatA', new THREE.BufferAttribute(this.splatA, 4));
    g.setAttribute('splatB', new THREE.BufferAttribute(this.splatB, 4));
    this.geometry = g;
    this.computeSplat(0, 0, GW - 1, GH - 1);
    g.computeBoundingSphere();
    g.computeBoundingBox();

    const mat = this.material();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.name = 'terrain';
    return m;
  }

  /** Blend weights per mesh point in the area [gx0..gx1]×[gy0..gy1]. */
  computeSplat(gx0, gy0, gx1, gy1) {
    const { GW, R, M, map, W, H } = this;
    const nrm = this.geometry.attributes.normal.array;
    const wl = this.waterLevelY;
    const snowLine = wl + 9.2;
    // precompute water and cliff proximity per tile once
    if (!this.tileInfo) {
      const info = new Float32Array(W * H * 2);
      const S = W;
      // distance to the water (tiles, up to 4)
      const dist = new Int8Array(W * H).fill(9);
      const q = [];
      for (let k = 0; k < W * H; k++) if (map.flags[k] & WATER) { dist[k] = 0; q.push(k); }
      for (let qi = 0; qi < q.length; qi++) {
        const k = q[qi], x = k % S, y = (k / S) | 0;
        if (dist[k] >= 4) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * S + nx;
          if (dist[n] > dist[k] + 1) { dist[n] = dist[k] + 1; q.push(n); }
        }
      }
      for (let k = 0; k < W * H; k++) {
        info[k * 2] = dist[k];
        info[k * 2 + 1] = map.flags[k] & CLIFF ? 1 : 0;
      }
      this.tileInfo = info;
    }
    const tileAt = (x, z, ch) => {
      const tx = Math.max(0, Math.min(W - 1, Math.floor(x))), tz = Math.max(0, Math.min(H - 1, Math.floor(z)));
      return this.tileInfo[(tz * W + tx) * 2 + ch];
    };
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const k = gy * GW + gx;
      const x = gx / R - M, z = gy / R - M;
      const y = this.grid[k];
      const ny = nrm[k * 3 + 1];
      const slope = 1 - ny; // 0 = eben
      const n1 = fbm2(x * 0.09, z * 0.09, 3), n2 = fbm2(x * 0.23, z * 0.23, 5), n3 = fbm2(x * 0.5, z * 0.5, 7);
      // cliff proximity from the tiles of the corner
      let cliff = 0;
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) cliff += tileAt(x + dx, z + dz, 1);
      cliff /= 4;
      let wdist = 9;
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) wdist = Math.min(wdist, tileAt(x + dx, z + dz, 0));
      const above = y - wl;
      let rock = Math.max(smooth(0.2, 0.4, slope + (n3 - 0.5) * 0.12), cliff * smooth(0.08, 0.2, slope) * 0.95);
      let snow = smooth(snowLine - 1.2, snowLine + 1.0, y + (n2 - 0.5) * 2.5) * (1 - smooth(0.38, 0.6, slope) * 0.75);
      let sand = 0;
      // sand only on the shore: narrow strip, width varies with noise
      if (above < 0.05 && wdist <= 1) sand = 1;
      else if (wdist <= 1 && above < 0.16 + n2 * 0.2) sand = smooth(0.16 + n2 * 0.2, 0.03, above);
      else if (wdist === 2 && n2 > 0.55 && above < 0.18) sand = smooth(0.18, 0.05, above) * smooth(0.55, 0.7, n2);
      // earth: scattered patches, slope feet, scree below cliffs
      let dirt = smooth(0.66, 0.8, n1 * 0.6 + n3 * 0.4) * 0.8 + smooth(0.12, 0.22, slope) * (1 - rock) * 0.45;
      const meadow = smooth(0.48, 0.66, n2 * 0.7 + n1 * 0.3);
      // outside the map: more rock/forest ground so the edge stays readable
      const outside = Math.max(-x, -z, x - W, z - H);
      if (outside > 0) dirt = Math.max(dirt, smooth(0, 6, outside) * 0.25);
      snow = Math.min(snow, 1);
      rock = Math.min(rock, 1 - snow * 0.6);
      sand *= 1 - rock;
      this.splatA[k * 4] = meadow;
      this.splatA[k * 4 + 1] = Math.min(1, dirt);
      this.splatA[k * 4 + 2] = sand;
      this.splatA[k * 4 + 3] = rock;
      this.splatB[k * 4] = snow;
      this.splatB[k * 4 + 1] = Math.max(0, Math.min(1, -above * 1.2 + 0.1)); // wet/under water
      this.splatB[k * 4 + 2] = cliff;
      this.splatB[k * 4 + 3] = n3;
    }
    this.geometry.attributes.splatA.needsUpdate = true;
    this.geometry.attributes.splatB.needsUpdate = true;
  }

  // ---------- Trampled ground around buildings ----------

  buildTrample() {
    const { W, H } = this;
    const data = new Uint8Array(W * H * 4);
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    this.trampleTex = t;
    this.uniforms.uTrample.value = t;
  }

  /**
   * Recompute trampled areas.
   * @param {{x:number,y:number,w:number,h:number}[]} rects building footprints
   */
  setTrampled(rects) {
    const { W, H } = this;
    const f = new Float32Array(W * H);
    for (const r of rects) {
      const pad = 2;
      for (let y = r.y - pad; y < r.y + r.h + pad; y++) for (let x = r.x - pad; x < r.x + r.w + pad; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dx = Math.max(r.x - x, 0, x - (r.x + r.w - 1)), dy = Math.max(r.y - y, 0, y - (r.y + r.h - 1));
        const d = Math.max(dx, dy);
        const n = vnoise(x * 0.7, y * 0.7, 21);
        const v = d === 0 ? 1 : d === 1 ? 0.75 + n * 0.25 : 0.25 + n * 0.35;
        // forecourt towards +z (entrance) a bit stronger
        f[y * W + x] = Math.max(f[y * W + x], y >= r.y + r.h ? Math.min(1, v + 0.15) : v);
      }
    }
    const d = this.trampleTex.image.data;
    for (let k = 0; k < W * H; k++) d[k * 4] = Math.round(f[k] * 255);
    this.trampleTex.needsUpdate = true;
  }

  // ---------- Height changes from the simulation ----------

  /** Remember a building surface: its edge corners lie exactly on the plane. Returns true if new. */
  setPad(id, x, y, w, h) {
    if (this.pads.has(id)) return false;
    this.pads.set(id, { x, y, w, h });
    this.updateArea(x, y, w, h);
    return true;
  }

  /** Forget a building surface (demolition); the ground stays flat in the simulation, only the corners smooth out. */
  clearPad(id) {
    const r = this.pads.get(id);
    if (!r) return;
    this.pads.delete(id);
    this.updateArea(r.x, r.y, r.w, r.h);
  }

  /**
   * Take changed tile heights (rectangle in tiles) into the mesh: corners, fine grid (Catmull-Rom
   * reaches two corners far), positions, normals and texture weights (rock by steepness) in the area.
   * @returns {{x0:number,z0:number,x1:number,z1:number}} affected world area
   */
  updateArea(x, y, w, h) {
    const { W, H, R, M, E, EW, GW, GH } = this;
    // corners of the tiles in the rectangle
    const i0 = Math.max(0, x), j0 = Math.max(0, y), i1 = Math.min(W, x + w), j1 = Math.min(H, y + h);
    this.computeCorners(i0, j0, i1, j1);
    // extended grid: at the map edge also the outer corners (they continue the edge)
    const ei0 = i0 === 0 ? -E : i0, ej0 = j0 === 0 ? -E : j0, ei1 = i1 === W ? W + E : i1, ej1 = j1 === H ? H + E : j1;
    for (let j = ej0; j <= ej1; j++) for (let i = ei0; i <= ei1; i++) this.ext[(j + E) * EW + i + E] = this.outer(i, j);
    // fine points that depend on these corners (Catmull-Rom: ±2 corners)
    const clampX = (v) => Math.max(0, Math.min(GW - 1, v)), clampY = (v) => Math.max(0, Math.min(GH - 1, v));
    const gx0 = clampX((ei0 - 2 + M) * R), gx1 = clampX((ei1 + 2 + M) * R);
    const gy0 = clampY((ej0 - 2 + M) * R), gy1 = clampY((ej1 + 2 + M) * R);
    this.fillGrid(gx0, gy0, gx1, gy1);
    const pos = this.geometry.attributes.position;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const k = gy * GW + gx;
      pos.array[k * 3 + 1] = this.grid[k];
    }
    // normals one row further (neighbouring surfaces), texture weights in the same area
    const nx0 = clampX(gx0 - 1), nx1 = clampX(gx1 + 1), ny0 = clampY(gy0 - 1), ny1 = clampY(gy1 + 1);
    this.computeNormals(nx0, ny0, nx1, ny1);
    this.computeSplat(nx0, ny0, nx1, ny1);
    const start = ny0 * GW, count = (ny1 - ny0 + 1) * GW;
    for (const [attr, n] of [[pos, 3], [this.geometry.attributes.normal, 3], [this.geometry.attributes.splatA, 4], [this.geometry.attributes.splatB, 4]]) {
      attr.clearUpdateRanges?.();
      attr.addUpdateRange?.(start * n, count * n);
      attr.needsUpdate = true;
    }
    this.version = (this.version ?? 0) + 1;
    return { x0: gx0 / R - M, z0: gy0 / R - M, x1: gx1 / R - M, z1: gy1 / R - M };
  }

  /**
   * Recompute normals of the mesh points in the area – same weighting as
   * BufferGeometry.computeVertexNormals (face normals weighted by area), so that no seams appear.
   */
  computeNormals(gx0, gy0, gx1, gy1) {
    const { GW, GH } = this;
    const p = this.geometry.attributes.position.array, n = this.geometry.attributes.normal.array;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) { const k = (gy * GW + gx) * 3; n[k] = n[k + 1] = n[k + 2] = 0; }
    const inside = (v) => { const gx = v % GW, gy = (v / GW) | 0; return gx >= gx0 && gx <= gx1 && gy >= gy0 && gy <= gy1; };
    const tri = (a, b, c) => {
      const cbx = p[c * 3] - p[b * 3], cby = p[c * 3 + 1] - p[b * 3 + 1], cbz = p[c * 3 + 2] - p[b * 3 + 2];
      const abx = p[a * 3] - p[b * 3], aby = p[a * 3 + 1] - p[b * 3 + 1], abz = p[a * 3 + 2] - p[b * 3 + 2];
      const x = cby * abz - cbz * aby, y = cbz * abx - cbx * abz, z = cbx * aby - cby * abx;
      for (const v of [a, b, c]) if (inside(v)) { n[v * 3] += x; n[v * 3 + 1] += y; n[v * 3 + 2] += z; }
    };
    for (let qy = Math.max(0, gy0 - 1); qy <= Math.min(GH - 2, gy1); qy++) for (let qx = Math.max(0, gx0 - 1); qx <= Math.min(GW - 2, gx1); qx++) {
      const a = qy * GW + qx, b = a + 1, c = a + GW, d = c + 1;
      tri(a, c, b); tri(b, c, d);
    }
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const k = (gy * GW + gx) * 3, l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
      n[k] /= l; n[k + 1] /= l; n[k + 2] /= l;
    }
  }

  /** Build height of a surface according to the simulation (plane after levelling), in world units. */
  padY(height) { return height / HEIGHT_SCALE; }

  // ---------- Material ----------

  material() {
    const q = this.q;
    const tex = terrainTextures(q.textureSize, q.anisotropy);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, color: 0xffffff });
    const u = this.uniforms;
    Object.assign(u, {
      tGrass: { value: tex.grass }, tMeadow: { value: tex.meadow }, tDirt: { value: tex.dirt }, tSand: { value: tex.sand },
      tRock: { value: tex.rock }, tSnow: { value: tex.snow }, tMacro: { value: tex.macro },
      uRep: { value: 1 / TEX_REPEAT }, uRockRep: { value: 1 / ROCK_REPEAT },
    });
    const bump = q.terrainBump ? 1 : 0;
    const lite = q.tier === 'low' ? 1 : 0; // fewer texture samples for weak devices
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
attribute vec4 splatA;
attribute vec4 splatB;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec3 vWPos;
varying vec3 vWNrm;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
vSplatA = splatA; vSplatB = splatB;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNrm = normalize(mat3(modelMatrix) * objectNormal);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D tGrass, tMeadow, tDirt, tSand, tRock, tSnow, tMacro, uTrample;
uniform float uRep, uRockRep, uSnow, uWet, uWaterY;
uniform vec2 uMapSize;
varying vec4 vSplatA;
varying vec4 vSplatB;
varying vec3 vWPos;
varying vec3 vWNrm;
float kH = 0.0;
// Two counter-rotated samples against visible tile repetition
vec3 kSample(sampler2D t, vec2 uv, float m) {
#if ${lite}
  return texture2D(t, uv).rgb;
#else
  vec3 a = texture2D(t, uv).rgb;
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.43 + vec2(0.31, 0.17);
  vec3 b = texture2D(t, uv2).rgb;
  return mix(a, b, smoothstep(0.35, 0.65, m));
#endif
}
float kLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 kPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`)
        .replace('#include <map_fragment>', `
vec2 uv = vWPos.xz * uRep;
vec4 macro = texture2D(tMacro, vWPos.xz * 0.012);
float m = macro.g;
vec3 cGrass = kSample(tGrass, uv, m);
#if ${lite}
vec3 cMeadow = mix(cGrass, cGrass * vec3(1.12, 1.08, 0.82), 0.6);
#else
vec3 cMeadow = kSample(tMeadow, uv * 0.9 + 0.5, macro.b);
#endif
vec3 cDirt = kSample(tDirt, uv, m);
vec3 cSand = kSample(tSand, uv * 0.8, m);
#if ${lite}
vec3 cSnow = vec3(0.93, 0.95, 0.98);
// Rock: one sample along the dominant axis
vec3 an = abs(normalize(vWNrm));
vec2 ruv = an.y > max(an.x, an.z) ? vWPos.xz : (an.x > an.z ? vWPos.zy : vWPos.xy);
vec3 cRock = texture2D(tRock, ruv * uRockRep).rgb;
#else
vec3 cSnow = texture2D(tSnow, uv * 0.7).rgb;
// Rock triplanar so that cliffs are not distorted
vec3 bw = pow(abs(normalize(vWNrm)), vec3(4.0));
bw /= (bw.x + bw.y + bw.z);
vec3 cRock = texture2D(tRock, vWPos.zy * uRockRep).rgb * bw.x
           + texture2D(tRock, vWPos.xz * uRockRep).rgb * bw.y
           + texture2D(tRock, vWPos.xy * uRockRep).rgb * bw.z;
#endif
// Trampled ground around buildings
float trample = texture2D(uTrample, vWPos.xz / uMapSize).r;
float inside = step(0.0, vWPos.x) * step(0.0, vWPos.z) * step(vWPos.x, uMapSize.x) * step(vWPos.z, uMapSize.y);
trample *= inside;
// Weights: grass is the rest
float wMeadow = vSplatA.x, wDirt = max(vSplatA.y, trample * 0.95), wSand = vSplatA.z, wRock = vSplatA.w;
// Winter: snow on flat ground, rock on steep slopes and cliffs stays visible, paths shimmer through
float flatness = 1.0 - smoothstep(0.18, 0.42, 1.0 - normalize(vWNrm).y);
float wSnow = max(vSplatB.x, uSnow * flatness * (1.0 - wRock * 0.55) * (1.0 - trample * 0.45) * smoothstep(0.0, 0.1, vWPos.y - uWaterY));
float wGrass = max(0.0, 1.0 - wMeadow - wDirt - wSand - wRock);
wMeadow *= (1.0 - wDirt) * (1.0 - wSand) * (1.0 - wRock);
// Height-based blending: bright texture spots win first (sharp, natural transitions)
vec4 hA = vec4(kLum(cMeadow), kLum(cDirt), kLum(cSand), kLum(cRock));
float hG = kLum(cGrass);
vec4 aA = vec4(wMeadow, wDirt, wSand, wRock) * 1.6 + hA * 0.5 * step(0.001, vec4(wMeadow, wDirt, wSand, wRock));
float aG = wGrass * 1.6 + hG * 0.5 * step(0.001, wGrass);
float aMax = max(max(max(aA.x, aA.y), max(aA.z, aA.w)), aG) - 0.25;
vec4 bA = max(aA - aMax, 0.0);
float bG = max(aG - aMax, 0.0);
float bSum = bA.x + bA.y + bA.z + bA.w + bG + 1e-4;
vec3 albedo = (cGrass * bG + cMeadow * bA.x + cDirt * bA.y + cSand * bA.z + cRock * bA.w) / bSum;
kH = (hG * bG + dot(hA, bA)) / bSum;
// Snow lies on top
float sMask = smoothstep(0.3, 0.6, wSnow + (kLum(cSnow) - 0.8) * 0.6 + (1.0 - kH) * 0.25 * wSnow);
albedo = mix(albedo, cSnow, sMask);
kH = mix(kH, kLum(cSnow) * 0.3, sMask);
// Large-scale colour variation (sun patches, richer hollows)
albedo *= 0.88 + macro.r * 0.24;
albedo = mix(albedo, albedo * vec3(1.06, 1.0, 0.86), smoothstep(0.55, 0.85, macro.b) * (1.0 - sMask) * 0.6);
// Under water and at the shore: darker, wet
float wet = vSplatB.y;
albedo *= mix(1.0, 0.62, wet);
albedo = mix(albedo, albedo * vec3(0.78, 0.9, 0.86), wet);
albedo *= 1.0 - uWet * 0.18 * (1.0 - sMask);
// Darken slightly outside the map so the playing field edge stays readable
vec2 o = max(-vWPos.xz, vWPos.xz - uMapSize);
float outside = smoothstep(0.0, 10.0, max(o.x, o.y));
albedo = mix(albedo, albedo * vec3(0.72, 0.76, 0.8), outside);
diffuseColor.rgb *= albedo;
`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(0.95, 0.55, wet * 0.8 + uWet * 0.35);
roughnessFactor = mix(roughnessFactor, 0.6, sMask * 0.5);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#if ${bump}
normal = kPerturb(-vViewPosition, normal, vec2(dFdx(kH), dFdy(kH)) * 1.4, faceDirection);
#endif`);
    };
    mat.customProgramCacheKey = () => `kronland-terrain-${bump}-${lite}`;
    return mat;
  }

  dispose() {
    this.geometry.dispose();
    this.mesh.material.dispose();
    this.trampleTex.dispose();
  }
}
