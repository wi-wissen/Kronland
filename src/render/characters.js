// Figures: manifest-driven, instanced, GPU-animated, with levels of detail.
//
// Flow
//  1. public/models/characters/manifest.json maps roles (serf, professions, troop classes, heroes,
//     bandits) to a model (GLB), with clip names, parts (weapons), player-colour and tint mask, size.
//  2. On loading, the skeleton animation of each model is "baked" into a bone texture: per frame (24/s) and
//     bone a 4×4 matrix. The figure geometry (per LOD level, from <model>.lodN.glb) is merged into a
//     single mesh with bone indices; rigid parts (weapons, helmets) hang on their bone.
//  3. Per frame each figure gets only a few numbers (matrix, animation frame A/B + blend, colours) in an
//     InstancedMesh per (variant, LOD level). The graphics card does the skinning itself
//     (texelFetch on the bone texture) – hundreds of figures thus cost a handful of draw calls.
//  4. If a model is missing (or on the low level), the procedural figures from models.js are baked in
//     the same way (body parts as "bones"), so also instanced.
//
// Pure helper functions (role resolution, clip fallback, frame computation, masks) are testable without WebGL.

import * as THREE from 'three';
import { pickVariant, roleVariants } from './variants.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LodState, sphereVisible, lodSettings, screenHeightPx, pixelMetric } from './lod.js';
import { assetUrl } from '../paths.js';
import { trackLoad } from './lazyLoads.js';

// ---------- Pure logic ----------

/** Animation keys the game uses. */
export const CLIP_KEYS = ['idle', 'walk', 'run', 'chop', 'mine', 'hammer', 'build', 'carry', 'attack', 'shoot', 'die', 'cheer', 'sit'];

/** Fallback chain if a model does not have a clip. */
export const CLIP_FALLBACK = {
  run: 'walk', chop: 'attack', mine: 'chop', hammer: 'chop', build: 'hammer', carry: 'walk',
  shoot: 'attack', attack: 'idle', cheer: 'idle', sit: 'idle', walk: 'idle', die: null, idle: null,
};

/** Clips that are not repeated (stay on the last frame). */
export const ONE_SHOT = new Set(['die']);

/**
 * Resolve a clip key to an existing one (via CLIP_FALLBACK).
 * @param {string} key @param {(k:string)=>boolean} has
 * @returns {string|null}
 */
export function resolveClip(key, has) {
  let k = key;
  for (let i = 0; i < 8 && k; i++) {
    if (has(k)) return k;
    k = CLIP_FALLBACK[k] ?? null;
  }
  return has('idle') ? 'idle' : null;
}

/**
 * Resolve a role key: 'soldier.sword.leader' → 'soldier.sword' → 'soldier'. Roles without an available
 * model fall back to their `fallback` role or the procedural model. Roles with `variants`
 * (e.g. serf male/female) yield the variant `pick` (or the next available) mixed in.
 * @param {{roles: Record<string, any>, models?: Record<string, any>}} manifest
 * @param {string} key
 * @param {(model:string)=>boolean} [available] is the model loaded?
 * @param {number} [pick] index of the variant (see pickVariant)
 * @returns {{ key: string, role: any, model: string|null, procedural: string|null } | null}
 */
export function resolveRole(manifest, key, available = () => true, pick = 0) {
  const roles = manifest?.roles ?? {};
  const seen = new Set();
  let k = key;
  let procedural = null;
  while (k && !seen.has(k)) {
    seen.add(k);
    const role = roles[k] ? variantRole(roles[k], pick, available) : null;
    if (role) {
      procedural ??= role.procedural ?? null;
      if (role.model && available(role.model)) return { key: k, role, model: role.model, procedural };
      if (role.fallback) { k = role.fallback; continue; }
      if (role.procedural && !role.model) return { key: k, role, model: null, procedural: role.procedural };
    }
    const dot = k.lastIndexOf('.');
    k = dot > 0 ? k.slice(0, dot) : null;
  }
  return procedural ? { key, role: roles[key] ?? {}, model: null, procedural } : null;
}

/**
 * Role with mixed-in variant. If the model of the desired variant is not available, the
 * next available one is taken (so the role stays playable even if only one model is loaded).
 */
export function variantRole(role, pick, available = () => true) {
  const list = role.variants;
  if (!list?.length) return role;
  const n = list.length;
  const start = ((pick % n) + n) % n;
  let v = list[start];
  for (let i = 0; i < n; i++) {
    const c = list[(start + i) % n];
    if (c.model && available(c.model)) { v = c; break; }
  }
  return { ...role, ...v, weight: undefined };
}

export { pickVariant, roleVariants };

/** Placeholder whose model has been loaded in the meantime (also in attachments such as the crew)? */
export function variantStale(v) {
  if (!v) return false;
  if (v.pendingModel && store.models.has(v.pendingModel)) return true;
  // near model has arrived: rebuild with both levels
  if (v.nearPending && store.models.get(v.nearPending)?.gltf) return true;
  if (v.pendingCheck?.()) return true;
  return (v.attach ?? []).some((a) => variantStale(a.variant));
}

/**
 * Tools that are only visible during certain clips (axe when chopping, hammer when building …).
 * @param {Record<string, string[]>|undefined} props part name → clip keys
 * @param {Record<string, string>} clips clip key → animation name
 * @returns {{ part: string, names: Set<string> }[]} part → animation names in which it is visible
 */
export function propClipNames(props, clips) {
  return Object.entries(props ?? {}).map(([part, keys]) => ({
    part, names: new Set(keys.map((k) => clips?.[k]).filter(Boolean)),
  }));
}

/**
 * Animation frames for a point in time.
 * @param {{start:number, frames:number}} clip @param {number} t seconds since clip start
 * @param {number} fps @param {boolean} loop
 * @returns {[number, number, number]} frame A, frame B (absolute rows of the texture), blend A→B
 */
export function clipFrames(clip, t, fps, loop) {
  const n = clip.frames;
  if (n <= 1) return [clip.start, clip.start, 0];
  let f = Math.max(0, t) * fps;
  if (loop) f %= n; else f = Math.min(f, n - 1);
  const a = Math.floor(f);
  const b = loop ? (a + 1) % n : Math.min(a + 1, n - 1);
  return [clip.start + a, clip.start + b, f - a];
}

/**
 * Does a UV point lie in a mask? Cells refer to a grid (KayKit: 8×4 colour fields),
 * rectangles to [u0, v0, u1, v1]. v counts from the top as in glTF.
 * @param {number} u @param {number} v
 * @param {{ uvCells?: number[][], uvRects?: number[][] }} mask @param {[number, number]} [grid]
 */
export function uvInMask(u, v, mask, grid = [8, 4]) {
  if (mask.uvCells) {
    const cx = Math.floor(u * grid[0]), cy = Math.floor(v * grid[1]);
    for (const [x, y] of mask.uvCells) if (x === cx && y === cy) return true;
  }
  if (mask.uvRects) for (const [u0, v0, u1, v1] of mask.uvRects) if (u >= u0 && u <= u1 && v >= v0 && v <= v1) return true;
  return false;
}

/**
 * Distance → animation pacing: 0 = smooth (blended between frames), otherwise time step in seconds
 * (whole frames, no blending), Infinity = rigid pose.
 */
export function animStep(level) {
  return level === 0 ? 0 : level === 1 ? 1 / 24 : level === 2 ? 1 / 8 : Infinity;
}

// ---------- Loading ----------

/** @type {{ manifest: any, models: Map<string, {gltf: any, lods: any[]}> }} */
const store = { manifest: null, models: new Map() };

/** Figure manifest (or null while it is not loaded) – e.g. for the voice matching the look. */
export const characterManifest = () => store.manifest;

/** Loaded figure models (for Renderer.dispose). */
export const sharedCharacterRoots = () => [...store.models.values()].flatMap((m) => [m.gltf?.scene, ...m.lods.map((l) => l?.scene)]).filter(Boolean);
export const characterModelLoaded = (name) => store.models.has(name);
/** Loaded figure model (for tools and debugging). */
export const characterModel = (name) => store.models.get(name) ?? null;

/**
 * Load the manifest and required figure models. Errors are not fatal (procedural figures remain).
 * @param {import('three/addons/loaders/GLTFLoader.js').GLTFLoader} loader
 * @param {string} base e.g. './models/'
 * @param {{ procedural?: boolean, onItem?: () => void }} [opts]
 * @returns {Promise<string[]>} list of files to load (known beforehand for the progress display)
 */
export async function loadCharacterManifest(base) {
  try {
    const r = await fetch(assetUrl(`${base}characters/manifest.json`));
    if (!r.ok) return null;
    store.manifest = await r.json();
  } catch { store.manifest = null; }
  return store.manifest;
}

/** Models used by roles (also as part donors: "model:part"). */
export function usedModels(m) {
  const used = new Set();
  for (const r of Object.values(m.roles ?? {})) {
    for (const v of [r, ...(r.variants ?? [])]) {
      if (v.model) used.add(v.model);
      for (const inc of v.include ?? []) if (inc.includes(':')) used.add(inc.split(':')[0]);
    }
  }
  return [...used].filter((n) => m.models?.[n]);
}

/** All animation names that a model needs according to the manifest (model clips + role overrides). */
export function clipNamesFor(m, model) {
  const names = new Set(Object.values(m.models?.[model]?.clips ?? {}));
  for (const r of Object.values(m.roles ?? {})) {
    for (const v of [r, ...(r.variants ?? [])]) {
      if ((v.model ?? r.model) === model) for (const n of Object.values({ ...r.clips, ...v.clips })) names.add(n);
    }
  }
  return [...names];
}

/** Files of a model (original + LOD levels). */
export function modelFiles(name, def) {
  const file = def.file ?? `${name}.glb`;
  const n = def.lods ?? 0;
  return [file, ...Array.from({ length: n }, (_, i) => file.replace(/\.glb$/i, `.lod${i + 1}.glb`))];
}

/** Roles whose models are needed right at the start; all others are loaded on demand. */
export const START_ROLES = ['serf'];

/** Models that are loaded at start (start roles including part donors and attachments). */
export function startModels(m) {
  const roles = {};
  const add = (k) => { if (!m.roles?.[k] || roles[k]) return; roles[k] = m.roles[k]; for (const a of m.roles[k].attach ?? []) add(a.role); };
  for (const k of START_ROLES) add(k);
  return usedModels({ ...m, roles });
}

/** Masks that the levels from `from` need (near mask only with the near model). */
export function levelMaskFiles(def, from, to) {
  const out = new Set();
  for (let l = from; l <= to; l++) { const f = maskFileFor(def, l); if (f) out.add(f); }
  return [...out];
}

/** Files needed on the first load of a figure: game model(s) and their masks; without levels the original. */
export function firstFiles(name, def) {
  const files = modelFiles(name, def);
  if (files.length < 2) return { models: files, masks: maskFiles(def) };
  return { models: files.slice(1), masks: levelMaskFiles(def, 1, files.length - 1) };
}

/**
 * Load a figure. First only the game model (lod1, carries skeleton and animations); the large near model (level 0,
 * 2048 texture) only when a figure is close enough for it (requestNearModel). Older files without animations
 * in the game model: then the near model right away (it supplies the animations).
 */
async function loadModel(name, tick = () => {}) {
  const m = store.manifest, def = m?.models?.[name];
  const { load, base } = store.lazy ?? {};
  if (!def || !load) return;
  const files = modelFiles(name, def);
  const first = firstFiles(name, def);
  const [res, maskList] = await Promise.all([
    Promise.all(first.models.map((f) => load(`${base}characters/${f}`).catch(() => null).finally(tick))),
    Promise.all(first.masks.map((f) => loadMaskTexture(assetUrl(`${base}characters/${f}`)).finally(tick))),
  ]);
  const masks = new Map(first.masks.map((f, i) => [f, maskList[i]]));
  let near = files.length < 2 ? res[0] : null;
  // do not shift LOD levels if a file is missing: gap → previous level
  const lods = files.length < 2 ? [] : res.filter(Boolean);
  let anim = [near, ...lods].find((g) => g?.animations?.length) ?? null;
  if (!anim && files.length >= 2) {
    near = await load(`${base}characters/${files[0]}`).catch(() => null);
    await addNearMasks(def, masks);
    anim = near;
  }
  if (!anim) return;
  store.models.set(name, { gltf: near, lods, anim, masks, mask: masks.get(maskFileFor(def, 0)) ?? null });
}

async function addNearMasks(def, masks) {
  const { base } = store.lazy;
  const want = levelMaskFiles(def, 0, 0).filter((f) => !masks.has(f));
  const list = await Promise.all(want.map((f) => loadMaskTexture(assetUrl(`${base}characters/${f}`))));
  want.forEach((f, i) => masks.set(f, list[i]));
}

/**
 * Load the models of the start roles; the others are loaded by requestCharacterModel as soon as a figure needs them.
 * @param {(url:string)=>Promise<any>} load GLTF loader
 * @param {string} base
 * @param {() => void} [tick] progress
 */
export async function loadCharacterModels(load, base, tick = () => {}) {
  const m = store.manifest;
  if (!m) return;
  store.lazy = { load, base, pending: new Set(), near: new Set() };
  await Promise.all(startModels(m).map((name) => loadModel(name, tick)));
}

/** Reload a figure model (once); rendering switches from the placeholder to the model at the next frame. */
export function requestCharacterModel(name) {
  const l = store.lazy;
  if (!l || store.models.has(name) || l.pending.has(name) || !store.manifest?.models?.[name]) return;
  l.pending.add(name);
  const def = store.manifest.models[name], first = firstFiles(name, def);
  const urls = [...first.models, ...first.masks].map((f) => assetUrl(`${l.base}characters/${f}`));
  trackLoad(loadModel(name).finally(() => l.pending.delete(name)), urls);
}

/**
 * Reload the near model of a loaded figure (once) as soon as a figure would need the near level. Until then
 * the figure shows the game model even up close; afterwards variantStale rebuilds the rendering with both levels.
 */
export function requestNearModel(name) {
  const l = store.lazy, e = store.models.get(name), def = store.manifest?.models?.[name];
  if (!l || !e || e.gltf || l.near.has(name) || !def) return;
  l.near.add(name);
  Promise.all([l.load(`${l.base}characters/${modelFiles(name, def)[0]}`), addNearMasks(def, e.masks)])
    .then(([g]) => { if (g) { e.mask = e.masks.get(maskFileFor(def, 0)) ?? null; e.gltf = g; } })
    .catch(() => {}); // without a near model the game model stays (no second attempt)
}

/** Number of files that loadCharacterModels loads at start (for progress). */
export function characterFileCount() {
  const m = store.manifest;
  if (!m) return 0;
  let n = 0;
  for (const name of startModels(m)) {
    const def = m.models?.[name];
    if (def) { const f = firstFiles(name, def); n += f.models.length + f.masks.length; }
  }
  return n;
}

/**
 * Mask file of a LOD level. `mask` is a file name (all levels) or a list per level;
 * missing entries take over the previous level (null = no mask).
 * @param {{ mask?: string|(string|null)[] }} def @param {number} level
 */
export function maskFileFor(def, level) {
  const m = def.mask;
  if (!Array.isArray(m)) return m ?? null;
  for (let l = Math.min(level, m.length - 1); l >= 0; l--) if (m[l] !== undefined) return m[l];
  return null;
}

/** All mask files of a model (without duplicates). */
export function maskFiles(def) {
  const m = def.mask;
  return [...new Set((Array.isArray(m) ? m : [m]).filter(Boolean))];
}

/**
 * Load mask texture (R = player colour, G = tint; same UV as the base colour). Error → null
 * (then only the masks from the manifest apply).
 */
async function loadMaskTexture(url) {
  try {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.flipY = false; // glTF UV
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch { return null; }
}

// ---------- Baking ----------

const FPS_DEFAULT = 24;

/** Convert attribute to Float32 (meshopt stores quantised). */
function floatAttr(a) {
  const f = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
  return new THREE.BufferAttribute(f, a.itemSize);
}

/**
 * Bone texture from poses: frames[f][b] = Matrix4 (model space, incl. inverse bind matrix).
 * Width = bones × 4 (one RGBA texel per column of the matrix), height = frames.
 */
function boneTexture(rows, boneCount) {
  const w = boneCount * 4, h = Math.max(1, rows.length);
  const data = new Float32Array(w * h * 4);
  rows.forEach((mats, f) => {
    for (let b = 0; b < boneCount; b++) data.set(mats[b].elements, (f * w + b * 4) * 4);
  });
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Bake the animations of a GLB model.
 * @returns {{ texture: THREE.DataTexture, clips: Record<string,{start:number,frames:number,duration:number}>, bones: THREE.Bone[], boneIndex: Map<string,number>, boneInverses: THREE.Matrix4[], fps: number }}
 */
export function bakeGltfAnimations(gltf, clipNames, fps, props = []) {
  const scene = gltf.scene;
  let skinned = null;
  scene.traverse((o) => { if (!skinned && o.isSkinnedMesh) skinned = o; });
  if (!skinned) return null;
  const sk = skinned.skeleton;
  const boneIndex = new Map(sk.bones.map((b, i) => [b.name, i]));
  // Tools with their own visibility: one additional "bone" per tool = the tool node itself
  // (hangs on the hand, can have its own animation – two-handed tools are aligned per frame).
  // In clips without the tool it is collapsed to a point (invisible, without shader branch).
  const boneInverses = [...sk.boneInverses];
  const virtual = [];
  scene.updateMatrixWorld(true);
  for (const pr of props) {
    let node = null;
    scene.traverse((o) => { if (!node && o.name === pr.part) node = o; });
    if (!node) continue;
    boneIndex.set('@prop:' + pr.part, sk.bones.length + virtual.length);
    boneInverses.push(node.matrixWorld.clone().invert()); // rest pose (before any animation)
    virtual.push({ node, inv: boneInverses[boneInverses.length - 1], names: pr.names });
  }
  const bones = sk.bones;
  const mixer = new THREE.AnimationMixer(scene);
  const rows = [];
  const clips = {};
  const tmp = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  const rootInv = scene.matrixWorld.clone().invert();
  let current = null; // name of the clip currently being sampled (for tool visibility)
  const sample = () => {
    scene.updateMatrixWorld(true);
    const row = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(rootInv, tmp.multiplyMatrices(b.matrixWorld, sk.boneInverses[i])));
    for (const vb of virtual) {
      const m = new THREE.Matrix4().multiplyMatrices(rootInv, tmp.multiplyMatrices(vb.node.matrixWorld, vb.inv));
      if (!vb.names.has(current)) {
        // linear part 0: all corners collapse onto the grip point (in model coordinates)
        const at = new THREE.Vector3().setFromMatrixPosition(tmp.multiplyMatrices(rootInv, vb.node.matrixWorld));
        m.set(0, 0, 0, at.x, 0, 0, 0, at.y, 0, 0, 0, at.z, 0, 0, 0, 1);
      }
      row.push(m);
    }
    rows.push(row);
  };
  // Frame 0 = rest pose (fallback if no clip matches): first frame of idle, otherwise the node base pose.
  // skeleton.pose() is not suitable here: for quantised models the inverse bind matrices contain the dequantisation.
  const byName = new Map(gltf.animations.map((c) => [c.name, c]));
  const idle = byName.get('Idle') ?? gltf.animations[0];
  if (idle) { const a = mixer.clipAction(idle); a.play(); mixer.setTime(0); sample(); a.stop(); mixer.uncacheAction(idle); }
  else sample();
  clips.__bind = { start: 0, frames: 1, duration: 0 };
  for (const name of clipNames) {
    const clip = byName.get(name);
    if (!clip) continue;
    // loops: frame n = frame 0, hence n frames for [0, duration); one-shot clips with end frame
    const loop = !/death|die|_pose$/i.test(name);
    const frames = Math.max(1, Math.round(clip.duration * fps) + (loop ? 0 : 1));
    const start = rows.length;
    current = name;
    const action = mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.play();
    for (let f = 0; f < frames; f++) {
      mixer.setTime(Math.min(clip.duration, f / fps));
      sample();
    }
    action.stop();
    mixer.uncacheAction(clip);
    clips[name] = { start, frames, duration: clip.duration };
  }
  mixer.stopAllAction();
  scene.updateMatrixWorld(true);
  const boneCount = bones.length + virtual.length;
  return { texture: boneTexture(rows, boneCount), clips, bones, boneIndex, boneInverses, fps, rows: rows.length, scene };
}

/** Mask weight of a part (name/material/UV/texture). */
function maskWeight(mask, partName, matName, u, v, grid, maskImg) {
  if (!mask) return 0;
  if (mask.parts?.some((p) => partName === p || partName.startsWith(p))) return 1;
  if (mask.materials?.includes(matName)) return 1;
  if (uvInMask(u, v, mask, grid)) return 1;
  if (maskImg) {
    const x = Math.min(maskImg.w - 1, Math.max(0, Math.floor(u * maskImg.w))), y = Math.min(maskImg.h - 1, Math.max(0, Math.floor(v * maskImg.h)));
    return maskImg.data[(y * maskImg.w + x) * 4] / 255;
  }
  return 0;
}

/**
 * Merge the figure parts of a (LOD) scene graph into one mesh with bone indices.
 * @param {THREE.Object3D} scene
 * @param {{ boneIndex: Map<string,number>, boneInverses: THREE.Matrix4[] }} bake
 * @param {{ include?: string[], team?: any, tint?: any }} role
 * @param {[number,number]} grid
 * @param {{team?: any, tint?: any}} maskImgs
 */
export function mergeCharacterGeometry(scene, bake, role, grid, maskImgs = {}, donors = new Map()) {
  const parts = [];
  const include = role.include ?? [];
  const exclude = role.exclude ?? [];
  // parts from other models (same bone names, e.g. "Barbarian:1H_Axe")
  const meshes = [];
  scene.traverse((o) => { if (o.isMesh) meshes.push([o, scene]); });
  for (const inc of include) {
    if (!inc.includes(':')) continue;
    const [model, part] = inc.split(':');
    const donor = donors.get(model);
    if (!donor) continue;
    donor.traverse((o) => { if (o.isMesh && o.name === part) meshes.push([o, donor, part]); });
  }
  for (const [o, owner, donated] of meshes) {
    let name = o.name;
    // Animated nodes with a mesh are loaded by three.js as Object3D "Axe" with child mesh "Axe_1": then the node counts
    let partNode = o;
    if (!donated && !o.isSkinnedMesh && !include.includes(name) && o.parent && include.includes(o.parent.name) && name.startsWith(o.parent.name)) {
      name = o.parent.name;
      partNode = o.parent;
    }
    if (exclude.some((p) => name === p)) continue;
    if (!donated && !o.isSkinnedMesh && !include.includes(name)) continue; // rigid parts only on request
    const src = o.geometry;
    const g = new THREE.BufferGeometry();
    const pos = floatAttr(src.attributes.position);
    const nrm = src.attributes.normal ? floatAttr(src.attributes.normal) : null;
    const uv = src.attributes.uv ? floatAttr(src.attributes.uv) : new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    g.setAttribute('position', pos);
    if (nrm) g.setAttribute('normal', nrm);
    g.setAttribute('uv', uv);
    // vertex colours (game model without texture): always RGB
    if (src.attributes.color) {
      const c = floatAttr(src.attributes.color), n3 = new Float32Array(c.count * 3);
      for (let i = 0; i < c.count; i++) for (let k = 0; k < 3; k++) n3[i * 3 + k] = c.getComponent(i, k);
      g.setAttribute('color', new THREE.BufferAttribute(n3, 3));
    }
    if (src.index) g.setIndex(src.index.clone());
    const n = pos.count;
    const bIdx = new Float32Array(n * 4), bW = new Float32Array(n * 4);
    let pre;
    if (o.isSkinnedMesh) {
      const si = src.attributes.skinIndex, sw = src.attributes.skinWeight;
      const bones = o.skeleton.bones;
      let ref = -1, refLocal = 0;
      for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) {
        const local = si.getComponent(i, c);
        const bi = bake.boneIndex.get(bones[local]?.name) ?? 0;
        bIdx[i * 4 + c] = bi;
        bW[i * 4 + c] = sw.getComponent(i, c);
        if (ref < 0 && bake.boneIndex.has(bones[local]?.name)) { ref = bi; refLocal = local; }
      }
      // Quantised models (meshopt) carry the dequantisation per mesh in the inverse bind matrices.
      // Compensation onto the bind matrices of the baked skeleton: inv(IBM_bake) · IBM_mesh · bindMatrix
      if (ref < 0) { ref = 0; refLocal = 0; }
      pre = bake.boneInverses[ref].clone().invert().multiply(o.skeleton.boneInverses[refLocal]).multiply(o.bindMatrix);
    } else {
      // rigid part: attach to the nearest bone ancestor; pose relative to the bone from the
      // local node matrices (independent of the current pose)
      let p = o, bi = -1;
      const chain = new THREE.Matrix4();
      while (p && bi < 0) {
        p.updateMatrix();
        chain.premultiply(p.matrix);
        p = p.parent;
        bi = p ? bake.boneIndex.get(p.name) ?? -1 : -1;
      }
      if (bi < 0) { bi = 0; }
      const pv = bake.boneIndex.get('@prop:' + name); // tool: own bone = the node itself
      if (pv !== undefined) {
        // Rest pose of the tool node in *this* file (LOD levels quantise their geometry differently).
        // The scene of the original is no longer in rest pose after baking → use the remembered one there.
        bi = pv;
        if (scene === bake.scene) {
          chain.copy(bake.boneInverses[pv]).invert();
          if (partNode !== o) { o.updateMatrix(); chain.multiply(o.matrix); }
        } else { chain.identity(); for (let q = o; q && q !== scene; q = q.parent) { q.updateMatrix(); chain.premultiply(q.matrix); } }
        pre = chain.clone();
      }
      for (let i = 0; i < n; i++) { bIdx[i * 4] = bi; bW[i * 4] = 1; }
      pre ??= bake.boneInverses[bi].clone().invert().multiply(chain);
    }
    g.applyMatrix4(pre);
    g.setAttribute('aBoneIdx', new THREE.BufferAttribute(bIdx, 4));
    g.setAttribute('aBoneW', new THREE.BufferAttribute(bW, 4));
    // Masks: player colour (x) and tint (y)
    const mask = new Float32Array(n * 2);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const matOf = (vi) => {
      if (!Array.isArray(o.material) || !src.groups.length) return mats[0]?.name ?? '';
      return mats[0]?.name ?? '';
    };
    const teamAttr = src.attributes._team ?? null; // team area as vertex attribute (game model)
    for (let i = 0; i < n; i++) {
      const u = uv.getX(i), v = uv.getY(i), mn = matOf(i);
      mask[i * 2] = Math.max(maskWeight(role.team, name, mn, u, v, grid, maskImgs.team), teamAttr ? teamAttr.getX(i) : 0);
      mask[i * 2 + 1] = maskWeight(role.tint, name, mn, u, v, grid, maskImgs.tint);
    }
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 2));
    parts.push(g);
  }
  if (!parts.length) return null;
  // Vertex colours: if some parts have them, the others get white (otherwise they cannot be merged)
  if (parts.some((p) => p.attributes.color)) {
    for (const p of parts) if (!p.attributes.color) p.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 3).fill(1), 3));
  }
  // all parts indexed or none
  const allIndexed = parts.every((p) => p.index);
  const list = allIndexed ? parts : parts.map((p) => (p.index ? p.toNonIndexed() : p));
  const merged = mergeGeometries(list, false);
  if (!merged) return null;
  merged.computeBoundingBox();
  return merged;
}

/** Bounds of a figure geometry in a baked frame (CPU, only on build). */
export function posedBounds(geo, bake, frame) {
  const tex = bake.texture.image, W = tex.width, d = tex.data;
  // tools (own bones '@prop:…') do not count towards body height
  const props = new Set([...(bake.boneIndex?.entries() ?? [])].filter(([k]) => k.startsWith('@prop:')).map(([, v]) => v));
  const pos = geo.attributes.position, bi = geo.attributes.aBoneIdx, bw = geo.attributes.aBoneW;
  const box = new THREE.Box3();
  const v = new THREE.Vector3(), acc = new THREE.Vector3(), m = new THREE.Matrix4();
  const step = Math.max(1, Math.floor(pos.count / 600));
  for (let i = 0; i < pos.count; i += step) {
    if (props.size && props.has(bi.getComponent(i, 0))) continue;
    acc.set(0, 0, 0);
    for (let c = 0; c < 4; c++) {
      const w = bw.getComponent(i, c);
      if (!w) continue;
      m.fromArray(d, (frame * W + bi.getComponent(i, c) * 4) * 4);
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      acc.addScaledVector(v, w);
    }
    box.expandByPoint(acc);
  }
  return box;
}

/**
 * Natural ground speed of a walk clip (model units per second, without scaling): the stance foot
 * (lowest points) slides backwards relative to the body at walking speed. Measured as the median of the
 * foot speed over all frame pairs (foot changes are outliers). Tools do not count.
 * null if nothing can be measured (clip in place or similar).
 * @param {THREE.BufferGeometry} geo @param {any} bake @param {{start:number, frames:number, duration:number}} clip
 */
export function strideSpeed(geo, bake, clip) {
  if (!clip || clip.frames < 4 || !clip.duration) return null;
  const tex = bake.texture.image, W = tex.width, d = tex.data;
  const props = new Set([...(bake.boneIndex?.entries() ?? [])].filter(([k]) => k.startsWith('@prop:')).map(([, v]) => v));
  const pos = geo.attributes.position, bi = geo.attributes.aBoneIdx, bw = geo.attributes.aBoneW;
  const step = Math.max(1, Math.floor(pos.count / 1500));
  const v = new THREE.Vector3(), acc = new THREE.Vector3(), m = new THREE.Matrix4();
  const feet = [];
  for (let f = 0; f < clip.frames; f++) {
    const pts = [];
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i += step) {
      if (props.size && props.has(bi.getComponent(i, 0))) continue;
      acc.set(0, 0, 0);
      for (let c = 0; c < 4; c++) {
        const w = bw.getComponent(i, c);
        if (!w) continue;
        m.fromArray(d, ((clip.start + f) * W + bi.getComponent(i, c) * 4) * 4);
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        acc.addScaledVector(v, w);
      }
      pts.push(acc.x, acc.y, acc.z);
      if (acc.y < minY) minY = acc.y;
      if (acc.y > maxY) maxY = acc.y;
    }
    // sole: points in the lowest strip (3 % of the height)
    const lim = minY + (maxY - minY) * 0.03;
    let sx = 0, sz = 0, n = 0;
    for (let k = 0; k < pts.length; k += 3) if (pts[k + 1] <= lim) { sx += pts[k]; sz += pts[k + 2]; n++; }
    feet.push(n ? [sx / n, sz / n] : null);
  }
  const dt = clip.duration / clip.frames;
  const vel = [];
  for (let f = 0; f < feet.length; f++) {
    const p = feet[f], q = feet[(f + 1) % feet.length];
    if (p && q) vel.push(Math.hypot(q[0] - p[0], q[1] - p[1]) / dt);
  }
  if (vel.length < 4) return null;
  vel.sort((x, y) => x - y);
  const med = vel[vel.length >> 1];
  return med > 1e-4 ? med : null;
}

/**
 * Saddle of a mount per baked frame: height of the saddle point (`at`, model coordinates in frame 0 = rest pose,
 * moved along by the bone `bone`) relative to frame 0 – the rider thus rises and falls like the animal's back.
 * Computed as M_f · M_0⁻¹ · at: this way the dequantisation in the inverse bind matrices cancels out.
 * @param {any} bake @param {{ bone: string, at: number[] }} def
 * @returns {{ y0: number, dy: Float32Array } | null} y0 = saddle height in frame 0 (model units)
 */
export function saddleTrack(bake, def) {
  const b = bake.boneIndex?.get(def?.bone);
  if (b === undefined || !Array.isArray(def.at)) return null;
  const tex = bake.texture.image, W = tex.width, d = tex.data, H = tex.height;
  const inv0 = new THREE.Matrix4().fromArray(d, b * 4 * 4).invert();
  const m = new THREE.Matrix4(), v = new THREE.Vector3();
  const dy = new Float32Array(H);
  for (let f = 0; f < H; f++) dy[f] = v.fromArray(def.at).applyMatrix4(inv0).applyMatrix4(m.fromArray(d, (f * W + b * 4) * 4)).y - def.at[1];
  return { y0: def.at[1], dy };
}

/** Is an object visible together with all its ancestors? */
function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }

/** Pixels of a texture (for mask textures and the brightness reference). */
function imagePixels(img, size = 128) {
  try {
    if (!img || typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    return { w: size, h: size, data: ctx.getImageData(0, 0, size, size).data };
  } catch { return null; }
}

/** Mean brightness (max channel, linear) of the masked areas – so that player colours look equally strong. */
function maskReference(geo, pix, channel) {
  if (!pix) return 0.5;
  const uv = geo.attributes.uv, m = geo.attributes.aMask;
  let sum = 0, n = 0;
  const c = new THREE.Color();
  for (let i = 0; i < uv.count; i++) {
    if (m.getComponent(i, channel) < 0.5) continue;
    const x = Math.min(pix.w - 1, Math.max(0, Math.floor(uv.getX(i) * pix.w))), y = Math.min(pix.h - 1, Math.max(0, Math.floor(uv.getY(i) * pix.h)));
    const k = (y * pix.w + x) * 4;
    c.setRGB(pix.data[k] / 255, pix.data[k + 1] / 255, pix.data[k + 2] / 255, THREE.SRGBColorSpace);
    sum += Math.max(c.r, c.g, c.b); n++;
  }
  return n ? Math.max(0.05, sum / n) : 0.5;
}

/**
 * Bring a figure texture to a maximum size (low graphics level/phone: 1024 instead of 2048 – a quarter
 * of the graphics memory). Once per model, the result is remembered on the loaded model.
 */
function limitTexture(map, max, loaded, slot = 'smallMap') {
  const img = map?.image;
  if (!img || typeof document === 'undefined' || !(img.width > max || img.height > max)) return map;
  if (loaded[slot]?.max === max && loaded[slot].src === map) return loaded[slot].tex; // per source: game model first, near model later
  const k = max / Math.max(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = map.flipY; tex.colorSpace = map.colorSpace; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT;
  tex.anisotropy = map.anisotropy;
  loaded[slot] = { max, src: map, tex };
  return tex;
}

/** Mean brightness (max channel, linear) of the vertex colours in a mask – like maskReference for vertex colours. */
function vertexColorReference(geo, channel) {
  const c = geo.attributes.color, m = geo.attributes.aMask;
  let sum = 0, n = 0;
  for (let i = 0; i < c.count; i++) {
    if (m.getComponent(i, channel) < 0.5) continue;
    sum += Math.max(c.getX(i), c.getY(i), c.getZ(i)); n++;
  }
  return n ? Math.max(0.05, sum / n) : 0.5;
}

/** Like maskReference, but from a mask texture (pixels with mask ≥ 50 %). */
function maskImageReference(pix, maskPix, channel) {
  if (!pix || !maskPix) return 0.5;
  let sum = 0, n = 0;
  const c = new THREE.Color();
  for (let k = 0; k < maskPix.data.length; k += 4) {
    if (maskPix.data[k + channel] < 128) continue;
    c.setRGB(pix.data[k] / 255, pix.data[k + 1] / 255, pix.data[k + 2] / 255, THREE.SRGBColorSpace);
    sum += Math.max(c.r, c.g, c.b); n++;
  }
  return n ? Math.max(0.05, sum / n) : 0.5;
}

// ---------- Material ----------

/**
 * Standard material with GPU skinning from the bone texture and player colour/tint.
 * Optional `maskMap`: mask texture (R = player colour, G = tint), pixel-exact instead of per corner.
 * Optional `rim`: strength of the rim light (0 = off).
 * @param {{ map?: THREE.Texture|null, maskMap?: THREE.Texture|null, vertexColors?: boolean, bones: THREE.DataTexture, refTeam?: number, refTint?: number, rim?: number }} o
 */
export function characterMaterial(o) {
  const m = new THREE.MeshStandardMaterial({
    map: o.map ?? null, vertexColors: !!o.vertexColors, roughness: 0.78, metalness: 0,
    flatShading: !!o.flatShading, normalMap: o.normalMap ?? null,
  });
  const uniforms = {
    uBones: { value: o.bones },
    uRefTeam: { value: o.refTeam ?? 1 }, uRefTint: { value: o.refTint ?? 1 },
    uMaskMap: { value: o.maskMap ?? null },
    uRim: { value: o.rim ?? 0 },
  };
  const maskMap = !!(o.maskMap && o.map); // needs the UV of the base colour
  const marker = !!(o.marker && o.map); // team area is magenta in the texture (manifest teamMarker)
  m.userData.charUniforms = uniforms;
  m.userData.teamMarker = !!(o.marker && o.map);
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
${SKIN_PARS}
attribute vec2 aMask;
attribute vec3 aTeam;
attribute vec3 aTint;
attribute float aFade;
varying vec2 vCharMask;
varying vec3 vTeam;
varying vec3 vTint;
varying float vFade;`)
      .replace('#include <beginnormal_vertex>', `kSkin = charSkin();
vec3 objectNormal = normalize((kSkin * vec4(normal, 0.0)).xyz);
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = (kSkin * vec4(position, 1.0)).xyz;
#ifdef USE_ALPHAHASH
vPosition = vec3(position);
#endif
vCharMask = aMask; vTeam = aTeam; vTint = aTint; vFade = aFade;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uRefTeam;
uniform float uRefTint;
uniform float uRim;
${maskMap ? 'uniform sampler2D uMaskMap;' : ''}
${marker ? MARKER_PARS : ''}
varying vec2 vCharMask;
varying vec3 vTeam;
varying vec3 vTint;
varying float vFade;
${DITHER_PARS}`)
      // Cross-fade between LOD levels: fade out pixels by Bayer pattern (the incoming level shows
      // the pixels under vFade, the outgoing the rest – together exactly one full figure, without transparency)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vFade < 0.999) { if (charBayer(gl_FragCoord.xy) >= vFade) discard; }
else if (vFade > 1.001) { if (charBayer(gl_FragCoord.xy) < vFade - 1.0) discard; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 cm = vCharMask;
  ${maskMap ? 'cm = max(cm, texture2D(uMaskMap, vMapUv).rg);' : ''}
  ${marker ? 'cm.x = max(cm.x, charMarker(diffuseColor.rgb));' : ''}
  float v = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
  diffuseColor.rgb = mix(diffuseColor.rgb, vTeam * clamp(v / uRefTeam, 0.45, 1.6), cm.x);
  diffuseColor.rgb = mix(diffuseColor.rgb, vTint * clamp(v / uRefTint, 0.45, 1.6), cm.y);
}`)
      // Rim light: brighten edges slightly so that figures stand out from the ground (readability from game height)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
if (uRim > 0.0) {
  float fres = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  totalEmissiveRadiance += diffuseColor.rgb * uRim * fres * fres;
}`);
  };
  m.customProgramCacheKey = () => `kr-char-${o.map ? 'm' : ''}${maskMap ? 'k' : ''}${marker ? 'p' : ''}${o.normalMap ? 'n' : ''}${o.vertexColors ? 'c' : ''}${o.flatShading ? 'f' : ''}`;
  return m;
}

/** Depth material (shadow) with the same skinning. */
export function characterDepthMaterial(bones) {
  const m = new THREE.MeshDepthMaterial(); // like the standard shadow material of three.js
  const uniforms = { uBones: { value: bones } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
${SKIN_PARS}`)
      .replace('#include <begin_vertex>', `kSkin = charSkin();
vec3 transformed = (kSkin * vec4(position, 1.0)).xyz;`);
  };
  m.customProgramCacheKey = () => 'kr-char-depth';
  return m;
}

/**
 * Team colour directly from the texture: how strongly magenta is a (linear) colour? Same rule as markerWeight in
 * scripts/asset-gen/postprocess.mjs (hue 285°–352°, saturation from 0.25), on sRGB values.
 */
export const MARKER_PARS = /* glsl */`
float charMarker(vec3 lin) {
  vec3 c = pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn;
  if (mx < 0.2 || d < 1e-4) return 0.0;
  float h;
  if (mx == c.r) h = 60.0 * (c.g - c.b) / d; else if (mx == c.g) h = 120.0 + 60.0 * (c.b - c.r) / d; else h = 240.0 + 60.0 * (c.r - c.g) / d;
  if (h < 0.0) h += 360.0;
  float hue = h < 295.0 ? clamp((h - 285.0) / 10.0, 0.0, 1.0) : 1.0 - clamp((h - 342.0) / 10.0, 0.0, 1.0);
  return hue * clamp((d / mx - 0.25) / 0.15, 0.0, 1.0);
}`;

/** JS counterpart of charMarker (sRGB 0–255), for the mean brightness of the team area. */
export function markerWeightSrgb(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 51 || d === 0) return 0;
  let h;
  if (mx === r) h = (60 * (g - b)) / d; else if (mx === g) h = 120 + (60 * (b - r)) / d; else h = 240 + (60 * (r - g)) / d;
  if (h < 0) h += 360;
  const cl = (x) => Math.min(1, Math.max(0, x));
  const hue = h < 295 ? cl((h - 285) / 10) : 1 - cl((h - 342) / 10);
  return hue * cl((d / mx - 0.25) / 0.15);
}

/** Mean brightness (max channel, linear) of the magenta pixels – so that player colours look equally strong. */
function markerReference(pix) {
  if (!pix) return 0.5;
  let sum = 0, n = 0;
  const c = new THREE.Color();
  for (let k = 0; k < pix.data.length; k += 4 * 3) {
    if (markerWeightSrgb(pix.data[k], pix.data[k + 1], pix.data[k + 2]) < 0.8) continue;
    c.setRGB(pix.data[k] / 255, pix.data[k + 1] / 255, pix.data[k + 2] / 255, THREE.SRGBColorSpace);
    sum += Math.max(c.r, c.g, c.b); n++;
  }
  return n ? Math.max(0.05, sum / n) : 0.5;
}

const DITHER_PARS = /* glsl */`
float charBayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[q.x + q.y * 4]) + 0.5) / 16.0;
}`;

/** Duration of the cross-fade when switching between near and game model (s). */
export const LOD_FADE = 0.35;

/**
 * Cross-fade value per instance: 1 = fully visible; (0,1) = incoming level visible by this fraction;
 * (1,2) = outgoing level, 1 + fraction of the points already faded out. Both together cover each point exactly once.
 * @param {number} t seconds since the switch @returns {[number, number]} [incoming, outgoing]
 */
export function lodFadeValues(t) {
  const f = Math.min(1, Math.max(0, t / LOD_FADE));
  return [f >= 1 ? 1 : Math.max(0.001, f), f >= 1 ? 2 : 1 + Math.max(0.001, f)];
}

/**
 * Track the mesh switch of a figure (near ↔ game model) and determine the cross-fade.
 * Own fields `lodFrom`/`lodT0`: `fadeT0` belongs to the cross-fade between animations.
 * @param {{ meshLvl?: number, lodFrom?: number, lodT0?: number, dying?: boolean }} r record (is updated)
 * @param {number} meshLvl mesh in this frame @param {number} time
 * @returns {{ fin: number, fout: number, from: number }} cross-fade values; from = outgoing mesh or −1
 */
export function lodTransition(r, meshLvl, time) {
  if (r.meshLvl >= 0 && r.meshLvl !== meshLvl) { r.lodFrom = r.meshLvl; r.lodT0 = time; }
  r.meshLvl = meshLvl;
  if (r.lodFrom === undefined || r.lodFrom === meshLvl || r.dying || time - r.lodT0 >= LOD_FADE) {
    r.lodFrom = undefined;
    return { fin: 1, fout: 2, from: -1 };
  }
  const [fin, fout] = lodFadeValues(time - r.lodT0);
  return { fin, fout, from: r.lodFrom };
}

const SKIN_PARS = /* glsl */`
uniform highp sampler2D uBones;
attribute vec4 aBoneIdx;
attribute vec4 aBoneW;
attribute vec3 aAnim;
mat4 kSkin;
mat4 charBone(float frame, float b) {
  int x = int(b) * 4, y = int(frame);
  return mat4(texelFetch(uBones, ivec2(x, y), 0), texelFetch(uBones, ivec2(x + 1, y), 0),
              texelFetch(uBones, ivec2(x + 2, y), 0), texelFetch(uBones, ivec2(x + 3, y), 0));
}
mat4 charBoneMix(float b) {
  // blend between two frames only when necessary (saves half the texture lookups)
  if (aAnim.z < 0.002) return charBone(aAnim.x, b);
  return charBone(aAnim.x, b) * (1.0 - aAnim.z) + charBone(aAnim.y, b) * aAnim.z;
}
mat4 charSkin() {
  mat4 m = charBoneMix(aBoneIdx.x) * aBoneW.x;
  if (aBoneW.y > 0.0) m += charBoneMix(aBoneIdx.y) * aBoneW.y;
  if (aBoneW.z > 0.0) m += charBoneMix(aBoneIdx.z) * aBoneW.z;
  if (aBoneW.w > 0.0) m += charBoneMix(aBoneIdx.w) * aBoneW.w;
  return m;
}`;

// ---------- Baking procedural figures ----------

/**
 * Bake a procedural figure (group from models.js with userData.body/legs/arm/tool/horse).
 * @param {THREE.Group} g in base pose
 * @param {{ team: number, tint?: number }} markers colours that are recognised as masks
 * @param {Record<string, (parts:any, t:number)=>void>} poses clip → pose function
 * @param {Record<string, number>} durations clip length in s
 */
export function bakeProcedural(g, markers, poses, durations, fps = FPS_DEFAULT) {
  const root = new THREE.Group();
  root.add(g);
  const ud = g.userData;
  // "bones": group itself, body, legs, arm, tool, horse
  const boneObjs = [g];
  const named = { root: 0 };
  const addBone = (key, o) => { if (o && !boneObjs.includes(o)) { named[key] = boneObjs.length; boneObjs.push(o); } };
  addBone('body', ud.body);
  ud.legs?.forEach((l, i) => addBone('leg' + i, l));
  addBone('arm', ud.arm);
  addBone('tool', ud.tool);
  addBone('horse', ud.horse);
  (ud.horseLegs ?? ud.horse?.userData?.legs)?.forEach((l, i) => addBone('hleg' + i, l));
  addBone('barrel', ud.barrel);
  // remember base pose (poses are set relative to it)
  const rest = boneObjs.map((o) => ({ p: o.position.clone(), r: o.rotation.clone() }));
  const resetPose = () => boneObjs.forEach((o, i) => { o.position.copy(rest[i].p); o.rotation.copy(rest[i].r); });
  root.updateMatrixWorld(true);
  const bindInv = boneObjs.map((o) => o.matrixWorld.clone().invert());
  // geometry: assign each mesh to the nearest bone ancestor
  const parts = [];
  const tc = new THREE.Color(markers.team), tt = markers.tint !== undefined ? new THREE.Color(markers.tint) : null;
  g.traverse((o) => {
    if (!o.isMesh || !shown(o)) return;
    let p = o, bi = -1;
    while (p && bi < 0) { bi = boneObjs.indexOf(p); if (bi < 0) p = p.parent; }
    if (bi < 0) bi = 0;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    // vertex colours and team area per corner (own model, obtained from the texture: cannonFigureGeometry in models.js)
    const vc = geo.attributes.color?.array, vt = geo.attributes.teamMask?.array;
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    geo.applyMatrix4(o.matrixWorld);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3), mask = new Float32Array(n * 2), bIdx = new Float32Array(n * 4), bW = new Float32Array(n * 4);
    const mc = o.material.color ?? new THREE.Color(1, 1, 1);
    const isTeam = mc.equals(tc), isTint = tt && mc.equals(tt);
    const white = { r: 1, g: 1, b: 1 };
    for (let i = 0; i < n; i++) {
      const team = vt ? vt[i] > 0.5 : isTeam;
      const c = team || isTint ? white : vc ? { r: vc[i * 3], g: vc[i * 3 + 1], b: vc[i * 3 + 2] } : mc;
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      mask[i * 2] = team ? 1 : 0; mask[i * 2 + 1] = isTint ? 1 : 0;
      bIdx[i * 4] = bi; bW[i * 4] = 1;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aMask', new THREE.BufferAttribute(mask, 2));
    geo.setAttribute('aBoneIdx', new THREE.BufferAttribute(bIdx, 4));
    geo.setAttribute('aBoneW', new THREE.BufferAttribute(bW, 4));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    parts.push(geo);
  });
  const geometry = mergeGeometries(parts, false);
  geometry.computeBoundingBox();
  // animations: set pose, read out world matrices
  const rows = [];
  const tmp = new THREE.Matrix4();
  const sample = () => { root.updateMatrixWorld(true); rows.push(boneObjs.map((o, i) => new THREE.Matrix4().multiplyMatrices(o.matrixWorld, bindInv[i]))); void tmp; };
  resetPose(); sample();
  const clips = { __bind: { start: 0, frames: 1, duration: 0 } };
  const P = { ...named, objs: boneObjs, rest };
  for (const [key, pose] of Object.entries(poses)) {
    const dur = durations[key] ?? 1;
    const frames = Math.max(1, Math.round(dur * fps) + (ONE_SHOT.has(key) ? 1 : 0));
    const start = rows.length;
    for (let f = 0; f < frames; f++) {
      resetPose();
      pose(P, (f / fps) / dur, f / fps);
      sample();
    }
    clips[key] = { start, frames, duration: dur };
  }
  resetPose();
  root.remove(g);
  return { geometry, texture: boneTexture(rows, boneObjs.length), clips, fps, boneCount: boneObjs.length, rows: rows.length };
}

/** Poses of the procedural figures (phase 0…1 per clip). */
export const PROCEDURAL_POSES = {
  idle: (P, k) => { const b = P.objs[P.body]; if (b) b.position.y += Math.sin(k * Math.PI * 2) * 0.006; },
  walk: (P, k) => {
    const s = Math.sin(k * Math.PI * 2);
    if (P.leg0 !== undefined) P.objs[P.leg0].rotation.x = s * 0.6;
    if (P.leg1 !== undefined) P.objs[P.leg1].rotation.x = -s * 0.6;
    const b = P.objs[P.body]; if (b) b.position.y += Math.abs(s) * 0.03;
    if (P.horse !== undefined) P.objs[P.horse].position.y += Math.abs(s) * 0.04;
    if (P.arm !== undefined) P.objs[P.arm].rotation.x = -s * 0.25;
    // horse legs: diagonal trot
    for (let i = 0; i < 4; i++) if (P['hleg' + i] !== undefined) P.objs[P['hleg' + i]].rotation.x = (i === 0 || i === 3 ? s : -s) * 0.55;
  },
  work: (P, k) => {
    const s = Math.max(0, Math.sin(k * Math.PI * 2));
    if (P.tool !== undefined) P.objs[P.tool].rotation.x = -s * 1.6;
    if (P.arm !== undefined) P.objs[P.arm].rotation.x = -s * 1.4;
    const b = P.objs[P.body]; if (b) b.rotation.x = s * 0.2;
  },
  attack: (P, k) => {
    const s = Math.sin(Math.min(1, k * 1.6) * Math.PI);
    if (P.arm !== undefined) P.objs[P.arm].rotation.x = -s * 1.6;
    if (P.tool !== undefined) P.objs[P.tool].rotation.x = -s * 1.6;
    const b = P.objs[P.body]; if (b) b.rotation.x = s * 0.12;
    if (P.barrel !== undefined) P.objs[P.barrel].position.z -= s * 0.12; // cannon: recoil
  },
  sit: (P) => { const b = P.objs[P.body]; if (b) b.rotation.x = 0.35; },
  die: (P, k) => {
    const e = Math.min(1, k * 1.2);
    const r = P.objs[0];
    r.rotation.x = -e * e * 1.45;
    r.position.y += Math.sin(e * Math.PI) * 0.05;
  },
};
const PROCEDURAL_DURATIONS = { idle: 2, walk: 0.7, work: 0.9, attack: 0.8, sit: 1, die: 0.9 };

// ---------- Runtime ----------

/** Variant = (model or procedural kind) + parts + masks. One InstancedMesh per variant and level. */
export class Variant {
  /**
   * @param {string} key role key
   * @param {THREE.BufferGeometry[]} levels geometries per LOD level
   * @param {any} bake baked animations ({ clips: name → {start, frames, duration}, fps, texture })
   * @param {Record<string,string>} names clip key → animation name
   */
  constructor(key, levels, bake, material, depth, names, opts = {}) {
    this.key = key;
    this.levels = levels;
    this.bake = bake;
    this.material = material;
    this.depth = depth;
    this.names = names;
    this.yaw = opts.yaw ?? 0;
    this.scale = opts.scale ?? 1;
    this.seat = opts.seat ?? 0;
    this.alias = opts.alias ?? {};
    /** @type {Record<string, number>|null} natural ground speed per clip key (model units/s) */
    this.stride = opts.stride ?? null;
    /** @type {{variant: Variant, offset: number[], scale: number, alias: Record<string,string>}[]} */
    this.attach = [];
    this.meshes = [];
    this.has = (k) => !!(this.names[k] && bake.clips[this.names[k]]);
    this.clipCache = new Map();
    this.radius = opts.radius ?? 0.35;
    /** Height in world units (for the LOD level by screen height) */
    this.worldHeight = opts.worldHeight ?? 0.95;
  }
  /** Clip key → clip with fallback (incl. role renaming, e.g. rider: walk → ride). */
  clip(key) {
    let c = this.clipCache.get(key);
    if (c === undefined) {
      const k = resolveClip(this.alias[key] ?? key, this.has) ?? resolveClip(key, this.has);
      c = k ? { key: k, ...this.bake.clips[this.names[k]], loop: !ONE_SHOT.has(k) } : { key: '__bind', ...this.bake.clips.__bind, loop: true };
      this.clipCache.set(key, c);
    }
    return c;
  }
  /** Mount under the figure (attachment with saddle) or null. */
  get mount() { return this.attach.find((a) => a.variant.saddle) ?? null; }
  /**
   * Ground speed to which the walking pace is coupled: for riders that of the mount (in its clip and
   * scale), otherwise their own.
   */
  moveSpeed(key) {
    const m = this.mount;
    if (!m) return this.groundSpeed(key);
    const n = m.variant.groundSpeed(m.alias[key] ?? key);
    return n ? n * m.scale : null;
  }
  /**
   * Facing direction of the body (hip) in a baked frame relative to the rest pose (first frame of `idle`, for
   * riders the riding pose), in radians around the vertical axis. 0 without a hip bone (procedural). Only for checks.
   * @param {number} frame row of the bone texture @param {string} [bone] e.g. 'Spine' for the chest
   */
  bodyYaw(frame, bone = 'Hips') {
    const b = this.bake.boneIndex?.get(bone);
    const tex = this.bake.texture?.image;
    if (b === undefined || !tex?.data) return 0;
    const ref = this.clip('idle').start;
    const m = new THREE.Matrix4().fromArray(tex.data, (frame * tex.width + b * 4) * 4)
      .multiply(new THREE.Matrix4().fromArray(tex.data, (ref * tex.width + b * 4) * 4).invert());
    const f = new THREE.Vector3(0, 0, 1).transformDirection(m);
    return Math.atan2(f.x, f.z);
  }
  /** Natural ground speed (tiles/s) of a walk clip at pace 1; null = not measurable. */
  groundSpeed(key) {
    this.strideCache ??= new Map();
    if (!this.strideCache.has(key)) {
      const c = this.clip(key);
      // own value in the manifest (model units/s, e.g. horse: known from the gait) or measured
      const raw = this.procedural || !MOVE_CLIPS.has(c.key) ? null : this.stride?.[c.key] ?? strideSpeed(this.levels[0], this.bake, c);
      this.strideCache.set(key, raw ? raw * this.scale : null);
    }
    return this.strideCache.get(key);
  }
}

/** Clips whose legs should match the ground speed */
const MOVE_CLIPS = new Set(['walk', 'run', 'carry']);
/** Limits for the walking pace: the Meshy walk clips go almost on the spot with short steps – fully
 * keeping up (≈ ×7) would look like fidgeting, hence at most ×2.2 (≈ 3 steps/s). */
export const STRIDE_RATE_MIN = 0.6, STRIDE_RATE_MAX = 2.2;

/** Cavalry: walk up to WALK_MAX tiles/s, gallop from RUN_MIN; in between the gait stays (no flicker). */
export const CAV_WALK_MAX = 1.3, CAV_RUN_MIN = 1.7;

/**
 * Gait of a rider from the ground speed (rendering only): 'walk' or 'run' (gallop).
 * @param {number} ground tiles/s @param {string|null|undefined} prev previous clip
 */
export function cavalryGait(ground, prev) {
  if (ground >= CAV_RUN_MIN) return 'run';
  if (ground <= CAV_WALK_MAX) return 'walk';
  return prev === 'walk' ? 'walk' : 'run';
}

/**
 * Playback pace of a walk clip so that the feet do not slide: ground speed / natural clip speed.
 * @param {number|null} natural tiles/s at pace 1 @param {number} ground tiles/s @param {number} [fallback]
 */
export function strideRate(natural, ground, fallback = 1) {
  if (!natural || !(ground > 0)) return fallback;
  return Math.min(STRIDE_RATE_MAX, Math.max(STRIDE_RATE_MIN, ground / natural));
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const tmpC = new THREE.Color();

/**
 * Runtime management of all figures.
 * Per frame: set(id, …) for every visible unit, then render(camera, frustum, time).
 */
export class CharacterSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./quality.js').QualitySettings} quality
   * @param {{ procedural: Record<string, (owner:number)=>{group: THREE.Group, team:number, tint?:number}> }} hooks
   */
  constructor(scene, quality, hooks) {
    this.scene = scene;
    this.quality = quality;
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.name = 'characters';
    scene.add(this.group);
    /** @type {Map<string, Variant|null>} */
    this.variants = new Map();
    /** @type {Map<number, any>} */
    this.records = new Map();
    this.gpuModels = quality.characterModels !== 'procedural';
    this.lodSettings = lodSettings('character', quality.tier);
    this.blob = quality.tier === 'low' || quality.shadows === false;
    this.stats = { drawn: 0, levels: [0, 0, 0, 0], culled: 0 };
    this.modelBakes = new Map();
    if (this.blob) this.initBlobs();
  }

  /**
   * Switch graphics level in the running game: LOD thresholds and shadow type (shadow casting of the
   * near figures or blob shadows on the ground). Figure models themselves stay until the next start.
   * @param {import('./quality.js').QualitySettings} quality
   */
  setQuality(quality) {
    this.quality = quality;
    this.lodSettings = lodSettings('character', quality.tier);
    const blob = quality.tier === 'low' || quality.shadows === false;
    if (blob === this.blob) return;
    this.blob = blob;
    if (blob && !this.blobs) this.initBlobs();
    if (!blob && this.blobs) { this.blobs.count = 0; this.blobs.visible = false; }
    for (const v of this.variants.values()) {
      (v?.meshes ?? []).forEach((m, level) => { if (m) m.castShadow = !blob && level === 0; });
    }
  }

  /**
   * Take over the finished figure renderings of the system of the previous world (stage restart): geometry, baked
   * animations, materials and instanced meshes do not depend on the world, baking them again is the biggest part of
   * a restart. The figures themselves (records) start empty. Only for the same figure model setting.
   * @param {CharacterSystem} prev
   */
  adoptVariants(prev) {
    if (prev === this || prev.quality.characterModels !== this.quality.characterModels) return false;
    this.variants = prev.variants;
    this.modelBakes = prev.modelBakes;
    this.variantLists = prev.variantLists;
    for (const v of this.variants.values()) {
      for (const m of v?.meshes ?? []) if (m) { m.count = 0; this.group.add(m); }
    }
    prev.variants = new Map();
    return true;
  }

  /** What is the variant key for a role? Loads/bakes on demand. @returns {Variant|null} */
  /** Discard the rendering of a role (is rebuilt at the next need). */
  dropVariant(key, v) {
    this.variants.delete(key);
    for (const m of v.meshes ?? []) if (m) { m.visible = false; m.count = 0; this.group.remove(m); }
  }

  variantFor(roleKey) {
    if (this.variants.has(roleKey)) return this.variants.get(roleKey);
    let v = null;
    try { v = this.buildVariant(roleKey); } catch (err) { console.warn('Figure', roleKey, err); v = null; }
    this.variants.set(roleKey, v);
    return v;
  }

  /**
   * Key of the rendering for a unit: roles with variants get '#<index>' (chosen by ID).
   * @param {string} roleKey @param {number} id
   */
  variantKey(roleKey, id) {
    let list = (this.variantLists ??= new Map()).get(roleKey);
    if (list === undefined) { list = roleVariants(store.manifest, roleKey); this.variantLists.set(roleKey, list); }
    return list ? `${roleKey}#${pickVariant(list, id)}` : roleKey;
  }

  buildVariant(key) {
    const manifest = store.manifest;
    const hash = key.indexOf('#');
    const roleKey = hash < 0 ? key : key.slice(0, hash);
    const pick = hash < 0 ? 0 : Number(key.slice(hash + 1));
    const res = resolveRole(manifest ?? { roles: {} }, roleKey, (m) => this.gpuModels && store.models.has(m), pick)
      ?? { key: roleKey, role: {}, model: null, procedural: PROCEDURAL_DEFAULT(roleKey) };
    // desired model not loaded yet: reload, until then placeholder (is swapped in set())
    const want = this.gpuModels && manifest ? resolveRole(manifest, roleKey, () => true, pick)?.model : null;
    if (want && !store.models.has(want)) requestCharacterModel(want);
    const role = res.role ?? {};
    let v;
    if (res.model) v = this.buildModelVariant(key, res.model, role);
    if (!v) v = this.buildProceduralVariant(key, res.procedural ?? PROCEDURAL_DEFAULT(roleKey), role);
    if (!v) return null;
    if (want && want !== res.model) v.pendingModel = want;
    // attachments: mount, crew (roles with variants in turn: two different gunners)
    (role.attach ?? []).forEach((a, i) => {
      const list = roleVariants(store.manifest, a.role);
      const av = this.variantFor(list ? `${a.role}#${i % list.length}` : a.role);
      if (av) v.attach.push({ key: av.key ?? null, variant: av, offset: a.offset ?? [0, 0, 0], scale: a.scale ?? 1, alias: a.clipAlias ?? {} });
    });
    // seat height on the mount
    // Seat height on the mount: saddle of the animal (world, with the attachment's scale) + distance saddle → foot point
    // of the rider (seatOffset, negative: the rider sits with the backside on the saddle, the feet hang lower)
    const mount = v.mount;
    if (mount) v.seat = role.seat ?? mount.variant.saddle * mount.scale + (role.seatOffset ?? 0);
    return v;
  }

  buildModelVariant(roleKey, model, role) {
    const manifest = store.manifest;
    const def = manifest.models[model];
    const loaded = store.models.get(model);
    const fps = manifest.fps ?? FPS_DEFAULT;
    let bake = this.modelBakes.get(model);
    if (!bake) {
      // bone texture from the file with the animations (game model; older files: near model)
      bake = bakeGltfAnimations(loaded.anim ?? loaded.gltf, clipNamesFor(manifest, model), fps, propClipNames(def.props, def.clips));
      if (!bake) return null;
      this.modelBakes.set(model, bake);
    }
    const grid = def.uvGrid ?? [8, 4];
    const team = role.team !== undefined ? role.team : def.team;
    const tint = role.tint !== undefined ? role.tint : def.tint;
    const include = [...(role.include ?? def.include ?? []), ...Object.keys(def.props ?? {})];
    const r = { include, exclude: role.exclude ?? def.exclude, team, tint };
    let map = null;
    (loaded.gltf ?? loaded.lods[0])?.scene.traverse((o) => { if (!map && o.isMesh && o.material?.map) map = o.material.map; });
    map = limitTexture(map, this.quality.characterTexture ?? 2048, loaded);
    const pix = imagePixels(map?.image);
    // levels with their real number (0 = near model). If the near model is still missing, the game model shows all levels.
    const scenes = [...(loaded.gltf ? [[loaded.gltf.scene, 0]] : []), ...loaded.lods.map((l, i) => [l.scene, i + 1])];
    const built = scenes.map(([sc, lvl]) => {
      // donor parts in the matching LOD level
      const donors = new Map();
      for (const inc of r.include) {
        if (!inc.includes(':')) continue;
        const dm = store.models.get(inc.split(':')[0]);
        if (dm) donors.set(inc.split(':')[0], (lvl > 0 ? dm.lods[Math.min(lvl, dm.lods.length) - 1]?.scene : null) ?? dm.gltf?.scene ?? dm.lods[0]?.scene);
      }
      return { geo: mergeCharacterGeometry(sc, bake, r, grid, {}, donors), sc, lvl };
    }).filter((x) => x.geo);
    if (!built.length) return null;
    const levels = built.map((x) => x.geo);
    const names = { ...(def.clips ?? {}), ...(role.clips ?? {}) };
    // Height from the rest posture (first frame of idle, otherwise frame 0): scale the figure so that it is def.height tiles
    // tall. The base posture (frame 0) is hunched in some models – they would be too large. The measure is always
    // the model with the animations – so the size does not change when the near model arrives later.
    const idle = bake.clips[names.idle];
    const animScene = (loaded.anim ?? loaded.gltf).scene;
    const bb = posedBounds((built.find((x) => x.sc === animScene) ?? built[0]).geo, bake, idle ? idle.start : 0);
    const height = def.height ?? 1;
    const scale = (def.scale ?? height / Math.max(0.01, bb.max.y - Math.max(0, bb.min.y))) * (role.scale ?? 1);
    // Material per LOD level: far and middle levels may have their own texture (e.g. flat palette colours)
    // and mask; otherwise the texture and mask of the original apply. Equal combinations share a material.
    const cache = new Map();
    const materialFor = (sc, lvl, geo) => {
      if (geo.attributes.color) {
        // game model with vertex colours: no texture (does not blur together in the distance), team area from the corners
        const key = 'vc';
        if (!cache.has(key)) cache.set(key, characterMaterial({ vertexColors: true, bones: bake.texture, rim: def.rim ?? 0, refTeam: vertexColorReference(geo, 0), refTint: vertexColorReference(geo, 1) }));
        return cache.get(key);
      }
      let own = null, nrm = null;
      if (lvl > 0) sc.traverse((o) => { if (!own && o.isMesh && o.material?.map) own = o.material.map; });
      let nscale = null;
      sc.traverse((o) => { if (!nrm && o.isMesh && o.material?.normalMap) { nrm = o.material.normalMap; nscale = o.material.normalScale; } });
      const lmap = own ?? map;
      if (def.teamMarker) {
        // team area as magenta in the texture: no mask image, the shader recognises it
        const key = `tm|${lmap?.uuid}|${nrm?.uuid}`;
        if (!cache.has(key)) {
          cache.set(key, characterMaterial({
            map: lmap, normalMap: nrm ? limitTexture(nrm, this.quality.characterTexture ?? 2048, loaded, 'smallNormal' + lvl) : null,
            marker: true, bones: bake.texture, refTeam: markerReference(own ? imagePixels(own.image) : pix),
          }));
          if (nscale) cache.get(key).normalScale.copy(nscale); // as set by the GLTFLoader (sign y)
        }
        return cache.get(key);
      }
      const maskMap = loaded.masks?.get(maskFileFor(def, lvl)) ?? (lvl === 0 ? loaded.mask : null) ?? null;
      const key = `${lmap?.uuid}|${maskMap?.uuid}`;
      if (cache.has(key)) return cache.get(key);
      const lpix = own ? imagePixels(own.image) : pix;
      const maskPix = maskMap ? imagePixels(maskMap.image) : null;
      const mat = characterMaterial({
        map: lmap, maskMap, bones: bake.texture, rim: def.rim ?? 0,
        refTeam: maskPix ? maskImageReference(lpix, maskPix, 0) : maskReference(geo, lpix, 0),
        refTint: maskPix ? maskImageReference(lpix, maskPix, 1) : maskReference(geo, lpix, 1),
      });
      cache.set(key, mat);
      return mat;
    };
    const materials = built.map((x) => materialFor(x.sc, x.lvl, x.geo));
    const v = new Variant(roleKey, levels, bake, materials[0], characterDepthMaterial(bake.texture), names, {
      yaw: def.yaw, scale, alias: role.clipAlias, worldHeight: (def.height ?? 1) * (role.scale ?? 1), stride: def.stride,
    });
    v.materials = materials;
    v.tintColor = tint?.color ? new THREE.Color(tint.color) : null;
    v.model = model;
    // mount: saddle height and its rising/falling per frame (rider follows the back)
    const track = def.saddle ? saddleTrack(bake, def.saddle) : null;
    if (track) { v.saddle = track.y0 * scale; v.saddleDy = track.dy; }
    // near model still missing: request as soon as a figure would need the near level (render)
    v.nearPending = loaded.gltf ? null : model;
    return v;
  }

  buildProceduralVariant(roleKey, kind, role) {
    const make = this.hooks.procedural[kind] ?? this.hooks.procedural[kind.split(':')[0]] ?? this.hooks.procedural.serf;
    const p = make(kind);
    const bake = bakeProcedural(p.group, { team: p.team, tint: p.tint }, PROCEDURAL_POSES, PROCEDURAL_DURATIONS);
    const names = Object.fromEntries(Object.keys(bake.clips).map((k) => [k, k]));
    // map work/attack/… onto the available poses
    for (const [k, src] of Object.entries({ chop: 'work', mine: 'work', hammer: 'work', build: 'work', shoot: 'attack', run: 'walk', carry: 'walk', cheer: 'idle', ride: 'idle' })) names[k] ??= src;
    const material = characterMaterial({ vertexColors: true, flatShading: true, bones: bake.texture, refTeam: 1, refTint: 1 });
    const v = new Variant(roleKey, [bake.geometry], bake, material, characterDepthMaterial(bake.texture), names, {
      scale: role.procScale ?? 1, alias: role.procAlias ?? {}, radius: p.radius, worldHeight: 0.9 * (role.procScale ?? 1),
    });
    v.tintColor = role.tint?.color ? new THREE.Color(role.tint.color) : (p.tintDefault !== undefined ? new THREE.Color(p.tintDefault) : null);
    v.procedural = true;
    v.saddle = (p.saddle ?? 0) * (role.procScale ?? 1);
    // own model is being reloaded (e.g. the cannon): then bake anew (set() swaps)
    if (p.pending) v.pendingCheck = p.pending;
    return v;
  }

  /** InstancedMesh for variant and level (grows on demand). */
  meshFor(v, level, need) {
    let m = v.meshes[level];
    if (m && m.instanceMatrix.count >= need) return m;
    const cap = Math.max(16, need * 2, m ? m.instanceMatrix.count * 2 : 0);
    if (m) { this.group.remove(m); m.geometry.dispose(); m.dispose(); } // also free the instanceMatrix buffer
    const geo = new THREE.InstancedBufferGeometry();
    const src = v.levels[level];
    for (const [k, a] of Object.entries(src.attributes)) geo.setAttribute(k, a);
    geo.setIndex(src.index);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aTeam', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFade', new THREE.InstancedBufferAttribute(new Float32Array(cap).fill(1), 1).setUsage(THREE.DynamicDrawUsage));
    m = new THREE.InstancedMesh(geo, v.materials?.[level] ?? v.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.customDepthMaterial = v.depth;
    m.frustumCulled = false;
    m.count = 0;
    // shadows only from close up (level 0); farther away figures are a few pixels tall
    m.castShadow = !this.blob && level === 0;
    m.receiveShadow = level === 0;
    m.name = `char-${v.key}-lod${level}`;
    this.group.add(m);
    v.meshes[level] = m;
    return m;
  }

  /**
   * Report a figure for this frame.
   * @param {number} id entity
   * @param {string} roleKey
   * @param {{ x:number, y:number, z:number, yaw:number, clip:string, team:number, tint?:number|null, visible?:boolean, speed?:number }} s
   */
  set(id, role, s) {
    const roleKey = this.variantKey(role, id);
    let r = this.records.get(id);
    // reloaded model is there: replace the placeholder rendering of this role
    if (r?.roleKey === roleKey && variantStale(r.variant)) {
      // also rebuild reloaded attachments (crew, mount)
      for (const [k, v] of this.variants) {
        if (v && v !== r.variant && r.variant.attach.some((a) => a.variant === v) && variantStale(v)) this.dropVariant(k, v);
      }
      if (this.variants.get(roleKey) === r.variant) this.dropVariant(roleKey, r.variant);
      r.variant = this.variantFor(roleKey);
    }
    if (!r || r.roleKey !== roleKey) {
      r = { id, roleKey, variant: this.variantFor(roleKey), lod: new LodState(), clip: null, clipT0: 0, prevClip: null, prevT0: 0, fadeT0: -1, seen: 0, dying: false, phase: (((id * 2654435761) >>> 0) / 4294967296) * 3 };
      r.position = new THREE.Vector3();
      this.records.set(id, r);
    }
    r.position.set(s.x, s.y, s.z);
    r.yaw = s.yaw;
    r.team = s.team;
    r.tint = s.tint ?? null;
    r.visible = s.visible !== false;
    r.seen = this.frameNo;
    if (r.clip !== s.clip) this.switchClip(r, s.clip);
    // Walking pace: coupled to the ground speed (s.ground, tiles/s) to the clip's step length, smoothed
    // and phase-continuous (the legs do not jump when the pace changes)
    let rate = s.speed ?? 1;
    if (s.ground > 0 && r.variant && MOVE_CLIPS.has(r.clip)) rate = strideRate(r.variant.moveSpeed(r.clip), s.ground, rate);
    if (MOVE_CLIPS.has(r.clip)) {
      const old = r.speed ?? rate;
      const next = old + (rate - old) * 0.25;
      if (old > 0 && next > 0 && Math.abs(next - old) > 1e-6) r.clipT0 = this.time - ((this.time - r.clipT0) * old) / next;
      r.speed = next;
    } else r.speed = rate;
    return r;
  }

  switchClip(r, clip) {
    if (r.clip) { r.prevClip = r.clip; r.prevT0 = r.clipT0; r.fadeT0 = this.time; }
    r.clip = clip;
    // start looping clips phase-shifted (no masses moving in lockstep)
    r.clipT0 = this.time - (ONE_SHOT.has(clip) ? 0 : r.phase);
  }

  /** Unit died: play the death animation, then sink and remove. */
  kill(id) {
    const r = this.records.get(id);
    if (!r || r.dying) return;
    r.dying = true;
    r.dieAt = this.time;
    this.switchClip(r, 'die');
    r.fadeT0 = -1;
  }

  /** Remove records without a report in this frame (except dying ones). */
  prune() {
    for (const [id, r] of this.records) {
      if (r.dying) { if (this.time - r.dieAt > 4.2) this.records.delete(id); continue; }
      if (r.seen !== this.frameNo) this.records.delete(id);
    }
  }

  begin(time) { this.time = time; this.frameNo = (this.frameNo ?? 0) + 1; }

  /**
   * Work beat of a figure for the sound (read only): shown clip, seconds since clip start, cycle length and
   * key of the animation actually played (e.g. build → hammer, procedural → work). null without figure/clip.
   * @param {number} id
   * @returns {{ clip: string, t: number, period: number, anim: string } | null}
   */
  beat(id) {
    const r = this.records.get(id);
    if (!r || r.dying || !r.clip || !r.variant) return null;
    const cur = r.variant.clip(r.clip);
    if (!cur?.duration) return null;
    return { clip: r.clip, t: this.time - r.clipT0, period: cur.duration, anim: r.variant.procedural ? r.variant.names[cur.key] ?? cur.key : cur.key };
  }

  /**
   * Write instance data.
   * @param {THREE.PerspectiveCamera} camera @param {THREE.Frustum} frustum
   * @param {import('./lod.js').LodCounter} [counter]
   */
  render(camera, frustum, counter) {
    const time = this.time;
    const camPos = camera.position;
    const bias = this.lodSettings.bias;
    const viewH = this.viewH ?? 800;
    /** @type {Map<Variant, any[][]>} variant → level → [record, level, sinking, attachment, cross-fade] */
    const buckets = new Map();
    const push = (v, lvl, item) => {
      let b = buckets.get(v);
      if (!b) { b = []; buckets.set(v, b); }
      (b[Math.min(lvl, v.levels.length - 1)] ??= []).push(item);
    };
    const st = this.stats; st.drawn = 0; st.culled = 0; st.levels = [0, 0, 0, 0];
    for (const r of this.records.values()) {
      const v = r.variant;
      if (!v || !r.visible) continue;
      const sink = r.dying ? Math.max(0, (time - r.dieAt - 2.6) / 1.6) : 0;
      const p = r.position;
      if (!sphereVisible(frustum, p.x, p.y + 0.5, p.z, 0.9)) { st.culled++; r.meshLvl = -1; continue; }
      // level by screen height of the figure (phone and desktop equal), graphics level shifts the thresholds
      const px = screenHeightPx(v.worldHeight, camPos.distanceTo(p), camera.fov, viewH) * bias;
      const lvl = r.lod.update(pixelMetric(px), this.lodSettings);
      if (lvl < 0) { st.culled++; r.meshLvl = -1; continue; }
      st.levels[lvl]++; st.drawn++;
      if (lvl === 0) { if (v.nearPending) requestNearModel(v.nearPending); for (const a of v.attach) if (a.variant.nearPending) requestNearModel(a.variant.nearPending); }
      counter?.add('character', lvl);
      // mesh switch (near ↔ game model): briefly draw both, cross-faded by dither
      const tr = lodTransition(r, Math.min(lvl, v.levels.length - 1), time);
      push(v, lvl, [r, lvl, sink, null, tr.fin]);
      if (tr.from >= 0) push(v, tr.from, [r, tr.from, sink, null, tr.fout]);
      for (const a of v.attach) push(a.variant, lvl, [r, lvl, sink, a, 1]);
    }
    for (const v of this.variants.values()) {
      if (!v) continue;
      const b = buckets.get(v) ?? [];
      for (let lvl = 0; lvl < Math.max(b.length, v.meshes.length); lvl++) {
        const list = b[lvl] ?? [];
        if (!list.length) { if (v.meshes[lvl]) { v.meshes[lvl].count = 0; v.meshes[lvl].visible = false; } continue; }
        const m = this.meshFor(v, lvl, list.length);
        const anim = m.geometry.attributes.aAnim, team = m.geometry.attributes.aTeam, tint = m.geometry.attributes.aTint, fade = m.geometry.attributes.aFade;
        let i = 0;
        for (const [r, rl, sink, a, fv] of list) {
          const host = r.variant;
          const yaw = r.yaw + v.yaw;
          tmpP.copy(r.position);
          if (a) {
            // attachment relative to the figure (rotated with it)
            const [ox, oy, oz] = a.offset, c = Math.cos(r.yaw), sn = Math.sin(r.yaw);
            tmpP.x += ox * c + oz * sn; tmpP.z += -ox * sn + oz * c; tmpP.y += oy;
          } else tmpP.y += host.seat;
          tmpP.y -= sink * 0.6;
          tmpQ.setFromAxisAngle(UP, yaw);
          tmpS.setScalar(v.scale * (a ? a.scale : 1));
          tmpM.compose(tmpP, tmpQ, tmpS);
          m.setMatrixAt(i, tmpM);
          // animation (throttled by distance)
          const step = animStep(rl);
          let [fa, fb, w] = animFrames(v, r, a, step, time);
          // rider: rises and falls with the back of the mount (same frame as the animal)
          const mount = a ? null : host.mount;
          if (mount?.variant.saddleDy) {
            const mv = mount.variant, [ma, mb, mw] = animFrames(mv, r, mount, step, time);
            tmpP.y += (mv.saddleDy[ma] * (1 - mw) + mv.saddleDy[mb] * mw) * mv.scale * mount.scale;
            tmpM.compose(tmpP, tmpQ, tmpS);
            m.setMatrixAt(i, tmpM);
          }
          const fadeK = r.fadeT0 >= 0 ? (time - r.fadeT0) / 0.22 : 1;
          if (fadeK < 1 && step === 0 && r.prevClip) {
            // cross-fade: previous clip (frame A) → current (frame B)
            const pk = a ? (a.alias[r.prevClip] ?? r.prevClip) : r.prevClip;
            const pc = v.clip(pk);
            const [pa] = clipFrames(pc, time - r.prevT0, v.bake.fps, pc.loop);
            fb = w < 0.5 ? fa : fb; fa = pa; w = fadeK;
          }
          anim.setXYZ(i, fa, fb, w);
          fade.setX(i, fv ?? 1);
          tmpC.setHex(r.team);
          team.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
          if (r.tint !== null && !a) tmpC.setHex(r.tint);
          else if (v.tintColor) tmpC.copy(v.tintColor);
          else tmpC.setRGB(1, 1, 1);
          tint.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
          i++;
        }
        m.count = i;
        m.visible = i > 0;
        for (const at of [m.instanceMatrix, anim, team, tint, fade]) { at.clearUpdateRanges(); at.addUpdateRange(0, i * at.itemSize); at.needsUpdate = true; }
      }
    }
    if (this.blob) this.renderBlobs(buckets);
  }

  /**
   * Facing directions of a figure and its mount in this frame (world, radians; rider including the hip rotation
   * of the shown animation frame). Read only, for checks: rider and horse must face the same way.
   * @param {number} id @returns {{ rider: number, horse: number|null, clip: string } | null}
   */
  facing(id) {
    const r = this.records.get(id), v = r?.variant;
    if (!v) return null;
    const [fa] = animFrames(v, r, null, 0, this.time);
    const m = v.mount;
    return { rider: r.yaw + v.yaw + v.bodyYaw(fa), horse: m ? r.yaw + m.variant.yaw : null, clip: v.clip(r.clip).key };
  }

  /** Make all variants visible once (precompile shaders). */
  prewarm(on) {
    for (const v of this.variants.values()) {
      if (!v) continue;
      for (let l = 0; l < v.levels.length; l++) {
        const m = this.meshFor(v, l, 1);
        if (on) { m.count = Math.max(m.count, 1); m.visible = true; } else { m.visible = m.count > 0; }
      }
    }
  }

  // ---------- Blob shadows (low level) ----------

  initBlobs() {
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {},
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vUv; void main() { float d = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.0, 0.0, 0.0, 0.42 * (1.0 - smoothstep(0.35, 1.0, d))); }`,
    });
    this.blobs = new THREE.InstancedMesh(geo, mat, 512);
    this.blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.blobs.name = 'blob-shadows';
    this.blobs.count = 0;
    this.scene.add(this.blobs);
  }

  renderBlobs(buckets) {
    let n = 0;
    const cap = this.blobs.instanceMatrix.count;
    for (const [v, b] of buckets) for (const list of b) for (const [r, lvl, , att, fv] of list ?? []) {
      if (n >= cap || lvl > 2 || att || fv > 1) continue; // outgoing level of the cross-fade: no second shadow
      const sz = v.radius * 1.8 * (v.attach.length ? 1.6 : 1);
      tmpM.makeScale(sz, 1, sz).setPosition(r.position.x, r.position.y + 0.035, r.position.z);
      this.blobs.setMatrixAt(n++, tmpM);
    }
    this.blobs.count = n;
    this.blobs.visible = n > 0;
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  /** Statistics for the debug display. */
  info() {
    let meshes = 0;
    for (const v of this.variants.values()) if (v) for (const m of v.meshes) if (m?.visible) meshes++;
    return { ...this.stats, meshes, variants: [...this.variants.values()].filter(Boolean).length };
  }
}

/**
 * Animation frames of a figure or an attachment in this frame (without cross-fade between clips).
 * @param {Variant} v rendering @param {any} r record of the unit @param {any} a attachment (or null)
 * @param {number} step pacing (animStep) @param {number} time
 * @returns {[number, number, number]}
 */
function animFrames(v, r, a, step, time) {
  const key = a ? (a.alias[r.clip] ?? r.clip) : r.clip;
  const cur = v.clip(key);
  let t = (time - r.clipT0) * (MOVE_CLIPS.has(cur.key) || MOVE_CLIPS.has(r.clip) ? r.speed : 1);
  if (step === Infinity) t = cur.loop ? 0 : cur.duration;
  else if (step > 0) t = Math.floor(t / step + 1e-4) * step;
  const f = clipFrames(cur, t, v.bake.fps, cur.loop);
  if (step > 0) f[2] = 0;
  return f;
}

/** Procedural kind from a role key if the manifest is missing. */
export function PROCEDURAL_DEFAULT(roleKey) {
  const [a, b] = roleKey.split('.');
  if (a === 'serf') return 'serf';
  if (a === 'worker') return 'worker';
  if (a === 'hero') return 'hero:' + (b ?? 'nelia');
  if (a === 'soldier' || a === 'bandit') return b ?? 'sword';
  if (a === 'cannonCrew') return 'serf';
  return 'serf';
}
