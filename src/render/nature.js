// Nature and markers: trees (own models, otherwise procedural: broadleaf, birch, conifer), tree stumps, decoration scatter
// (grass tufts, flowers, bushes, pebbles, rocks), resource deposits, shaft and settlement-spot markers.
// All low-poly and flat-shaded like the KayKit buildings. Origin = ground, 1 unit = 1 tile.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instancedParts } from './assets.js';
import { getQuality } from './quality.js';
import { natureDetailTexture } from './naturetex.js';
import { TREE_MODELS, BUSH_MODEL, TREE_LOD_FILES, BUSH_LOD_FILES, seasonLevels } from './treeModels.js';

/**
 * Texture per nature kind (bush also uses the broadleaf trees' texture): packed channels (R, G), repetitions per tile, strength per channel, mask and colour accent.
 * mask 'tree': channel R on green faces (crown), G on brown/light faces with red > green (trunk, branches);
 * 'all': channel R everywhere (rock). tint: colour shift per unit of texture (highlights warmer, shadows cooler).
 */
export const NATURE_DETAIL = {
  leafy: { spec: [{ kind: 'leaves' }, { kind: 'bark', rep: 3 }], scale: 0.8, k: [0.95, 0.8], mask: 'tree', tint: [0.10, 0.05, -0.10] },
  conifer: { spec: [{ kind: 'needles' }, { kind: 'bark', rep: 2 }], scale: 0.65, k: [0.95, 0.8], mask: 'tree', tint: [0.06, 0.06, -0.06] },
  bush: { spec: [{ kind: 'leaves' }, { kind: 'bark', rep: 3 }], scale: 0.95, k: [0.9, 0], mask: 'tree', tint: [0.10, 0.05, -0.10] },
  rock: { spec: [{ kind: 'boulder' }], scale: 1.0, k: [0.75, 0], mask: 'all', tint: [0.03, 0.02, -0.03] },
  kayRock: { spec: [{ kind: 'boulder' }], scale: 0.9, k: [0.7, 0], mask: 'all', tint: [0.03, 0.02, -0.03] },
  // resource piles and stone ring of the shafts: small objects, hence finer and stronger rock texture
  ore: { spec: [{ kind: 'boulder' }], scale: 2.4, k: [1.15, 0], mask: 'all', tint: [0.06, 0.03, -0.06] },
  // boards and beams (headframe, sign): fine grain
  timber: { spec: [{ kind: 'bark', rep: 2 }], scale: 1.5, k: [1.0, 0], mask: 'all', tint: [0.08, 0.04, -0.06] },
  // wood (tree stumps, root stock): bark everywhere
  wood: { spec: [{ kind: 'bark', rep: 3 }], scale: 0.8, k: [0.8, 0], mask: 'all', tint: [0.08, 0.04, -0.06] },
};

/** Texture switched off? (?nature=off for comparison, level "low" for performance reasons) */
export function natureDetailOff() {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('nature') === 'off') return true;
  return getQuality().tier === 'low';
}

/**
 * Painted texture for a nature kind (option `detail` of natureMaterial), or null (switched off, image missing).
 * @param {keyof typeof NATURE_DETAIL} name
 */
export function natureDetail(name) {
  const d = NATURE_DETAIL[name];
  if (!d || typeof document === 'undefined' || natureDetailOff()) return null;
  const tex = natureDetailTexture(d.spec, getQuality().anisotropy);
  return tex ? { ...d, tex } : null;
}

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

/** Far level broadleaf tree: one dented sphere on a short trunk (~30 triangles). */
function farLeafy(seed, opts = {}) {
  const { trunkH = 0.62, crownR = 0.5, dark = 0x2f5a22, light = 0x8fbf4a, trunk = 0x6b4a2e, slim = 1 } = opts;
  const t = trunkGeo(0.085 * slim, 0.055 * slim, trunkH + 0.1, 3, trunk);
  const g = new THREE.IcosahedronGeometry(crownR * 1.18, 0);
  jitter(g, crownR * 0.18, seed);
  g.scale(1.08, 0.92, 1.08);
  g.translate(0, trunkH + crownR * 0.75, 0);
  return mergeGeometries([t, crownPaint(g, dark, light, trunkH, trunkH + crownR * 2.1, seed)]);
}

/** Far level conifer: two cones (~20 triangles). */
function farConifer(seed, opts = {}) {
  const { h = 1.9, r0 = 0.5, dark = 0x1f4a2c, light = 0x4f8a4a } = opts;
  const parts = [];
  for (let i = 0; i < 2; i++) {
    const ch = (h - 0.3) * (i ? 0.62 : 0.78), rad = r0 * (i ? 0.62 : 1);
    const g = new THREE.ConeGeometry(rad, ch, 5, 1);
    const y = 0.32 + i * (h - 0.3) * 0.38;
    g.translate(0, y + ch / 2, 0);
    g.rotateY(i * 0.6);
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
  const {
    wind = 0.05, vertexColors = true, map = null, snowCap = true, upNormal = false, fade = null, detail = null,
    normalMap = null, normalScale = null, flat = true, bend = 0.45, tintMix = null,
  } = opts;
  const m = new THREE.MeshStandardMaterial({ vertexColors, map, roughness: 0.88, metalness: 0, flatShading: flat });
  if (normalMap) { m.normalMap = normalMap; if (normalScale) m.normalScale.copy(normalScale); }
  // Wind, snow cap, bend height and colour variation as uniforms: all nature materials share a few shader programs
  const uWind = { value: wind }, uSnowCap = { value: snowCap ? 1 : 0 }, uBend = { value: bend }, uTintMix = { value: tintMix ?? 1 };
  m.userData.uWind = uWind;
  m.userData.uSnowCap = uSnowCap;
  m.userData.uTintMix = uTintMix;
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uSnow = shared.uSnow;
    s.uniforms.uWind = uWind;
    s.uniforms.uSnowCap = uSnowCap;
    s.uniforms.uBend = uBend;
    if (tintMix !== null) s.uniforms.uTintMix = uTintMix;
    if (fade) s.uniforms.uFade = fade;
    if (detail) {
      s.uniforms.uDetail = { value: detail.tex };
      s.uniforms.uDetailS = { value: detail.scale };
      s.uniforms.uDetailK = { value: new THREE.Vector2(...detail.k) };
      s.uniforms.uDetailTint = { value: new THREE.Vector3(...detail.tint) };
    }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
uniform float uWind;
uniform float uBend;
${fade ? 'uniform vec2 uFade;' : ''}
varying float vUp;
${detail ? 'varying vec3 vWPos; varying vec3 vWN;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
${fade ? `// shrink into the ground with distance (instead of suddenly disappearing)
transformed *= 1.0 - smoothstep(uFade.x, uFade.y, distance((modelMatrix * instanceMatrix[3]).xyz, cameraPosition));` : ''}
vec2 ip = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
float sway = sin(uTime * 1.4 + ip.x * 0.6 + ip.y * 0.45) + sin(uTime * 2.3 + ip.x * 1.3) * 0.35;
float bend = max(0.0, position.y - uBend);
transformed.x += sway * uWind * bend;
transformed.z += sway * uWind * 0.6 * bend;
#endif`)
      .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
#ifdef USE_INSTANCING
vUp = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal).y;
#else
vUp = normalize(mat3(modelMatrix) * objectNormal).y;
#endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
${detail ? `#ifdef USE_INSTANCING
vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);
#endif` : ''}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSnow;
uniform float uSnowCap;
${tintMix !== null ? 'uniform float uTintMix;' : ''}
varying float vUp;
${detail ? `uniform sampler2D uDetail; uniform float uDetailS; uniform vec2 uDetailK; uniform vec3 uDetailTint;
varying vec3 vWPos; varying vec3 vWN;` : ''}`)
      .replace('#include <color_fragment>', `${tintMix !== null
    // colour variation per instance attenuable (winter: no yellow-tinted snow)
    ? `#if defined( USE_COLOR_ALPHA )
diffuseColor *= vColor;
#elif defined( USE_COLOR )
diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, uTintMix);
#endif`
    : '#include <color_fragment>'}
${detail ? `// painted texture from all sides (triplanar, 3 lookups): channels normalised around 0.5 (naturetex.js), so
// on average neither brighter nor darker; only brightness and a slight colour accent, the hue stays that of the model
{ vec3 bw = pow(abs(vWN), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  vec2 t = texture2D(uDetail, vWPos.zy * uDetailS).rg * bw.x + texture2D(uDetail, vWPos.xz * uDetailS).rg * bw.y + texture2D(uDetail, vWPos.xy * uDetailS).rg * bw.z;
  t = t * 2.0 - 1.0;
  ${detail.mask === 'tree'
    // trunk and branches: red over green (brown, birch whitish); the crown is always greener than red
    ? 'float bark = smoothstep(0.004, 0.03, diffuseColor.r - diffuseColor.g); float d = mix(t.x * uDetailK.x, t.y * uDetailK.y, bark);'
    : 'float d = t.x * uDetailK.x;'}
  // values count as in sRGB (painted): convert to linear colour space
  diffuseColor.rgb *= pow(max(1.0 + d, 0.2), 2.2) * max(vec3(0.0), 1.0 + d * uDetailTint); }` : ''}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), uSnow * uSnowCap * smoothstep(0.25, 0.7, vUp));`);
    // blades: visible on both sides, but always lit like the ground (do not flip the back side)
    if (upNormal) s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
normal = normalize(vNormal);`);
  };
  m.customProgramCacheKey = () => 'kr-nature' + (upNormal ? '-up' : '') + (fade ? '-fade' : '') + (detail ? `-d${detail.mask}` : '') + (tintMix !== null ? '-tm' : '');
  return m;
}

/**
 * Tree variants. kind: 'leafy' | 'birch' | 'conifer'.
 * @param {boolean} detail
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 */
export function treeVariants(detail, shared) {
  const mat = natureMaterial(shared, { wind: 0.045, detail: natureDetail('leafy') });
  const matC = natureMaterial(shared, { wind: 0.045, detail: natureDetail('conifer') });
  const v = [
    { kind: 'leafy', geometry: leafyTree(detail, 11, {}), material: mat, scale: 1.25 },
    { kind: 'leafy', geometry: leafyTree(detail, 23, { crownR: 0.56, trunkH: 0.55, dark: 0x3a6424, light: 0xa3c853 }), material: mat, scale: 1.2 },
    { kind: 'birch', geometry: leafyTree(detail, 37, { crownR: 0.4, trunkH: 0.8, trunk: 0xe6e1d4, dark: 0x5a8a2c, light: 0xc8dc6a, slim: 0.75 }), material: mat, scale: 1.2 },
    { kind: 'conifer', geometry: conifer(detail, 41, {}), material: matC, scale: 1.15 },
    { kind: 'conifer', geometry: conifer(detail, 53, { h: 2.2, r0: 0.44, tiers: detail ? 5 : 3, dark: 0x1a3f2a, light: 0x3f7a48 }), material: matC, scale: 1.15 },
  ];
  for (const t of v) { t.geometry.computeBoundingSphere(); }
  return v;
}

/**
 * Tree variants with LOD levels: levels[0] nearest, levels[n] farthest. With loaded tree models
 * (treeModels.js) their LOD levels, otherwise the procedural trees: high/medium level [detailed, simple,
 * far], low level [simple, far].
 * @param {boolean} detail
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 * @param {{ models?: boolean }} [opts] models: false forces the procedural trees
 */
export function treeLodVariants(detail, shared, opts = {}) {
  if (opts.models !== false) {
    const m = treeModelVariants(detail, shared);
    if (m) return m;
  }
  const near = treeVariants(detail, shared);
  const simple = detail ? treeVariants(false, shared) : null;
  const P = [
    ['leafy', 11, {}], ['leafy', 23, { crownR: 0.56, trunkH: 0.55, dark: 0x3a6424, light: 0xa3c853 }],
    ['birch', 37, { crownR: 0.4, trunkH: 0.8, trunk: 0xe6e1d4, dark: 0x5a8a2c, light: 0xc8dc6a, slim: 0.75 }],
    ['conifer', 41, {}], ['conifer', 53, { h: 2.2, r0: 0.44, dark: 0x1a3f2a, light: 0x3f7a48 }],
  ];
  return near.map((v, i) => {
    const p = P[i];
    const far = p[0] === 'conifer' ? farConifer(p[1], p[2]) : farLeafy(p[1], p[2]);
    far.computeBoundingSphere();
    return { ...v, levels: simple ? [v.geometry, simple[i].geometry, far] : [v.geometry, far], winter: null };
  });
}

// ---------- Own tree and bush models ----------

const modelFile = (name, k) => `buildings/${name}${k ? `.lod${k}` : ''}`;

/** Keep only position, normal and UV (parts mergeable, there are no vertex colours of the models). */
function bareParts(parts) {
  const indexed = parts.every((p) => p.geometry.index);
  return mergeGeometries(parts.map((p) => {
    const g = indexed || !p.geometry.index ? p.geometry.clone() : p.geometry.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    return g;
  }));
}

/**
 * Stand model geometry on the ground, centre it and bring it to a height; flat models as a cross.
 * Scale and centre come from the original (ref), so that all LOD levels coincide.
 * @param {THREE.BufferGeometry} g (is modified) @param {THREE.Box3} ref outline of the original
 * @param {number} height target height @param {boolean} [cross]
 */
export function fitNatureGeometry(g, ref, height, cross = false) {
  const c = ref.getCenter(new THREE.Vector3());
  const s = height / Math.max(1e-6, ref.max.y - ref.min.y);
  g.translate(-c.x, -ref.min.y, -c.z);
  g.scale(s, s, s);
  const out = cross ? crossGeometry(g) : g;
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/**
 * Cheap game trick for flat models (bare winter trees, birch): original and a copy rotated by 90° around the
 * vertical axis into one geometry – full from every side, one draw call.
 * @param {THREE.BufferGeometry} g
 */
export function crossGeometry(g) {
  const b = g.clone();
  b.rotateY(Math.PI / 2);
  const out = mergeGeometries([g, b]);
  g.dispose(); b.dispose();
  return out;
}

const refBoxes = new Map();
/** Outline of the original (model space, from the parts). */
function modelBox(name) {
  if (refBoxes.has(name)) return refBoxes.get(name);
  const parts = instancedParts(modelFile(name, 0));
  if (!parts) return null;
  const box = new THREE.Box3();
  for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); p.geometry.dispose(); }
  refBoxes.set(name, box);
  return box;
}

/**
 * LOD levels of a model as finished geometries (per entry in files, 0 = original) and the material of the
 * original, or null if the original is not loaded. Missing levels: next coarser available.
 * @param {{name: string, cross?: boolean}} model @param {number} height @param {number[]} files
 */
export function natureModelLevels(model, height, files) {
  const ref = modelBox(model.name);
  const base = ref && instancedParts(modelFile(model.name, 0));
  if (!base) return null;
  const material = base[0].material;
  for (const p of base) p.geometry.dispose();
  const geos = files.map((k) => {
    const parts = instancedParts(modelFile(model.name, k));
    if (!parts) return null;
    const g = fitNatureGeometry(bareParts(parts), ref, height, !!model.cross);
    for (const p of parts) p.geometry.dispose();
    return g;
  });
  const levels = seasonLevels(geos);
  return levels && { levels, material };
}

/**
 * Material of a tree or bush model: texture and normals of the model, softly shaded, wind from the
 * bend height. snowCap: snow from the shader (only if the winter version is missing; otherwise the snow is in the model).
 */
function natureModelMaterial(shared, src, opts) {
  const m = natureMaterial(shared, {
    vertexColors: false, map: src.map ?? null, normalMap: src.normalMap ?? null, normalScale: src.normalScale ?? null,
    flat: false, wind: opts.wind, bend: opts.bend, snowCap: opts.snowCap, tintMix: opts.tintMix ?? 1,
  });
  m.side = THREE.DoubleSide;
  return m;
}

/**
 * Tree variants from the own models (summer) including winter version, or null if a summer model is missing.
 * winter() only builds the winter levels when they are needed (models are reloaded on demand).
 * @param {boolean} detail @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 */
export function treeModelVariants(detail, shared) {
  const files = detail ? TREE_LOD_FILES.detail : TREE_LOD_FILES.simple;
  const out = [];
  for (const t of TREE_MODELS) {
    const m = natureModelLevels(t, t.height, files);
    if (!m) return null;
    // summer: shader snow cap on – only applies while the winter version is still loading or missing
    const material = natureModelMaterial(shared, m.material, { wind: 0.03, bend: t.bend, snowCap: true });
    out.push({
      kind: t.kind, model: t.name, geometry: m.levels[0], levels: m.levels, material, scale: 1,
      winter: seasonVariant(t, files, shared, 0.03),
    });
  }
  return out;
}

/** Winter version of a kind (lazy): {levels, material} or null while/if the model is missing. */
function seasonVariant(t, files, shared, wind) {
  let made = null;
  return () => {
    if (made) return made;
    const m = natureModelLevels(t.winter, t.height, files);
    if (!m) return null;
    // snow is in the model; colour variation only weak (otherwise yellow-tinted snow with autumn dabs)
    made = { levels: m.levels, material: natureModelMaterial(shared, m.material, { wind, bend: t.bend, snowCap: false, tintMix: 0.3 }) };
    return made;
  };
}

/**
 * Bush from the own model (summer, winter lazy) for the decoration scatter, or null.
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 */
export function bushModelVariant(shared) {
  const m = natureModelLevels(BUSH_MODEL, BUSH_MODEL.height, BUSH_LOD_FILES);
  if (!m) return null;
  return {
    levels: m.levels,
    material: natureModelMaterial(shared, m.material, { wind: 0.02, bend: BUSH_MODEL.bend, snowCap: true }),
    winter: seasonVariant(BUSH_MODEL, BUSH_LOD_FILES, shared, 0.02),
  };
}

export function stumpVariant(shared) {
  return { geometry: stumpGeo(), material: natureMaterial(shared, { wind: 0, snowCap: true, detail: natureDetail('wood') }) };
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
 * Scatter kinds. Each: { name, geometry, material, winter: visible in winter }; the bush model additionally with
 * levels (LOD levels) and season() (winter version).
 * @param {{ uTime: {value:number}, uSnow: {value:number} }} shared
 * @param {{ models?: boolean }} [opts] models: false = procedural bushes
 */
export function scatterKinds(shared, opts = {}) {
  // distance at which small decoration is faded out (set by the renderer per graphics level and field of view)
  const fade = (shared.uFade ??= { value: new THREE.Vector2(45, 60) });
  const soft = natureMaterial(shared, { wind: 0.12, snowCap: false, upNormal: true, fade });
  soft.flatShading = false;
  soft.side = THREE.DoubleSide;
  const plant = natureMaterial(shared, { wind: 0.03, detail: natureDetail('bush') });
  const rockDetail = natureDetail('rock');
  const stone = natureMaterial(shared, { wind: 0, detail: rockDetail });
  const stoneSmall = natureMaterial(shared, { wind: 0, fade, detail: rockDetail });
  const kinds = {
    grass: { small: true, geometry: grassTuft(3, [0x406a26, 0x8cbc4a]), material: soft, winter: false },
    grassDry: { small: true, geometry: grassTuft(5, [0x6a7a34, 0xc2c070]), material: soft, winter: false },
    flowerW: { small: true, geometry: flowerPatch(7, 0xf6f2e6), material: soft, winter: false },
    flowerY: { small: true, geometry: flowerPatch(9, 0xf7cf3a), material: soft, winter: false },
    flowerP: { small: true, geometry: flowerPatch(11, 0xc770c8), material: soft, winter: false },
    flowerR: { small: true, geometry: flowerPatch(12, 0xe0503a), material: soft, winter: false },
    bush: { geometry: bushGeo(13, 0x2d5a24, 0x76a844), material: plant, winter: true },
    bushB: { geometry: bushGeo(17, 0x3e5c22, 0x9ab04c), material: plant, winter: true },
    pebbles: { geometry: pebbleGeo(19), material: stoneSmall, winter: true, small: true },
    rock: { geometry: rockGeo(23), material: stone, winter: true },
    rockB: { geometry: rockGeo(29, 1.4), material: stone, winter: true },
    reeds: { small: true, geometry: reedsGeo(31), material: soft, winter: false },
  };
  // KayKit models in addition (if loaded): rocks, rock peaks
  const kayRock = natureDetail('kayRock');
  const kay = (name, key, winter, snowCap = true, detail = null) => {
    const parts = instancedParts(name);
    if (!parts) return;
    const g = mergeGeometries(parts.map((p) => {
      const c = p.geometry.clone();
      for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
      return c;
    }));
    if (g) kinds[key] = { geometry: g, material: natureMaterial(shared, { wind: 0, vertexColors: false, map: parts[0].material.map, snowCap, detail }), winter };
  };
  for (const n of ['A', 'B', 'C', 'D', 'E']) kay(`nature/rock_single_${n}`, 'kk' + n, true, true, kayRock);
  for (const n of ['A', 'B', 'C']) kay(`nature/mountain_${n}`, 'mt' + n, true, true, kayRock);
  // own bush model instead of the procedural bushes (LOD levels and winter version, see bushModelVariant)
  const bush = opts.models === false ? null : bushModelVariant(shared);
  if (bush) {
    kinds.bush = { geometry: bush.levels[0], levels: bush.levels, material: bush.material, winter: true, season: bush.winter, model: true };
    delete kinds.bushB;
  }
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
/** Shared materials of the markers (for Renderer.dispose). */
export const sharedMarkerMaterials = () => [...markerMats.values()];
function mmat(key, opts) {
  if (!markerMats.has(key)) markerMats.set(key, natureMaterial(shared0, { wind: 0, ...opts }));
  return markerMats.get(key);
}
/** Mesh with vertex colours; detail: nature texture (e.g. 'rock' for piles and stone ring, 'wood' for wood). */
function vmesh(geo, detail = null) {
  const m = new THREE.Mesh(geo, mmat(detail ?? 'v', detail ? { detail: natureDetail(detail) } : {}));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const DEPOSIT = {
  clay: { base: 0x8a5a3a, chunks: [0xb5653a, 0xc4774a, 0x9c5232], accent: 0xd89a6a },
  stone: { base: 0x7f7b74, chunks: [0xb2aea4, 0x9a968e, 0xc4c0b6], accent: 0xdcd8ce },
  iron: { base: 0x4c4d52, chunks: [0x5e6068, 0x6d717c, 0x8a4a2e], accent: 0xb5562c },
  // gold only from scripts (treasure in the learning adventure): shiny nuggets
  gold: { base: 0x7a5a24, chunks: [0xf3c85e, 0xe1a83a, 0xffe08a], accent: 0xfff1c4 },
  sulfur: { base: 0x77705a, chunks: [0xe8cf3a, 0xd8c33a, 0xf2e266], accent: 0xfff27a },
};

/** Wood pile in the style of the other resource piles: flat mound of bark and shavings, with stacked logs on top. */
function woodPile(seed) {
  const r = rng(seed * 17 + 3);
  const parts = [];
  const mound = new THREE.IcosahedronGeometry(0.45, 1);
  jitter(mound, 0.1, seed);
  mound.scale(1, 0.22, 1);
  mound.translate(0, 0.01, 0);
  parts.push(crownPaint(mound, 0x5a4330, 0x7a5a3c, -0.1, 0.12, seed));
  // two layers of short logs, crosswise
  for (let i = 0; i < 7; i++) {
    const layer = i < 4 ? 0 : 1, k = layer ? i - 4 : i;
    const len = 0.5 + r() * 0.2, rad = 0.06 + r() * 0.02;
    const log = new THREE.CylinderGeometry(rad, rad, len, 6);
    log.rotateZ(Math.PI / 2);
    const off = (k - (layer ? 1 : 1.5)) * rad * 2.1;
    log.translate(0, 0.08 + layer * rad * 1.8 + rad, off);
    if (layer) log.rotateY(Math.PI / 2 + (r() - 0.5) * 0.3);
    else log.rotateY((r() - 0.5) * 0.2);
    parts.push(solid(log, k % 2 ? 0x7a5634 : 0x654428, 0.1, seed + i));
  }
  const m = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Resource deposit (wood: logs, see woodPile): flat earth mound with chunks in the resource colour, scree at the edge and veins/crystals.
 * Chunks with more faces and painted rock texture ('ore'), so that they look like rock even up close.
 */
export function depositModel(res, seed = 1) {
  if (res === 'wood') return woodPile(seed);
  const d = DEPOSIT[res] ?? DEPOSIT.stone;
  const r = rng(seed * 31 + res.length);
  const parts = [];
  const mound = new THREE.IcosahedronGeometry(0.5, 2);
  jitter(mound, 0.1, seed);
  mound.scale(1, 0.3, 1);
  mound.translate(0, 0.02, 0);
  parts.push(crownPaint(mound, d.base, d.chunks[0], -0.1, 0.18, seed));
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    const dd = i === 0 ? 0 : 0.16 + r() * 0.24;
    const rr = (i === 0 ? 0.21 : 0.08 + r() * 0.09);
    let g;
    if (res === 'sulfur' && i % 2 === 1) {
      g = new THREE.OctahedronGeometry(rr * 0.8, 0); g.scale(0.6, 1.6, 0.6);
      g.rotateZ((r() - 0.5) * 0.6);
    } else if (res === 'clay') {
      g = new THREE.BoxGeometry(rr * 1.6, rr * 0.8, rr * 1.1, 2, 1, 2); jitter(g, rr * 0.12, seed + i);
      g.rotateY(r() * 3); g.rotateX((r() - 0.5) * 0.4);
    } else {
      g = new THREE.IcosahedronGeometry(rr, 1); jitter(g, rr * 0.38, seed + i);
      g.scale(1, 0.75 + r() * 0.2, 1); g.rotateY(r() * 3);
    }
    g.translate(Math.cos(a) * dd, 0.1 + rr * 0.6 + (i === 0 ? 0.08 : 0), Math.sin(a) * dd);
    parts.push(solid(g, d.chunks[i % d.chunks.length], 0.12, i + seed));
  }
  // scree at the foot of the mound
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2, dd = 0.42 + r() * 0.16, rr = 0.03 + r() * 0.035;
    const g = new THREE.DodecahedronGeometry(rr, 0); jitter(g, rr * 0.4, seed + 40 + i);
    g.scale(1, 0.6, 1);
    g.translate(Math.cos(a) * dd, rr * 0.3, Math.sin(a) * dd);
    parts.push(solid(g, i % 3 ? d.chunks[(i + 1) % d.chunks.length] : d.base, 0.1, i + 7));
  }
  // small accents (veins, crystals)
  for (let i = 0; i < 6; i++) {
    const g = new THREE.TetrahedronGeometry(0.05 + r() * 0.03, 0);
    const a = r() * Math.PI * 2, dd = 0.1 + r() * 0.3;
    g.translate(Math.cos(a) * dd, 0.16 + r() * 0.12, Math.sin(a) * dd);
    parts.push(solid(g, d.accent, 0.05, i));
  }
  const g = new THREE.Group();
  g.add(vmesh(mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p)), 'ore'));
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
  const parts = [], stones = [];
  const r = rng(res.length * 17 + 5);
  // stone ring
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const s = new THREE.IcosahedronGeometry(0.15 + r() * 0.05, 1);
    jitter(s, 0.07, i);
    s.scale(1, 0.7, 1);
    s.translate(Math.cos(a) * 0.68, 0.08, Math.sin(a) * 0.68);
    stones.push(solid(s, 0x8f8a80, 0.12, i));
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
    stones.push(solid(s, d.chunks[i % d.chunks.length], 0.1, i));
  }
  // sign
  parts.push(plank(0.05, 0.6, 0.05, wood, -0.95, 0, 0.75));
  parts.push(plank(0.36, 0.22, 0.04, 0xc8a878, -0.95, 0.42, 0.78));
  const badge = new THREE.CircleGeometry(0.07, 8);
  badge.translate(-0.95, 0.53, 0.805);
  parts.push(solid(badge, d.chunks[0], 0));
  const flat = (list) => mergeGeometries(list.map((p) => p.index ? p.toNonIndexed() : p));
  g.add(vmesh(flat(stones), 'ore'));
  g.add(vmesh(flat(parts), 'timber'));
  // pit: dark funnel instead of a flat disc, two boards above it
  const pit = new THREE.CylinderGeometry(0.6, 0.18, 0.5, 14, 1, true);
  pit.translate(0, -0.2, 0);
  const pitMat = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 1, side: THREE.BackSide });
  const pm = new THREE.Mesh(pit, pitMat); pm.receiveShadow = true; g.add(pm);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 1 }));
  floor.position.y = -0.44; g.add(floor);
  const boards = mergeGeometries([plank(1.2, 0.04, 0.16, 0x7a5634, 0, 0.05, -0.18), plank(1.2, 0.04, 0.16, 0x6b4a2e, 0, 0.05, 0.22)]);
  const bm = vmesh(boards, 'timber'); bm.rotation.y = 0.3; g.add(bm);
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
