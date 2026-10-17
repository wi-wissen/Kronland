// Impostors: far level of the model trees and the bush as one camera-facing quad per instance (2 triangles instead of
// ~250). At load time the game renders each model once into an atlas: N azimuths × a few elevations, orthographic,
// transparent background. Light is not baked in: albedo and normals are stored separately and lit in the shader
// with the game light (time of day, weather) like the meshes; fog of war via patchFog, snow and tint like natureMaterial.
//
// The pure functions at the top (layout, cell choice) are testable without WebGL (tests/render/impostor.test.js);
// the shader mirrors them.

import * as THREE from 'three';

/**
 * Atlas parameters: azimuths per elevation (full circle), elevations (rad above the horizon, ascending), atlas
 * columns, margin per cell (pixels, against mipmap bleeding between cells), cell width per graphics level
 * (height follows the model's outline). Far trees are below ~80 px on screen, 128 px cells are ample with mipmaps.
 * Elevations: default pitch 0.95 (CameraRig.js); far trees beyond the target are seen flatter (~0.4–0.8).
 */
export const IMPOSTOR = {
  azimuths: 16,
  elevations: [0.5, 0.95],
  cols: 8,
  margin: 6,
  cellWidth: { high: 128, medium: 112, low: 80 },
  /** Elevation blend: only in the middle part between two rows (short transition instead of ghosting) */
  rowBlend: [0.3, 0.7],
  alphaTest: 0.4,
};

const TAU = Math.PI * 2;

/**
 * Cell size and quad size for a model: outline as a cylinder (radius, height from the ground), seen at the
 * elevations. Cell width fixed, height by the steepest outline; scale (pixels per world unit) the same for all
 * cells, so one quad size fits every cell.
 * @param {number} radius max. horizontal distance from the axis @param {number} height model height (ground = 0)
 * @param {number} cellW cell width (px) @param {{elevations?: number[], margin?: number}} [o]
 * @returns {{cellW:number, cellH:number, scale:number, half:[number, number], pivotY:number}} half: quad half size (world)
 */
export function impostorFit(radius, height, cellW, o = {}) {
  const els = o.elevations ?? IMPOSTOR.elevations, m = o.margin ?? IMPOSTOR.margin;
  const r = Math.max(1e-3, radius);
  // vertical half extent of the cylinder in the image at elevation e (orthographic): height·cos e + radius·sin e
  const halfH = Math.max(...els.map((e) => (height / 2) * Math.cos(e) + r * Math.sin(e)));
  const cellH = Math.max(64, Math.min(256, Math.ceil((cellW * halfH) / r / 8) * 8));
  const scale = Math.min((cellW - 2 * m) / (2 * r), (cellH - 2 * m) / (2 * halfH));
  return { cellW, cellH, scale, half: [cellW / 2 / scale, cellH / 2 / scale], pivotY: height / 2 };
}

/**
 * Atlas layout: cell k = row · azimuths + azimuth, line by line in `cols` columns (line 0 at the bottom, as in the
 * render target).
 * @param {number} cellW @param {number} cellH @param {{azimuths?: number, elevations?: number[], cols?: number}} [o]
 */
export function impostorLayout(cellW, cellH, o = {}) {
  const n = o.azimuths ?? IMPOSTOR.azimuths, rows = (o.elevations ?? IMPOSTOR.elevations).length, cols = o.cols ?? IMPOSTOR.cols;
  const lines = Math.ceil((n * rows) / cols);
  return {
    cols, lines, width: cols * cellW, height: lines * cellH, cells: n * rows,
    /** Pixel rectangle (x, y from the bottom left) of azimuth i in elevation row r. */
    rect(i, r) { const k = r * n + i; return { x: (k % cols) * cellW, y: Math.floor(k / cols) * cellH, w: cellW, h: cellH }; },
  };
}

/**
 * Azimuth cells for a view (mirrors the vertex shader): camera azimuth in world MINUS instance rotation = direction
 * in the model frame; the two nearest cells and the blend between them. Azimuth: atan2(x, z) of the direction from
 * the tree to the camera (rotation around +Y like THREE's setFromAxisAngle).
 * @param {number} camAz @param {number} rot @param {number} [n]
 * @returns {{i0:number, i1:number, t:number}}
 */
export function impostorCell(camAz, rot, n = IMPOSTOR.azimuths) {
  let f = ((camAz - rot) / TAU) * n;
  f = ((f % n) + n) % n;
  const i0 = Math.floor(f) % n;
  return { i0, i1: (i0 + 1) % n, t: f - Math.floor(f) };
}

/**
 * Elevation rows for a view (mirrors the vertex shader): the two neighbouring rows and the blend (only in the middle
 * part rowBlend, otherwise the nearer row), clamped outside.
 * @param {number} el elevation of the camera seen from the tree (rad) @param {number[]} [els]
 * @returns {{r0:number, r1:number, t:number}}
 */
export function impostorRow(el, els = IMPOSTOR.elevations) {
  if (els.length < 2 || el <= els[0]) return { r0: 0, r1: 0, t: 0 };
  const last = els.length - 1;
  if (el >= els[last]) return { r0: last, r1: last, t: 0 };
  let r = 0;
  while (el > els[r + 1]) r++;
  const f = (el - els[r]) / (els[r + 1] - els[r]);
  const [a, b] = IMPOSTOR.rowBlend;
  const x = Math.max(0, Math.min(1, (f - a) / (b - a)));
  return { r0: r, r1: r + 1, t: x * x * (3 - 2 * x) };
}

/** Instance matrix of a capture cell: model rotated so that the camera direction (azimuth a, elevation e) looks along −Z. */
export function captureMatrix(a, e, scale, pivotY, cx, cy, out = new THREE.Matrix4()) {
  const t = new THREE.Matrix4();
  out.makeTranslation(cx, cy, 0);
  out.multiply(t.makeScale(scale, scale, scale));
  out.multiply(t.makeRotationX(e));
  out.multiply(t.makeRotationY(-a));
  out.multiply(t.makeTranslation(0, -pivotY, 0));
  return out;
}

// ---------- Baking (WebGL) ----------

/** @typedef {{albedo: THREE.Texture, normal: THREE.Texture, fit: ReturnType<typeof impostorFit>, layout: ReturnType<typeof impostorLayout>, geometry: THREE.BufferGeometry, targets: THREE.WebGLRenderTarget[], ms: number}} ImpostorAtlas */

/** Atlases per WebGL renderer and model (scatter rebuilds and stage restarts reuse them). */
const atlases = new WeakMap();

/**
 * Atlas of a model (cached per renderer and key), or null without WebGL or on failure (caller keeps the mesh level).
 * @param {THREE.WebGLRenderer|null|undefined} gl
 * @param {string} key model name and cell width
 * @param {() => {geometry: THREE.BufferGeometry, material: any, dispose?: boolean}|null} source geometry (ground at y = 0, axis at
 *   x = z = 0) and model material; dispose: free the geometry after baking (built only for this)
 * @param {number} cellW
 * @returns {ImpostorAtlas|null}
 */
export function impostorAtlas(gl, key, source, cellW) {
  if (!gl?.isWebGLRenderer) return null;
  let map = atlases.get(gl);
  if (!map) { map = new Map(); atlases.set(gl, map); }
  if (map.has(key)) return map.get(key);
  const src = source();
  let atlas = null;
  try { atlas = src && bake(gl, src.geometry, src.material, cellW); } catch (e) { console.warn('impostor bake failed', key, e); atlas = null; }
  if (src?.dispose) src.geometry.dispose();
  map.set(key, atlas);
  return atlas;
}

/** Baked atlases of a renderer (measurements): key, atlas size in pixels, bake time. */
export function impostorInfo(gl) {
  return [...(atlases.get(gl)?.entries() ?? [])].map(([key, a]) => (a ? { key, width: a.layout.width, height: a.layout.height, ms: Math.round(a.ms * 10) / 10 } : { key, failed: true }));
}

/** Textures of all atlases of a renderer (kept when an old world is freed: render targets cannot be re-uploaded). */
export function sharedImpostorTextures(gl) {
  return [...(atlases.get(gl)?.values() ?? [])].filter(Boolean).flatMap((a) => [a.albedo, a.normal, a.geometry]);
}

/** Free all atlases of a renderer (renderer disposed without successor). */
export function disposeImpostors(gl) {
  const map = atlases.get(gl);
  if (!map) return;
  for (const a of map.values()) if (a) { for (const t of a.targets) t.dispose(); a.geometry.dispose(); }
  atlases.delete(gl);
}

function bake(gl, geometry, material, cellW) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const pos = geometry.attributes.position;
  let r = 0, h = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    r = Math.max(r, x * x + z * z);
    h = Math.max(h, pos.getY(i));
  }
  r = Math.sqrt(r);
  const fit = impostorFit(r, h, cellW);
  const layout = impostorLayout(fit.cellW, fit.cellH);
  const n = IMPOSTOR.azimuths, els = IMPOSTOR.elevations;

  const albedoMat = new THREE.MeshBasicMaterial({ map: material.map ?? null, side: THREE.DoubleSide });
  const normalMat = new THREE.MeshNormalMaterial({ normalMap: material.normalMap ?? null, side: THREE.DoubleSide });
  if (material.normalScale) normalMat.normalScale.copy(material.normalScale);
  const mesh = new THREE.InstancedMesh(geometry, albedoMat, layout.cells);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  for (let row = 0; row < els.length; row++) for (let i = 0; i < n; i++) {
    const c = layout.rect(i, row);
    mesh.setMatrixAt(row * n + i, captureMatrix((i / n) * TAU, els[row], fit.scale, fit.pivotY, c.x + c.w / 2, c.y + c.h / 2, m));
  }
  const scene = new THREE.Scene();
  scene.add(mesh);
  const depth = (Math.max(r, h) * fit.scale + 10) * 2;
  const cam = new THREE.OrthographicCamera(0, layout.width, layout.height, 0, 0.1, depth * 2);
  cam.position.z = depth;
  cam.updateMatrixWorld();

  // final atlases: mipmaps, no depth, no multisampling (they stay in memory); albedo in sRGB storage (8 bit without
  // banding in the dark), normals linear
  const target = (colorSpace) => {
    const t = new THREE.WebGLRenderTarget(layout.width, layout.height, {
      minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, colorSpace, depthBuffer: false,
    });
    t.texture.name = 'impostor';
    return t;
  };
  const targets = [target(THREE.SRGBColorSpace), target(THREE.NoColorSpace)];
  // drawn with 4× MSAA into a temporary target, then copied unchanged (premultiplied alpha, no blending)
  const copyMat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
  const copy = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
  copy.frustumCulled = false;
  const copyScene = new THREE.Scene().add(copy), copyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const prevTarget = gl.getRenderTarget(), prevColor = gl.getClearColor(new THREE.Color()), prevAlpha = gl.getClearAlpha();
  const prevAuto = gl.autoClear, prevShadow = gl.shadowMap.autoUpdate;
  const tmps = [];
  try {
    gl.autoClear = true;
    gl.shadowMap.autoUpdate = false;
    gl.setClearColor(0x000000, 0);
    for (const [t, mat] of [[targets[0], albedoMat], [targets[1], normalMat]]) {
      const tmp = new THREE.WebGLRenderTarget(layout.width, layout.height, { samples: 4, colorSpace: t.texture.colorSpace, generateMipmaps: false });
      tmps.push(tmp);
      mesh.material = mat;
      gl.setRenderTarget(tmp);
      gl.render(scene, cam);
      copyMat.map = tmp.texture;
      copyMat.needsUpdate = true;
      gl.setRenderTarget(t);
      gl.render(copyScene, copyCam);
    }
  } finally {
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevColor, prevAlpha);
    gl.autoClear = prevAuto;
    gl.shadowMap.autoUpdate = prevShadow;
    for (const t of tmps) t.dispose();
    albedoMat.dispose(); normalMat.dispose(); copyMat.dispose(); copy.geometry.dispose(); mesh.dispose();
  }

  // quad −1…1; bounding sphere as the model's, so frustum tests of the chunks stay right
  const quad = new THREE.PlaneGeometry(2, 2);
  quad.deleteAttribute('normal');
  quad.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, fit.pivotY, 0), Math.hypot(r, h / 2));
  // ms: CPU time of the bake (measurement, docs/MODELLE.md)
  const ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0;
  return { albedo: targets[0].texture, normal: targets[1].texture, fit, layout, geometry: quad, targets, ms };
}

// ---------- Material ----------

const glslFloat = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/**
 * Material of an impostor level: MeshStandardMaterial (same light as the meshes, roughness like natureMaterial),
 * billboard and cell choice in the vertex shader, albedo and normal from the atlas in the fragment shader.
 * @param {{ uSnow: {value:number} }} shared nature uniforms
 * @param {ImpostorAtlas} atlas
 * @param {{ snowCap?: boolean, tintMix?: number }} [opts] like natureMaterial: shader snow (summer version while the
 *   winter version is missing), weakened per-instance tint (winter)
 */
export function impostorMaterial(shared, atlas, opts = {}) {
  const { snowCap = true, tintMix = 1 } = opts;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0 });
  const uSnowCap = { value: snowCap ? 1 : 0 }, uTintMix = { value: tintMix };
  m.userData.uSnowCap = uSnowCap;
  m.userData.uTintMix = uTintMix;
  m.userData.impostor = atlas;
  const { fit, layout } = atlas;
  const n = IMPOSTOR.azimuths, els = IMPOSTOR.elevations;
  m.onBeforeCompile = (s) => {
    s.uniforms.uSnow = shared.uSnow;
    s.uniforms.uSnowCap = uSnowCap;
    s.uniforms.uTintMix = uTintMix;
    s.uniforms.uImpAlbedo = { value: atlas.albedo };
    s.uniforms.uImpNormal = { value: atlas.normal };
    s.uniforms.uImpHalf = { value: new THREE.Vector2(...fit.half) };
    s.uniforms.uImpPivot = { value: fit.pivotY };
    s.uniforms.uImpGrid = { value: new THREE.Vector2(layout.cols, layout.lines) };
    const defs = `
#define IMP_N ${glslFloat(n)}
#define IMP_ROWS ${els.length}
const float IMP_EL[${els.length}] = float[](${els.map(glslFloat).join(', ')});
`;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
${defs}
uniform vec2 uImpHalf;
uniform float uImpPivot;
varying vec2 vImpUv;
varying vec4 vImpCell; // azimuth cells i0, i1, rows r0, r1
varying vec2 vImpBlend; // blend azimuth, elevation
varying vec2 vImpRot; // instance rotation (cos, sin)
`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
{
  mat4 kM = modelMatrix * instanceMatrix;
  vec3 kC = (kM * vec4(0.0, uImpPivot, 0.0, 1.0)).xyz;
  vec3 kX = kM[0].xyz;
  float kS = length(kX), kSY = length(kM[1].xyz);
  // rotation of the instance around Y (x axis of the model in world = (cos, 0, −sin))
  vImpRot = vec2(kX.x, -kX.z) / kS;
  vec3 kV = normalize(cameraPosition - kC);
  vec3 kR = cross(vec3(0.0, 1.0, 0.0), kV);
  kR = dot(kR, kR) < 1e-6 ? vec3(1.0, 0.0, 0.0) : normalize(kR);
  vec3 kU = cross(kV, kR);
  vec3 kW = kC + kR * (position.x * uImpHalf.x * kS) + kU * (position.y * uImpHalf.y * kSY);
  transformed = (inverse(kM) * vec4(kW, 1.0)).xyz;
  vImpUv = position.xy * 0.5 + 0.5;
  // camera azimuth in world minus instance rotation = direction in the model frame
  float kAz = atan(kV.x, kV.z) - atan(vImpRot.y, vImpRot.x);
  float kF = mod(kAz / 6.283185307 * IMP_N, IMP_N);
  float kI0 = floor(kF);
  vImpCell.xy = vec2(kI0, mod(kI0 + 1.0, IMP_N));
  vImpBlend.x = kF - kI0;
  float kEl = asin(clamp(kV.y, -1.0, 1.0));
  vImpCell.zw = vec2(0.0);
  vImpBlend.y = 0.0;
  if (kEl >= IMP_EL[IMP_ROWS - 1]) vImpCell.zw = vec2(float(IMP_ROWS - 1));
  else for (int r = 0; r < IMP_ROWS - 1; r++) {
    if (kEl > IMP_EL[r] && kEl <= IMP_EL[r + 1]) {
      vImpCell.zw = vec2(float(r), float(r + 1));
      vImpBlend.y = smoothstep(${glslFloat(IMPOSTOR.rowBlend[0])}, ${glslFloat(IMPOSTOR.rowBlend[1])}, (kEl - IMP_EL[r]) / (IMP_EL[r + 1] - IMP_EL[r]));
    }
  }
}
#endif`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
${defs}
uniform sampler2D uImpAlbedo;
uniform sampler2D uImpNormal;
uniform vec2 uImpGrid;
uniform float uSnow;
uniform float uSnowCap;
uniform float uTintMix;
varying vec2 vImpUv;
varying vec4 vImpCell;
varying vec2 vImpBlend;
varying vec2 vImpRot;
vec4 kImpAlbedo = vec4(0.0);
vec3 kImpN = vec3(0.0);
/** One cell: premultiplied albedo and normal in the model frame (weighted with coverage) */
void kImpSample(float i, float r, float w) {
  if (w <= 0.0) return;
  float k = r * IMP_N + i;
  vec2 uv = (vec2(mod(k, uImpGrid.x), floor(k / uImpGrid.x)) + vImpUv) / uImpGrid;
  vec4 a = texture2D(uImpAlbedo, uv);
  vec4 nn = texture2D(uImpNormal, uv);
  kImpAlbedo += a * w;
  if (nn.a < 1e-3) return;
  // normal in the view space of the capture (camera looking along −Z) → model frame: R_y(az) · R_x(−el)
  vec3 c = nn.rgb / nn.a * 2.0 - 1.0;
  float el = IMP_EL[int(r)], az = i / IMP_N * 6.283185307;
  float ce = cos(el), se = sin(el), ca = cos(az), sa = sin(az);
  vec3 q = vec3(c.x, c.y * ce + c.z * se, -c.y * se + c.z * ce);
  kImpN += vec3(q.x * ca + q.z * sa, q.y, -q.x * sa + q.z * ca) * nn.a * w;
}
`)
      .replace('#include <map_fragment>', `
kImpSample(vImpCell.x, vImpCell.z, (1.0 - vImpBlend.x) * (1.0 - vImpBlend.y));
kImpSample(vImpCell.y, vImpCell.z, vImpBlend.x * (1.0 - vImpBlend.y));
kImpSample(vImpCell.x, vImpCell.w, (1.0 - vImpBlend.x) * vImpBlend.y);
kImpSample(vImpCell.y, vImpCell.w, vImpBlend.x * vImpBlend.y);
if (kImpAlbedo.a < ${glslFloat(IMPOSTOR.alphaTest)}) discard;
diffuseColor.rgb *= kImpAlbedo.rgb / kImpAlbedo.a;
// model frame → world (instance rotation around Y)
vec3 kImpW = normalize(vec3(kImpN.x * vImpRot.x + kImpN.z * vImpRot.y, kImpN.y, -kImpN.x * vImpRot.y + kImpN.z * vImpRot.x) + vec3(0.0, 1e-4, 0.0));`)
      .replace('#include <color_fragment>', `#if defined( USE_COLOR )
diffuseColor.rgb *= mix(vec3(1.0), vColor.rgb, uTintMix);
#endif
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), uSnow * uSnowCap * smoothstep(0.25, 0.7, kImpW.y));`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
normal = normalize((viewMatrix * vec4(kImpW, 0.0)).xyz);
nonPerturbedNormal = normal;`);
  };
  m.customProgramCacheKey = () => `kr-impostor-${n}-${els.join('_')}`;
  return m;
}
