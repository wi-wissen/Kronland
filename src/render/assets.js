// Loading the CC0 models (KayKit by Kay Lousberg, www.kaylousberg.com).
// The mapping game type → model is here; without loaded models the procedural placeholders take over.
// Swapping graphics: replace files in public/assets and adjust the tables below.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { loadCharacterManifest, loadCharacterModels, characterFileCount } from './characters.js';
import { loadGroundImages, GROUND_IMAGE_KINDS } from './textures.js';
import { loadNatureImages, NATURE_IMAGE_KINDS } from './naturetex.js';
import { getQuality } from './quality.js';
import { siteUrl, assetUrl } from '../paths.js';
import { playerColorIndex } from './playerColors.js';
import { SUMMER_NATURE_MODELS, NATURE_MODEL_LODS } from './treeModels.js';
import { pitShape, pitRect, pitTexture, hangerBeam } from './pit.js';

/** Colour versions of the models in palette order (player → colour: playerColorIndex in playerColors.js). */
export const ASSET_COLORS = ['blue', 'red', 'green', 'yellow'];

/**
 * Building type → model per level (last entry applies to higher levels). Own models (scripts/asset-gen/building.mjs)
 * exist ONCE (`buildings/<name>.glb`, pennant in magenta, the game colours it when drawing) and are only loaded
 * when the building appears; KayKit models per player colour (`<name>_<colour>.glb`) are preloaded.
 */
export const OWN_BUILDING_ASSETS = {
  headquarters: ['castle', 'castle2', 'castle3'],
  villageCenter: ['village', 'village2', 'village3'],
  residence: ['house', 'house2', 'house3'],
  farm: ['farm', 'farm2', 'farm3'],
  chapel: ['chapel', 'chapel2', 'chapel3'],
  storehouse: ['storehouse', 'storehouse2'],
  university: ['university', 'university2'],
  bank: ['bank1', 'bank2'],
  brickworks: ['brickworks', 'brickworks2'],
  sawmill: ['sawmill', 'sawmill2'],
  stonemason: ['stonemason', 'stonemason2'],
  smithy: ['smithy', 'smithy2'],
  alchemist: ['alchemist', 'alchemist2'],
  clayMine: ['clay_mine', 'clay_mine2', 'clay_mine3'],
  stoneMine: ['stone_mine', 'stone_mine2', 'stone_mine3'],
  ironMine: ['iron_mine', 'iron_mine2', 'iron_mine3'],
  sulfurMine: ['sulfur_mine', 'sulfur_mine2', 'sulfur_mine3'],
  barracks: ['barracks', 'barracks2'],
  archery: ['archery', 'archery2'],
  stable: ['stable', 'stable2'],
  foundry: ['foundry', 'foundry2'],
  tower: ['tower', 'tower2', 'tower3'],
  clock: ['clock'],
  windwheel: ['windwheel'],
  weatherTower: ['weather_tower'],
  weatherPlant: ['weather_plant'],
  banditCamp: ['bandit_camp'],
  fountain: ['fountain'],
  statue: ['statue'],
};
/** KayKit placeholders for types without their own model. */
export const KAYKIT_BUILDING_ASSETS = {};
export const BUILDING_ASSETS = { ...KAYKIT_BUILDING_ASSETS, ...OWN_BUILDING_ASSETS };

/** Own building models: foundation in the model (no stone base from the game), team colour from magenta. */
export const OWN_BUILDING_MODELS = new Set(Object.values(OWN_BUILDING_ASSETS).flat());
const bareName = (asset) => asset.replace(/^buildings\//, '').replace(/_(blue|red|green|yellow)$/, '').replace(/\.lod\d$/, '');
/** @param {string|null} asset e.g. 'buildings/house' */
export const isOwnBuildingModel = (asset) => !!asset && OWN_BUILDING_MODELS.has(bareName(asset));

/** Enlargement of own models whose outline extends beyond the footprint (mill sails). */
export const OWN_BUILDING_FILL = { farm2: 1.3, farm3: 1.3, chapel2: 0.8, chapel3: 1.08 };
/**
 * Pits: ground = fraction of the model height below the ground disc – so far the model is sunk. The terrain
 * hides the sunken shaft; therefore a "foil" lies below the ground disc: the opening of the model, rasterised
 * from above (src/render/pit.js), softly bordered and painted (earth in the colour `rim` → black in the middle). It never
 * goes beyond the rim wall. If the rasterisation finds no hole, the old black hull (`shrink`) applies.
 * gallows: two posts and a crossbeam below a freely hanging bucket (hangerBeam in pit.js).
 */
export const OWN_BUILDING_PIT = {
  // Clay: reddish earth; flat patch of earth with gallows in the model (newly generated, front view only)
  clay_mine: { ground: 0.28, shrink: 0.68, rim: [118, 66, 40] },
  iron_mine: { ground: 0.35, rim: [86, 62, 46] },
  sulfur_mine: { ground: 0.075, rim: [104, 76, 48] },
};
/** @param {string|null} asset @returns {{ground: number, shrink?: number, rim?: number[], gallows?: boolean}|null} */
export const ownBuildingPit = (asset) => (asset ? OWN_BUILDING_PIT[bareName(asset)] ?? null : null);
/** @param {string|null} asset */
export const ownBuildingFill = (asset) => (asset ? OWN_BUILDING_FILL[bareName(asset)] ?? 1 : 1);

/** Own models that are needed right at the start (castle, village centre, level-1 house). */
const OWN_PRELOAD = ['castle', 'village', 'house'];

/** Number of simplified LOD levels per building model (<name>.lod1.glb …, see scripts/build-lods.mjs). */
export const BUILDING_LODS = 2;

const NEUTRAL = [
  'buildings/scaffolding', 'buildings/stage_A', 'buildings/stage_B', 'buildings/stage_C', 'buildings/destroyed',
  'nature/rock_single_A', 'nature/rock_single_B', 'nature/rock_single_C', 'nature/rock_single_D', 'nature/rock_single_E',
  'nature/mountain_A', 'nature/mountain_B', 'nature/mountain_C',
];

/** @type {Map<string, {scene: THREE.Object3D, animations: THREE.AnimationClip[]}>} */
const cache = new Map();
let base = './models/';

export const hasAsset = (name) => cache.has(name);
/** Cached models (for Renderer.dispose: free GPU data, models stay loaded). */
export const sharedAssetRoots = () => [...cache.values()].map((a) => a.scene);

/**
 * Loads all models for the given number of players. Errors are not fatal (placeholders remain).
 * @param {number} players
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function loadAssets(players, onProgress = () => {}, baseUrl = siteUrl('models/'), opts = {}) {
  base = baseUrl;
  const names = [...NEUTRAL];
  // own trees and bush (summer) immediately: original (texture) and the used LOD levels; winter on demand
  for (const f of SUMMER_NATURE_MODELS) names.push(...natureModelFiles(f));
  const files = new Set(Object.values(KAYKIT_BUILDING_ASSETS).flat());
  const lods = opts.lods ?? true;
  for (let p = 0; p < players; p++) for (const f of files) {
    const n = `buildings/${f}_${ASSET_COLORS[playerColorIndex(p)]}`;
    names.push(n);
    if (lods) for (let k = 1; k <= BUILDING_LODS; k++) names.push(`${n}.lod${k}`);
  }
  for (const f of OWN_PRELOAD) {
    names.push(`buildings/${f}`);
    if (lods) for (let k = 1; k <= BUILDING_LODS; k++) names.push(`buildings/${f}.lod${k}`);
  }
  useLods = lods;
  // file extension can be overridden (e.g. embedded .json version for hosts without .glb)
  const ext = globalThis.KRONLAND_MODEL_EXT ?? '.glb';
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  lazy = { loader, ext };
  // figure manifest first (small), so the total for the progress is known
  const manifest = opts.characters === false ? null : await loadCharacterManifest(base);
  const ground = opts.ground === false ? 0 : GROUND_IMAGE_KINDS.length;
  // texture for trees, bushes, rocks: not on level "low" (switched off there, saves download and shader)
  const nature = opts.ground === false || getQuality().tier === 'low' ? 0 : NATURE_IMAGE_KINDS.length;
  const total = names.length + (manifest ? characterFileCount() : 0) + ground + nature;
  let done = 0;
  const tick = () => onProgress(++done, total);
  await Promise.all([
    // painted ground textures at the size of the graphics level (phone: small version)
    ground ? loadGroundImages(siteUrl('textures/ground/'), getQuality().textureSize, tick) : null,
    nature ? loadNatureImages(siteUrl('textures/nature/'), tick) : null,
    ...names.map((n) => loader.loadAsync(assetUrl(`${base}${n}${ext}`))
      .then((g) => {
        g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        cache.set(n, { scene: g.scene, animations: g.animations });
      })
      .catch(() => {})
      .finally(tick)),
    manifest ? loadCharacterModels((url) => loader.loadAsync(assetUrl(url.replace(/\.glb$/, ext))), base, tick) : null,
  ]);
  return cache.size;
}

/**
 * Copy of a loaded model, scaled to a footprint (width × depth in tiles).
 * @param {string} name @param {number} w @param {number} d @param {number} [fill]
 * @param {string} [fitTo] model whose dimensions determine the scaling (LOD levels thus fit the original exactly)
 * @param {{ground: number}|null} [pit] pit: sink, opening black (OWN_BUILDING_PIT)
 */
export function fittedModel(name, w, d, fill = 0.9, fitTo = name, pit = null) {
  const a = cache.get(name);
  if (!a) return null;
  const obj = a.scene.clone(true);
  // LOD levels have no texture of their own: take over the material of the original
  if (fitTo !== name && cache.has(fitTo)) shareMaterials(obj, cache.get(fitTo).scene);
  const box = boxOf(fitTo);
  const size = box.getSize(new THREE.Vector3());
  // fit per axis (long buildings use the long side of the plot), for a square footprint as before
  const s = Math.min((w * fill) / size.x, (d * fill) / size.z);
  obj.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x * s, -(box.min.y + (pit?.ground ?? 0) * size.y) * s, -c.z * s);
  const g = new THREE.Group();
  g.add(obj);
  if (pit) {
    // foil below the ground disc: opening of the model (painted, soft edge), otherwise closed hull in black;
    // never larger than the model. The model lies PIT_LIFT above it, the surface in between.
    obj.position.y += PIT_LIFT;
    const toShape = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2((x - c.x) * s, -(z - c.z) * s)));
    const open = pitOpening(fitTo, box, size, pit);
    const parts = open
      ? open.loops.map((l) => ({ geo: new THREE.ShapeGeometry(toShape(l)), mat: open.material }))
      : [pitHull(fitTo, box, size, pit.ground, pit.shrink ?? PIT_SHRINK)].filter((h) => h.length >= 3)
        .map((h) => ({ geo: new THREE.ShapeGeometry(toShape(h)), mat: pitMaterial() }));
    if (pit.gallows && open?.beam) obj.add(gallows(open.beam, box.min.y + pit.ground * size.y - 0.02 * size.y));
    for (const { geo, mat } of parts) {
      if (open) {
        // texture coordinates from the position in the model (rectangle around the opening)
        const pos = geo.attributes.position, uv = geo.attributes.uv, r = open.rect;
        for (let k = 0; k < pos.count; k++) {
          uv.setXY(k, (pos.getX(k) / s + c.x - r.minX) / (r.maxX - r.minX), (-pos.getY(k) / s + c.z - r.minZ) / (r.maxZ - r.minZ));
        }
      }
      const floor = new THREE.Mesh(geo, mat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = PIT_LIFT / 2;
      floor.userData.noTeam = true;
      floor.renderOrder = -1;
      g.add(floor);
    }
  }
  return g;
}

const PIT_LIFT = 0.03, PIT_SHRINK = 0.85;
const openings = new Map();
/**
 * Opening of a pit (contours in model space, painted texture) – computed once per model; null = no hole found.
 * @returns {{loops: number[][][], rect: {minX: number, maxX: number, minZ: number, maxZ: number}, material: THREE.Material}|null}
 */
function pitOpening(name, box, size, pit) {
  if (openings.has(name)) return openings.get(name);
  let out = null;
  try {
    const root = cache.get(name).scene, v = new THREE.Vector3(), tris = [];
    root.updateMatrixWorld(true);
    root.traverse((m) => {
      if (!m.isMesh) return;
      const pos = m.geometry.attributes.position, idx = m.geometry.index, count = idx ? idx.count : pos.count;
      for (let k = 0; k < count; k++) {
        v.fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(m.matrixWorld);
        tris.push(v.x, v.y, v.z);
      }
    });
    const bounds = { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
    const shape = pitShape(tris, bounds, box.min.y + pit.ground * size.y, size.y);
    if (shape) {
      const rect = pitRect(shape), n = 128;
      const tex = new THREE.DataTexture(pitTexture(shape, rect, pit.rim ?? [96, 66, 44], n), n, n);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.magFilter = tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      out = { loops: shape.loops, rect, material, beam: pit.gallows ? hangerBeam(tris, shape.loops, box.min.y + pit.ground * size.y, size.y) : null };
    }
  } catch {
    out = null; // fallback: hull
  }
  openings.set(name, out);
  return out;
}
/** Wooden gallows (model space): two posts from y0 to above the beam, crossbeam through the hanging block. */
let woodMat = null;
function gallows({ x0, x1, z, y, r }, y0) {
  woodMat ??= new THREE.MeshStandardMaterial({ color: 0x8a5d38, roughness: 0.85 });
  const g = new THREE.Group(), h = y + 1.6 * r - y0;
  for (const x of [x0, x1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.05, h, 8), woodMat);
    post.position.set(x, y0 + h / 2, z);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.85, x1 - x0 + 3.2 * r, 8), woodMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set((x0 + x1) / 2, y, z);
  g.add(beam);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.userData.noTeam = true; } });
  return g;
}
const hulls = new Map();
/** Convex hull (x, z in model space) of the points up to just above the ground disc of a pit (cached). */
function pitHull(name, box, size, ground, shrink) {
  if (hulls.has(name)) return hulls.get(name);
  // only the ground disc itself (not the wider sunken shaft below)
  const gy = box.min.y + ground * size.y, lo = gy - 0.03 * size.y, top = gy + 0.04 * size.y, pts = [], v = new THREE.Vector3();
  const root = cache.get(name).scene;
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.y >= lo && v.y <= top) pts.push([v.x, v.z]);
    }
  });
  // pull in a little: the edge of the disc stays visible, no black all around
  const raw = convexHull(pts), cx = raw.reduce((a, q) => a + q[0], 0) / raw.length, cz = raw.reduce((a, q) => a + q[1], 0) / raw.length;
  const hull = raw.map(([x, z]) => [cx + (x - cx) * shrink, cz + (z - cz) * shrink]);
  hulls.set(name, hull);
  return hull;
}
/** Convex hull (monotone chain), points counter-clockwise. @param {number[][]} p */
export function convexHull(p) {
  const pts = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of pts) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of pts.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Black for the pit opening (fallback, shared). */
let pitMat = null;
const pitMaterial = () => (pitMat ??= new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.DoubleSide }));

const boxes = new Map();
function boxOf(name) {
  if (!boxes.has(name)) boxes.set(name, new THREE.Box3().setFromObject(cache.get(name).scene));
  return boxes.get(name);
}

/**
 * Transfer the materials of the original to a LOD level (same mesh names, otherwise first material).
 * Levels with vertex colours instead of UV (far level of the buildings, scripts/build-lods.mjs) keep their own material.
 */
function shareMaterials(obj, src) {
  const byName = new Map();
  let first = null;
  src.traverse((m) => { if (m.isMesh) { byName.set(m.name, m.material); first ??= m.material; } });
  obj.traverse((m) => { if (m.isMesh && !isBakedGeometry(m.geometry)) m.material = byName.get(m.name) ?? first; });
}
/** Mesh with vertex colours and without UV (standalone far level)? */
export const isBakedGeometry = (g) => !!g?.attributes?.color && !g.attributes.uv;

/** Existing LOD levels of a model (names), level 0 = original. */
export function assetLods(name) {
  const out = [name];
  for (let k = 1; k <= BUILDING_LODS; k++) if (cache.has(`${name}.lod${k}`)) out.push(`${name}.lod${k}`);
  return out;
}

/** Can a loaded model be displayed without the original (only meshes with vertex colours, e.g. the far level)? */
function standalone(name) {
  const a = cache.get(name);
  if (!a) return false;
  if (a.standalone === undefined) {
    let ok = true, any = false;
    a.scene.traverse((m) => { if (m.isMesh) { any = true; ok &&= isBakedGeometry(m.geometry); } });
    a.standalone = ok && any;
  }
  return a.standalone;
}

/**
 * Model name for a building, or null. If the original of an own model is missing, it is reloaded; if the
 * standalone far level is already there (it loads before the original), it stands in for the whole building until then.
 */
export function buildingAssetName(type, level, owner) {
  const own = OWN_BUILDING_ASSETS[type];
  if (own) {
    const n = `buildings/${own[Math.min(level, own.length - 1)]}`;
    if (cache.has(n)) return n;
    requestAsset(n);
    const far = `${n}.lod${BUILDING_LODS}`;
    if (standalone(far)) return far;
    // until the own model is there: KayKit version if available, otherwise procedural
  }
  const list = KAYKIT_BUILDING_ASSETS[type];
  if (!list) return null;
  const n = `buildings/${list[Math.min(level, list.length - 1)]}_${ASSET_COLORS[playerColorIndex(owner)]}`;
  return cache.has(n) ? n : null;
}

/** Reload on demand (own building models including LOD levels); the building rebuilds at the next reconciliation. */
let lazy = null, useLods = true;
const pending = new Set();
function requestAsset(n) {
  if (!lazy || pending.has(n) || cache.has(n)) return;
  pending.add(n);
  const load = (name) => lazy.loader.loadAsync(assetUrl(`${base}${name}${lazy.ext}`)).then((g) => {
    g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    cache.set(name, { scene: g.scene, animations: g.animations });
  });
  // LOD levels first, so that the original only becomes visible when everything is there
  const lods = useLods ? Array.from({ length: BUILDING_LODS }, (_, k) => load(`${n}.lod${k + 1}`).catch(() => {})) : [];
  Promise.all(lods).then(() => load(n)).catch(() => {}).finally(() => pending.delete(n));
}
/** Own bridge model (a whole bridge, models.js stretches the middle part). */
export const BRIDGE_ASSET = 'bridge';

/** Own building model (scene) or null – then it is reloaded (ruins, bridge). */
export function ownAsset(file) {
  const n = `buildings/${file}`;
  if (cache.has(n)) return cache.get(n).scene;
  requestAsset(n);
  return null;
}

/** Is a model currently being reloaded? (The building reconciliation checks this in order to rebuild after loading.) */
export const assetPending = (type, level) => assetState(type, level) < 2;
/**
 * Load state of a building's model: 2 = original there (or no own model), 1 = only the standalone
 * far level (simplified shape instead of placeholder), 0 = nothing yet. The reconciliation rebuilds on every change.
 */
export function assetState(type, level) {
  if (type === 'bridge') return lazy && !cache.has(`buildings/${BRIDGE_ASSET}`) ? 0 : 2;
  const own = OWN_BUILDING_ASSETS[type];
  if (!own) return 2;
  const n = `buildings/${own[Math.min(level, own.length - 1)]}`;
  return cache.has(n) ? 2 : standalone(`${n}.lod${BUILDING_LODS}`) ? 1 : 0;
}

/** Files of a tree or bush model: original and the used LOD levels. @param {string} name */
const natureModelFiles = (name) => [`buildings/${name}`, ...NATURE_MODEL_LODS.map((k) => `buildings/${name}.lod${k}`)];

/**
 * Reload tree/bush models (winter versions at the first winter). Missing files are not an error.
 * @param {string[]} models names without folder @returns {Promise<number>} number of originals now loaded
 */
export async function loadNatureModels(models) {
  if (!lazy) return 0;
  const files = models.flatMap(natureModelFiles).filter((n) => !cache.has(n));
  await Promise.all(files.map((n) => lazy.loader.loadAsync(assetUrl(`${base}${n}${lazy.ext}`)).then((g) => {
    g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    cache.set(n, { scene: g.scene, animations: g.animations });
  }).catch(() => {})));
  return models.filter((m) => cache.has(`buildings/${m}`)).length;
}

/** Geometry and material of a model for instancing (all sub-meshes in model coordinates). */
export function instancedParts(name) {
  const a = cache.get(name);
  if (!a) return null;
  a.scene.updateMatrixWorld(true);
  const parts = [];
  a.scene.traverse((m) => {
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    // meshopt stores positions quantised (normalised Int16); convert to float before transforming,
    // otherwise values outside [-1, 1] are clipped.
    for (const [k, a] of Object.entries(g.attributes)) {
      if (a.array instanceof Float32Array && !a.isInterleavedBufferAttribute) continue;
      const f = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
    }
    g.applyMatrix4(m.matrixWorld);
    parts.push({ geometry: g, material: m.material });
  });
  return parts;
}
