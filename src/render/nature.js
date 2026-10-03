// Nature and markers: trees (leafy, birch, conifer, KayKit pines), tree stumps, decoration scatter
// (grass tufts, flowers, bushes, pebbles, rocks), resource deposits, shaft and settlement-spot markers.
// All low-poly and flat-shaded like the KayKit buildings. Origin = ground, 1 unit = 1 tile.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instancedParts } from './assets.js';

/** Deterministic rendering random. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash3 = (x, y, z) => {
  let h = (Math.imul(Math.round(x * 1000), 73856093) ^ Math.imul(Math.round(y * 1000), 19349663) ^ Math.imul(Math.round(z * 1000), 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h ^ (h >>> 13)) / 4294967296;
};

/** Move corners at the same position together (faces stay closed). */
function jitter(geo, amount, seed = 0) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    p.setXYZ(i,
      x + (hash3(x + seed, y, z) - 0.5) * amount,
      y + (hash3(x, y + seed, z + 1) - 0.5) * amount,
      z + (hash3(x, y, z + seed + 2) - 0.5) * amount);
  }
  return geo;
}

/** Colour corners: f(x, y, z) → THREE.Color. */
function paint(geo, f) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    f(p.getX(i), p.getY(i), p.getZ(i), c, i);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

const C = (h) => new THREE.Color(h);

/** Flat: single colour with slight random variation per face. */
function solid(geo, hex, vary = 0.06, seed = 0) {
  const base = C(hex);
  return paint(geo, (x, y, z, c, i) => {
    const f = Math.floor(i / 3);
    const v = 1 + (hash3(f + seed, 0.5, 0.25) - 0.5) * vary * 2;
    c.copy(base).multiplyScalar(v);
  });
}

/** Crown: dark at the bottom, bright at the top (reads as volume from above). */
function crownPaint(geo, dark, light, y0, y1, seed) {
  const a = C(dark), b = C(light);
  return paint(geo, (x, y, z, c, i) => {
    const t = Math.max(0, Math.min(1, (y - y0) / (y1 - y0)));
    const f = Math.floor(i / 3);
    c.copy(a).lerp(b, t * t * 0.4 + t * 0.6).multiplyScalar(0.92 + hash3(f, seed, 1) * 0.16);
  });
}

// ---------- Tree geometries ----------

function trunkGeo(r0, r1, h, seg, hex, lean = 0) {
  const g = new THREE.CylinderGeometry(r1, r0, h, seg, 2);
  g.translate(0, h / 2, 0);
  if (lean) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + (p.getY(i) / h) * lean);
  }
  return solid(g, hex, 0.08, 3);
}

/** Broadleaf tree: trunk with fork, crown of several dented spheres. */
function leafyTree(detail, seed, opts = {}) {
  const r = rng(seed);
  const { trunkH = 0.62, crownR = 0.5, dark = 0x2f5a22, light = 0x8fbf4a, trunk = 0x6b4a2e, slim = 1 } = opts;
  const parts = [trunkGeo(0.085 * slim, 0.055 * slim, trunkH + 0.25, detail ? 7 : 5, trunk)];
  // two branches
  for (const s of [-1, 1]) {
    const b = new THREE.CylinderGeometry(0.025, 0.04, 0.38, 4);
    b.translate(0, 0.19, 0); b.rotateZ(s * 0.75); b.rotateY(r() * 3);
    b.translate(0, trunkH * 0.72, 0);
    parts.push(solid(b, trunk, 0.05, 4));
  }
  const blobs = detail ? 4 : 3;
  const yb = trunkH + crownR * 0.55;
  for (let k = 0; k < blobs; k++) {
    const a = (k / blobs) * Math.PI * 2 + r() * 0.8;
    const rr = crownR * (k === 0 ? 0.95 : 0.62 + r() * 0.2);
    const g = new THREE.IcosahedronGeometry(rr, detail ? 1 : 0);
    jitter(g, rr * 0.28, seed + k);
    g.scale(1, 0.85, 1);
    const off = k === 0 ? 0 : crownR * 0.48;
    g.translate(Math.cos(a) * off, yb + (k === 0 ? crownR * 0.25 : (r() - 0.3) * crownR * 0.5), Math.sin(a) * off);
    parts.push(crownPaint(g, dark, light, trunkH, trunkH + crownR * 2.1, seed + k));
  }
  return mergeGeometries(parts);
}

/** Conifer: visible trunk, tiers of cones. */
function conifer(detail, seed, opts = {}) {
  const { tiers = detail ? 4 : 3, h = 1.9, r0 = 0.5, dark = 0x1f4a2c, light = 0x4f8a4a, trunk = 0x5a3c24 } = opts;
  const parts = [trunkGeo(0.075, 0.05, 0.6, detail ? 6 : 5, trunk)];
  const seg = detail ? 8 : 6;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const rad = r0 * (1 - t * 0.68);
    const ch = (h - 0.35) / tiers * 1.55;
    const g = new THREE.ConeGeometry(rad, ch, seg, 1);
    jitter(g, rad * 0.12, seed + i);
    const y = 0.38 + t * (h - 0.35 - ch * 0.35);
    g.translate(0, y + ch / 2, 0);
    g.rotateY(i * 0.7);
    parts.push(crownPaint(g, dark, light, y, y + ch, seed + i));
  }
  return mergeGeometries(parts);
}

/** Tree stump with annual rings. */
function stumpGeo() {
  const side = new THREE.CylinderGeometry(0.09, 0.12, 0.16, 7, 1, true);
  side.translate(0, 0.08, 0);
  const top = new THREE.CircleGeometry(0.09, 7);
  top.rotateX(-Math.PI / 2); top.translate(0, 0.16, 0);
  return mergeGeometries([solid(side, 0x5d4128, 0.08), solid(top, 0xc8a46e, 0.04)]);
}

/**
 * Materials with wind and snow cover (uniforms shared).
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 */
export function natureMaterial(shared, opts = {}) {
  const { wind = 0.05, vertexColors = true, map = null, snowCap = true, upNormal = false } = opts;
  const m = new THREE.MeshStandardMaterial({ vertexColors, map, roughness: 0.88, metalness: 0, flatShading: true });
  // Wind and snow cap as uniforms: all nature materials share a few shader programs
  const uWind = { value: wind }, uSnowCap = { value: snowCap ? 1 : 0 };
  m.userData.uWind = uWind;
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uSnow = shared.uSnow;
    s.uniforms.uWind = uWind;
    s.uniforms.uSnowCap = uSnowCap;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uWind;
varying float vUp;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 ip = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
float sway = sin(uTime * 1.4 + ip.x * 0.6 + ip.y * 0.45) + sin(uTime * 2.3 + ip.x * 1.3) * 0.35;
float bend = max(0.0, position.y - 0.45);
transformed.x += sway * uWind * bend;
transformed.z += sway * uWind * 0.6 * bend;
#endif`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
#ifdef USE_INSTANCING
vUp = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
#else
vUp = normalize(mat3(modelMatrix) * objectNormal).y;
#endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSnow;
uniform float uSnowCap;
varying float vUp;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), uSnow * uSnowCap * smoothstep(0.25, 0.7, vUp));`);
    // blades: visible on both sides, but always lit like the ground (do not flip the back side)
    if (upNormal) s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
normal = normalize(vNormal);`);
  };
  m.customProgramCacheKey = () => 'kr-nature' + (upNormal ? '-up' : '');
  return m;
}

/**
 * Tree variants. kind: 'leafy' | 'birch' | 'conifer'.
 * @param {boolean} detail
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 */
export function treeVariants(detail, shared) {
  const mat = natureMaterial(shared, { wind: 0.045 });
  const v = [
    { kind: 'leafy', geometry: leafyTree(detail, 11, {}), material: mat, scale: 1.25 },
    { kind: 'leafy', geometry: leafyTree(detail, 23, { crownR: 0.56, trunkH: 0.55, dark: 0x3a6424, light: 0xa3c853 }), material: mat, scale: 1.2 },
    { kind: 'birch', geometry: leafyTree(detail, 37, { crownR: 0.4, trunkH: 0.8, trunk: 0xe6e1d4, dark: 0x5a8a2c, light: 0xc8dc6a, slim: 0.75 }), material: mat, scale: 1.2 },
    { kind: 'conifer', geometry: conifer(detail, 41, {}), material: mat, scale: 1.15 },
    { kind: 'conifer', geometry: conifer(detail, 53, { h: 2.2, r0: 0.44, tiers: detail ? 5 : 3, dark: 0x1a3f2a, light: 0x3f7a48 }), material: mat, scale: 1.15 },
  ];
  // KayKit pines as additional conifers (if loaded); stretch the crown a bit so the trunk is visible
  if (detail) {
    for (const name of ['nature/tree_single_A', 'nature/tree_single_B']) {
      const parts = instancedParts(name);
      if (!parts) continue;
      const geo = mergeGeometries(parts.map((p) => {
        const g = p.geometry.clone();
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        g.translate(0, 0.1, 0);
        return g;
      }));
      if (!geo) continue;
      v.push({ kind: 'conifer', geometry: geo, material: natureMaterial(shared, { wind: 0.04, vertexColors: false, map: parts[0].material.map }), scale: 1.55 });
    }
  }
  for (const t of v) { t.geometry.computeBoundingSphere(); }
  return v;
}

export function stumpVariant(shared) {
  return { geometry: stumpGeo(), material: natureMaterial(shared, { wind: 0, snowCap: true }) };
}

// ---------- Decoration scatter ----------

/** Grass tuft of narrow, bent blades. */
function grassTuft(seed, palette) {
  const r = rng(seed);
  const parts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const h = 0.12 + r() * 0.14, w = 0.025 + r() * 0.015;
    const g = new THREE.BufferGeometry();
    const tip = (r() - 0.5) * 0.08;
    const v = new Float32Array([-w, 0, 0, w, 0, 0, tip, h, 0.02]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    g.rotateY(r() * Math.PI);
    g.translate((r() - 0.5) * 0.14, 0, (r() - 0.5) * 0.14);
    const base = C(palette[0]), top = C(palette[1]);
    parts.push(paint(g, (x, y, z, c) => c.copy(base).lerp(top, Math.min(1, y / 0.2))));
  }
  const m = mergeGeometries(parts);
  // normals upwards so the blades are lit like the ground
  const nr = m.attributes.normal;
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
  return m;
}

function flowerPatch(seed, color) {
  const r = rng(seed);
  const parts = [grassTuft(seed + 1, [0x4f7a2c, 0x86b04a])];
  for (let i = 0; i < 4; i++) {
    const h = 0.12 + r() * 0.1;
    const stem = new THREE.CylinderGeometry(0.006, 0.008, h, 3, 1, true);
    stem.translate((r() - 0.5) * 0.16, h / 2, (r() - 0.5) * 0.16);
    const p = stem.attributes.position;
    const sx = p.getX(0), sz = p.getZ(0);
    parts.push(solid(stem, 0x4a7a2a, 0));
    const blossom = new THREE.OctahedronGeometry(0.032, 0);
    blossom.scale(1, 0.6, 1);
    blossom.translate(sx, h, sz);
    parts.push(solid(blossom, color, 0.1));
  }
  const m = mergeGeometries(parts);
  return m;
}

function bushGeo(seed, dark, light) {
  const r = rng(seed);
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const rr = 0.16 + r() * 0.1;
    const g = new THREE.IcosahedronGeometry(rr, 0);
    jitter(g, rr * 0.3, seed + k);
    g.scale(1, 0.75, 1);
    g.translate((r() - 0.5) * 0.25, rr * 0.6, (r() - 0.5) * 0.25);
    parts.push(crownPaint(g, dark, light, 0, 0.4, seed + k));
  }
  return mergeGeometries(parts);
}

function pebbleGeo(seed) {
  const r = rng(seed);
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const rr = 0.04 + r() * 0.05;
    const g = new THREE.OctahedronGeometry(rr, 0);
    jitter(g, rr * 0.4, seed + k);
    g.scale(1, 0.5, 1);
    g.translate((r() - 0.5) * 0.3, rr * 0.2, (r() - 0.5) * 0.3);
    parts.push(solid(g, [0x8f8a80, 0xa39d92, 0x7b766e][k], 0.06, k));
  }
  return mergeGeometries(parts);
}

function rockGeo(seed, size = 1) {
  const r = rng(seed);
  const parts = [];
  const n = 2 + ((r() * 2) | 0);
  for (let k = 0; k < n; k++) {
    const rr = (k === 0 ? 0.35 : 0.18 + r() * 0.12) * size;
    const g = new THREE.DodecahedronGeometry(rr, 0);
    jitter(g, rr * 0.35, seed + k * 7);
    g.scale(1, 0.7 + r() * 0.3, 1);
    g.translate(k === 0 ? 0 : (r() - 0.5) * 0.6 * size, rr * 0.45, k === 0 ? 0 : (r() - 0.5) * 0.6 * size);
    parts.push(paint(g, (x, y, z, c, i) => {
      const f = Math.floor(i / 3);
      c.setHex(0x8c877e).multiplyScalar(0.82 + hash3(f, seed, k) * 0.3);
      if (y > rr * 0.9 && hash3(f, 2, seed) > 0.6) c.lerp(C(0x7a8a4a), 0.4); // moss on top
    }));
  }
  return mergeGeometries(parts);
}

/**
 * Scatter kinds. Each: { name, geometry, material, winter: visible in winter }
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 */
export function scatterKinds(shared) {
  const soft = natureMaterial(shared, { wind: 0.12, snowCap: false, upNormal: true });
  soft.flatShading = false;
  soft.side = THREE.DoubleSide;
  const plant = natureMaterial(shared, { wind: 0.03 });
  const stone = natureMaterial(shared, { wind: 0 });
  const kinds = {
    grass: { geometry: grassTuft(3, [0x406a26, 0x8cbc4a]), material: soft, winter: false },
    grassDry: { geometry: grassTuft(5, [0x6a7a34, 0xc2c070]), material: soft, winter: false },
    flowerW: { geometry: flowerPatch(7, 0xf6f2e6), material: soft, winter: false },
    flowerY: { geometry: flowerPatch(9, 0xf7cf3a), material: soft, winter: false },
    flowerP: { geometry: flowerPatch(11, 0xc770c8), material: soft, winter: false },
    flowerR: { geometry: flowerPatch(12, 0xe0503a), material: soft, winter: false },
    bush: { geometry: bushGeo(13, 0x2d5a24, 0x76a844), material: plant, winter: true },
    bushB: { geometry: bushGeo(17, 0x3e5c22, 0x9ab04c), material: plant, winter: true },
    pebbles: { geometry: pebbleGeo(19), material: stone, winter: true },
    rock: { geometry: rockGeo(23), material: stone, winter: true },
    rockB: { geometry: rockGeo(29, 1.4), material: stone, winter: true },
    reeds: { geometry: reedsGeo(31), material: soft, winter: false },
  };
  // KayKit models in addition (if loaded): rocks, rock peaks, water lilies
  const kay = (name, key, winter, snowCap = true) => {
    const parts = instancedParts(name);
    if (!parts) return;
    const g = mergeGeometries(parts.map((p) => {
      const c = p.geometry.clone();
      for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
      return c;
    }));
    if (g) kinds[key] = { geometry: g, material: natureMaterial(shared, { wind: 0, vertexColors: false, map: parts[0].material.map, snowCap }), winter };
  };
  for (const n of ['A', 'B', 'C', 'D', 'E']) kay(`nature/rock_single_${n}`, 'kk' + n, true);
  for (const n of ['A', 'B', 'C']) kay(`nature/mountain_${n}`, 'mt' + n, true);
  for (const n of ['A', 'B']) kay(`nature/waterlily_${n}`, 'lily' + n, false, false);
  return kinds;
}

function reedsGeo(seed) {
  const r = rng(seed);
  const parts = [];
  for (let i = 0; i < 9; i++) {
    const h = 0.3 + r() * 0.3;
    const g = new THREE.CylinderGeometry(0.006, 0.012, h, 3);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.3); g.rotateX((r() - 0.5) * 0.3);
    g.translate((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
    parts.push(paint(g, (x, y, z, c) => c.setHex(0x55702a).lerp(C(0xb4b060), Math.min(1, y / 0.5))));
    if (i % 3 === 0) {
      const head = new THREE.CylinderGeometry(0.018, 0.018, 0.07, 4);
      const p = g.attributes.position;
      let top = 0; for (let k = 1; k < p.count; k++) if (p.getY(k) > p.getY(top)) top = k;
      head.translate(p.getX(top), p.getY(top), p.getZ(top));
      parts.push(solid(head, 0x6b4426, 0.05));
    }
  }
  return mergeGeometries(parts);
}

// ---------- Resource deposits, shafts, settlement spots ----------

const shared0 = { uTime: { value: 0 }, uSnow: { value: 0 } };
/** Shared uniforms of the markers (snow). */
export const markerUniforms = shared0;
const markerMats = new Map();
function mmat(key, opts) {
  if (!markerMats.has(key)) markerMats.set(key, natureMaterial(shared0, { wind: 0, ...opts }));
  return markerMats.get(key);
}
function vmesh(geo, key = 'v') {
  const m = new THREE.Mesh(geo, mmat(key, {}));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const DEPOSIT = {
  clay: { base: 0x8a5a3a, chunks: [0xb5653a, 0xc4774a, 0x9c5232], accent: 0xd89a6a },
  stone: { base: 0x7f7b74, chunks: [0xb2aea4, 0x9a968e, 0xc4c0b6], accent: 0xdcd8ce },
  iron: { base: 0x4c4d52, chunks: [0x5e6068, 0x6d717c, 0x8a4a2e], accent: 0xb5562c },
  sulfur: { base: 0x77705a, chunks: [0xe8cf3a, 0xd8c33a, 0xf2e266], accent: 0xfff27a },
};

/** Resource deposit: flat mound with chunks in the resource colour. */
export function depositModel(res, seed = 1) {
  const d = DEPOSIT[res] ?? DEPOSIT.stone;
  const r = rng(seed * 31 + res.length);
  const parts = [];
  const mound = new THREE.IcosahedronGeometry(0.45, 1);
  jitter(mound, 0.12, seed);
  mound.scale(1, 0.32, 1);
  mound.translate(0, 0.02, 0);
  parts.push(crownPaint(mound, d.base, d.chunks[0], -0.1, 0.18, seed));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    const dd = i === 0 ? 0 : 0.18 + r() * 0.22;
    const rr = (i === 0 ? 0.2 : 0.09 + r() * 0.08);
    let g;
    if (res === 'sulfur' && i % 2 === 1) {
      g = new THREE.OctahedronGeometry(rr * 0.8, 0); g.scale(0.6, 1.6, 0.6);
      g.rotateZ((r() - 0.5) * 0.6);
    } else if (res === 'clay') {
      g = new THREE.BoxGeometry(rr * 1.6, rr * 0.8, rr * 1.1); g.rotateY(r() * 3); g.rotateX((r() - 0.5) * 0.4);
    } else {
      g = new THREE.DodecahedronGeometry(rr, 0); jitter(g, rr * 0.3, seed + i);
    }
    g.translate(Math.cos(a) * dd, 0.1 + rr * 0.6 + (i === 0 ? 0.08 : 0), Math.sin(a) * dd);
    parts.push(solid(g, d.chunks[i % d.chunks.length], 0.1, i + seed));
  }
  // small accents (veins, crystals)
  for (let i = 0; i < 5; i++) {
    const g = new THREE.TetrahedronGeometry(0.05 + r() * 0.03, 0);
    const a = r() * Math.PI * 2, dd = 0.1 + r() * 0.3;
    g.translate(Math.cos(a) * dd, 0.16 + r() * 0.12, Math.sin(a) * dd);
    parts.push(solid(g, d.accent, 0.05, i));
  }
  const g = new THREE.Group();
  g.add(vmesh(mergeGeometries(parts), 'v'));
  if (res === 'iron' || res === 'sulfur') {
    // glitter: metallic or glowing splinters
    const sp = [];
    for (let i = 0; i < 4; i++) {
      const s = new THREE.OctahedronGeometry(0.035, 0);
      const a = r() * Math.PI * 2, dd = 0.1 + r() * 0.25;
      s.translate(Math.cos(a) * dd, 0.22 + r() * 0.1, Math.sin(a) * dd);
      sp.push(s);
    }
    const m = new THREE.Mesh(mergeGeometries(sp), new THREE.MeshStandardMaterial({
      color: res === 'iron' ? 0xc0c6d0 : 0xfff07a, metalness: res === 'iron' ? 0.8 : 0, roughness: 0.3,
      emissive: res === 'sulfur' ? 0x6a5a10 : 0x000000, flatShading: true,
    }));
    g.add(m);
  }
  g.scale.setScalar(1.15);
  return g;
}

function plank(w, h, d, hex, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y + h / 2, z);
  return solid(g, hex, 0.08);
}

/** Shaft: stone ring, dark pit, wooden headframe and resource chunks. */
export function shaftMarker(res) {
  const g = new THREE.Group();
  const parts = [];
  const r = rng(res.length * 17 + 5);
  // stone ring
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const s = new THREE.DodecahedronGeometry(0.15 + r() * 0.05, 0);
    jitter(s, 0.06, i);
    s.scale(1, 0.7, 1);
    s.translate(Math.cos(a) * 0.68, 0.08, Math.sin(a) * 0.68);
    parts.push(solid(s, 0x8f8a80, 0.12, i));
  }
  // headframe
  const wood = 0x6b4a2e;
  for (const sx of [-1, 1]) {
    const leg = new THREE.BoxGeometry(0.08, 1.15, 0.08);
    leg.translate(0, 0.575, 0); leg.rotateZ(sx * 0.18); leg.translate(sx * 0.62, 0, 0);
    parts.push(solid(leg, wood, 0.06));
  }
  parts.push(plank(1.15, 0.08, 0.1, wood, 0, 1.1, 0));
  const wheel = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 10);
  wheel.rotateX(Math.PI / 2); wheel.translate(0, 1.1, 0.08);
  parts.push(solid(wheel, 0x4a3420, 0.04));
  // rope
  const rope = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 4);
  rope.translate(0, 0.62, 0.1);
  parts.push(solid(rope, 0xc8b48a, 0));
  // pile in resource colour
  const d = DEPOSIT[res] ?? DEPOSIT.stone;
  for (let i = 0; i < 6; i++) {
    const s = new THREE.DodecahedronGeometry(0.08 + r() * 0.06, 0);
    s.translate(0.85 + r() * 0.35, 0.06, 0.55 + r() * 0.35);
    parts.push(solid(s, d.chunks[i % d.chunks.length], 0.1, i));
  }
  // sign
  parts.push(plank(0.05, 0.6, 0.05, wood, -0.95, 0, 0.75));
  parts.push(plank(0.36, 0.22, 0.04, 0xc8a878, -0.95, 0.42, 0.78));
  const badge = new THREE.CircleGeometry(0.07, 8);
  badge.translate(-0.95, 0.53, 0.805);
  parts.push(solid(badge, d.chunks[0], 0));
  g.add(vmesh(mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p))));
  // pit: dark funnel instead of a flat disc, two boards above it
  const pit = new THREE.CylinderGeometry(0.6, 0.18, 0.5, 14, 1, true);
  pit.translate(0, -0.2, 0);
  const pitMat = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 1, side: THREE.BackSide });
  const pm = new THREE.Mesh(pit, pitMat); pm.receiveShadow = true; g.add(pm);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 1 }));
  floor.position.y = -0.44; g.add(floor);
  const boards = mergeGeometries([plank(1.2, 0.04, 0.16, 0x7a5634, 0, 0.05, -0.18), plank(1.2, 0.04, 0.16, 0x6b4a2e, 0, 0.05, 0.22)]);
  const bm = vmesh(boards); bm.rotation.y = 0.3; g.add(bm);
  return g;
}

/** Settlement spot: corner stakes with rope, pennant mast. */
export function spotMarker() {
  const g = new THREE.Group();
  const parts = [];
  const wood = 0x7a5634;
  const pts = [[-1.7, -1.7], [1.7, -1.7], [1.7, 1.7], [-1.7, 1.7]];
  for (const [x, z] of pts) {
    parts.push(plank(0.1, 0.5, 0.1, wood, x, 0, z));
    const tip = new THREE.ConeGeometry(0.07, 0.12, 4); tip.translate(x, 0.56, z);
    parts.push(solid(tip, 0xe6d6b0, 0));
  }
  for (let i = 0; i < 4; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    const rope = new THREE.BoxGeometry(len, 0.025, 0.025);
    rope.rotateY(-Math.atan2(bz - az, bx - ax));
    rope.translate((ax + bx) / 2, 0.4, (az + bz) / 2);
    parts.push(solid(rope, 0xe8dcc0, 0));
  }
  // mast with pennant and stone base
  for (let i = 0; i < 6; i++) {
    const s = new THREE.DodecahedronGeometry(0.12, 0);
    const a = (i / 6) * Math.PI * 2;
    s.translate(Math.cos(a) * 0.18, 0.06, Math.sin(a) * 0.18);
    parts.push(solid(s, 0x9a958a, 0.1, i));
  }
  parts.push(plank(0.07, 1.6, 0.07, 0x5a3c24, 0, 0, 0));
  g.add(vmesh(mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p))));
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0.03, 1.55, 0, 0.6, 1.42, 0, 0.03, 1.22, 0]), 3));
  cloth.computeVertexNormals();
  const flag = new THREE.Mesh(cloth, new THREE.MeshStandardMaterial({ color: 0xf2e4be, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.name = 'banner';
  flag.castShadow = true;
  g.add(flag);
  return g;
}
