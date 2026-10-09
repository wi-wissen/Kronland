// Items on tiles in the rendering (coins, flowers – docs/SPIELREGELN.md §Spuren und Gegenstände).
// One InstancedMesh per kind, rebuilt when the simulation's groundVersion changes (pick up, put down, world script).
// Coins stand upright, turn slowly and bob, so that they stay readable from the overview camera, also on phones;
// the flower is a single big Christmas rose (white, yellow centre), clearly different from the meadow flowers and
// also visible in winter. Only on explored tiles (fog shader of the instances, fog.js).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ITEM_KINDS } from '../sim/systems/ground.js';

/** Size of the items in world units (1 = one tile). */
export const COIN_SIZE = 0.46;
export const FLOWER_SIZE = 0.5;

/**
 * Size factor of the items for the camera distance: from far away (overview of a whole adventure map, phones) they
 * grow up to 1.8 times, so that a coin stays a few pixels big; in steps of 0.1 (flowers are only rebuilt then).
 * @param {number} dist camera distance
 */
export function itemScale(dist) {
  return Math.round(Math.max(1, Math.min(1.8, dist / 16)) * 10) / 10;
}

/**
 * Instance list per kind from the items of the map: tile centres, sorted (rows, then columns), optionally only
 * explored tiles.
 * @param {import('../sim/map.js').TileMap} map
 * @param {(x: number, y: number) => boolean} [explored] tile explored? (fog)
 * @returns {Record<string, {x:number, z:number, seed:number}[]>}
 */
export function itemInstances(map, explored = null) {
  /** @type {Record<string, {x:number, z:number, seed:number}[]>} */
  const out = Object.fromEntries(ITEM_KINDS.map((k) => [k, []]));
  for (const k of [...map.items.keys()].sort((a, b) => a - b)) {
    const kind = map.items.get(k);
    const x = k % map.width, y = (k - x) / map.width;
    if (!out[kind] || (explored && !explored(x + 0.5, y + 0.5))) continue;
    out[kind].push({ x: x + 0.5, z: y + 0.5, seed: ((x * 73856093) ^ (y * 19349663)) >>> 0 });
  }
  return out;
}

/** Coin: a thick disc with a raised rim, standing upright (faces along x). */
function coinGeometry() {
  const r = COIN_SIZE / 2;
  const disc = new THREE.CylinderGeometry(r, r, r * 0.22, 24);
  const rim = new THREE.TorusGeometry(r * 0.78, r * 0.07, 6, 24);
  rim.rotateX(Math.PI / 2);
  const rim2 = rim.clone();
  rim.translate(0, r * 0.11, 0); rim2.translate(0, -r * 0.11, 0);
  const g = mergeGeometries([disc.toNonIndexed(), rim.toNonIndexed(), rim2.toNonIndexed()]);
  g.rotateZ(Math.PI / 2);
  g.translate(0, r + 0.06, 0);
  return g;
}

/** Christmas rose: short stem, dark leaves, five white petals around a yellow centre (vertex colours). */
function flowerGeometry() {
  const s = FLOWER_SIZE;
  const parts = [];
  const paint = (g, hex) => {
    g = g.index ? g.toNonIndexed() : g;
    const c = new THREE.Color(hex), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    parts.push(g);
  };
  const stem = new THREE.CylinderGeometry(s * 0.03, s * 0.04, s * 0.42, 5);
  stem.translate(0, s * 0.21, 0);
  paint(stem, 0x3f6b2a);
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.SphereGeometry(s * 0.2, 6, 4);
    leaf.scale(1, 0.18, 0.45);
    leaf.translate(s * 0.2, s * 0.05, 0);
    leaf.rotateY((i / 4) * Math.PI * 2 + 0.4);
    paint(leaf, 0x2f5a24);
  }
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.SphereGeometry(s * 0.17, 8, 5);
    petal.scale(1, 0.28, 0.72);
    petal.translate(s * 0.15, 0, 0);
    petal.rotateZ(0.35);
    petal.rotateY((i / 5) * Math.PI * 2);
    petal.translate(0, s * 0.44, 0);
    paint(petal, 0xfbf7f0);
  }
  const centre = new THREE.SphereGeometry(s * 0.07, 8, 6);
  centre.translate(0, s * 0.48, 0);
  paint(centre, 0xf2c230);
  return mergeGeometries(parts);
}

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class ItemLayer {
  /**
   * @param {THREE.Scene} scene
   * @param {{ heightAt: (x: number, z: number) => number }} terrain
   * @param {(root: THREE.Object3D) => void} patchFogTree
   */
  constructor(scene, terrain, patchFogTree) {
    this.scene = scene;
    this.terrain = terrain;
    this.patchFogTree = patchFogTree;
    this.version = -1;
    this.exploredKey = '';
    this.lists = Object.fromEntries(ITEM_KINDS.map((k) => [k, []]));
    /** @type {Record<string, THREE.InstancedMesh|null>} */
    this.meshes = { coin: null, flower: null };
    this.coinMat = new THREE.MeshStandardMaterial({ color: 0xffcf4a, metalness: 0.55, roughness: 0.3, emissive: 0x8a5e00, emissiveIntensity: 0.8 });
    this.scale = 1;
    this.flowerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, emissive: 0x262626 });
    this.geos = { coin: coinGeometry(), flower: flowerGeometry() };
  }

  /** Rebuild the instances (count changed) of one kind. */
  build(kind) {
    const list = this.lists[kind];
    let mesh = this.meshes[kind];
    if (!mesh || mesh.instanceMatrix.count < list.length) {
      if (mesh) { this.scene.remove(mesh); mesh.dispose(); }
      mesh = new THREE.InstancedMesh(this.geos[kind], kind === 'coin' ? this.coinMat : this.flowerMat, Math.max(8, list.length + 8));
      mesh.name = `items-${kind}`;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.patchFogTree(mesh);
      this.scene.add(mesh);
      this.meshes[kind] = mesh;
    }
    mesh.count = list.length;
    mesh.visible = list.length > 0;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      it.y = this.terrain.heightAt(it.x, it.z);
      tmpQ.setFromAxisAngle(UP, (it.seed % 628) / 100);
      mesh.setMatrixAt(i, tmpM.compose(tmpP.set(it.x, it.y, it.z), tmpQ, tmpS.setScalar(this.scale)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Per frame: take over changed items, let coins turn and bob.
   * @param {import('../sim/map.js').TileMap} map @param {number} time seconds
   * @param {(x: number, y: number) => boolean} [explored] tile explored? (fog)
   * @param {string} [exploredKey] changes when the explored area changes
   * @param {number} [scale] size factor (itemScale of the camera distance)
   */
  update(map, time, explored = null, exploredKey = '', scale = 1) {
    if (map.groundVersion !== this.version || exploredKey !== this.exploredKey || scale !== this.scale) {
      this.scale = scale;
      this.version = map.groundVersion;
      this.exploredKey = exploredKey;
      this.lists = itemInstances(map, explored);
      for (const kind of ITEM_KINDS) if (this.lists[kind].length || this.meshes[kind]) this.build(kind);
    }
    const mesh = this.meshes.coin, list = this.lists.coin;
    if (!mesh || !list.length) return;
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      tmpQ.setFromAxisAngle(UP, time * 1.6 + (it.seed % 628) / 100);
      tmpP.set(it.x, it.y + (0.05 + Math.sin(time * 2.4 + (it.seed % 97)) * 0.04) * scale, it.z);
      mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS.setScalar(scale)));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Terrain changed (levelling, editor): put the items onto the new ground at the next update. */
  invalidate() { this.version = -1; }

  dispose() {
    for (const m of Object.values(this.meshes)) if (m) { this.scene.remove(m); m.dispose(); }
    for (const g of Object.values(this.geos)) g.dispose();
    this.coinMat.dispose();
    this.flowerMat.dispose();
  }
}
