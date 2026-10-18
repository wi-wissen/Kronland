// Impostors for distant trees and bushes: the model photographed from G×G directions over the upper hemisphere
// (hemi-octahedral layout, so every tilt and rotation of the free camera is covered) into two atlases – albedo and
// normals – and drawn as one camera-facing quad per instance. The shader blends the four nearest views, projecting
// the quad point into each view's own image plane (no ghosting), and lights the stored normals with the game's
// lights, fog and per-instance tint. Baked once per model at load: no download.
//
// The pure functions below (hemi-octahedral mapping, view basis, view selection) are mirrored 1:1 in GLSL and
// tested in tests/render/impostor.test.js.

import * as THREE from 'three';

/** Views per side (G×G over the hemisphere). */
export const IMPOSTOR_GRID = 8;

// read once when the module loads: the app rewrites the address bar at start and drops unknown parameters
const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).get('impostor') === 'off';
/** Impostors switched off? (?impostor=off for comparison: then the farthest level stays the reduced model) */
export const impostorsOff = () => OFF;

/**
 * Bake settings by graphics level: pixels per view (atlas = 8 × cell: 768² on "high", 512² otherwise) and
 * multisampling. Without a real GPU (software rasterizer, quality.software) small and without multisampling:
 * ~0.1 s instead of ~0.8 s for all kinds, the far trees are tiny there anyway.
 * @param {{ tier: string, software?: boolean }} q
 */
export const impostorBake = (q) => (q.software ? { cell: 32, samples: 0 } : { cell: q.tier === 'high' ? 96 : 64, samples: 4 });

/**
 * Upper-hemisphere direction (y ≥ 0) → hemi-octahedral coordinates in [−1, 1]².
 * @param {number} x @param {number} y @param {number} z @returns {[number, number]}
 */
export function hemiOctEncode(x, y, z) {
  const s = Math.abs(x) + Math.abs(Math.max(0, y)) + Math.abs(z) || 1;
  const px = x / s, pz = z / s;
  return [px + pz, px - pz];
}

/**
 * Hemi-octahedral coordinates → unit direction (y ≥ 0).
 * @param {number} ex @param {number} ey @returns {[number, number, number]}
 */
export function hemiOctDecode(ex, ey) {
  const px = (ex + ey) / 2, pz = (ex - ey) / 2;
  const y = 1 - Math.abs(px) - Math.abs(pz);
  const l = Math.hypot(px, y, pz) || 1;
  return [px / l, y / l, pz / l];
}

/** Direction of view (i, j) of a G×G grid (cell centres). @returns {[number, number, number]} */
export function viewDir(i, j, g = IMPOSTOR_GRID) {
  return hemiOctDecode(((i + 0.5) / g) * 2 - 1, ((j + 0.5) / g) * 2 - 1);
}

/**
 * Image plane of a view looking along −d at the model: right and up vectors (also the capture camera's axes).
 * @param {[number, number, number]} d @returns {{ right: [number, number, number], up: [number, number, number] }}
 */
export function viewBasis(d) {
  const ref = Math.abs(d[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  // right = normalize(ref × d), up = d × right
  let r = [ref[1] * d[2] - ref[2] * d[1], ref[2] * d[0] - ref[0] * d[2], ref[0] * d[1] - ref[1] * d[0]];
  const l = Math.hypot(...r) || 1;
  r = r.map((v) => v / l);
  const u = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  return { right: /** @type {[number, number, number]} */ (r), up: /** @type {[number, number, number]} */ (u) };
}

/**
 * The four views to blend for a direction (object space, from the model towards the camera) with bilinear weights.
 * @param {[number, number, number]} d @param {number} [g]
 * @returns {{ cells: [number, number][], weights: number[] }}
 */
export function viewBlend(d, g = IMPOSTOR_GRID) {
  const [ex, ey] = hemiOctEncode(d[0], Math.max(0, d[1]), d[2]);
  const gx = ((ex + 1) / 2) * g - 0.5, gy = ((ey + 1) / 2) * g - 0.5;
  const i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
  const c = (v) => Math.max(0, Math.min(g - 1, v));
  return {
    cells: [[c(i0), c(j0)], [c(i0 + 1), c(j0)], [c(i0), c(j0 + 1)], [c(i0 + 1), c(j0 + 1)]],
    weights: [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy],
  };
}

const GLSL_COMMON = /* glsl */`
uniform vec3 uImpC;
uniform float uImpR;
uniform float uImpG;
vec2 impEncode(vec3 d) {
  float s = abs(d.x) + abs(max(d.y, 0.0)) + abs(d.z);
  vec2 p = d.xz / max(s, 1e-5);
  return vec2(p.x + p.y, p.x - p.y);
}
vec3 impDecode(vec2 e) {
  vec2 p = vec2(e.x + e.y, e.x - e.y) * 0.5;
  return normalize(vec3(p.x, 1.0 - abs(p.x) - abs(p.y), p.y));
}
vec3 impDir(vec2 cell) { return impDecode((cell + 0.5) / uImpG * 2.0 - 1.0); }
void impBasis(vec3 d, out vec3 r, out vec3 u) {
  vec3 ref = abs(d.y) > 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
  r = normalize(cross(ref, d));
  u = cross(d, r);
}`;

/**
 * Photograph a model into albedo and normal atlases.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.BufferGeometry} geometry level 0 of the model (game units)
 * @param {THREE.Material} source material of the model (map, normalMap)
 * @param {{ grid?: number, cell?: number, samples?: number }} [opts]
 * @returns {{ albedo: THREE.Texture, normal: THREE.Texture, center: THREE.Vector3, radius: number, grid: number, dispose: () => void }}
 */
export function bakeImpostor(renderer, geometry, source, opts = {}) {
  const g = opts.grid ?? IMPOSTOR_GRID, cell = opts.cell ?? 96, size = g * cell;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  const center = geometry.boundingSphere.center.clone(), radius = geometry.boundingSphere.radius;
  const make = () => {
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: opts.samples ?? 4, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.scissorTest = true;
    return rt;
  };
  const rtA = make(), rtN = make();
  const albedoMat = new THREE.MeshBasicMaterial({ map: /** @type {any} */ (source).map ?? null, side: THREE.DoubleSide });
  const normalMat = new THREE.MeshNormalMaterial({ normalMap: /** @type {any} */ (source).normalMap ?? null, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, albedoMat);
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 0.01, radius * 6);
  // keep the renderer's state
  const prevTarget = renderer.getRenderTarget(), prevColor = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const prevAuto = renderer.autoClear, prevShadow = renderer.shadowMap.autoUpdate;
  renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);
  for (const [rt, mat] of [[rtA, albedoMat], [rtN, normalMat]]) {
    mesh.material = mat;
    rt.viewport.set(0, 0, size, size); rt.scissor.set(0, 0, size, size);
    renderer.setRenderTarget(rt); renderer.clear();
    for (let j = 0; j < g; j++) for (let i = 0; i < g; i++) {
      const d = viewDir(i, j, g), { up } = viewBasis(d);
      cam.position.set(center.x + d[0] * radius * 3, center.y + d[1] * radius * 3, center.z + d[2] * radius * 3);
      cam.up.set(up[0], up[1], up[2]);
      cam.lookAt(center);
      cam.updateMatrixWorld();
      rt.viewport.set(i * cell, j * cell, cell, cell); rt.scissor.set(i * cell, j * cell, cell, cell);
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
    }
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.autoClear = prevAuto; renderer.shadowMap.autoUpdate = prevShadow;
  albedoMat.dispose(); normalMat.dispose();
  return {
    albedo: rtA.texture, normal: rtN.texture, center, radius, grid: g,
    dispose: () => { rtA.dispose(); rtN.dispose(); },
  };
}

/**
 * Tree or bush variant with its farthest level replaced by an impostor (summer now, winter version lazily when it
 * is first needed). Adds `materials` (one per level); the other levels keep the model's material.
 * @template {{ levels: THREE.BufferGeometry[], material: THREE.Material, winter?: (() => any)|null }} V
 * @param {THREE.WebGLRenderer} renderer @param {V} v @param {{ grid?: number, cell?: number }} [opts]
 * @returns {V & { materials: THREE.Material[] }}
 */
export function withImpostor(renderer, v, opts = {}) {
  const last = v.levels.length - 1;
  const wrap = (src) => {
    const baked = bakeImpostor(renderer, src.levels[0], src.material, opts);
    const material = impostorMaterial(baked, src.material.userData?.uTintMix);
    return {
      ...src,
      levels: [...src.levels.slice(0, last), impostorGeometry(baked)],
      // the other levels keep their material (own per level from lodbake, else the shared one)
      materials: src.levels.map((_, i) => (i === last ? material : src.materials?.[i] ?? src.material)),
      impostor: true,
    };
  };
  let winterMade = null;
  const winter = v.winter ? () => {
    if (winterMade) return winterMade;
    const w = v.winter();
    if (!w) return null;
    winterMade = wrap(w);
    return winterMade;
  } : v.winter;
  return { ...wrap(v), winter };
}

/** Quad for the impostor level (positions −0.5…0.5; the vertex shader places it). */
export function impostorGeometry(baked) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.deleteAttribute('normal');
  geo.boundingSphere = new THREE.Sphere(baked.center.clone(), baked.radius);
  geo.boundingBox = new THREE.Box3().setFromCenterAndSize(baked.center, new THREE.Vector3(2, 2, 2).multiplyScalar(baked.radius));
  return geo;
}

/**
 * Material of the impostor level: lit like the model (MeshStandardMaterial with the game's lights), tint per
 * instance (instanceColor, attenuated like the model: `tintMix`, winter 0.3), fog via patchFog (Renderer).
 * @param {ReturnType<typeof bakeImpostor>} baked
 * @param {{ value: number }} [tintMix] the model material's uniform (natureMaterial userData.uTintMix)
 */
export function impostorMaterial(baked, tintMix = { value: 1 }) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 });
  const uniforms = {
    uTintMix: tintMix,
    uImpC: { value: baked.center }, uImpR: { value: baked.radius }, uImpG: { value: baked.grid },
    uImpAlbedo: { value: baked.albedo }, uImpNormal: { value: baked.normal },
  };
  m.userData.impostor = baked;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
${GLSL_COMMON}
varying vec2 vImpUv[4];
varying vec2 vImpCell[4];
varying vec4 vImpW;
varying vec3 vImpX; varying vec3 vImpY; varying vec3 vImpZ;`)
      // the quad faces the camera in object space of the instance (rotation, slightly non-uniform scale)
      .replace('#include <begin_vertex>', `
#ifdef USE_INSTANCING
mat4 impM = modelMatrix * instanceMatrix;
#else
mat4 impM = modelMatrix;
#endif
vec3 impCam = (inverse(impM) * vec4(cameraPosition, 1.0)).xyz;
vec3 impD = impCam - uImpC;
impD.y = max(impD.y, 0.0);
impD = normalize(impD + vec3(0.0, 1e-4, 0.0));
vec3 impR, impU;
impBasis(impD, impR, impU);
vec3 transformed = uImpC + (position.x * impR + position.y * impU) * (2.0 * uImpR);
// the four nearest views and their weights; per view the point projected into its image plane
vec2 impG = (impEncode(impD) * 0.5 + 0.5) * uImpG - 0.5;
vec2 impI = floor(impG), impF = impG - impI;
vec2 impCells[4];
impCells[0] = clamp(impI, 0.0, uImpG - 1.0);
impCells[1] = clamp(impI + vec2(1.0, 0.0), 0.0, uImpG - 1.0);
impCells[2] = clamp(impI + vec2(0.0, 1.0), 0.0, uImpG - 1.0);
impCells[3] = clamp(impI + vec2(1.0, 1.0), 0.0, uImpG - 1.0);
vImpW = vec4((1.0 - impF.x) * (1.0 - impF.y), impF.x * (1.0 - impF.y), (1.0 - impF.x) * impF.y, impF.x * impF.y);
for (int k = 0; k < 4; k++) {
  vec3 dk = impDir(impCells[k]), rk, uk;
  impBasis(dk, rk, uk);
  // ray from the camera through the quad point onto the view's plane through the centre (parallax-correct)
  vec3 ray = normalize(transformed - impCam);
  float t = dot(uImpC - transformed, dk) / min(dot(ray, dk), -1e-3);
  vec3 q = transformed + ray * t - uImpC;
  vImpUv[k] = vec2(dot(q, rk), dot(q, uk)) / (2.0 * uImpR) + 0.5;
  vImpCell[k] = impCells[k];
}
// object axes in view space (for the stored normals)
mat3 impN = mat3(viewMatrix) * mat3(impM);
vImpX = normalize(impN[0]); vImpY = normalize(impN[1]); vImpZ = normalize(impN[2]);`)
      .replace('#include <project_vertex>', `vec4 mvPosition = viewMatrix * impM * vec4(transformed, 1.0);
gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 0.0, 1.0);');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
${GLSL_COMMON}
uniform sampler2D uImpAlbedo;
uniform sampler2D uImpNormal;
uniform float uTintMix;
varying vec2 vImpUv[4];
varying vec2 vImpCell[4];
varying vec4 vImpW;
varying vec3 vImpX; varying vec3 vImpY; varying vec3 vImpZ;
vec3 impObjNormal;`)
      .replace('#include <map_fragment>', `{
  vec4 acc = vec4(0.0); vec3 nacc = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    float w = vImpW[k];
    if (w <= 0.0) continue;
    vec2 uv = (vImpCell[k] + clamp(vImpUv[k], 0.002, 0.998)) / uImpG;
    vec4 a = texture2D(uImpAlbedo, uv);
    vec3 n = texture2D(uImpNormal, uv).xyz * 2.0 - 1.0;
    // normal of the view's camera space → object space
    vec3 dk = impDir(vImpCell[k]), rk, uk;
    impBasis(dk, rk, uk);
    acc += w * a;
    nacc += w * a.a * (rk * n.x + uk * n.y + dk * n.z);
  }
  if (acc.a < 0.5) discard;
  diffuseColor.rgb *= acc.rgb / acc.a;
  impObjNormal = normalize(nacc + vec3(0.0, 1e-4, 0.0));
}`)
      .replace('#include <normal_fragment_begin>', `float faceDirection = 1.0;
vec3 normal = normalize(impObjNormal.x * vImpX + impObjNormal.y * vImpY + impObjNormal.z * vImpZ);
vec3 nonPerturbedNormal = normal;`)
      .replace('#include <normal_fragment_maps>', '')
      // colour variation per instance attenuable like natureMaterial (winter: no yellow-tinted snow)
      .replace('#include <color_fragment>', `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, uTintMix);
#endif`);
  };
  m.customProgramCacheKey = () => 'kr-impostor';
  return m;
}
