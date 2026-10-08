// Own 3D models of a level (npc(look="assets/alchemist.glb")): loaded from the level's files and shown in place
// of the figure. Until the file is there – or if it never loads – the normal figure stands in for it.
// Display only: the simulation knows nothing but the path.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { levelAssetUrl } from '../levels/assets.js';

/** Height of a figure in tiles (as in the figure manifest): own models are scaled to it, feet on the ground. */
const FIGURE_HEIGHT = 0.81;

export class LevelModels {
  /** @param {THREE.Scene} scene @param {(g: THREE.Object3D) => void} [prepare] e.g. fog of war shading */
  constructor(scene, prepare = () => {}) {
    this.scene = scene;
    this.prepare = prepare;
    /** @type {Map<string, {state: 'loading'|'ready'|'failed', gltf: any}>} address → file */
    this.files = new Map();
    /** @type {Map<number, {obj: THREE.Group, mixer: THREE.AnimationMixer|null, url: string}>} entity → model */
    this.items = new Map();
    this.loader = null;
  }

  /**
   * Place the own model of a figure. @returns {boolean} true if it stands there (then hide the normal figure)
   * @param {{id: number, look?: string}} e
   */
  sync(e, x, y, z, yaw, dt) {
    const url = levelAssetUrl(e.look);
    if (!url || !/\.glb$/i.test(e.look)) return false;
    let f = this.files.get(url);
    if (!f) {
      f = { state: 'loading', gltf: null };
      this.files.set(url, f);
      this.load(url, f);
    }
    if (f.state !== 'ready') return false;
    let it = this.items.get(e.id);
    if (it && it.url !== url) { this.drop(e.id); it = null; }
    it ??= this.make(e.id, url, f.gltf);
    it.obj.position.set(x, y, z);
    it.obj.rotation.y = yaw;
    it.mixer?.update(dt);
    return true;
  }

  load(url, f) {
    this.loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.loader.load(url, (g) => { f.gltf = g; f.state = 'ready'; }, undefined, () => { f.state = 'failed'; });
  }

  make(id, url, gltf) {
    const inner = cloneSkinned(gltf.scene);
    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const s = FIGURE_HEIGHT / (size.y || 1);
    inner.scale.setScalar(s);
    inner.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const obj = new THREE.Group();
    obj.add(inner);
    obj.traverse((o) => { o.userData.entity = id; if (o.isMesh) o.castShadow = true; });
    this.prepare(obj);
    let mixer = null;
    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(inner);
      const clip = gltf.animations.find((a) => /idle/i.test(a.name)) ?? gltf.animations[0];
      mixer.clipAction(clip).play();
    }
    this.scene.add(obj);
    const it = { obj, mixer, url };
    this.items.set(id, it);
    return it;
  }

  /** Remove models of figures that are gone or out of sight. @param {Set<number>} seen */
  prune(seen) { for (const id of [...this.items.keys()]) if (!seen.has(id)) this.drop(id); }

  drop(id) {
    const it = this.items.get(id);
    if (!it) return;
    this.scene.remove(it.obj);
    this.items.delete(id);
  }

  /** Objects for picking (tapping the figure). */
  objects() { return [...this.items.values()].map((i) => i.obj); }
}
