// Levels of detail (LOD) by distance/zoom and visibility check (frustum) for instanced objects.
//
// Basic idea: every object (building, tree chunk, figure) gets an "effective distance" to the camera.
// It takes the field of view into account (phone in portrait has a wider field of view) and the graphics level
// (low = simplify earlier). From the distance follows level 0 (full) … n (simplest);
// a hysteresis prevents flicker when an object stands exactly on a threshold.
//
// The pure computation functions above are testable without WebGL (tests/render/lod.test.js).

import * as THREE from 'three';

/** @typedef {'low'|'medium'|'high'} QualityTier */

/**
 * Threshold distances per object group (in world units = tiles, at level "high" and 40° field of view).
 * An object beyond the last value is level thresholds.length (e.g. figures: rigid pose).
 * `cull`: distance from which nothing is drawn any more (Infinity = never).
 * `minBias`: lower bound for the graphics-level factor (figures should still walk on "low" at normal
 * game height and not glide as a rigid pose).
 */
export const LOD_PROFILES = {
  building: { thresholds: [38, 72], cull: Infinity },
  tree: { thresholds: [30, 62], cull: Infinity },
  // Figures by screen height (CSS pixels), see screenHeightPx: near model from 80 px (even the phone on
  // "low" shows it when zoomed "close"), below that the game model; below 28 px animation throttled, below
  // 12 px rigid, below 3 px not drawn at all
  character: { pixels: [80, 28, 12], cullPixels: 3, minBias: 0.8 },
  scatterSmall: { thresholds: [], cull: 66 },
  scatterLarge: { thresholds: [], cull: Infinity },
  effect: { thresholds: [], cull: 120 },
};

/** Shift of the thresholds per graphics level (<1 = simplify earlier) and hysteresis (fraction). */
export const LOD_TIERS = {
  high: { bias: 1, hysteresis: 0.1, scatterFade: 1 },
  medium: { bias: 0.8, hysteresis: 0.1, scatterFade: 0.78 },
  low: { bias: 0.55, hysteresis: 0.12, scatterFade: 0.48 },
};

/**
 * Up to this real distance (tiles) level 0 always applies, also on "low" and in portrait:
 * it lies below all first thresholds including hysteresis (figures: 16 · 0.9), and the effective distance is
 * at most the real one here.
 */
export const NEAR_FULL_DETAIL = 14;

const REF_TAN = Math.tan(THREE.MathUtils.degToRad(20)); // 40° field of view = reference

/**
 * Screen height of an object in pixels (like Unity's "Screen Relative Transition Height"): the same size on
 * screen yields the same level – on phone and desktop, at every field of view and zoom.
 * @param {number} worldHeight height in world units @param {number} dist distance to the camera
 * @param {number} fovDeg vertical field of view @param {number} viewH height of the canvas (CSS pixels)
 */
export function screenHeightPx(worldHeight, dist, fovDeg, viewH) {
  return (worldHeight * viewH) / (2 * Math.max(1e-3, dist) * Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)));
}

/** Pixel height → measure that grows with size like a distance (for selectLod/LodState). */
export const PIXEL_REF = 1000;
export const pixelMetric = (px) => PIXEL_REF / Math.max(1e-3, px);

/**
 * Effective distance: real distance, corrected for the field of view (wider field of view = object smaller
 * on screen = as if farther away) and the graphics level.
 * @param {number} dist real distance camera–object
 * @param {number} fovDeg vertical field of view of the camera
 * @param {number} bias graphics-level factor (LOD_TIERS[tier].bias)
 */
export function effectiveDistance(dist, fovDeg = 40, bias = 1) {
  const t = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) / REF_TAN;
  const eff = (dist * t) / Math.max(0.05, bias);
  // close view: full level of detail regardless of field of view and graphics level; beyond it a continuous transition
  // (no jump at the threshold, which would make levels flicker)
  if (eff <= dist) return eff;
  const w = Math.max(0, Math.min(1, (dist - NEAR_FULL_DETAIL) / (NEAR_FULL_DETAIL * 0.5)));
  return dist + (eff - dist) * w;
}

/**
 * Level of detail with hysteresis. A switch to coarser only at distance > threshold·(1+h),
 * back to finer only at distance < threshold·(1−h). Without a previous level (current < 0) without hysteresis.
 * @param {number} dist effective distance
 * @param {number} current previous level (−1 = none)
 * @param {number[]} thresholds ascending threshold distances
 * @param {number} [h] hysteresis fraction (0.1 = ±10 %)
 * @returns {number} level 0 … thresholds.length
 */
export function selectLod(dist, current, thresholds, h = 0.1) {
  const n = thresholds.length;
  if (current < 0 || current > n) {
    let lvl = 0;
    while (lvl < n && dist > thresholds[lvl]) lvl++;
    return lvl;
  }
  let lvl = current;
  // become coarser
  while (lvl < n && dist > thresholds[lvl] * (1 + h)) lvl++;
  // become finer
  while (lvl > 0 && dist < thresholds[lvl - 1] * (1 - h)) lvl--;
  return lvl;
}

/**
 * Visibility across a cull threshold with hysteresis.
 * @param {number} dist @param {boolean} wasVisible @param {number} cull @param {number} [h]
 */
export function withinCull(dist, wasVisible, cull, h = 0.1) {
  if (!Number.isFinite(cull)) return true;
  return wasVisible ? dist < cull * (1 + h) : dist < cull * (1 - h);
}

/**
 * Thresholds and hysteresis for an object group and graphics level.
 * @param {keyof typeof LOD_PROFILES} kind @param {QualityTier} tier
 */
export function lodSettings(kind, tier) {
  const p = LOD_PROFILES[kind], t = LOD_TIERS[tier] ?? LOD_TIERS.high;
  const bias = Math.max(t.bias, p.minBias ?? 0);
  // pixel profiles: thresholds as pixelMetric (larger = smaller on screen); the caller passes
  // pixelMetric(pixel height · bias)
  if (p.pixels) return { thresholds: p.pixels.map(pixelMetric), cull: pixelMetric(p.cullPixels ?? 1), h: t.hysteresis, bias, pixels: true };
  return { thresholds: p.thresholds, cull: p.cull, h: t.hysteresis, bias };
}

/**
 * State for an object: holds the level and decides anew each frame.
 * Deliberately small (created for hundreds of figures).
 */
export class LodState {
  constructor() { this.level = -1; this.visible = true; }
  /**
   * @param {number} effDist effective distance
   * @param {{thresholds:number[], cull:number, h:number}} s
   * @returns {number} level, or −1 if beyond the cull threshold
   */
  update(effDist, s) {
    this.visible = withinCull(effDist, this.visible && this.level >= 0, s.cull, s.h);
    if (!this.visible) { this.level = -1; return -1; }
    this.level = selectLod(effDist, this.level, s.thresholds, s.h);
    return this.level;
  }
}

/** Counter for the debug display: group name → count per level. */
export class LodCounter {
  constructor() { /** @type {Record<string, number[]>} */ this.groups = {}; }
  reset(name) { (this.groups[name] ??= []).fill(0); }
  add(name, level, n = 1) {
    const g = (this.groups[name] ??= []);
    while (g.length <= level) g.push(0);
    g[level] += n;
  }
}

// ---------- Chunk grid for instanced objects ----------

const _sphere = new THREE.Sphere();

/**
 * Instances (trees, scatter decoration) in a chunk grid. Per chunk the matrices lie contiguously;
 * per frame (only if the camera has moved) visible chunks are selected by frustum, one level
 * of detail is determined per chunk and the matrices are copied into a few dynamic InstancedMeshes (one per level).
 * Whole chunks outside the screen or beyond the cull threshold thus drop out without a draw call,
 * and it stays at one draw call per level (instead of one per chunk).
 */
export class ChunkedInstances {
  /**
   * @param {{
   *   name: string,
   *   chunkSize?: number,
   *   levels: { geometry: THREE.BufferGeometry, material: THREE.Material|THREE.Material[], castShadow?: boolean, receiveShadow?: boolean }[],
   *   colors?: boolean,
   *   kind?: keyof typeof LOD_PROFILES,
   * }} opts
   */
  constructor(opts) {
    this.name = opts.name;
    this.size = opts.chunkSize ?? 8;
    this.kind = opts.kind ?? 'tree';
    this.useColors = !!opts.colors;
    /** @type {Map<number, {x:number, z:number, m:number[], c:number[]}>} */
    this.staging = new Map();
    this.count = 0;
    this.levelDefs = opts.levels;
    /** @type {THREE.InstancedMesh[]} */
    this.meshes = [];
    /** @type {{key:number, cx:number, cz:number, sphere:THREE.Sphere, matrices:Float32Array, colors:Float32Array|null, n:number, lod:LodState}[]} */
    this.chunks = [];
    this.dirty = true;
    this.userData = {};
  }

  /** Add an instance (before finalize). @returns {{chunk:number, index:number}} handle for hiding later */
  add(x, z, matrix, color) {
    const key = Math.floor(x / this.size) * 4096 + Math.floor(z / this.size);
    let s = this.staging.get(key);
    if (!s) { s = { x: Math.floor(x / this.size), z: Math.floor(z / this.size), m: [], c: [] }; this.staging.set(key, s); }
    const index = s.m.length / 16;
    for (let i = 0; i < 16; i++) s.m.push(matrix.elements[i]);
    if (this.useColors) { const c = color ?? { r: 1, g: 1, b: 1 }; s.c.push(c.r, c.g, c.b); }
    this.count++;
    return { key, index };
  }

  /** Finish the chunks and create the InstancedMeshes. @param {THREE.Object3D} parent */
  finalize(parent) {
    const keyToChunk = new Map();
    const v = new THREE.Vector3();
    for (const [key, s] of this.staging) {
      const n = s.m.length / 16;
      const matrices = new Float32Array(s.m);
      const box = new THREE.Box3();
      const r = this.levelDefs[0].geometry.boundingSphere ?? (this.levelDefs[0].geometry.computeBoundingSphere(), this.levelDefs[0].geometry.boundingSphere);
      for (let i = 0; i < n; i++) {
        v.set(matrices[i * 16 + 12], matrices[i * 16 + 13], matrices[i * 16 + 14]);
        const sc = Math.hypot(matrices[i * 16], matrices[i * 16 + 1], matrices[i * 16 + 2]);
        const c = r.center;
        box.expandByPoint(new THREE.Vector3(v.x + c.x * sc, v.y + c.y * sc, v.z + c.z * sc).addScalar(r.radius * sc));
        box.expandByPoint(new THREE.Vector3(v.x + c.x * sc, v.y + c.y * sc, v.z + c.z * sc).addScalar(-r.radius * sc));
      }
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      keyToChunk.set(key, this.chunks.length);
      this.chunks.push({ key, cx: s.x, cz: s.z, sphere, matrices, colors: this.useColors ? new Float32Array(s.c) : null, n, lod: new LodState() });
    }
    this.keyToChunk = keyToChunk;
    this.staging = null;
    const cap = Math.max(1, this.count);
    this.meshes = this.levelDefs.map((d, i) => {
      const m = new THREE.InstancedMesh(d.geometry, d.material, cap);
      m.count = 0;
      m.name = `${this.name}-lod${i}`;
      m.castShadow = d.castShadow ?? true;
      m.receiveShadow = d.receiveShadow ?? true;
      m.frustumCulled = false; // visibility check is done per chunk
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (this.useColors) {
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      parent.add(m);
      return m;
    });
    this.dirty = true;
  }

  /** Hide an instance (tree felled, decoration under a building). */
  hide(handle) {
    const ci = this.keyToChunk?.get(handle.key);
    if (ci === undefined) return;
    const m = this.chunks[ci].matrices, o = handle.index * 16;
    for (let i = 0; i < 16; i++) m[o + i] = 0;
    this.dirty = true;
  }

  /**
   * Raise or lower visible instances in a world area (x/z), e.g. after levelling.
   * @param {(x:number, z:number) => number} dy height change at the position of the instance
   */
  shiftY(x0, z0, x1, z1, dy) {
    for (const c of this.chunks) {
      if ((c.cx + 1) * this.size < x0 || c.cx * this.size > x1 || (c.cz + 1) * this.size < z0 || c.cz * this.size > z1) continue;
      const m = c.matrices;
      for (let o = 0; o < c.n * 16; o += 16) {
        if (m[o + 15] === 0) continue; // hidden
        const x = m[o + 12], z = m[o + 14];
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        const d = dy(x, z);
        if (d) { m[o + 13] += d; this.dirty = true; }
      }
    }
  }

  set visible(v) { for (const m of this.meshes) m.visible = v; }
  get visible() { return this.meshes[0]?.visible ?? false; }

  /**
   * Collect visible chunks.
   * @param {THREE.Frustum} frustum
   * @param {THREE.Vector3} camPos
   * @param {(d:number) => number} eff Abstand → effektiver Abstand
   * @param {{thresholds:number[], cull:number, h:number}} s
   * @param {LodCounter} [counter]
   */
  update(frustum, camPos, eff, s, counter) {
    const nLevels = this.meshes.length;
    const counts = new Array(nLevels).fill(0);
    const mats = this.meshes.map((m) => m.instanceMatrix.array);
    const cols = this.useColors ? this.meshes.map((m) => m.instanceColor.array) : null;
    for (const c of this.chunks) {
      if (!frustum.intersectsSphere(c.sphere)) continue;
      const d = Math.max(0, c.sphere.center.distanceTo(camPos) - c.sphere.radius * 0.5);
      let lvl = c.lod.update(eff(d), s);
      if (lvl < 0) continue;
      lvl = Math.min(lvl, nLevels - 1);
      mats[lvl].set(c.matrices, counts[lvl] * 16);
      if (cols) cols[lvl].set(c.colors, counts[lvl] * 3);
      counts[lvl] += c.n;
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i];
      const im = m.instanceMatrix;
      im.clearUpdateRanges(); im.addUpdateRange(0, Math.max(1, counts[i]) * 16); im.needsUpdate = true;
      if (m.instanceColor) {
        m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, Math.max(1, counts[i]) * 3); m.instanceColor.needsUpdate = true;
      }
      counter?.add(this.kind, i, counts[i]);
    });
    this.dirty = false;
  }
}

/**
 * Remembers the camera and reports whether the view has changed so much that chunks must be
 * collected anew.
 */
export class ViewTracker {
  constructor() { this.pos = new THREE.Vector3(Infinity, 0, 0); this.dir = new THREE.Vector3(); this.fov = 0; this.aspect = 0; }
  /** @param {THREE.PerspectiveCamera} cam */
  changed(cam, posEps = 0.25, dirEps = 0.0004) {
    const dir = cam.getWorldDirection(_v);
    if (this.pos.distanceToSquared(cam.position) > posEps * posEps || 1 - dir.dot(this.dir) > dirEps || cam.fov !== this.fov || cam.aspect !== this.aspect) {
      this.pos.copy(cam.position); this.dir.copy(dir); this.fov = cam.fov; this.aspect = cam.aspect;
      return true;
    }
    return false;
  }
}
const _v = new THREE.Vector3();

/** Frustum of the camera (reused). */
export function cameraFrustum(cam, out = new THREE.Frustum()) {
  _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return out.setFromProjectionMatrix(_m);
}
const _m = new THREE.Matrix4();

/** Sphere test against a frustum with a reused sphere. */
export function sphereVisible(frustum, x, y, z, r) {
  _sphere.center.set(x, y, z); _sphere.radius = r;
  return frustum.intersectsSphere(_sphere);
}

/**
 * Split a large grid mesh (terrain, water) into tiles so that the visibility check discards whole areas.
 * The sub-meshes share attributes (positions, normals, …) with the original – changes to the original
 * (levelling, splat) thus continue to take effect; only the index is split per tile.
 * @param {THREE.Mesh} mesh indexed mesh
 * @param {number} cell edge length of a tile in world units (local x/z coordinates)
 * @returns {THREE.Group} group with the same pose as the original
 */
export function splitGridMesh(mesh, cell = 32) {
  const g = mesh.geometry;
  const pos = g.attributes.position, idx = g.index.array;
  const buckets = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const key = Math.floor(cx / cell) * 65536 + Math.floor(cz / cell);
    let list = buckets.get(key);
    if (!list) { list = []; buckets.set(key, list); }
    list.push(a, b, c);
  }
  const group = new THREE.Group();
  group.name = mesh.name + '-chunks';
  group.position.copy(mesh.position); group.quaternion.copy(mesh.quaternion); group.scale.copy(mesh.scale);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const list of buckets.values()) {
    const cg = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(g.attributes)) cg.setAttribute(k, a);
    const I = pos.count > 65535 ? Uint32Array : Uint16Array;
    cg.setIndex(new THREE.BufferAttribute(new I(list), 1));
    box.makeEmpty();
    for (const i of list) box.expandByPoint(v.fromBufferAttribute(pos, i));
    // headroom above/below for waves and later levelling
    box.min.y -= 1; box.max.y += 1;
    cg.boundingBox = box.clone();
    cg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(cg, mesh.material);
    m.name = mesh.name;
    m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow;
    m.renderOrder = mesh.renderOrder;
    m.userData = mesh.userData;
    group.add(m);
  }
  return group;
}
