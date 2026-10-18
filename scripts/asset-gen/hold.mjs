// Turn the hand in the attack and cheer clips so that a held pole keeps a sensible direction.
//
// The Meshy library clips are made for an empty hand: in Victory_Cheer the hand turns over, so a spear standing up in
// the rest pose hangs upside down; in the attack it swings backwards. This script rotates only the hand's keys (minimal
// rotation in the world, the arm stays as it is): cheer – the tip up; attack – while the spear is not up anyway, the
// tip forward (an overhand thrust). The pole's direction in the hand comes from the model (vertices fully on the hand,
// far from the wrist: the shaft of pole.mjs). Clips live in the game model only (anims-to-game.mjs).
//
//   node scripts/asset-gen/hold.mjs <Model> [hand=RightHand]
//
// Docs: docs/MODELLE.md#waffen-an-der-hand.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { threeOf, pose } from './rig3.mjs';
import { mainMesh, skinned, dominantBones } from './weapons.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'models', 'characters');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const UP = new THREE.Vector3(0, 1, 0.15).normalize();

/**
 * Wanted tip direction for a clip, given the current one. Pure (tested).
 * cheer: up; attack: keep it when it is up anyway, otherwise towards where the chest faces (the clip turns the body
 * into the blow), the more the lower it points.
 * @param {string} clip @param {THREE.Vector3} d current unit direction @param {THREE.Vector3} chest horizontal unit
 * direction the chest faces @returns {THREE.Vector3|null} null = leave
 */
export function wanted(clip, d, chest) {
  if (clip === 'cheer') return UP.clone();
  if (clip === 'attack') {
    const s = Math.min(1, Math.max(0, (0.85 - d.y) / 0.35));
    if (s === 0) return null;
    const forward = new THREE.Vector3(chest.x, 0.25, chest.z).normalize();
    return new THREE.Vector3().copy(UP).lerp(forward, s).normalize();
  }
  return null;
}

/** @returns {Promise<string>} */
export async function fixHold(file, hand = 'RightHand') {
  const doc = await io.read(file);
  const g = await threeOf(io, doc);
  const mesh = mainMesh(g);
  const bone = mesh.skeleton.bones.find((b) => b.name === hand);
  pose(g, null);
  const rest = skinned(mesh), boneOf = dominantBones(mesh);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 1; i < rest.length; i += 3) { ymin = Math.min(ymin, rest[i]); ymax = Math.max(ymax, rest[i]); }
  const wrist = bone.getWorldPosition(new THREE.Vector3());
  const shaft = [];
  for (let i = 0; i < rest.length / 3; i++) {
    if (boneOf[i] === hand && Math.hypot(rest[i * 3] - wrist.x, rest[i * 3 + 1] - wrist.y, rest[i * 3 + 2] - wrist.z) > 0.25 * (ymax - ymin)) shaft.push(i);
  }
  if (shaft.length < 4) return `${hand}: no pole`;
  const top = shaft.reduce((b, i) => (rest[i * 3 + 1] > rest[b * 3 + 1] ? i : b)), bottom = shaft.reduce((b, i) => (rest[i * 3 + 1] < rest[b * 3 + 1] ? i : b));
  const dirRest = new THREE.Vector3(rest[top * 3] - rest[bottom * 3], rest[top * 3 + 1] - rest[bottom * 3 + 1], rest[top * 3 + 2] - rest[bottom * 3 + 2]).normalize();
  const dLocal = dirRest.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
  // the chest faces +z in the rest pose
  const spine = mesh.skeleton.bones.find((b) => b.name === 'Spine02') ?? mesh.skeleton.bones.find((b) => b.name === 'Hips');
  const chestLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(spine.getWorldQuaternion(new THREE.Quaternion()).invert());
  const report = [];
  for (const anim of doc.getRoot().listAnimations()) {
    const name = anim.getName();
    if (name !== 'attack' && name !== 'cheer') continue;
    const ch = anim.listChannels().find((c) => c.getTargetNode()?.getName() === hand && c.getTargetPath() === 'rotation');
    if (!ch) continue;
    const sampler = ch.getSampler(), times = sampler.getInput().getArray(), outAcc = sampler.getOutput();
    const out = new Float32Array(times.length * 4), q = [0, 0, 0, 0];
    let turned = 0;
    for (let k = 0; k < times.length; k++) {
      outAcc.getElement(k, q);
      const local = new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize();
      pose(g, name, times[k]);
      bone.parent.updateWorldMatrix(true, false);
      const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      const world = parent.clone().multiply(local);
      const d = dLocal.clone().applyQuaternion(world);
      spine.updateWorldMatrix(true, false);
      const chest = chestLocal.clone().applyQuaternion(spine.getWorldQuaternion(new THREE.Quaternion()));
      chest.y = 0;
      const want = wanted(name, d, chest.lengthSq() > 1e-6 ? chest.normalize() : new THREE.Vector3(0, 0, 1));
      if (want) {
        const turn = new THREE.Quaternion().setFromUnitVectors(d, want);
        local.copy(parent.clone().invert().multiply(turn).multiply(world));
        if (d.angleTo(want) > 0.2) turned++;
      }
      out.set([local.x, local.y, local.z, local.w], k * 4);
    }
    const acc = doc.createAccessor().setType('VEC4').setArray(out).setBuffer(outAcc.getBuffer());
    sampler.setOutput(acc);
    report.push(`${name}: ${turned}/${times.length} keys turned`);
  }
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' })); // quantized again like the other models
  await io.write(file, doc);
  return `${hand}: ${report.join(', ')}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [model, hand = 'RightHand'] = process.argv.slice(2);
  console.log(`${model}.lod1.glb: ${await fixHold(path.join(DIR, `${model}.lod1.glb`), hand)}`);
}
