// Loading the CC0 models (KayKit by Kay Lousberg, www.kaylousberg.com).
// The mapping game type → model is here; without loaded models the procedural placeholders take over.
// Swapping graphics: replace files in public/assets and adjust the tables below.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** Player colours in player order. */
export const ASSET_COLORS = ['blue', 'red', 'green', 'yellow'];

/** Building type → model per level (last entry applies to higher levels). */
export const BUILDING_ASSETS = {
  headquarters: ['castle'],
  villageCenter: ['tavern'],
  residence: ['home_A', 'home_B'],
  farm: ['windmill'],
  smithy: ['blacksmith'],
  sawmill: ['lumbermill'],
  clayMine: ['mine'], stoneMine: ['mine'], ironMine: ['mine'], sulfurMine: ['mine'],
  barracks: ['barracks'],
  archery: ['archeryrange'],
  chapel: ['church'],
  storehouse: ['market'],
  tower: ['tower_A', 'tower_catapult'],
};

/** Heroes → figure. */
export const HERO_ASSETS = { bertram: 'Knight', hedda: 'Mage', gerold: 'Barbarian' };

const NEUTRAL = ['buildings/scaffolding', 'nature/tree_single_A', 'nature/tree_single_B'];

/** @type {Map<string, {scene: THREE.Object3D, animations: THREE.AnimationClip[]}>} */
const cache = new Map();
let base = './models/';

export const hasAsset = (name) => cache.has(name);

/**
 * Loads all models for the given number of players. Errors are not fatal (placeholders remain).
 * @param {number} players
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function loadAssets(players, onProgress = () => {}, baseUrl = './models/') {
  base = baseUrl;
  const names = [...NEUTRAL, ...Object.values(HERO_ASSETS).map((c) => `characters/${c}`)];
  const files = new Set(Object.values(BUILDING_ASSETS).flat());
  for (let p = 0; p < players; p++) for (const f of files) names.push(`buildings/${f}_${ASSET_COLORS[p % 4]}`);
  // file extension can be overridden (e.g. embedded .json version for hosts without .glb)
  const ext = globalThis.KRONLAND_MODEL_EXT ?? '.glb';
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  await Promise.all(names.map((n) => loader.loadAsync(`${base}${n}${ext}`)
    .then((g) => {
      g.scene.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      cache.set(n, { scene: g.scene, animations: g.animations });
    })
    .catch(() => {})
    .finally(() => onProgress(++done, names.length))));
  return cache.size;
}

/** Copy of a loaded model, scaled to a footprint (width × depth in tiles). */
export function fittedModel(name, w, d, fill = 0.9) {
  const a = cache.get(name);
  if (!a) return null;
  const obj = a.scene.clone(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = (Math.min(w, d) * fill) / Math.max(size.x, size.z);
  obj.scale.setScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

/** Model name for a building, or null. */
export function buildingAssetName(type, level, owner) {
  const list = BUILDING_ASSETS[type];
  if (!list) return null;
  const n = `buildings/${list[Math.min(level, list.length - 1)]}_${ASSET_COLORS[owner % 4]}`;
  return cache.has(n) ? n : null;
}

/** Animated hero figure (own skeleton per copy). */
export function heroAsset(hero) {
  const a = cache.get(`characters/${HERO_ASSETS[hero]}`);
  if (!a) return null;
  const obj = cloneSkinned(a.scene);
  obj.traverse((m) => {
    // Keep only one weapon in hand: hide accessories the figure does not need
    if (m.isMesh && /Mug|Spellbook|Shield_Round_Barbarian|1handed.*\.001/i.test(m.name)) m.visible = false;
  });
  const mixer = new THREE.AnimationMixer(obj);
  const clips = Object.fromEntries(a.animations.map((c) => [c.name, c]));
  return { obj, mixer, clips };
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
    g.applyMatrix4(m.matrixWorld);
    parts.push({ geometry: g, material: m.material });
  });
  return parts;
}
