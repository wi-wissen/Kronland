// Skeleton helpers on three.js for clip scripts (ride-clips.mjs): a gltf-transform document as a posable three scene,
// skinned vertex positions, bone swings and a two-bone IK. Everything in the coordinates of the scene root (model units).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { cloneDocument } from '@gltf-transform/functions';

/**
 * Three scene of a document (copy without textures – Node cannot decode images).
 * @param {import('@gltf-transform/core').NodeIO} io @param {import('@gltf-transform/core').Document} doc
 */
export async function threeOf(io, doc) {
  const copy = cloneDocument(doc);
  for (const m of copy.getRoot().listMaterials()) m.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
  for (const t of copy.getRoot().listTextures()) t.dispose();
  const bin = await io.writeBinary(copy);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), '');
}

/** Pose the scene at time t of a clip (null = rest pose). */
export function pose(g, clipName, t = 0) {
  g.scene.traverse((o) => { if (o.userData.rest) { o.position.copy(o.userData.rest.p); o.quaternion.copy(o.userData.rest.q); } else if (o.isBone || o.isObject3D) o.userData.rest = { p: o.position.clone(), q: o.quaternion.clone() }; });
  const clip = clipName && g.animations.find((a) => a.name === clipName);
  if (clip) {
    const mx = new THREE.AnimationMixer(g.scene);
    mx.clipAction(clip).play();
    mx.setTime(t); // the mixer is dropped afterwards, the sampled values stay on the nodes
  }
  g.scene.updateMatrixWorld(true);
  return g;
}

/** Skinned vertices of all meshes: { p: world position, bone: name of the strongest bone }. */
export function skinnedPoints(g) {
  g.scene.updateMatrixWorld(true);
  const out = [];
  g.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight, n = o.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) {
      const p = o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld);
      let b = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, b)) b = k;
      out.push({ p, bone: o.skeleton.bones[si.getComponent(i, b)].name });
    }
  });
  return out;
}

/** Height of the figure in the first frame of idle (as the game measures it: minimum y clipped at 0). */
export function idleHeight(g) {
  pose(g, g.animations.some((a) => a.name === 'idle') ? 'idle' : null, 0);
  let lo = Infinity, hi = -Infinity;
  for (const { p } of skinnedPoints(g)) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  return hi - Math.max(0, lo);
}

const wp = (o) => o.getWorldPosition(new THREE.Vector3());
const wq = (o) => o.getWorldQuaternion(new THREE.Quaternion());

/** Set the world rotation of a bone (local = parent⁻¹ · world). */
export function setWorldQuat(bone, q) {
  bone.quaternion.copy(wq(bone.parent).invert().multiply(q));
  bone.updateMatrixWorld(true);
}

/** Rotate a bone (shortest arc) so that the joint of `child` moves from its position towards `target`. */
export function swing(bone, child, target) {
  const o = wp(bone), from = wp(child).sub(o).normalize(), to = target.clone().sub(o).normalize();
  setWorldQuat(bone, new THREE.Quaternion().setFromUnitVectors(from, to).multiply(wq(bone)));
}

/**
 * Two-bone IK (upper → lower → end): end joint to `target`, the middle joint bends towards `pole` (world direction).
 * Lengths stay; out of reach the chain stretches towards the target.
 */
export function ik2(upper, lower, end, target, pole) {
  const S = wp(upper), a = S.distanceTo(wp(lower)), b = wp(lower).distanceTo(wp(end));
  const dir = target.clone().sub(S);
  const d = Math.min(Math.max(dir.length(), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  dir.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const side = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const elbow = S.clone().addScaledVector(dir, a * cosA).addScaledVector(side, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
  swing(upper, lower, elbow);
  swing(lower, end, S.clone().addScaledVector(dir, d));
}

export { wp as worldPos, wq as worldQuat };
