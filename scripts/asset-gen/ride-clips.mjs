// Attack in the saddle for the rider characters: the Meshy attacks were recorded standing – the hips turn up to ~45°
// along, the legs stand. On the horse that left the rider sitting sideways. This creates the clip `rideAttack` per character:
// upper body, arms, head (and tools) from `attack`, hips (rotation and position) and legs from the first pose of
// `ride`. In addition the rotation of the chest around the vertical axis is damped to 30 % (compensated at the lowest
// spine bone): the figure thus always looks in the riding direction, the upper body only turns slightly for the blow/shot.
//
//   node scripts/asset-gen/ride-clips.mjs                      # all models with a "ride" clip in the manifest
//   node scripts/asset-gen/ride-clips.mjs LightRider …
//
// Writes into the game model (<model>.lod1.glb, where the animations live). Repeatable (replaces the clip).

import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';

const DIR = process.env.CHAR_DIR ?? 'public/models/characters';
/** Spine chain from the bottom (compensation) to the chest (measure of the facing direction). */
export const SPINE = ['Spine02', 'Spine01', 'Spine'];
/** Fraction of the chest rotation (around the vertical axis) that stays in the saddle. */
export const KEEP_TWIST = 0.3;
/** Bones that follow the riding pose in the saddle (hips and legs). */
export const SEAT_BONES = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))$/;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

/**
 * Write the clip `rideAttack` into a document. @returns {number} number of channels
 * @param {import('@gltf-transform/core').Document} doc
 */
export function addRideAttack(doc, { from = 'attack', seat = 'ride', name = 'rideAttack' } = {}) {
  const root = doc.getRoot();
  const anims = new Map(root.listAnimations().map((a) => [a.getName(), a]));
  const atk = anims.get(from), ride = anims.get(seat);
  if (!atk || !ride) return 0;
  anims.get(name)?.dispose();
  const buffer = root.listBuffers()[0];
  const out = doc.createAnimation(name);
  // riding pose: first value per channel
  const seatVal = new Map();
  for (const ch of ride.listChannels()) {
    const s = ch.getSampler(), size = ch.getTargetPath() === 'rotation' ? 4 : 3;
    seatVal.set(`${ch.getTargetNode().getName()}.${ch.getTargetPath()}`, s.getOutput().getArray().slice(0, size));
  }
  const samplers = new Map();
  let n = 0;
  for (const ch of atk.listChannels()) {
    const node = ch.getTargetNode(), p = ch.getTargetPath(), key = `${node.getName()}.${p}`;
    const src = ch.getSampler();
    let s;
    if (SEAT_BONES.test(node.getName()) && seatVal.has(key)) {
      // fixed in the riding pose, on the same time axis as the attack (two keys suffice)
      const t = src.getInput().getArray();
      const v = seatVal.get(key);
      s = doc.createAnimationSampler().setInterpolation('LINEAR')
        .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array([t[0], t[t.length - 1]])).setBuffer(buffer))
        .setOutput(doc.createAccessor().setType(v.length === 4 ? 'VEC4' : 'VEC3').setArray(new Float32Array([...v, ...v])).setBuffer(buffer));
    } else {
      s = samplers.get(src);
      if (!s) {
        s = doc.createAnimationSampler().setInterpolation(src.getInterpolation())
          .setInput(doc.createAccessor().setType('SCALAR').setArray(src.getInput().getArray().slice()).setBuffer(buffer))
          .setOutput(doc.createAccessor().setType(src.getOutput().getType()).setArray(src.getOutput().getArray().slice()).setNormalized(src.getOutput().getNormalized()).setBuffer(buffer));
        samplers.set(src, s);
      }
    }
    out.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(p).setSampler(s));
    n++;
  }
  dampTwist(doc, out, seatVal);
  return n;
}

/** Yaw angle of a world rotation (facing +z around the vertical axis). */
const yawOf = (q) => { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };

/**
 * Damp the chest rotation around the vertical axis: per keyframe measure the rotation of the chest (SPINE[last]) relative to the
 * riding pose and rotate it back by (1 − KEEP_TWIST) at the lowest spine bone (SPINE[0]). Needs identical time axes of the
 * spine channels (Meshy clips: yes); otherwise the clip stays unchanged.
 */
function dampTwist(doc, anim, seatVal) {
  const ch = (name) => anim.listChannels().find((c) => c.getTargetNode().getName() === name && c.getTargetPath() === 'rotation');
  const chans = SPINE.map(ch), hips = ch('Hips');
  if (chans.some((c) => !c) || !hips) return;
  const nKeys = chans[0].getSampler().getInput().getCount();
  if (chans.some((c) => c.getSampler().getInput().getCount() !== nKeys)) return;
  // world rotation above the hips (armature etc.)
  const top = new THREE.Quaternion();
  for (let p = hips.getTargetNode().getParentNode(); p; p = p.getParentNode()) top.premultiply(new THREE.Quaternion().fromArray(p.getRotation()));
  const hipsQ = new THREE.Quaternion().fromArray(seatVal.get('Hips.rotation'));
  const parentW = top.clone().multiply(hipsQ); // parent of the lowest spine bone
  const chest = (qs) => qs.reduce((acc, q) => acc.multiply(q), parentW.clone());
  const ref = yawOf(chest(SPINE.map((b) => new THREE.Quaternion().fromArray(seatVal.get(`${b}.rotation`) ?? [0, 0, 0, 1]))));
  const outs = chans.map((c) => c.getSampler().getOutput().getArray());
  const low = Float32Array.from(outs[0]);
  const inv = parentW.clone().invert();
  for (let k = 0; k < nKeys; k++) {
    const qs = outs.map((a) => new THREE.Quaternion().fromArray(a, k * 4));
    let e = yawOf(chest(qs)) - ref;
    e = Math.atan2(Math.sin(e), Math.cos(e));
    const fix = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -e * (1 - KEEP_TWIST));
    // local' = parent⁻¹ · fix · parent · local
    inv.clone().multiply(fix).multiply(parentW).multiply(qs[0]).toArray(low, k * 4);
  }
  const s0 = chans[0].getSampler();
  const s = doc.createAnimationSampler().setInterpolation(s0.getInterpolation()).setInput(s0.getInput())
    .setOutput(doc.createAccessor().setType('VEC4').setArray(low).setBuffer(doc.getRoot().listBuffers()[0]));
  anim.addSampler(s);
  chans[0].setSampler(s);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest.models).filter((k) => manifest.models[k].clips?.ride);
  for (const m of names) {
    const file = path.join(DIR, `${m}.lod1.glb`);
    const doc = await io.read(file);
    const n = addRideAttack(doc);
    await io.write(file, doc);
    console.log(`${m}: rideAttack with ${n} channels, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
}
